let latestInfo = null;
let youtubeTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "YOUTUBE_INFO") {
    latestInfo = msg.data;

    if (sender?.tab?.id) {
      youtubeTabId = sender.tab.id;
    }
  }

  if (msg.type === "REQUEST_INFO") {
    sendResponse(latestInfo);
  }

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === youtubeTabId) {
    latestInfo = null;
    youtubeTabId = null;
    chrome.runtime.sendMessage({ type: "YOUTUBE_INFO_CLEARED" });
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
    chrome.runtime.sendMessage({ type: "YOUTUBE_INFO_CLEARED" });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkUpdates", {
    periodInMinutes: 240,
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "checkUpdates") return;

  const { monitoredItems = [] } =
    await chrome.storage.local.get("monitoredItems");

  for (const item of monitoredItems) {
    try {
      const res = await fetch(item.url);
      const html = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const element = doc.querySelector(item.selector);
      const latest = element?.textContent?.trim();

      if (!latest) continue;

      if (latest !== item.lastContent) {
        item.lastContent = latest;

        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon128.png",
          title: `Update: ${item.name || item.url}`,
          message: latest,
        });
      }
    } catch (err) {
      console.error("Scrape failed:", item.url, err);
    }
  }

  await chrome.storage.local.set({ monitoredItems });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "FETCH_HTML" && msg.url) {
    fetch(msg.url)
      .then((res) => res.text())
      .then((html) => sendResponse({ html }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }
});
