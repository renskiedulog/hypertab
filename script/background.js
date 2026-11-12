import { DEFAULTS, inFocus, matchesUrl, urlFilter } from "../src/lib/blocker";

let latestInfo = null;
let youtubeTabId = null;
const notifCounts = { facebook: 0, gmail: 0, cliq: 0 };

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "YOUTUBE_INFO") {
    latestInfo = msg.data;
    if (sender?.tab?.id) youtubeTabId = sender.tab.id;
  }

  if (msg.type === "REQUEST_INFO") {
    sendResponse(latestInfo);
  }

  if (msg.type === "NOTIF_COUNT" && msg.source in notifCounts) {
    notifCounts[msg.source] = msg.count;
    chrome.runtime.sendMessage({ type: "NOTIF_UPDATE", source: msg.source, count: msg.count }).catch(() => {});
  }

  if (msg.type === "REQUEST_NOTIF_COUNTS") {
    sendResponse({ ...notifCounts });
  }

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === youtubeTabId) {
    latestInfo = null;
    youtubeTabId = null;
    chrome.runtime.sendMessage({ type: "YOUTUBE_INFO_CLEARED" }).catch(() => {});
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (
    tabId === youtubeTabId &&
    changeInfo.url &&
    !changeInfo.url.includes("youtube.com/watch")
  ) {
    latestInfo = null;
    youtubeTabId = null;
    chrome.runtime.sendMessage({ type: "YOUTUBE_INFO_CLEARED" }).catch(() => {});
  }
});

// --- Blocker: rebuild redirect rules from settings; the 1-minute alarm flips focus-only sites on/off ---
async function activeSites() {
  const { blocker } = await chrome.storage.local.get("blocker");
  const settings = { ...DEFAULTS, ...blocker };
  const focus = inFocus(settings.focus);
  return { settings, active: settings.sites.filter((s) => s.mode === "always" || focus) };
}

const blockedUrl = (entry) => chrome.runtime.getURL(`index.html#/blocked?site=${encodeURIComponent(entry)}`);

async function syncRules() {
  const { settings, active } = await activeSites();
  // Rulesets first, so a rejected dynamic rule can't also freeze the ad toggle.
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    settings.ads ? { enableRulesetIds: ["ads"] } : { disableRulesetIds: ["ads"] },
  );

  const old = await chrome.declarativeNetRequest.getDynamicRules();

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.map((r) => r.id),
    addRules: active.map((s, i) => ({
      id: i + 1,
      priority: 2,
      action: {
        type: "redirect",
        redirect: { url: blockedUrl(s.entry) },
      },
      condition: { urlFilter: urlFilter(s.entry), resourceTypes: ["main_frame"] },
    })),
  });
}

// SPA sites (YouTube, Reddit, X) change pages via the History API, which DNR never sees.
chrome.webNavigation.onHistoryStateUpdated.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0) return;
  const { active } = await activeSites();
  const hit = active.find((s) => matchesUrl(s.entry, url));
  if (hit) chrome.tabs.update(tabId, { url: blockedUrl(hit.entry) });
});

// Serialized so an alarm and a settings change can't race on the same rule ids.
let syncing = Promise.resolve();
const sync = () => (syncing = syncing.then(syncRules).catch((e) => console.error("blocker sync", e)));

// Only create when missing: re-creating on every worker restart would keep pushing the first tick back.
chrome.alarms.get("blocker").then((a) => a || chrome.alarms.create("blocker", { periodInMinutes: 1 }));
chrome.alarms.onAlarm.addListener((a) => a.name === "blocker" && sync());
chrome.storage.onChanged.addListener((changes, area) => area === "local" && "blocker" in changes && sync());
chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);
