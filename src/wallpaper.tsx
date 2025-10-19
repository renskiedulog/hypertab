import { useEffect, useState } from "react";
import Visualizer from "./components/custom/visualizer";

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
  const [sites, setSites] = useState<any[]>([]);
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [background, setBackground] = useState<string>("images/1.jpg");

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
        })
      );

      setDate(
        now.toLocaleDateString([], {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function pickBackground() {
      const { customBackgrounds = [] } =
        (await chrome?.storage?.local?.get("customBackgrounds")) ?? [];

      const defaultBackgrounds = ["images/1.jpg"];

      const allBackgrounds = [...defaultBackgrounds, ...customBackgrounds];
      if (allBackgrounds.length === 0) return;

      const chosen =
        allBackgrounds[Math.floor(Math.random() * allBackgrounds.length)];

      setBackground(chosen);
    }

    pickBackground();
  }, []);

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
