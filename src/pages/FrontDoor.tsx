// A contractor's permanent front door: /c/:slug?src=website|google|text
//
// The link they put behind "Start your project" on their own website, their
// Google profile and their text replies. It looks like theirs (their name,
// logo, color), then hands the visitor the same brief flow as a personal
// link: when they start, the server mints them their own invite, so the
// brief goes to this contractor and no one else.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { CSSProperties } from "react";
import InviteWelcome, { Shell } from "@/components/InviteWelcome";
import { Button } from "@/components/ui/button";
import { saveIntakeStart, useIntake } from "@/lib/intake";
import { track } from "@/lib/analytics";
import { toast } from "@/hooks/use-toast";
import { brandThemeVars, frontDoorPath, parseSource } from "@/lib/frontDoor";
import {
  contractorDisplayName,
  fetchFrontDoor,
  getActiveInvite,
  markInviteOpened,
  openFrontDoor,
  setActiveInvite,
  type InviteContractor,
} from "@/lib/invites";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; contractor: InviteContractor };

export default function FrontDoor() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const source = parseSource(params.get("src"));
  const navigate = useNavigate();
  const { data: intake } = useIntake();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const contractor = await fetchFrontDoor(slug);
      if (cancelled) return;
      setState(contractor ? { kind: "ready", contractor } : { kind: "missing" });
      track("front_door_viewed", { found: !!contractor, source });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, source]);

  const style = useMemo(
    () => (state.kind === "ready" ? ((brandThemeVars(state.contractor.brandColor) ?? undefined) as CSSProperties | undefined) : undefined),
    [state],
  );

  if (state.kind === "loading") {
    return (
      <Shell>
        <div className="h-64 animate-pulse rounded-3xl border border-border bg-card/60" aria-label="Loading" />
      </Shell>
    );
  }

  if (state.kind === "missing") {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-light">This page isn't set up yet</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          The contractor may not have finished setting it up. You can still reach them directly, or plan your project
          on your own and share it with anyone.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/brief">Plan my project</Link>
        </Button>
      </Shell>
    );
  }

  const c = state.contractor;
  // Already partway through a brief for this same contractor? Keep going.
  const sameContractor = getActiveInvite()?.contractorId === c.id;

  const begin = async (resumed: boolean, homeownerName: string | undefined) => {
    setBusy(true);
    const res = await openFrontDoor(slug, source);
    if (!("token" in res)) {
      setBusy(false);
      toast({
        title: res.busy ? "Lots of people are starting right now" : "We couldn't start your project",
        description: "Try again in a moment.",
        variant: "destructive",
      });
      return;
    }
    setActiveInvite(res.token, c);
    if (homeownerName || !resumed) saveIntakeStart({ homeownerName });
    void markInviteOpened(res.token);
    track("front_door_started", { contractor_id: c.id, source, resumed });
    track("invite_brief_started", { contractor_id: c.id, resumed, source });
    navigate(resumed ? "/brief/result" : "/brief");
  };

  return (
    <InviteWelcome
      contractor={c}
      brand={{ name: contractorDisplayName(c), logoUrl: c.logoUrl ?? null, href: `${frontDoorPath(slug)}${source !== "other" ? `?src=${source}` : ""}` }}
      door="front"
      hasBrief={Boolean(intake.room) && sameContractor}
      busy={busy}
      defaultName={intake.homeownerName}
      onStart={(n) => void begin(false, n)}
      onResume={(n) => void begin(true, n)}
      style={style}
    />
  );
}
