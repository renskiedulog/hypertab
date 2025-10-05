console.log(chrome.runtime.onMessage);
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("asdsa");
  if (msg.type === "PING") {
    console.log("Background received PING");
    sendResponse({ type: "PONG", text: "Hello from background" });
  }
  // return true allows async sendResponse
  return true;
});
