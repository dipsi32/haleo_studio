// Says which Haleo you're on, everywhere but production (VITE_APP_ENV, set by
// the deploy pipeline from deploy/<env>.env). Dev and demo also get a noindex
// tag so search engines never list them. Renders nothing in production.
import { useEffect } from "react";

const appEnv = (import.meta.env.VITE_APP_ENV as string | undefined) || "production";

const RIBBON: Record<string, { text: string; tone: string; tag: string }> = {
  dev: { text: "Dev build. Test data only, and things break here.", tone: "bg-amber-400 text-amber-950", tag: "Dev" },
  demo: { text: "Preview. A look at what's coming; what you do here doesn't reach the live site.", tone: "bg-foreground text-background", tag: "Preview" },
};

export default function EnvRibbon() {
  const r = RIBBON[appEnv];
  useEffect(() => {
    if (!r) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    document.title = `[${r.tag}] ${document.title}`;
    return () => meta.remove();
  }, [r]);

  if (!r) return null;
  // A small pill in the middle of the header: visible on every page, never covering
  // the header's links or the sticky action bars at the bottom.
  return (
    <div
      role="status"
      title={r.text}
      aria-label={r.text}
      className={`pointer-events-none fixed left-1/2 top-2 z-[100] -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] shadow-soft ${r.tone}`}
    >
      {r.tag}
    </div>
  );
}
