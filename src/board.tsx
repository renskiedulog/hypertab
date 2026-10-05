import { useEffect, useRef, useState } from "react";
import { Pin } from "lucide-react";
import Visualizer from "./components/custom/visualizer";
import { currentBackground } from "./lib/backgrounds";
import { useStorage } from "./lib/storage-provider";
import { api, hasApiKey, noteLook, NOTES_PATH, sortNotes, useCached, type Note } from "./lib/api-bank";

interface LegacyNote {
  content: string;
}

export default function Board() {
  const background = currentBackground;
  const { getItem, setItem, removeItem } = useStorage();
  const { data, error, mutate, refresh } = useCached<{ items: Note[] }>(NOTES_PATH);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const migrated = useRef(false);
  const notes = data?.items ?? [];

  // One-time upload of the old localStorage sticky notes; failed ones stay local for the next try.
  useEffect(() => {
    const legacy = getItem<LegacyNote[]>("board-notes");
    if (!legacy || !hasApiKey || migrated.current) return;
    migrated.current = true;
    (async () => {
      const failed: LegacyNote[] = [];
      for (const n of legacy.filter((n) => n.content.trim())) {
        const [first, ...rest] = n.content.trim().split("\n");
        try {
          await api("notes/v1/notes", {
            method: "POST",
            body: JSON.stringify({ title: first.slice(0, 300), body: rest.join("\n") }),
          });
        } catch {
          failed.push(n);
        }
      }
      if (failed.length) setItem("board-notes", failed);
      else removeItem("board-notes");
      refresh();
    })();
  }, []);

  const setNotes = (items: Note[]) => mutate({ items });

  const run = (p: Promise<unknown>) =>
    p.then(() => setSaveError(null)).catch((e: Error) => setSaveError(e.message));

  const addNote = async () => {
    try {
      const note = await api<Note>("notes/v1/notes", {
        method: "POST",
        body: JSON.stringify({ title: "New note" }),
      });
      setNotes([...notes, note]);
      setSaveError(null);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const updateNote = (id: string, patch: Partial<Pick<Note, "title" | "body">>) => {
    const updated = notes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    setNotes(updated);
    const note = updated.find((n) => n.id === id)!;
    clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        run(
          api(`notes/v1/notes/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ title: note.title.trim() || "Untitled", body: note.body }),
          })
        );
      }, 600)
    );
  };

  const togglePin = (note: Note) => {
    setNotes(notes.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n)));
    run(api(`notes/v1/notes/${note.id}`, { method: "PATCH", body: JSON.stringify({ pinned: !note.pinned }) }));
  };

  const deleteNote = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNotes(notes.filter((n) => n.id !== id));
    run(api(`notes/v1/notes/${id}`, { method: "DELETE" }));
  };

  const shownError = saveError ?? error;

  return (
    <main
      className="h-screen w-screen bg-cover bg-center relative overflow-hidden"
      style={{
        backgroundImage: `
          linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0)),
          linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0)),
          url('${background}')
        `,
      }}
    >
      {shownError && (
        <p className="absolute top-5 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-red-200">
          {shownError}
        </p>
      )}
      <div className="absolute inset-0 flex items-center justify-center pl-20 overflow-y-auto">
        <div className="flex flex-wrap gap-6 justify-center max-w-5xl p-6">
          {sortNotes(notes).map((note) => {
            const { color, rotation } = noteLook(note.id);
            return (
              <div
                key={note.id}
                className="relative w-48 h-52 flex flex-col select-none"
                style={{
                  backgroundColor: color,
                  transform: `rotate(${rotation}deg)`,
                  borderRadius: "2px",
                  boxShadow:
                    "3px 6px 18px rgba(0,0,0,0.45), 1px 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
              >
                {/* Adhesive strip */}
                <div
                  className="h-7 shrink-0 flex items-center gap-1 px-2"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.1)",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  <input
                    className="flex-1 min-w-0 bg-transparent outline-none text-gray-800 text-xs font-bold placeholder-gray-500/50 cursor-text"
                    placeholder="Title"
                    value={note.title}
                    onChange={(e) => updateNote(note.id, { title: e.target.value })}
                  />
                  <button
                    onClick={() => togglePin(note)}
                    title={note.pinned ? "Unpin" : "Pin to main tab"}
                    className={`cursor-pointer transition-colors ${
                      note.pinned ? "text-gray-800" : "text-gray-600/40 hover:text-gray-800"
                    }`}
                  >
                    <Pin className="w-3 h-3" fill={note.pinned ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-gray-600/60 hover:text-gray-800 text-xs transition-colors cursor-pointer leading-none"
                  >
                    ✕
                  </button>
                </div>

                {/* Note body */}
                <textarea
                  className="flex-1 bg-transparent resize-none outline-none text-gray-800 text-sm px-3 py-2 placeholder-gray-500/50 leading-relaxed cursor-text font-medium"
                  placeholder="Type something..."
                  value={note.body}
                  onChange={(e) => updateNote(note.id, { body: e.target.value })}
                />

                {/* Folded corner */}
                <div
                  className="absolute bottom-0 right-0 w-7 h-7 pointer-events-none"
                  style={{
                    background: `linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.2) 50%)`,
                    borderBottomRightRadius: "2px",
                  }}
                />
              </div>
            );
          })}

          {hasApiKey && (
            <button
              onClick={addNote}
              className="w-48 h-52 rounded border-2 border-dashed border-white/30 flex items-center justify-center text-white/40 hover:border-white/60 hover:text-white/70 transition-all text-5xl font-thin cursor-pointer"
            >
              +
            </button>
          )}
        </div>
      </div>
      <Visualizer />
    </main>
  );
}
