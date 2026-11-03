// While a homeowner is in a contractor's link, the pages wear that
// contractor's color, so the planner feels like part of their website.
// Only on the pages of that journey; Haleo's own pages stay Haleo's.
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ACTIVE_EVENT, getActiveInvite } from "@/lib/invites";
import { brandThemeVars } from "@/lib/frontDoor";

const BRANDED = /^\/(i\/|brief|login|reset-password)/;

export default function BrandTheme() {
  const { pathname } = useLocation();
  const [color, setColor] = useState<string | null>(() => getActiveInvite()?.brandColor ?? null);

  useEffect(() => {
    const sync = () => setColor(getActiveInvite()?.brandColor ?? null);
    window.addEventListener(ACTIVE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ACTIVE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const vars = BRANDED.test(pathname) ? brandThemeVars(color) : null;
    if (!vars) return;
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
    };
  }, [pathname, color]);

  return null;
}
