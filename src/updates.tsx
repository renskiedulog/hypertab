import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, Plus, RefreshCw, Search, X } from "lucide-react";
import { PageShell } from "./components/custom/page-shell";
import { cn } from "./lib/utils";
import { api, hasApiKey, useCached, WATCHLIST_PATH, type MediaResult, type WatchItem } from "./lib/api-bank";

type Kind = "anime" | "manga";
type Filter = "all" | Kind;

const unit = (item: { type: Kind }) => (item.type === "anime" ? "Ep" : "Ch");

const airing = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

// "in 3h", "in 2d"
const until = (iso: string) => {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins < 60) return mins <= 0 ? "airing now" : `in ${mins}m`;
  if (mins < 48 * 60) return `in ${Math.round(mins / 60)}h`;
  return `in ${Math.round(mins / 1440)}d`;
};

// "NOT_YET_RELEASED" -> "Not yet released"
const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

function Cover({ src, title, className }: { src: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false); // some cover hosts refuse hotlinks (403)
  return src && !failed ? (
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className={cn("object-cover bg-raised shrink-0", className)} />
  ) : (
    <div aria-hidden className={cn("bg-raised grid place-items-center font-head text-dim shrink-0", className)}>
      {title.charAt(0)}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 bg-ink/60 rounded-xl p-1 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-3.5 py-1.5 cursor-pointer transition-colors",
            value === o.value ? "bg-fg text-ink font-bold" : "text-dim hover:text-fg hover:bg-raised",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Updates() {
  const { data, error, mutate, refresh } = useCached<WatchItem[]>(WATCHLIST_PATH, 0); // always refetch on open: follows can change in api-bank too
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [type, setType] = useState<Kind>("anime");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchSeq = useRef(0);

  const watchlist = data ?? [];
  // Actions resolve later; read the newest list then, so two quick clicks don't undo each other.
  const listRef = useRef(watchlist);
  listRef.current = watchlist;
  const commit = (next: WatchItem[]) => {
    listRef.current = next;
    mutate(next);
  };
  const shown = watchlist.filter((w) => filter === "all" || w.type === filter);
  const releases = shown.filter((w) => w.unseen > 0);
  const following = [...shown].sort((a, b) => b.unseen - a.unseen || a.title.localeCompare(b.title));
  const comingUp = shown
    .filter((w) => w.nextAiringAt && new Date(w.nextAiringAt).getTime() > Date.now() - 3600000)
    .sort((a, b) => a.nextAiringAt!.localeCompare(b.nextAiringAt!));
  const count = (k: Kind) => watchlist.filter((w) => w.type === k).length;

  // Runs an API action with a per-item spinner; failures show in the header.
  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy((b) => new Set(b).add(key));
    try {
      await fn();
      setActionError(null);
    } catch (e) {
      setActionError((e as Error).message);
    }
    setBusy((b) => {
      const next = new Set(b);
      next.delete(key);
      return next;
    });
  };

  const replace = (item: WatchItem) => commit(listRef.current.map((w) => (w.id === item.id ? item : w)));

  const markSeen = (item: WatchItem) =>
    act(item.id, async () => replace(await api<WatchItem>(`${WATCHLIST_PATH}/${item.id}/seen`, { method: "POST" })));

  const unfollow = (item: WatchItem) =>
    act(item.id, async () => {
      await api(`${WATCHLIST_PATH}/${item.id}`, { method: "DELETE" });
      commit(listRef.current.filter((w) => w.id !== item.id));
    });

  const follow = (r: MediaResult) =>
    act(`${r.source}-${r.id}`, async () => {
      const body =
        r.type === "manga"
          ? { type: "manga", source: r.source, id: r.id }
          : r.source === "anilist"
            ? { type: "anime", anilistId: Number(r.id) }
            : { type: "anime", malId: Number(r.id) };
      const item = await api<WatchItem>(WATCHLIST_PATH, { method: "POST", body: JSON.stringify(body) });
      commit([...listRef.current, item]);
    });

  const checkNow = async () => {
    setChecking(true);
    try {
      await api(`${WATCHLIST_PATH}/check`, { method: "POST" });
      await refresh();
      setActionError(null);
    } catch (e) {
      setActionError((e as Error).message);
    }
    setChecking(false);
  };

  // Search as you type. Empty anime query = trending; manga needs a query (Asura / Mangakakalot search).
  useEffect(() => {
    if (!hasApiKey) return;
    const seq = ++searchSeq.current;
    const t = setTimeout(
      async () => {
        setSearching(true);
        setSearchError(null);
        try {
          const q = encodeURIComponent(query.trim());
          const found =
            type === "manga"
              ? q
                ? await api<MediaResult[]>(`media/v1/manga-sources/search?q=${q}&limit=20`)
                : []
              : q
                ? (await api<{ items: MediaResult[] }>(`media/v1/anime/search?q=${q}&limit=20`)).items
                : await api<MediaResult[]>("media/v1/trending?type=anime&limit=20");
          if (seq === searchSeq.current) setResults(found); // drop stale responses
        } catch (e) {
          if (seq === searchSeq.current) {
            setResults([]);
            setSearchError((e as Error).message);
          }
        }
        if (seq === searchSeq.current) setSearching(false);
      },
      query ? 400 : 0,
    );
    return () => clearTimeout(t);
  }, [query, type]);

  // "/" jumps to search, like most sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isFollowing = (r: MediaResult) => watchlist.some((w) => w.type === r.type && w.sourceId === r.id);
  const shownError = actionError ?? error;
  const loading = data === null && !error;
  const failed = data === null && !!error;

  return (
    <PageShell>
      <div className="h-full grid grid-cols-[minmax(0,1fr)_minmax(22rem,27rem)] gap-8">
        {/* Watchlist */}
        <section className="flex flex-col gap-6 min-h-0">
          <header className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <h1 className="font-head text-3xl tracking-tight">Updates</h1>
            <Segmented
              label="Show"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: `All ${watchlist.length}` },
                { value: "anime", label: `Anime ${count("anime")}` },
                { value: "manga", label: `Manga ${count("manga")}` },
              ]}
            />
            <button
              onClick={checkNow}
              disabled={checking || !hasApiKey}
              className="flex items-center gap-2 text-sm bg-raised hover:bg-line rounded-xl px-3.5 py-2 cursor-pointer disabled:opacity-50 disabled:cursor-default transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", checking && "animate-spin")} />
              {checking ? "Checking…" : "Check now"}
            </button>
            {shownError && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-ember">
                <AlertTriangle className="w-4 h-4 shrink-0" /> {shownError}
              </p>
            )}
          </header>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-8 pr-2 pb-4">
            {/* New releases */}
            <section aria-labelledby="releases-h">
              <h2 id="releases-h" className="text-lg font-extrabold mb-3">
                New releases <span className="text-dim font-medium">{releases.length}</span>
              </h2>
              {loading ? (
                <p className="text-dim">Loading your watchlist…</p>
              ) : failed ? (
                <p className="flex items-center gap-3 text-dim">
                  Couldn't load your watchlist.
                  <button
                    onClick={refresh}
                    disabled={!hasApiKey}
                    className="text-sm text-fg bg-raised hover:bg-line rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    Retry
                  </button>
                </p>
              ) : releases.length === 0 ? (
                <p className="text-dim">You're all caught up.</p>
              ) : (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(21rem,1fr))] gap-3">
                  {releases.map((item) => (
                    <li key={item.id} className="flex gap-4 bg-surface rounded-2xl p-3">
                      <Cover src={item.cover} title={item.title} className="w-20 h-28 rounded-xl" />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <p className="font-bold leading-snug line-clamp-2" title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-sm text-dim mt-1">
                          {unit(item)} {item.latest}
                          <span className="ml-2 rounded-md bg-ember text-ember-ink font-extrabold text-xs px-1.5 py-0.5">
                            +{item.unseen} new
                          </span>
                        </p>
                        <div className="flex gap-2 mt-auto pt-2">
                          {item.latestUrl && (
                            <a
                              href={item.latestUrl}
                              className="flex items-center gap-1.5 text-sm bg-raised hover:bg-line rounded-lg px-3 py-1.5 transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" /> Open {unit(item)} {item.latest}
                            </a>
                          )}
                          <button
                            onClick={() => markSeen(item)}
                            disabled={busy.has(item.id)}
                            className="flex items-center gap-1.5 text-sm bg-fg text-ink font-bold hover:bg-fg/85 rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-60 transition-colors"
                          >
                            {busy.has(item.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Mark seen
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Coming up */}
            {comingUp.length > 0 && (
              <section aria-labelledby="coming-h">
                <h2 id="coming-h" className="text-lg font-extrabold mb-3">
                  Coming up
                </h2>
                <ul className="flex gap-3 overflow-x-auto pb-1">
                  {comingUp.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 bg-surface rounded-xl pl-2 pr-4 py-2 shrink-0">
                      <Cover src={item.cover} title={item.title} className="w-8 h-11 rounded-md" />
                      <div>
                        <p className="text-sm font-bold max-w-56 truncate" title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-xs text-dim">
                          Ep {item.nextEpisode} · {airing(item.nextAiringAt!)} ·{" "}
                          <span className="text-ember font-bold">{until(item.nextAiringAt!)}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Following */}
            <section aria-labelledby="following-h">
              <h2 id="following-h" className="text-lg font-extrabold mb-3">
                Following <span className="text-dim font-medium">{shown.length}</span>
              </h2>
              {failed ? null : !loading && shown.length === 0 ? (
                <p className="text-dim">Nothing followed yet. Search on the right to add something.</p>
              ) : (
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-4 gap-y-6">
                  {following.map((item) => {
                    const pct = item.latest ? Math.min(100, (item.lastSeen / item.latest) * 100) : null;
                    return (
                      <li key={item.id} className="group relative">
                        <div className="relative">
                        <a href={item.sourceUrl ?? undefined} className="block rounded-xl" title={item.title}>
                          <Cover src={item.cover} title={item.title} className="w-full aspect-[2/3] rounded-xl" />
                        </a>
                        {item.unseen > 0 && (
                          <span className="absolute top-2 left-2 rounded-md bg-ember text-ember-ink font-extrabold text-xs px-1.5 py-0.5 shadow-md">
                            +{item.unseen}
                          </span>
                        )}
                        {item.checkError && (
                          <span
                            title={`Update check failed: ${item.checkError}`}
                            className="absolute top-2 right-2 rounded-md bg-ink/85 p-1"
                          >
                            <AlertTriangle className="w-4 h-4 text-ember" />
                          </span>
                        )}
                        <button
                          onClick={() => unfollow(item)}
                          disabled={busy.has(item.id)}
                          aria-label={`Unfollow ${item.title}`}
                          className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold bg-ink/85 hover:bg-ink rounded-lg px-2 py-1 cursor-pointer opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 disabled:opacity-100 transition-opacity"
                        >
                          {busy.has(item.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          Unfollow
                        </button>
                        </div>
                        <p className="mt-2 text-sm font-bold leading-snug line-clamp-2" title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-xs text-dim mt-0.5">
                          {unit(item)} {item.lastSeen}
                          {item.latest != null && ` / ${item.latest}`}
                          {item.nextAiringAt && ` · next ${airing(item.nextAiringAt)}`}
                        </p>
                        {pct != null && (
                          <div className="mt-1.5 h-1 rounded-full bg-raised overflow-hidden" aria-hidden>
                            <div
                              className={cn("h-full rounded-full", item.unseen > 0 ? "bg-ember" : "bg-dim/60")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        </section>

        {/* Search & follow */}
        <aside aria-label="Find and follow" className="bg-surface rounded-3xl p-5 flex flex-col gap-4 min-h-0">
          <label className="flex items-center gap-3 bg-ink/60 rounded-xl px-4 h-12 focus-within:ring-2 focus-within:ring-ember">
            <Search className="w-5 h-5 text-dim shrink-0" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={type === "anime" ? "Search anime…" : "Search Asura / Mangakakalot…"}
              aria-label="Search titles"
              className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-dim/70 [&:focus-visible]:outline-none"
            />
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin text-dim" />
            ) : (
              <kbd className="text-xs text-dim border border-line rounded px-1.5 py-0.5 font-ui">/</kbd>
            )}
          </label>
          <Segmented
            label="Search type"
            value={type}
            onChange={(t) => {
              setType(t);
              setResults([]); // don't show anime results under the Manga tab while the new search runs
            }}
            options={[
              { value: "anime", label: "Anime" },
              { value: "manga", label: "Manga / Manhwa" },
            ]}
          />
          <h2 className="text-sm font-extrabold text-dim">
            {query.trim() ? `Results for “${query.trim()}”` : type === "anime" ? "Trending now" : "Search to find manga"}
          </h2>
          <ul className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 -mx-2 pr-1">
            {searchError && (
              <li role="alert" className="px-2 text-sm text-ember">
                Search failed: {searchError}
              </li>
            )}
            {!searching && !searchError && query.trim() && results.length === 0 && (
              <li className="px-2 text-sm text-dim">No matches. Try another spelling.</li>
            )}
            {results.map((r) => {
              const key = `${r.source}-${r.id}`;
              const followed = isFollowing(r);
              return (
                <li key={key} className="flex items-center gap-3 rounded-xl p-2 hover:bg-raised/60">
                  <Cover src={r.cover} title={r.title} className="w-12 h-[4.25rem] rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-snug line-clamp-2" title={r.title}>
                      {r.title}
                    </p>
                    <p className="text-xs text-dim mt-0.5">
                      {[r.year, r.status && humanize(r.status), r.episodes && `${r.episodes} eps`, r.chapters && `${r.chapters} ch`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {followed ? (
                    <span className="flex items-center gap-1 text-xs text-go font-bold px-2">
                      <Check className="w-4 h-4" /> Following
                    </span>
                  ) : (
                    <button
                      onClick={() => follow(r)}
                      disabled={busy.has(key) || !hasApiKey}
                      className="flex items-center gap-1 text-xs font-bold bg-raised hover:bg-ember hover:text-ember-ink rounded-lg px-2.5 py-1.5 cursor-pointer disabled:opacity-60 transition-colors"
                    >
                      {busy.has(key) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Follow
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </PageShell>
  );
}
