import { useEffect, useState } from "react";
import { Globe, Plus, ShieldCheck, ShieldOff, X } from "lucide-react";
import { PageShell } from "./components/custom/page-shell";
import { cn } from "./lib/utils";
import { DEFAULTS, fmtTime, inFocus, normalize, type BlockedSite, type BlockerSettings } from "./lib/blocker";

const hasChrome = typeof chrome !== "undefined" && !!chrome.storage;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const SUGGESTIONS = ["facebook.com", "x.com", "instagram.com", "tiktok.com", "reddit.com", "youtube.com/shorts"];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Blocked minutes per weekday as [from, to) ranges; overnight schedules spill into the next day.
function weekRanges(f: BlockerSettings["focus"]) {
  const out: Record<number, [number, number][]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  const s = toMin(f.start);
  const e = toMin(f.end);
  for (const d of f.days) {
    if (s <= e) out[d].push([s, e]);
    else {
      out[d].push([s, 1440]);
      out[(d + 1) % 7].push([0, e]);
    }
  }
  return out;
}

const favicon = (entry: string) =>
  chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(`https://${entry.split("/")[0]}`)}&size=32`);

function Favicon({ entry }: { entry: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span aria-hidden className="w-8 h-8 rounded-lg bg-raised grid place-items-center font-head text-sm text-dim shrink-0">
      {entry.charAt(0).toUpperCase()}
    </span>
  ) : (
    <img src={favicon(entry)} alt="" onError={() => setFailed(true)} className="w-8 h-8 rounded-lg bg-raised p-1.5 shrink-0" />
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn("relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0", on ? "bg-ember" : "bg-line")}
    >
      <span
        className={cn(
          "absolute top-1 left-1 w-4 h-4 rounded-full bg-fg transition-transform duration-200 ease-out",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}

function ModePicker({
  value,
  onChange,
  label,
  size = "md",
}: {
  value: BlockedSite["mode"];
  onChange: (m: BlockedSite["mode"]) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 bg-ink/60 rounded-xl p-1 shrink-0">
      {(["always", "focus"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "rounded-lg cursor-pointer transition-colors",
            size === "sm" ? "text-xs px-2.5 py-1" : "text-sm px-3.5 h-10",
            value === m ? "bg-fg text-ink font-bold" : "text-dim hover:text-fg hover:bg-raised",
          )}
        >
          {m === "always" ? "Always" : "Focus only"}
        </button>
      ))}
    </div>
  );
}

export default function Blocker() {
  const [settings, setSettings] = useState<BlockerSettings | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<BlockedSite["mode"]>("always");
  const [inputError, setInputError] = useState<string | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!hasChrome) return;
    chrome.storage.local.get("blocker").then((r: { blocker?: Partial<BlockerSettings> }) => setSettings({ ...DEFAULTS, ...r.blocker }));
    // Keep in sync with edits from other open tabs, so a stale tab can't overwrite them.
    const onChange = (c: { blocker?: { newValue?: Partial<BlockerSettings> } }, area: string) =>
      area === "local" && c.blocker && setSettings({ ...DEFAULTS, ...c.blocker.newValue });
    chrome.storage.onChanged.addListener(onChange);
    // Re-render each minute so "blocked now" and the week-strip marker stay current.
    const timer = setInterval(() => tick((n) => n + 1), 60000);
    return () => {
      chrome.storage.onChanged.removeListener(onChange);
      clearInterval(timer);
    };
  }, []);

  // The background worker listens for this write and rebuilds the block rules.
  const save = (next: BlockerSettings) => {
    setSettings(next);
    chrome.storage.local.set({ blocker: next });
  };

  if (!settings) {
    return (
      <PageShell className="grid place-items-center">
        <p className="text-dim">{hasChrome ? "Loading…" : "The blocker only works inside the extension."}</p>
      </PageShell>
    );
  }

  const { sites, focus, ads } = settings;
  const focusNow = inFocus(focus);
  const blockedNow = sites.filter((s) => s.mode === "always" || focusNow).length;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const ranges = weekRanges(focus);
  const suggestions = SUGGESTIONS.filter((s) => !sites.some((x) => x.entry === s));

  const addEntry = (raw: string) => {
    const entry = normalize(raw);
    if (!entry) return setInputError("Enter a domain like reddit.com or a path like youtube.com/shorts");
    if (sites.some((s) => s.entry === entry)) return setInputError(`${entry} is already on the list`);
    save({ ...settings, sites: [{ entry, mode }, ...sites] });
    setInput("");
    setInputError(null);
  };

  const updateSite = (entry: string, patch: Partial<BlockedSite> | null) =>
    save({
      ...settings,
      sites: patch ? sites.map((s) => (s.entry === entry ? { ...s, ...patch } : s)) : sites.filter((s) => s.entry !== entry),
    });

  const setFocus = (patch: Partial<BlockerSettings["focus"]>) => save({ ...settings, focus: { ...focus, ...patch } });

  const toggleDay = (d: number) =>
    setFocus({ days: focus.days.includes(d) ? focus.days.filter((x) => x !== d) : [...focus.days, d] });

  const status = focusNow
    ? `Focus is on until ${fmtTime(focus.end)}`
    : !focus.enabled
      ? "Focus schedule is off"
      : focus.days.length
        ? `Focus runs ${fmtTime(focus.start)} – ${fmtTime(focus.end)}`
        : "Focus is on, but no days are picked";

  return (
    <PageShell>
      <div className="h-full grid grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] gap-8">
        <section className="flex flex-col gap-6 min-h-0">
          <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <h1 className="font-head text-3xl tracking-tight">Blocker</h1>
            <p
              role="status"
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm",
                blockedNow ? "bg-ember/15 text-ember" : "bg-raised text-dim",
              )}
            >
              {blockedNow ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
              <span>
                <b className="font-extrabold">
                  {blockedNow} {blockedNow === 1 ? "site" : "sites"} blocked now
                </b>
                <span className="text-dim"> · {status}</span>
              </span>
            </p>
          </header>

          <div className="flex-1 min-h-0 flex flex-col bg-surface rounded-3xl p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addEntry(input);
              }}
              className="flex flex-wrap items-center gap-3"
            >
              <label className="flex-1 min-w-64 flex items-center gap-3 bg-ink/60 rounded-xl px-4 h-12 focus-within:ring-2 focus-within:ring-ember">
                <Globe className="w-5 h-5 text-dim shrink-0" />
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setInputError(null);
                  }}
                  placeholder="Add a site, e.g. reddit.com…"
                  aria-label="Site to block"
                  aria-invalid={!!inputError}
                  aria-describedby="site-error"
                  className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-dim/70 [&:focus-visible]:outline-none"
                />
              </label>
              <ModePicker value={mode} onChange={setMode} label="When to block" />
              <button className="flex items-center gap-2 h-12 bg-ember text-ember-ink font-extrabold hover:bg-ember/85 rounded-xl px-5 cursor-pointer transition-colors">
                <Plus className="w-5 h-5" /> Block
              </button>
            </form>
            <p id="site-error" role="alert" className="text-sm text-ember min-h-5 mt-2">
              {inputError}
            </p>

            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-sm text-dim mr-1">Quick add</span>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => addEntry(s)}
                    className="flex items-center gap-1.5 text-sm bg-raised hover:bg-line rounded-lg pl-1.5 pr-3 py-1 cursor-pointer transition-colors"
                  >
                    <img src={favicon(s)} alt="" className="w-4 h-4" onError={(e) => (e.currentTarget.style.display = "none")} />
                    {s}
                  </button>
                ))}
              </div>
            )}

            <h2 className="text-lg font-extrabold mt-6 mb-2">
              Blocked sites <span className="text-dim font-medium">{sites.length}</span>
            </h2>

            {sites.length === 0 ? (
              <p className="text-dim">Nothing blocked yet. Add a site above; its subdomains are blocked too.</p>
            ) : (
              <div role="table" aria-label="Blocked sites" className="flex-1 min-h-0 flex flex-col">
                <div
                  role="row"
                  className="grid grid-cols-[minmax(0,1fr)_auto_7rem_2.5rem] gap-4 px-3 pb-2 text-xs text-dim border-b border-line"
                >
                  <span role="columnheader">Site</span>
                  <span role="columnheader">When</span>
                  <span role="columnheader">Right now</span>
                  <span role="columnheader" className="sr-only">
                    Remove
                  </span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto pt-1">
                  {sites.map((s) => {
                    const live = s.mode === "always" || focusNow;
                    return (
                      <div
                        role="row"
                        key={s.entry}
                        className="grid grid-cols-[minmax(0,1fr)_auto_7rem_2.5rem] gap-4 items-center px-3 py-2 rounded-xl hover:bg-raised/50"
                      >
                        <span role="cell" className="flex items-center gap-3 min-w-0">
                          <Favicon entry={s.entry} />
                          <span className="truncate font-bold" title={s.entry}>
                            {s.entry}
                          </span>
                        </span>
                        <span role="cell">
                          <ModePicker
                            size="sm"
                            value={s.mode}
                            onChange={(m) => updateSite(s.entry, { mode: m })}
                            label={`When to block ${s.entry}`}
                          />
                        </span>
                        <span
                          role="cell"
                          className={cn("flex items-center gap-2 text-sm", live ? "text-ember font-bold" : "text-dim")}
                        >
                          <span className={cn("w-2 h-2 rounded-full", live ? "bg-ember" : "bg-dim/50")} />
                          {live ? "Blocked" : "Allowed"}
                        </span>
                        <span role="cell">
                          <button
                            onClick={() => updateSite(s.entry, null)}
                            aria-label={`Unblock ${s.entry}`}
                            title="Unblock"
                            className="grid place-items-center w-9 h-9 rounded-lg text-dim hover:text-fg hover:bg-line cursor-pointer transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-4 min-h-0 overflow-y-auto pt-[3.75rem]">
          {/* Focus schedule */}
          <section aria-labelledby="focus-h" className="bg-surface rounded-3xl p-5 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="focus-h" className="text-lg font-extrabold">
                  Focus schedule
                </h2>
                <p className="text-sm text-dim">“Focus only” sites are blocked during these hours.</p>
              </div>
              <Toggle on={focus.enabled} onClick={() => setFocus({ enabled: !focus.enabled })} label="Focus schedule" />
            </div>

            <div className={cn("flex flex-col gap-5 transition-opacity", !focus.enabled && "opacity-50")}>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={focus.start}
                  onChange={(e) => e.target.value && setFocus({ start: e.target.value })}
                  aria-label="Focus starts"
                  className="flex-1 min-w-0 bg-ink/60 rounded-xl px-3 h-11 outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-ember"
                />
                <span className="text-dim text-sm">to</span>
                <input
                  type="time"
                  value={focus.end}
                  onChange={(e) => e.target.value && setFocus({ end: e.target.value })}
                  aria-label="Focus ends"
                  className="flex-1 min-w-0 bg-ink/60 rounded-xl px-3 h-11 outline-none [color-scheme:dark] focus-visible:ring-2 focus-visible:ring-ember"
                />
              </div>

              {/* Week strip: one row per day, filled where focus blocks. Click a day to switch it on/off. */}
              <div className="flex flex-col gap-1.5">
                {WEEK.map((d) => {
                  const on = focus.days.includes(d);
                  const today = d === now.getDay();
                  return (
                    <div key={d} className="flex items-center gap-3">
                      <button
                        onClick={() => toggleDay(d)}
                        aria-pressed={on}
                        aria-label={`Focus on ${DAYS[d]}`}
                        className={cn(
                          "w-12 text-left text-sm rounded-md px-1.5 py-0.5 cursor-pointer transition-colors",
                          on ? "text-fg font-bold" : "text-dim/70 line-through hover:text-dim",
                          today && "bg-raised",
                        )}
                      >
                        {DAYS[d]}
                      </button>
                      <div className="relative flex-1 h-3 rounded-full bg-ink/60 overflow-hidden" aria-hidden>
                        {ranges[d].map(([a, b], i) => (
                          <span
                            key={i}
                            className="absolute inset-y-0 bg-ember/80"
                            style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }}
                          />
                        ))}
                        {today && <span className="absolute inset-y-0 w-0.5 bg-fg" style={{ left: `${(nowMin / 1440) * 100}%` }} />}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between pl-15 text-[0.7rem] text-dim" aria-hidden>
                  <span>12 AM</span>
                  <span>6 AM</span>
                  <span>12 PM</span>
                  <span>6 PM</span>
                  <span>12 AM</span>
                </div>
              </div>
            </div>
          </section>

          {/* Ads */}
          <section aria-labelledby="ads-h" className="bg-surface rounded-3xl p-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="ads-h" className="text-lg font-extrabold">
                Ad blocking
              </h2>
              <p className="text-sm text-dim">
                Stops requests to ~43k known ad servers (EasyList). Empty ad boxes may still show.
              </p>
            </div>
            <Toggle on={ads} onClick={() => save({ ...settings, ads: !ads })} label="Ad blocking" />
          </section>
        </aside>
      </div>
    </PageShell>
  );
}
