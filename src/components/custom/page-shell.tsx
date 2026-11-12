import { cn } from "@/lib/utils";
import { currentBackground } from "@/lib/backgrounds";

/** Full-screen ground for the tool pages: today's wallpaper, blurred down to its colours, under a warm ink wash. */
export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <main className="page relative h-screen w-screen overflow-hidden bg-ink">
      <div
        aria-hidden
        className="absolute inset-0 scale-125 bg-cover bg-center opacity-80 blur-[90px]"
        style={{ backgroundImage: `url('${currentBackground}')` }}
      />
      <div aria-hidden className="absolute inset-0 bg-ink/60" />
      <div className={cn("relative h-full pl-28 pr-8 py-7", className)}>{children}</div>
    </main>
  );
}
