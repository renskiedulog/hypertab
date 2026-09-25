import { useEffect, useState } from "react";
import Visualizer from "./components/custom/visualizer";
import { currentBackground } from "./lib/backgrounds";
import { useStorage } from "./lib/storage-provider";

const NOTE_COLORS = [
  "#FFF176",
  "#F48FB1",
  "#80DEEA",
  "#A5D6A7",
  "#FFCC80",
  "#CE93D8",
  "#90CAF9",
  "#EF9A9A",
];

interface Note {
  id: string;
  content: string;
  color: string;
  rotation: number;
  createdAt: number;
}

export default function Board() {
  const background = currentBackground;
  const { getItem, setItem } = useStorage();
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    const saved = getItem<Note[]>("board-notes");
    if (saved) setNotes(saved);
  }, []);

  const saveNotes = (updated: Note[]) => {
    setNotes(updated);
    setItem("board-notes", updated);
  };

  const addNote = () => {
    if (notes.length >= 8) return;
    const usedColors = notes.map((n) => n.color);
    const color =
      NOTE_COLORS.find((c) => !usedColors.includes(c)) ??
      NOTE_COLORS[notes.length % NOTE_COLORS.length];
    const rotation = parseFloat((Math.random() * 6 - 3).toFixed(1));
    saveNotes([
      ...notes,
      {
        id: crypto.randomUUID(),
        content: "",
        color,
        rotation,
        createdAt: Date.now(),
      },
    ]);
  };

  const updateNote = (id: string, content: string) => {
    saveNotes(notes.map((n) => (n.id === id ? { ...n, content } : n)));
  };

  const deleteNote = (id: string) => {
    saveNotes(notes.filter((n) => n.id !== id));
  };

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
      <div className="absolute inset-0 flex items-center justify-center pl-20">
        <div className="flex flex-wrap gap-6 justify-center max-w-5xl p-6">
          {notes
            .slice()
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((note) => (
              <div
                key={note.id}
                className="relative w-48 h-52 flex flex-col select-none"
                style={{
                  backgroundColor: note.color,
                  transform: `rotate(${note.rotation}deg)`,
                  borderRadius: "2px",
                  boxShadow:
                    "3px 6px 18px rgba(0,0,0,0.45), 1px 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.6)",
                }}
              >
                {/* Adhesive strip */}
                <div
                  className="h-7 shrink-0 flex items-center justify-end px-2"
                  style={{
                    backgroundColor: "rgba(0,0,0,0.1)",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
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
                  value={note.content}
                  onChange={(e) => updateNote(note.id, e.target.value)}
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
            ))}

          {notes.length < 8 && (
            <button
              onClick={addNote}
              className="w-48 h-52 rounded border-2 border-dashed border-white/30 flex items-center justify-center text-white/40 hover:border-white/60 hover:text-white/70 transition-all text-5xl font-thin cursor-pointer"
              style={{ transform: "rotate(0deg)" }}
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
