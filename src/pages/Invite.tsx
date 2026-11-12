// Landing page for a contractor's brief link: /i/:token
//
// The homeowner has already chosen this contractor, so this page honors that
// choice: it opens with who is coming (their profile, then the public record),
// then politely asks for the project so the contractor arrives prepared.
// Nothing here points to other contractors.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { type Cobrand } from "@/components/CobrandLogo";
import InviteWelcome, { Shell, type HomeownerStart } from "@/components/InviteWelcome";
import { Button } from "@/components/ui/button";
import { saveIntakeStart, useIntake } from "@/lib/intake";
import { track } from "@/lib/analytics";
import {
  contractorDisplayName,
  fetchInvite,
  markInviteOpened,
  markInviteStarted,
  setActiveInvite,
  type InvitePublic,
} from "@/lib/invites";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; invite: InvitePublic };

const Invite = () => {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: intake } = useIntake();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const invite = await fetchInvite(token);
      if (cancelled) return;
      if (!invite) {
        setState({ kind: "missing" });
        return;
      }
      setState({ kind: "ready", invite });
      if (invite.status === "open") {
        setActiveInvite(token, invite.contractor);
        void markInviteOpened(token);
        track("invite_opened", { contractor_id: invite.contractor.id });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
        <h1 className="font-display text-3xl font-light">This link isn't valid</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          It may have been copied incompletely. Ask the contractor to send it again, or start your own brief.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/brief">Start a brief</Link>
        </Button>
      </Shell>
    );
  }

  const { invite } = state;
  const name = contractorDisplayName(invite.contractor);

  const brand: Cobrand = { name, logoUrl: invite.contractor.logoUrl ?? null, href: `/i/${token}` };

  if (invite.status !== "open") {
    const why =
      invite.status === "completed"
        ? `A brief has already been sent through this link to ${name}.`
        : invite.status === "expired"
          ? `This link to ${name} has expired.`
          : `${name} turned this link off.`;
    return (
      <Shell brand={brand}>
        <h1 className="font-display text-3xl font-light">{why}</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          {invite.status === "completed"
            ? "If that was you, you'll find it in your account. If not, ask the contractor for a new link."
            : "Ask them for a fresh link, or start your own brief and see contractors with permit history near you."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {invite.status === "completed" ? (
            <Button asChild className="rounded-full">
              <Link to="/account">Go to my account</Link>
            </Button>
          ) : (
            <Button asChild className="rounded-full">
              <Link to="/brief">Start my own brief</Link>
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  const c = invite.contractor;
  const start = ({ name: homeownerName, phone: homeownerPhone }: HomeownerStart) => {
    saveIntakeStart({ homeownerName, homeownerPhone });
    if (token) void markInviteStarted(token);
    track("invite_brief_started", { contractor_id: c.id, resumed: false, source: invite.source ?? "direct" });
    navigate("/brief");
  };
  const resume = ({ name: homeownerName, phone: homeownerPhone }: HomeownerStart) => {
    if (homeownerName || homeownerPhone) saveIntakeStart({ homeownerName, homeownerPhone });
    track("invite_brief_started", { contractor_id: c.id, resumed: true, source: invite.source ?? "direct" });
    navigate("/brief/result");
  };

  return (
    <InviteWelcome
      contractor={c}
      brand={brand}
      door={invite.source && invite.source !== "direct" ? "front" : "personal"}
      hasBrief={Boolean(intake.room)}
      defaultName={intake.homeownerName}
      defaultPhone={intake.homeownerPhone}
      onStart={start}
      onResume={resume}
    />
  );
};

export default Invite;
