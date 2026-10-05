import { useCallback, useEffect, useRef, useState } from "react";
import { useStorage } from "./storage-provider";

const BASE = "https://api-bank-chi.vercel.app/api/";
const KEY = import.meta.env.VITE_API_BANK_KEY;
export const hasApiKey = Boolean(KEY);

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WatchItem {
  id: string;
  type: "anime" | "manga";
  source: "anilist" | "asura" | "mangakakalot";
  sourceId: string;
  title: string;
  cover: string | null;
  sourceUrl: string | null;
  status: string | null;
  total: number | null;
  latest: number | null;
  latestUrl: string | null;
  lastSeen: number;
  unseen: number;
  nextEpisode: number | null;
  nextAiringAt: string | null;
  checkError: string | null;
}

export interface MediaResult {
  id: string;
  type: "anime" | "manga";
  title: string;
  cover: string | null;
  status: string | null;
  episodes: number | null;
  chapters: number | null;
  year: number | null;
  source: "tenrai" | "anilist" | "asura" | "mangakakalot";
}

export const NOTES_PATH = "notes/v1/notes?archived=false&limit=100";
export const WATCHLIST_PATH = "media/v1/watchlist";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!KEY) throw new Error("Set VITE_API_BANK_KEY in .env.local");
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "x-api-key": KEY,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message ?? `api-bank ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const NOTE_COLORS = ["#FFF176", "#F48FB1", "#80DEEA", "#A5D6A7", "#FFCC80", "#CE93D8", "#90CAF9", "#EF9A9A"];

/** Stable sticky-note color and tilt derived from the note id. */
export function noteLook(id: string) {
  const h = Math.abs([...id].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0));
  return { color: NOTE_COLORS[h % NOTE_COLORS.length], rotation: ((h >> 3) % 61) / 10 - 3 };
}

/** Pinned first, then oldest first so notes don't jump around while editing. */
export const sortNotes = (notes: Note[]) =>
  notes.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.createdAt.localeCompare(b.createdAt));

const MINUTE = 60 * 1000;

/** Cached GET: serves the stored copy and only hits the API once the last fetch is older than `ttl`. */
export function useCached<T>(path: string, ttl = 15 * MINUTE) {
  const { getItem, setItem } = useStorage();
  const cacheKey = `api-bank:${path}`;
  const [cached] = useState(() => getItem<{ data: T; at: number }>(cacheKey));
  const [data, setData] = useState<T | null>(cached?.data ?? null);
  // Local edits keep the last fetch time, so they don't push the next real refresh back.
  const fetchedAt = useRef(cached?.at ?? 0);
  const [error, setError] = useState<string | null>(hasApiKey ? null : "Set VITE_API_BANK_KEY in .env.local");

  const mutate = useCallback(
    (next: T) => {
      setData(next);
      setItem(cacheKey, { data: next, at: fetchedAt.current });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cacheKey]
  );

  const refresh = useCallback(async () => {
    try {
      const fresh = await api<T>(path);
      fetchedAt.current = Date.now();
      mutate(fresh);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [path, mutate]);

  useEffect(() => {
    // Entries without `at` are from the old uncached format: treat as stale.
    if (hasApiKey && Date.now() - fetchedAt.current >= ttl) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  return { data, error, mutate, refresh };
}
