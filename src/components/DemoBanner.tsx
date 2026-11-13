// While a contractor plays their own lead in the demo, one quiet line says
// so on every page of the real flow, with a way out.
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ACTIVE_EVENT, clearActiveInvite, demoSlugOf, getActiveInvite, type ActiveInvite } from "@/lib/invites";

const IN_FLOW = /^\/(i\/|brief|login)/;

export default function DemoBanner() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState<ActiveInvite | null>(() => getActiveInvite());

  useEffect(() => {
    const sync = () => setActive(getActiveInvite());
    window.addEventListener(ACTIVE_EVENT, sync);
    return () => window.removeEventListener(ACTIVE_EVENT, sync);
  }, []);
  useEffect(() => {
    setActive(getActiveInvite());
  }, [pathname]);

  if (!active?.demo || !IN_FLOW.test(pathname)) return null;
  const who = active.personName ?? active.contractorName;
  return (
    <div className="flex items-center justify-center gap-3 bg-foreground px-4 py-2 text-center text-xs text-background">
      <span>
        Demo: what {who}'s lead sees. It all works for real, and nothing is sent.
      </span>
      <button
        type="button"
        onClick={() => {
          const slug = demoSlugOf(active.token);
          clearActiveInvite();
          navigate(`/demo/${slug}`);
        }}
        className="shrink-0 rounded-full border border-background/30 px-2.5 py-0.5 hover:bg-background/10"
      >
        Exit demo
      </button>
    </div>
  );
}
