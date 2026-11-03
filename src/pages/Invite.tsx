// Landing page for a contractor's brief link: /i/:token
//
// The homeowner has already chosen this contractor, so this page honors that
// choice: it opens with who is coming (their profile, then the public record),
// then politely asks for the project so the contractor arrives prepared.
// Nothing here points to other contractors.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, FileCheck2, Lock, Map } from "lucide-react";
import CobrandLogo, { type Cobrand } from "@/components/CobrandLogo";
import ProofPanel from "@/components/contractors/ProofPanel";
import { Button } from "@/components/ui/button";
import { useIntake } from "@/lib/intake";
import { track } from "@/lib/analytics";
import {
  contractorDisplayName,
  fetchInvite,
  markInviteOpened,
  setActiveInvite,
  personFirstName,
  type InvitePublic,
} from "@/lib/invites";

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; invite: InvitePublic };

const Shell = ({ children, brand }: { children: React.ReactNode; brand?: Cobrand | null }) => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
      <CobrandLogo brand={brand} />
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

  const hasBrief = Boolean(intake.room);
  const c = invite.contractor;
  const person = personFirstName(c);
  // "Matt" when we know the person, otherwise the company.
  const short = person ?? name;

  const start = () => {
    track("invite_brief_started", { contractor_id: c.id, resumed: false });
    navigate("/brief");
  };
  const resume = () => {
    track("invite_brief_started", { contractor_id: c.id, resumed: true });
    navigate("/brief/result");
  };

  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const steps = [
    { icon: FileCheck2, title: "Share your project", body: "Photos of the space, what you'd like done, a rough budget and timing. About five minutes, and you can skip anything." },
    { icon: CalendarDays, title: "Pick a few times", body: `Tap the days and times that work for a visit. ${short} confirms one with you.` },
    { icon: Map, title: `${short} arrives prepared`, body: "With a prep sheet on your home and project, so the first visit starts with your ideas, not the basics." },
  ];

  return (
    <Shell brand={brand}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        {/* Who is coming: the person first, then their record. */}
        <div className="flex items-center gap-4">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-full border border-border object-cover" />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg text-accent-soft-foreground">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">A personal invitation</p>
            <p className="truncate font-display text-lg">{person ? `${person} at ${name}` : name}</p>
          </div>
        </div>

        <h1 className="mt-6 font-display text-3xl font-light leading-tight md:text-[2.6rem]">
          {short} would love to hear <span className="italic">about your project.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Thanks for reaching out. Before you meet, {short} invited you to share a few details, so your first
          conversation starts with your plans instead of the basics.
        </p>

        {(c.tagline || c.yearsInBusiness || c.specialties || (c.gallery?.length ?? 0) > 0) && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
            {c.tagline && <p className="font-display text-xl italic leading-snug">“{c.tagline}”</p>}
            {(c.yearsInBusiness || c.specialties) && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                {c.yearsInBusiness ? (
                  <span className="rounded-full bg-secondary px-3 py-1">{c.yearsInBusiness} years in business</span>
                ) : null}
                {c.specialties
                  ?.split(/[,;]/)
                  .map((x) => x.trim())
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((x) => (
                    <span key={x} className="rounded-full bg-secondary px-3 py-1">{x}</span>
                  ))}
              </div>
            )}
            {(c.gallery?.length ?? 0) > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {c.gallery!.map((u) => (
                  <img key={u} src={u} alt={`Recent work by ${name}`} loading="lazy" className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">What the public record shows</p>
          <ProofPanel contractorId={c.id} city={c.city} variant="full" />
        </div>

        {/* The ask: polite, and clear about what they get. */}
        <section className="mt-10 rounded-3xl border border-accent/25 bg-card p-6 shadow-soft md:p-8">
          <h2 className="font-display text-2xl font-light">Help {short} come prepared</h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Would you share a little about your project? It's the easiest way to make your first visit count.
          </p>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {steps.map((st, i) => (
              <li key={st.title} className="rounded-2xl bg-secondary/40 p-4">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground text-[11px] text-background">{i + 1}</span>
                  {st.title}
                </span>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{st.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" className="rounded-full" onClick={start}>
              Share my project <ArrowRight className="h-4 w-4" />
            </Button>
            {hasBrief && (
              <Button size="lg" variant="outline" className="rounded-full" onClick={resume}>
                Use the brief I already started
              </Button>
            )}
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" /> Only {name} sees it, and it's yours to keep.
          </p>
        </section>
      </motion.div>
    </Shell>
  );
};

export default Invite;
