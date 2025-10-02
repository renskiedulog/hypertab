import { useEffect, useState } from "react";

const TopSites = () => {
  const [sites, setSites] = useState([]);

  useEffect(() => {
    chrome?.topSites?.get((data: any) => {
      setSites(data ?? []);
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Frequently Visited Sites</h1>
      <ul className="grid grid-cols-2 gap-4">
        {sites.map((site: any, index) => (
          <li
            key={index}
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition"
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${
                new URL(site.url).hostname
              }`}
              alt="favicon"
              className="w-6 h-6"
            />
            <a
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline truncate"
            >
              {site.title || site.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TopSites;
