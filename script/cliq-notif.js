let lastCount = -1;

function getCount() {
  const match = document.title.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

function send(count) {
  chrome.runtime.sendMessage({ type: "NOTIF_COUNT", source: "cliq", count }).catch(() => {});
}

const observer = new MutationObserver(() => {
  const count = getCount();
  if (count !== lastCount) {
    lastCount = count;
    send(count);
  }
});

observer.observe(document.querySelector("title") ?? document.head, { subtree: true, characterData: true, childList: true });

send(getCount());
