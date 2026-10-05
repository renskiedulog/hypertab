import { useEffect, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Plus, RefreshCw, Search, X } from "lucide-react";
import { currentBackground } from "./lib/backgrounds";
import { api, hasApiKey, useCached, WATCHLIST_PATH, type MediaResult, type WatchItem } from "./lib/api-bank";

const unit = (item: { type: "anime" | "manga" }) => (item.type === "anime" ? "Ep" : "Ch");

const airing = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

function Cover({ src }: { src: string | null }) {
  return src ? (
    <img src={src} alt="" className="w-10 h-14 rounded object-cover shrink-0" />
  ) : (
    <div className="w-10 h-14 rounded bg-white/10 shrink-0" />
  );
}

export default function Updates() {
  const { data, error, mutate, refresh } = useCached<WatchItem[]>(WATCHLIST_PATH, 0); // always refetch on open: follows can change in api-bank too
  const [actionError, setActionError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [type, setType] = useState<"anime" | "manga">("anime");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MediaResult[]>([]);
  const [searching, setSearching] = useState(false);
  const watchlist = data ?? [];
  const releases = watchlist.filter((w) => w.unseen > 0);

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
      setActionError(null);
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  const replace = (item: WatchItem) => mutate(watchlist.map((w) => (w.id === item.id ? item : w)));

  const markSeen = (item: WatchItem) =>
    act(async () => replace(await api<WatchItem>(`${WATCHLIST_PATH}/${item.id}/seen`, { method: "POST" })));

  const unfollow = (item: WatchItem) =>
    act(async () => {
      await api(`${WATCHLIST_PATH}/${item.id}`, { method: "DELETE" });
      mutate(watchlist.filter((w) => w.id !== item.id));
    });

  const checkNow = async () => {
    setChecking(true);
    await act(async () => {
      await api(`${WATCHLIST_PATH}/check`, { method: "POST" });
      await refresh();
    });
    setChecking(false);
  };

  const follow = (r: MediaResult) =>
    act(async () => {
      const body =
        r.type === "manga"
          ? { type: "manga", source: r.source, id: r.id }
          : r.source === "anilist"
            ? { type: "anime", anilistId: Number(r.id) }
            : { type: "anime", malId: Number(r.id) };
      const item = await api<WatchItem>(WATCHLIST_PATH, { method: "POST", body: JSON.stringify(body) });
      mutate([...watchlist, item]);
    });

  const search = async (q: string) => {
    setSearching(true);
    await act(async () => {
      const t = encodeURIComponent(q.trim());
      if (type === "manga") setResults(t ? await api<MediaResult[]>(`media/v1/manga-sources/search?q=${t}&limit=12`) : []);
      else if (t) setResults((await api<{ items: MediaResult[] }>(`media/v1/anime/search?q=${t}&limit=12`)).items);
      else setResults(await api<MediaResult[]>("media/v1/trending?type=anime&limit=12"));
    });
    setSearching(false);
  };

  // Trending anime as the default suggestions; manga/manhwa follows need an Asura/Mangakakalot search.
  useEffect(() => {
    setResults([]);
    if (hasApiKey) search("");
  }, [type]);

  const following = (r: MediaResult) => watchlist.some((w) => w.type === r.type && w.sourceId === r.id);
  const shownError = actionError ?? error;

  return (
    <main
      className="h-screen w-screen bg-cover bg-center text-white overflow-hidden"
      style={{
        backgroundImage: `
          linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0.3)),
          url('${currentBackground}')
        `,
      }}
    >
      <div className="h-full grid grid-cols-[1fr_minmax(0,24rem)] gap-6 pl-24 pr-6 py-6">
        {/* Releases + watchlist */}
        <section className="flex flex-col gap-4 min-h-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Updates</h1>
            <button
              onClick={checkNow}
              disabled={checking || !hasApiKey}
              className="flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} />
              Check now
            </button>
            {shownError && <span className="text-xs text-red-200">{shownError}</span>}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-1">
            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4">
              <h2 className="text-sm font-semibold opacity-80 mb-3">New releases ({releases.length})</h2>
              {releases.length === 0 ? (
                <p className="text-sm opacity-60">You're all caught up.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {releases.map((item) => (
                    <li key={item.id} className="flex items-center gap-3">
                      <Cover src={item.cover} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{item.title}</p>
                        <p className="text-xs opacity-70">
                          {unit(item)} {item.latest} · {item.unseen} new
                        </p>
                      </div>
                      {item.latestUrl && (
                        <a
                          href={item.latestUrl}
                          className="flex items-center gap-1 text-xs bg-white/15 hover:bg-white/25 rounded-lg px-2.5 py-1.5"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </a>
                      )}
                      <button
                        onClick={() => markSeen(item)}
                        className="flex items-center gap-1 text-xs bg-white text-black hover:bg-white/80 rounded-lg px-2.5 py-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Seen
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-black/30 backdrop-blur-sm rounded-xl p-4">
              <h2 className="text-sm font-semibold opacity-80 mb-3">Following ({watchlist.length})</h2>
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-2">
                {watchlist.map((item) => (
                  <li key={item.id} className="group flex items-center gap-3 rounded-lg p-1.5 hover:bg-white/10">
                    <Cover src={item.cover} />
                    <div className="flex-1 min-w-0">
                      <a href={item.sourceUrl ?? undefined} className="block text-sm font-semibold truncate hover:underline">
                        {item.title}
                      </a>
                      <p className="text-xs opacity-70">
                        Seen {unit(item)} {item.lastSeen}
                        {item.latest != null && ` / ${item.latest}`}
                        {item.nextAiringAt && ` · Ep ${item.nextEpisode} ${airing(item.nextAiringAt)}`}
                      </p>
                    </div>
                    {item.checkError && (
                      <span title={item.checkError}>
                        <AlertTriangle className="w-4 h-4 text-amber-300" />
                      </span>
                    )}
                    <button
                      onClick={() => unfollow(item)}
                      title="Unfollow"
                      className="opacity-0 group-hover:opacity-100 text-white/60 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Search & follow */}
        <section className="bg-black/30 backdrop-blur-sm rounded-xl p-4 flex flex-col gap-3 min-h-0">
          <div className="flex gap-1 bg-white/10 rounded-lg p-1 text-sm">
            {(["anime", "manga"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-md py-1 cursor-pointer ${type === t ? "bg-white text-black" : "hover:bg-white/10"}`}
              >
                {t === "anime" ? "Anime" : "Manga / Manhwa"}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search(query);
            }}
            className="flex items-center gap-2 border-b border-white/30 pb-1"
          >
            <Search className="w-4 h-4 opacity-60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={type === "anime" ? "Search anime (empty = trending)" : "Search Asura / Mangakakalot"}
              className="flex-1 bg-transparent outline-none text-sm placeholder-white/40"
            />
          </form>
          <ul className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
            {searching && <li className="text-sm opacity-60">Searching…</li>}
            {results.map((r) => (
              <li key={`${r.source}-${r.id}`} className="flex items-center gap-3">
                <Cover src={r.cover} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold line-clamp-2">{r.title}</p>
                  <p className="text-xs opacity-60">
                    {[r.year, r.status, r.episodes && `${r.episodes} eps`, r.chapters && `${r.chapters} ch`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {following(r) ? (
                  <Check className="w-4 h-4 opacity-60" />
                ) : (
                  <button
                    onClick={() => follow(r)}
                    title="Follow"
                    className="bg-white/15 hover:bg-white/25 rounded-lg p-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
