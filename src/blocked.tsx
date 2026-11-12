import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { PageShell } from "./components/custom/page-shell";
import { DEFAULTS, fmtTime, type BlockerSettings } from "./lib/blocker";

export default function Blocked() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const site = params.get("site");
  const [why, setWhy] = useState<string | null>(null);

  // Say why it's blocked: always, or only until focus ends.
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage) return;
    chrome.storage.local.get("blocker").then((r: { blocker?: Partial<BlockerSettings> }) => {
      const s = { ...DEFAULTS, ...r.blocker };
      const entry = s.sites.find((x) => x.entry === site);
      if (entry) setWhy(entry.mode === "always" ? "Blocked all the time" : `Blocked during focus, until ${fmtTime(s.focus.end)}`);
    });
  }, [site]);

  return (
    <PageShell className="pl-8 grid place-items-center">
      <div className="max-w-lg text-center flex flex-col items-center">
        <span className="grid place-items-center w-16 h-16 rounded-2xl bg-ember/15 text-ember mb-6">
          <ShieldAlert className="w-8 h-8" />
        </span>
        <h1 className="font-head text-4xl leading-tight text-balance">Oops, you might have blocked this site for a reason</h1>
        {site && (
          <p className="mt-5 inline-flex flex-wrap justify-center items-center gap-x-2 rounded-xl bg-surface px-4 py-2">
            <b className="font-extrabold break-all">{site}</b>
            {why && <span className="text-dim text-sm">· {why}</span>}
          </p>
        )}
        <div className="flex gap-3 mt-8">
          <button
            onClick={() => (history.length > 1 ? history.back() : navigate("/wallpaper"))}
            className="flex items-center gap-2 bg-fg text-ink font-bold hover:bg-fg/85 rounded-xl px-5 h-11 cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
          <button
            onClick={() => navigate("/blocker")}
            className="flex items-center gap-2 bg-raised hover:bg-line rounded-xl px-5 h-11 cursor-pointer transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" /> Edit block list
          </button>
        </div>
      </div>
    </PageShell>
  );
}
