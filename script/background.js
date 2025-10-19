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
