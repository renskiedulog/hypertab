# HyperTab

Chrome extension that replaces the new tab page with a customizable dashboard. Built with Vite + React + TypeScript.

## Features

| Page | Description |
|------|-------------|
| **Wallpaper** | Full-screen background with clock, top sites, Google shortcuts, and YouTube now-playing overlay |
| **Work** | Placeholder workspace page (in development) |
| **Entertainment** | Placeholder entertainment page (in development) |
| **Customize** | Upload custom background images stored in IndexedDB |
| **Home** | Set preferred default page on new tab open |

### YouTube Visualizer
Content script (`youtube-analyzer.js`) polls the active YouTube tab every second and sends video state (title, current time, duration, volume, paused) to the background service worker. The Wallpaper page displays this as a now-playing bar at the bottom.

### Content Scraper
Monitor any website for DOM changes using CSS selectors. Categorize items as **Manga** or **Anime**. Background alarm fires every 4 hours, scrapes all monitored URLs, and sends a Chrome notification if content changed.

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 6** (builds to `extension/` dir)
- **Tailwind CSS v4**
- **Radix UI** (Tabs, Tooltip, Dialog)
- **react-router-dom v7** (HashRouter)
- **next-themes** (theme switching per route)
- **lucide-react** icons
- **IndexedDB** — background image storage
- **chrome.storage.local** — scraper monitored items
- **localStorage** (via `StorageProvider`) — user preferences

## Project Structure

```
hypertab/
├── src/
│   ├── App.tsx                          # Root router + providers
│   ├── home.tsx                         # Default page selector + initial redirect
│   ├── wallpaper.tsx                    # Wallpaper page (clock, top sites, YouTube bar)
│   ├── work.tsx                         # Work page (stub)
│   ├── entertainment.tsx                # Entertainment page (stub)
│   ├── customize.tsx                    # Background image uploader
│   ├── components/
│   │   ├── custom/
│   │   │   ├── navigation.tsx           # Bottom tab bar (adapts layout on wallpaper route)
│   │   │   └── visualizer.tsx           # YouTube now-playing component
│   │   ├── feat/scraper/
│   │   │   └── scraped-items.tsx        # Manga/anime scraper UI
│   │   └── ui/                          # shadcn/ui components
│   └── lib/
│       ├── storage-provider.tsx         # localStorage React context
│       ├── indexedDB.tsx                # Background image IndexedDB helpers
│       ├── theme-watcher.tsx            # Applies body class per route
│       └── scraper.tsx                  # (empty placeholder)
├── script/
│   ├── background.js                    # Service worker: YouTube relay + scraper alarms
│   └── youtube-analyzer.js             # Content script: polls YouTube video state
├── public/
│   └── manifest.json                    # MV3 manifest
└── vite.config.ts                       # Multi-entry build (newtab + background + youtube-analyzer)
```

## Permissions Used

| Permission | Why |
|------------|-----|
| `topSites` | Show most visited sites on Wallpaper page |
| `storage` | Persist scraper monitored items |
| `scripting` | Execute scraper content script on tab load |
| `activeTab` | Access current tab for scraping |
| `alarms` | 4-hour background scrape check |
| `notifications` | Notify on scraped content change |

## Dev & Build

```bash
# Install dependencies
yarn install

# Dev server (UI preview only — not full extension)
yarn dev

# Build extension to extension/
yarn build
```

After `yarn build`, load the `extension/` folder as an unpacked extension in `chrome://extensions`.

## Theme System

Routes map to body class themes:

| Route | Theme class |
|-------|-------------|
| `/wallpaper` | `light` |
| `/work` | `blue` |
| `/entertainment` | `rose` |
| `/customize` | `light` |

`NavigationTabs` switches between vertical icon-only sidebar (wallpaper route) and horizontal tab bar (all other pages).

## Preferred Page / Default Redirect

On first new tab open per session, `home.tsx` reads `preferredPage` from localStorage and redirects to:
- `/wallpaper`
- `/normal` (stays on `/`)
- `/work`
- `/entertainment`

User sets preference via Home page buttons. Redirect only fires once per session (guarded by `sessionStorage`).
