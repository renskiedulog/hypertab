// Shared by the /blocker page and script/background.js. Settings live in chrome.storage.local under "blocker".

export type BlockedSite = { entry: string; mode: "always" | "focus" };
export type FocusSchedule = { enabled: boolean; days: number[]; start: string; end: string }; // days: 0 = Sunday
export type BlockerSettings = { sites: BlockedSite[]; focus: FocusSchedule; ads: boolean };

export const DEFAULTS: BlockerSettings = {
  sites: [],
  focus: { enabled: false, days: [1, 2, 3, 4, 5], start: "09:00", end: "17:00" },
  ads: false,
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function inFocus(f: FocusSchedule, now = new Date()): boolean {
  if (!f.enabled) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const s = toMin(f.start);
  const e = toMin(f.end);
  const day = now.getDay();
  if (s <= e) return f.days.includes(day) && mins >= s && mins < e;
  // Overnight (e.g. 22:00–06:00): the evening belongs to today, the early morning to yesterday's schedule.
  return (mins >= s && f.days.includes(day)) || (mins < e && f.days.includes((day + 6) % 7));
}

// "17:00" -> "5:00 PM" in the user's locale
export const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// "https://www.Reddit.com/r/x/?a=1" -> "reddit.com/r/x"; null when it isn't a domain.
export function normalize(input: string): string | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^(\*\.|www\.)/, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[\x21-\x7e]*)?$/.test(s) ? s : null; // ASCII only: Chrome rejects non-ASCII urlFilters
}

// Same match as urlFilter(), for in-page (History API) navigations that never hit the network.
export function matchesUrl(entry: string, url: string): boolean {
  const { hostname, pathname, search } = new URL(url);
  const slash = entry.indexOf("/");
  const domain = slash < 0 ? entry : entry.slice(0, slash);
  const path = slash < 0 ? "" : entry.slice(slash);
  return (hostname === domain || hostname.endsWith("." + domain)) && (pathname + search).startsWith(path);
}

// Domain-only entries end with "^" so "reddit.com" doesn't also match "reddit.community".
export const urlFilter = (entry: string) => `||${entry}${entry.includes("/") ? "" : "^"}`;
