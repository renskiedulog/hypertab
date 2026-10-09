import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import Visualizer from "./components/custom/visualizer";
import { currentBackground } from "./lib/backgrounds";
import { useStorage } from "./lib/storage-provider";
import { quoteOfTheDay } from "./lib/quotes";
import { noteLook, NOTES_PATH, sortNotes, useCached, WATCHLIST_PATH, type Note, type WatchItem } from "./lib/api-bank";

interface WeatherData {
  location: { name: string; country: string };
  current: {
    temp_c: number;
    condition: { text: string; icon: string };
  };
}

const googleSites = [
  {
    title: "Gmail",
    url: "https://gmail.com/",
    icon: "icons/gmail.png",
  },
  {
    title: "Drive",
    url: "https://drive.google.com/",
    icon: "icons/drive.png",
  },
  {
    title: "Docs",
    url: "https://docs.google.com/",
    icon: "icons/docs.png",
  },
  {
    title: "Sheets",
    url: "https://sheets.google.com/",
    icon: "icons/sheets.png",
  },
  {
    title: "Keep",
    url: "https://keep.google.com/",
    icon: "icons/keep.png",
  },
];

export default function Wallpaper() {
  const { getItem, setItem, removeItem } = useStorage();
  const [sites, setSites] = useState<any[]>([]);
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const background = currentBackground;
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const notes = useCached<{ items: Note[] }>(NOTES_PATH).data?.items ?? [];
  const watchlist = useCached<WatchItem[]>(WATCHLIST_PATH).data ?? [];
  const [isEditing, setIsEditing] = useState(false);
  const [cityInput, setCityInput] = useState("");
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const cityInputRef = useRef<HTMLInputElement>(null);

  const faviconSize = window.devicePixelRatio > 1 ? 128 : 64;

  useEffect(() => {
    chrome?.topSites?.get((data: any) => {
      setSites(data ?? []);
    });
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      setTime(
        now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );

      setDate(
        now.toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    const apiKey = getItem<string>("weatherApiKey");
    if (!apiKey) return;

    const cached = getItem<{ data: WeatherData; timestamp: number }>("weatherCache");
    const FOUR_HOURS = 4 * 60 * 60 * 1000;

    if (cached && Date.now() - cached.timestamp < FOUR_HOURS) {
      setWeather(cached.data);
      return;
    }

    const city = getItem<string>("weatherCity");

    const doFetch = (q: string) => {
      fetch(
        `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(q)}&aqi=no`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.error) return;
          setWeather(data);
          setItem("weatherCache", { data, timestamp: Date.now() });
        })
        .catch(() => {});
    };

    if (city) {
      doFetch(city);
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => doFetch(`${pos.coords.latitude},${pos.coords.longitude}`),
        () => {}
      );
    }
  }, [getItem, setItem, fetchTrigger]);

  const startEdit = () => {
    setCityInput(getItem<string>("weatherCity") ?? "");
    setIsEditing(true);
    setTimeout(() => cityInputRef.current?.focus(), 0);
  };

  const saveCity = () => {
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    setItem("weatherCity", trimmed);
    removeItem("weatherCache");
    setFetchTrigger((t) => t + 1);
    setIsEditing(false);
  };

  // Pinned notes first (sortNotes), otherwise the oldest; max 8.
  const previewNotes = sortNotes(notes).slice(0, 8);
  const releases = watchlist.filter((w) => w.unseen > 0);
  const quote = quoteOfTheDay();

  return (
    <main
      className="h-screen w-screen bg-cover bg-center flex flex-col gap-5 items-center justify-center text-white"
      style={{
        backgroundImage: `
          linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0)),
          linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0)),
          url('${background}')
        `,
      }}
    >
      {/* Notes preview (top-left, across from weather) */}
      <div className="absolute top-5 left-5 flex flex-col gap-5">
        {previewNotes.length > 0 && (
          <div className="flex gap-2">
            {previewNotes.map((note) => {
              const { color, rotation } = noteLook(note.id);
              return (
                <div
                  key={note.id}
                  className="w-28 h-28 p-2 text-gray-800 text-xs leading-snug overflow-hidden font-medium"
                  style={{
                    backgroundColor: color,
                    transform: `rotate(${rotation}deg)`,
                    borderRadius: "2px",
                    boxShadow:
                      "3px 6px 18px rgba(0,0,0,0.45), 1px 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)",
                  }}
                >
                  <p className="font-bold truncate">{note.title}</p>
                  <p className="line-clamp-4 whitespace-pre-wrap break-words">{note.body}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Daily quote (bottom-left) */}
      <figure className="absolute bottom-5 left-5 max-w-sm bg-black/30 backdrop-blur-sm rounded-xl px-4 py-3">
        <blockquote className="text-sm italic leading-snug line-clamp-4">“{quote.text}”</blockquote>
        <figcaption className="mt-1 text-xs opacity-70">— {quote.author}</figcaption>
      </figure>

      {/* Updates panel (right edge): followed titles with unseen episodes/chapters */}
      {releases.length > 0 && (
        <div className="absolute right-5 top-1/2 -translate-y-1/2">
          <ul className="w-72 max-h-[60vh] overflow-y-auto bg-black/30 backdrop-blur-sm rounded-xl p-2 flex flex-col gap-1">
            {releases.map((item) => (
              <li key={item.id}>
                <a
                  href={item.latestUrl ?? item.sourceUrl ?? undefined}
                  className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-white/15 transition"
                >
                  {item.cover && <img src={item.cover} alt="" className="w-7 h-10 rounded object-cover" />}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.title}</p>
                    <p className="text-xs opacity-70">
                      {item.type === "anime" ? "Ep" : "Ch"} {item.latest} · {item.unseen} new
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Weather Widget */}
      {weather && (
        <div className="absolute top-5 right-5 group">
          <div className="relative flex items-center gap-3 bg-black/30 backdrop-blur-sm rounded-xl px-4 py-3 text-white">
            {isEditing ? (
              <div className="flex items-center gap-2 min-w-[160px]">
                <input
                  ref={cityInputRef}
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveCity();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                  placeholder="Enter city..."
                  className="flex-1 bg-transparent border-b border-white/50 outline-none text-white text-sm placeholder-white/40 cursor-text"
                />
                <button onClick={saveCity} className="cursor-pointer text-white/70 hover:text-white transition-colors">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsEditing(false)} className="cursor-pointer text-white/70 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <img
                  src={`https:${weather.current.condition.icon}`}
                  alt={weather.current.condition.text}
                  className="w-10 h-10"
                />
                <div>
                  <p className="text-2xl font-bold leading-none">
                    {Math.round(weather.current.temp_c)}°C
                  </p>
                  <p className="text-sm opacity-80">{weather.current.condition.text}</p>
                  <p className="text-sm font-semibold tracking-wide">
                    {weather.location.name},{" "}
                    <span className="opacity-70 font-normal">{weather.location.country}</span>
                  </p>
                </div>
                <button
                  onClick={startEdit}
                  className="absolute -top-2 -right-2 bg-white/20 backdrop-blur-sm rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-white/30"
                >
                  <Pencil className="w-3 h-3 text-white" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Time and Date Header */}
      <div className="text-center">
        <h1 className="text-7xl font-bold tracking-wide">{time}</h1>
        <p className="text-xl mt-2">{date}</p>
      </div>

      {/* Sites */}
      <ul className="grid grid-cols-5 gap-2 max-w-3xl mx-auto mt-5">
        {sites.map((site: any, index) => (
          <a
            key={index}
            href={site.url}
            rel="noopener noreferrer"
            className="flex flex-col justify-center items-center min-w-[120px] gap-1.5 py-4 rounded-md group hover:bg-white/20 transition"
          >
            <img
              src={`https://www.google.com/s2/favicons?sz=${faviconSize}&domain=${
                new URL(site.url).hostname
              }`}
              alt="favicon"
              className="w-6 h-6 object-cover"
            />
            <span className="text-white truncate max-w-[100px]">
              {site.title || site.url}
            </span>
          </a>
        ))}
      </ul>

      {/* Google Shortcuts */}
      {googleSites.length > 0 && (
        <>
          <h2 className="text-2xl font-semibold">Google Shortcuts</h2>
          <ul className="grid grid-cols-5 gap-2 max-w-3xl mx-auto">
            {googleSites.map((site, index) => (
              <a
                key={index}
                href={site.url}
                rel="noopener noreferrer"
                className="flex flex-col justify-center items-center min-w-[120px] gap-1.5 py-4 rounded-md hover:bg-white/20 transition"
              >
                <img
                  src={site.icon}
                  alt="favicon"
                  className="w-8 h-8 object-cover"
                />
                <span className="text-white truncate max-w-[100px]">
                  {site.title}
                </span>
              </a>
            ))}
          </ul>
        </>
      )}
      <Visualizer />
    </main>
  );
}
