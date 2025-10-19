function getVideoInfo() {
  const video = document.querySelector("video");
  if (!video) return null;

  const title =
    document.querySelector("h1.title")?.textContent?.trim() || document.title;

  let volume = video.volume * 100;

  const volumeSlider = document.querySelector(".ytp-volume-panel");
  if (volumeSlider) {
    const ariaText = volumeSlider.getAttribute("aria-valuetext");
    if (ariaText) {
      if (ariaText.toLowerCase().includes("muted")) {
        volume = 0;
      } else {
        const match = ariaText.match(/(\d+)%/);
        if (match) volume = parseFloat(match[1]);
      }
    }
  }

  return {
    title,
    currentTime: video.currentTime,
    duration: video.duration,
    paused: video.paused,
    volume, // 0 if muted
  };
}

let lastSent = null;

setInterval(() => {
  const info = getVideoInfo();

  if (!info) {
    if (lastSent !== "cleared") {
      chrome.runtime.sendMessage({ type: "YOUTUBE_INFO", data: null });
      lastSent = "cleared";
    }
    return;
  }

  if (JSON.stringify(info) !== JSON.stringify(lastSent)) {
    chrome.runtime.sendMessage({ type: "YOUTUBE_INFO", data: info });
    lastSent = info;
  }
}, 1000);
