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
