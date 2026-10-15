// Shown only on the staging site (VITE_APP_ENV=staging). A slim ribbon so
// nobody mistakes it for production, and a noindex tag so search engines
// don't either. Renders nothing anywhere else.
import { useEffect } from "react";

export const isStaging = import.meta.env.VITE_APP_ENV === "staging";

export default function StagingBanner() {
  useEffect(() => {
    if (!isStaging) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    document.title = `[Staging] ${document.title}`;
    return () => meta.remove();
  }, []);

  if (!isStaging) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-[100] bg-amber-400 px-4 py-1.5 text-center text-xs font-medium text-amber-950"
    >
      Staging. Test data only, and nothing here is real.
    </div>
  );
}
