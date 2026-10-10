// Landing page for a contractor's brief link: /i/:token
//
// The homeowner has already chosen this contractor, so this page honors that
// choice instead of re-running a match. It says who asked, what the homeowner
// does, what they get, who sees the brief, and that the brief stays theirs.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileCheck2, Lock, Map } from "lucide-react";
import Logo from "@/components/Logo";
import ProofPanel from "@/components/contractors/ProofPanel";
import { Button } from "@/components/ui/button";
import { useIntake } from "@/lib/intake";
import { track } from "@/lib/analytics";
import {
  contractorDisplayName,
  fetchInvite,
  markInviteOpened,
  setActiveInvite,
  type InvitePublic,
} from "@/lib/invites";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; invite: InvitePublic };

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
      <Logo />
    </header>
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">{children}</main>
  </div>
);

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

  if (invite.status !== "open") {
    const why =
      invite.status === "completed"
        ? `A brief has already been sent through this link to ${name}.`
        : invite.status === "expired"
          ? `This link to ${name} has expired.`
          : `${name} turned this link off.`;
    return (
      <Shell>
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

  const hasBrief = Boolean(intake.room);

  const start = () => {
    track("invite_brief_started", { contractor_id: invite.contractor.id, resumed: false });
    navigate("/brief");
  };
  const resume = () => {
    track("invite_brief_started", { contractor_id: invite.contractor.id, resumed: true });
    navigate("/brief/result");
  };

  const points = [
    {
      icon: FileCheck2,
      title: "You get a clear written brief",
      body: "Your photos, plans, scope, budget and timeline in one place, plus Haleo's read of your space and what your city will want to see. It's yours to keep.",
    },
    {
      icon: Lock,
      title: `Only ${name} gets it`,
      body: "It goes to this contractor and no one else. You can share it with other contractors whenever you like from your account.",
    },
    {
      icon: Map,
      title: "A better first visit",
      body: `${name} reads it before you meet, so the visit goes to your actual project instead of the basics.`,
    },
  ];

  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">An invitation from {name}</p>
        <h1 className="mt-3 font-display text-3xl font-light leading-tight md:text-4xl">
          {name} asked you to share your project before you meet.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          It takes about five minutes: photos of the space, your address, what you want done, and a rough budget and
          timeline. Skip anything you're not ready to share.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" className="rounded-full" onClick={start}>
            Start my brief <ArrowRight className="h-4 w-4" />
          </Button>
          {hasBrief && (
            <Button size="lg" variant="outline" className="rounded-full" onClick={resume}>
              Use the brief I already started
            </Button>
          )}
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-3">
          {points.map((p) => (
            <li key={p.title} className="rounded-2xl border border-border bg-card/70 p-5">
              <p.icon className="h-5 w-5 text-accent" />
              <p className="mt-3 text-balance font-display text-base">{p.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Who you're sharing with</p>
          <ProofPanel contractorId={invite.contractor.id} city={invite.contractor.city} variant="compact" />
        </div>
      </motion.div>
    </Shell>
  );
};

export default Invite;
