console.log("YouTube content script injected!");

chrome.runtime.sendMessage({ type: "PING", text: "Hello from YouTube!" });
