// The contractor demo: /demo/:slug, then /text, /site, /welcome, /matt
//
// The contractor plays their own next lead in the real product:
//   /demo/:slug        Pick how the lead reaches them: a text, or their website.
//   /demo/:slug/text   The lead's phone: their text, the contractor's reply with the link.
//   /demo/:slug/site   Their website, with "Start your project" front and center.
//   /demo/:slug/welcome  The real front-door welcome, then the real brief flow
//                      (/brief, /brief/result, /i/demo-…/send) with their record
//                      answering each answer.
//   /demo/:slug/matt   "Send" lands here: the brief as it arrives on their phone.
// Nothing is sent or saved to anyone's account. Logic: src/lib/demo.ts.
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Globe,
  Hammer,
  Home,
  ImageIcon,
  MessageCircle,
  PlusSquare,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import Logo from "@/components/Logo";
import InviteWelcome from "@/components/InviteWelcome";
import VisitPrepCard from "@/components/pro/VisitPrepCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { brandThemeVars, frontDoorKey, frontDoorPath } from "@/lib/frontDoor";
import { findPermitRecord } from "@/lib/useShortlistCheck";
import { clearActiveInvite, demoToken, inviteMessage, setActiveInvite, type InviteContractor } from "@/lib/invites";
import { saveIntakeStart } from "@/lib/intake";
import { DEMO_BUY_BOX, LEAD_TEXT, loadDemoBrief, resolveDemo, type DemoConfig } from "@/lib/demo";

type View = "doors" | "text" | "site" | "welcome" | "matt";
const VIEWS: View[] = ["doors", "text", "site", "welcome", "matt"];

export default function Demo() {
  const { slug, view } = useParams<{ slug: string; view: string }>();
  const [search] = useSearchParams();
  const demo = useMemo(() => resolveDemo(slug, search), [slug, search]);
  const v: View = VIEWS.includes(view as View) ? (view as View) : "doors";

  useEffect(() => {
    if (demo && v === "doors") track("demo_opened", { demo: demo.slug });
  }, [demo, v]);
  useEffect(() => window.scrollTo({ top: 0 }), [v]);

  if (!demo) return <NoDemo />;
  if (v === "text") return <TextDoor demo={demo} />;
  if (v === "site") return <SiteDoor demo={demo} />;
  if (v === "welcome") return <Welcome demo={demo} />;
  if (v === "matt") return <MattView demo={demo} />;
  return <Doors demo={demo} />;
}

// ───── Shared ─────

/** Their record, found by the name on their permits, and the contractor as their client sees them. */
const useDemoContractor = (demo: DemoConfig) => {
  const [c, setC] = useState<InviteContractor | null>(null);
  useEffect(() => {
    let cancelled = false;
    const base = {
      name: demo.brand,
      company: demo.brand,
      city: "San Jose",
      brandColor: demo.brandColor ?? null,
      personName: demo.person,
      licenseNumber: demo.licenseNumber ?? null,
    };
    findPermitRecord(demo.recordName)
      .then((r) => !cancelled && setC({ ...base, id: r?.contractor.id ?? "", slug: (r?.contractor as { slug?: string } | undefined)?.slug ?? null }))
      .catch(() => !cancelled && setC({ ...base, id: "", slug: null }));
    return () => {
      cancelled = true;
    };
  }, [demo]);
  return c;
};

const themeOf = (demo: DemoConfig) => (brandThemeVars(demo.brandColor) ?? undefined) as CSSProperties | undefined;
const who = (demo: DemoConfig) => demo.person ?? demo.brand;

const Page = ({ demo, children, step }: { demo: DemoConfig; children: ReactNode; step?: string }) => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-5">
      <Logo />
      <span className="truncate rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground">
        {step ?? `A demo for ${demo.brand}`}
      </span>
    </header>
    <main className="mx-auto max-w-4xl px-5 pb-20">{children}</main>
  </div>
);

const NoDemo = () => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="mx-auto max-w-3xl px-6 py-6">
      <Logo />
    </header>
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-6">
      <h1 className="font-display text-3xl font-light">This demo link is missing a name</h1>
      <p className="mt-3 max-w-md text-muted-foreground">Ask for a fresh link, or see how Haleo works for contractors.</p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/pro">Haleo for contractors</Link>
      </Button>
    </main>
  </div>
);

// ───── 1. Two doors ─────

const Doors = ({ demo }: { demo: DemoConfig }) => {
  const navigate = useNavigate();
  const color = demo.brandColor ?? "#111827";
  const go = (door: "text" | "site") => {
    track("demo_door_chosen", { demo: demo.slug, door });
    navigate(`/demo/${demo.slug}/${door}`);
  };
  return (
    <Page demo={demo}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Three minutes · it all works for real</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          {demo.person ? `${demo.person}, be` : "Be"} your own next lead. <span className="italic">Then see what lands on your phone.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          How do new clients usually reach you? Pick one and do what they'd do. Add a photo of any room for the full effect.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {/* The text door */}
          <button
            type="button"
            onClick={() => go("text")}
            className="group rounded-3xl border border-border bg-card p-5 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="flex items-center gap-2 font-display text-xl">
              <MessageCircle className="h-5 w-5 text-accent" /> They text you
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">Most jobs start here. You reply with your link.</span>
            <span className="mt-4 block space-y-2 rounded-2xl bg-secondary/60 p-4">
              <span className="ml-auto block w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#0A84FF] px-3 py-2 text-[13px] leading-snug text-white">
                We're thinking about redoing our kitchen…
              </span>
              <span className="block w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-background px-3 py-2 text-[13px] leading-snug text-foreground/85">
                Thanks for reaching out! So I can come prepared…
                <span className="mt-1.5 block rounded-lg px-2 py-1 text-[11px] font-medium text-white" style={{ background: color }}>
                  {demo.brand} · Tell us about your project
                </span>
              </span>
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:text-accent">
              Start from a text <ArrowRight className="h-4 w-4" />
            </span>
          </button>

          {/* The website door */}
          <button
            type="button"
            onClick={() => go("site")}
            className="group rounded-3xl border border-border bg-card p-5 text-left shadow-soft transition-smooth hover:-translate-y-0.5 hover:shadow-lift"
          >
            <span className="flex items-center gap-2 font-display text-xl">
              <Globe className="h-5 w-5 text-accent" /> They find your website
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">One button, front and center, instead of a contact form.</span>
            <span className="mt-4 block overflow-hidden rounded-2xl border border-border">
              <span className="block bg-neutral-900 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white">{demo.brand}</span>
              <span className="block px-4 py-6 text-center" style={{ background: `linear-gradient(135deg, #1f1f1f, ${color})` }}>
                <span className="inline-block rounded-md px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-white" style={{ background: color, boxShadow: "0 0 0 3px rgba(255,255,255,.35)" }}>
                  Start your project →
                </span>
              </span>
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground group-hover:text-accent">
              Start from your website <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          At the end, you'll see the brief as it lands on your phone. Nothing is sent to anyone.
        </p>
      </motion.div>
    </Page>
  );
};

// ───── 2a. The lead's phone ─────

const TextDoor = ({ demo }: { demo: DemoConfig }) => {
  const navigate = useNavigate();
  const contractor = useDemoContractor(demo);
  const color = demo.brandColor ?? "#111827";
  // The link he'd text: his business name.
  const link = `haleo.pages.dev${frontDoorPath(frontDoorKey(demo.brand) || contractor?.slug || demo.slug)}`;
  const reply = inviteMessage({ contractor: demo.person ? `${demo.person} from ${demo.brand}` : demo.brand, url: "" }).replace(/:\s*$/, ".");
  const tap = () => {
    track("demo_link_tapped", { demo: demo.slug, door: "text" });
    navigate(`/demo/${demo.slug}/welcome?door=text`);
  };
  return (
    <Page demo={demo} step="Your lead's phone">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_minmax(0,360px)]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Step 1 of 3 · You're the homeowner now</p>
          <h1 className="mt-3 font-display text-3xl font-light leading-tight text-balance md:text-4xl">
            You texted {who(demo)} about your kitchen. <span className="italic">This came back.</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            {demo.person ?? "They"} replied with one link instead of twenty questions. Tap it, like your client would.
          </p>
        </div>

        {/* The phone */}
        <div className="mx-auto w-full max-w-[360px] rounded-[2.4rem] border-[10px] border-foreground/90 bg-background shadow-lift">
          <div className="rounded-[1.7rem] bg-background">
            <div className="flex flex-col items-center border-b border-border px-4 pb-3 pt-4">
              <span className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white" style={{ background: color }}>
                {(demo.person ?? demo.brand).slice(0, 1)}
              </span>
              <span className="mt-1 text-xs font-medium">{demo.person ? `${demo.person} · ${demo.brand}` : demo.brand}</span>
            </div>
            <div className="space-y-3 px-3 py-4">
              <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-[#0A84FF] px-3.5 py-2 text-[14px] leading-snug text-white">{LEAD_TEXT}</p>
              <div className="w-fit max-w-[86%]">
                <p className="rounded-2xl rounded-bl-md bg-secondary px-3.5 py-2 text-[14px] leading-snug text-foreground/90">{reply}</p>
                <button
                  type="button"
                  onClick={tap}
                  className="relative mt-1.5 block w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-soft transition-smooth hover:-translate-y-0.5"
                  aria-label={`Open ${demo.brand}'s link`}
                >
                  <span className="absolute -inset-1 animate-pulse rounded-2xl ring-2 ring-offset-2" style={{ ["--tw-ring-color" as string]: color }} aria-hidden />
                  <span className="relative block px-4 py-5 text-white" style={{ background: `linear-gradient(135deg, ${color}, #1f1f1f)` }}>
                    <span className="block text-[11px] uppercase tracking-[0.16em] opacity-80">{demo.brand}</span>
                    <span className="mt-1 block font-display text-lg leading-snug">Tell us about your project</span>
                  </span>
                  <span className="relative block px-4 py-2.5">
                    <span className="block text-[13px] font-medium">Share photos and ideas. {demo.person ?? "We"} come{demo.person ? "s" : ""} prepared.</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{link}</span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};

// ───── 2b. Their website, one new button ─────

const SiteDoor = ({ demo }: { demo: DemoConfig }) => {
  const navigate = useNavigate();
  const color = demo.brandColor ?? "#111827";
  const tap = () => {
    track("demo_link_tapped", { demo: demo.slug, door: "site" });
    navigate(`/demo/${demo.slug}/welcome?door=site`);
  };
  const services = demo.services?.length ? demo.services : ["Remodels", "Additions & ADUs", "Repairs"];
  const icons = [Hammer, PlusSquare, Home];
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {/* What this is, in one line */}
      <div className="flex items-center justify-center gap-3 bg-foreground px-4 py-2 text-center text-xs text-background">
        <span>Demo: your website{demo.website ? ` (${demo.website})` : ""} with one new button. Tap it like a visitor would.</span>
        <Link to={`/demo/${demo.slug}`} className="shrink-0 rounded-full border border-background/30 px-2.5 py-0.5 hover:bg-background/10">
          Back
        </Link>
      </div>

      {/* Their nav */}
      <nav className="bg-neutral-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <span className="text-lg font-extrabold uppercase tracking-tight" style={{ color }}>
            {demo.brand}
          </span>
          <span className="hidden items-center gap-7 text-[13px] font-medium uppercase tracking-wide text-white/85 lg:flex">
            <span>Home</span>
            <span>Gallery</span>
            <span>Services</span>
            <span>About us</span>
            <span>Contact us</span>
            {demo.licenseNumber && (
              <span className="rounded-md border border-dashed px-3 py-1.5 normal-case tracking-normal" style={{ borderColor: color }}>
                License Number: {demo.licenseNumber}
              </span>
            )}
          </span>
        </div>
      </nav>

      {/* Their hero, with the one new thing front and center */}
      <header className="relative overflow-hidden" style={{ background: `linear-gradient(120deg, #141414 0%, #262626 45%, ${color} 140%)` }}>
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-24">
          <div className="max-w-2xl rounded-md border border-dashed border-white/40 bg-white/5 p-6 backdrop-blur-sm md:p-10">
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white md:text-6xl">
              {demo.headline ?? "Build the home you've been picturing"}
            </h1>
            <span className="mt-5 block h-1 w-24 rounded-full" style={{ background: color }} />
            <p className="mt-5 text-lg leading-relaxed text-white/85">
              Planning a remodel, an addition or a new home? Tell us about it in five minutes, with a few photos if
              you have them. {demo.person ?? "We"} will come to your first visit with a plan, not a clipboard.
            </p>
            <div className="mt-8 flex flex-col items-start gap-3">
              <button
                type="button"
                onClick={tap}
                className="relative inline-flex items-center gap-3 rounded-md px-8 py-4 text-lg font-bold uppercase tracking-wide text-white shadow-2xl transition-transform hover:-translate-y-0.5"
                style={{ background: color }}
              >
                <span className="absolute inset-0 animate-ping rounded-md opacity-25" style={{ background: color }} aria-hidden />
                <span className="relative">Start your project</span>
                <ArrowRight className="relative h-5 w-5" />
              </button>
              <span className="text-sm text-white/70">Free · about 5 minutes · goes straight to {who(demo)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Their services */}
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-12 md:grid-cols-3">
        {services.map((s, i) => {
          const Icon = icons[i % icons.length];
          return (
            <div key={s} className="border border-neutral-200 p-6">
              <Icon className="h-9 w-9" style={{ color }} />
              <p className="mt-4 text-xl font-bold">{s}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
};

// ───── 3. The real welcome, then the real brief flow ─────

const Welcome = ({ demo }: { demo: DemoConfig }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // From a text, it's a personal invitation; from the website, it's their front door.
  const door = params.get("door") === "text" ? "personal" : "front";
  const contractor = useDemoContractor(demo);

  if (!contractor) {
    return (
      <div className="min-h-screen bg-gradient-warm p-10" style={themeOf(demo)}>
        <div className="mx-auto h-64 max-w-3xl animate-pulse rounded-3xl border border-border bg-card/60" aria-label="Loading" />
      </div>
    );
  }

  const start = (homeownerName: string | undefined) => {
    setActiveInvite(demoToken(demo.slug), contractor);
    // A fresh brief every run, so each demo starts from the lead's first tap.
    saveIntakeStart({ homeownerName }, true);
    navigate("/brief");
  };

  return (
    <>
      <div className="flex items-center justify-center gap-3 bg-foreground px-4 py-2 text-center text-xs text-background">
        <span>Demo: this is what your lead sees after tapping. Everything works; nothing is sent.</span>
      </div>
      <InviteWelcome
        contractor={contractor}
        brand={{ name: demo.brand, logoUrl: null, href: `/demo/${demo.slug}` }}
        door={door}
        hasBrief={false}
        onStart={start}
        style={themeOf(demo)}
      />
    </>
  );
};

// ───── 4. What lands on their phone ─────

const MattView = ({ demo }: { demo: DemoConfig }) => {
  const saved = useMemo(() => loadDemoBrief(demo.slug), [demo.slug]);
  const contractor = useDemoContractor(demo);

  useEffect(() => {
    // The demo run is over: their pages go back to normal.
    clearActiveInvite();
    track("demo_matt_viewed", { demo: demo.slug, has_brief: !!saved });
  }, [demo.slug, saved]);

  if (!saved) {
    return (
      <Page demo={demo}>
        <h1 className="font-display text-3xl font-light">No brief yet</h1>
        <p className="mt-3 text-muted-foreground">Start as your lead, and the brief will land here.</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to={`/demo/${demo.slug}`}>Start the demo</Link>
        </Button>
      </Page>
    );
  }

  const snap = saved.snapshot;
  const homeowner = snap.homeowner_name || "a new client";
  const project = snap.projectType || snap.rooms?.[0] || "A project";
  const claimHref = contractor?.slug ? `/pro/${contractor.slug}/claim` : "/pro/login?next=%2Fpro%2Flinks%23front-door";

  return (
    <Page demo={demo} step="Your phone">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="inline-flex items-center gap-2 rounded-full bg-sage/10 px-3 py-1 text-xs font-medium text-sage">
          <CheckCircle2 className="h-3.5 w-3.5" /> Your lead pressed send. In the demo, it came only to this screen.
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl font-light leading-tight text-balance md:text-5xl">
          Now you're {who(demo)}. <span className="italic">This just landed on your phone.</span>
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Before a single call: what they want, what they'll spend, when, the house itself, and whether it's worth the drive.
        </p>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
          {/* The phone */}
          <div className="mx-auto w-full max-w-[420px] rounded-[2.4rem] border-[10px] border-foreground/90 bg-background shadow-lift">
            <div className="max-h-[78vh] overflow-y-auto rounded-[1.7rem] bg-gradient-warm px-3 pb-5 pt-3">
              <div className="flex items-start gap-3 rounded-2xl bg-background/95 p-3 shadow-soft">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <Bell className="h-4 w-4" />
                </span>
                <span className="min-w-0 text-[13px] leading-snug">
                  <span className="block font-semibold">{snap.homeowner_name ? `${snap.homeowner_name} sent you a brief` : "New brief from a new client"}</span>
                  <span className="block text-muted-foreground">
                    {project} · {snap.neighborhood}
                    {snap.budget ? ` · ${snap.budget}` : ""}
                  </span>
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {snap.scope_summary && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">In their words</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{snap.scope_summary}</p>
                    {saved.note && <p className="mt-2 text-sm italic text-foreground/70">“{saved.note}”</p>}
                  </div>
                )}

                <VisitPrepCard demo snapshot={snap} buyBox={DEMO_BUY_BOX} homeownerName={homeowner} />

                {(snap.room_photo_urls?.length ?? 0) > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <ImageIcon className="h-3 w-3" /> The space
                    </p>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {snap.room_photo_urls.slice(0, 6).map((u) => (
                        <img key={u} src={u} alt="" className="aspect-square w-full rounded-lg object-cover" />
                      ))}
                    </div>
                  </div>
                )}

                {snap.haleo_read && (
                  <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                      <Sparkles className="h-3 w-3" /> Haleo's read of their photos
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-foreground/85">{snap.haleo_read.summary}</p>
                    {snap.haleo_read.sections.slice(0, 2).map((sec) => (
                      <div key={sec.title} className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground/60">{sec.title}</p>
                        <ul className="mt-1.5 space-y-1.5">
                          {sec.items.slice(0, 4).map((it) => (
                            <li key={it.text} className="flex gap-2 text-[13px] leading-snug text-foreground/85">
                              <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", it.basis === "grounded" ? "bg-sage" : it.basis === "inferred" ? "bg-accent" : "bg-muted-foreground/50")} />
                              {it.text}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {(snap.trade_groups?.length ?? 0) > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Scope by trade</p>
                    <ul className="mt-2 space-y-2">
                      {snap.trade_groups.slice(0, 5).map((g) => (
                        <li key={g.trade} className="text-[13px] leading-snug">
                          <span className="font-medium">{g.trade}</span>
                          <span className="text-foreground/70"> · {g.lines.slice(0, 2).join("; ")}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* What it means for them */}
          <div className="lg:sticky lg:top-8">
            <ul className="space-y-3">
              {[
                ["No phone tag for the basics.", "Scope, budget, timing, photos and the times they're free, before you call."],
                ["Drive out for the jobs that fit.", "A plain call on whether it's worth the trip, using the jobs you take on."],
                ["Walk in knowing the house.", "The city's records for their address: permits that never got a final, lot size, hazard zones."],
                ["Look like the most prepared bid.", "Your name and colors the whole way. They saw your record before you arrived."],
              ].map(([t, b]) => (
                <li key={t} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                  <p className="font-medium">{t}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{b}</p>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild size="lg" className="rounded-full" onClick={() => track("demo_cta_clicked", { demo: demo.slug })}>
                <Link to={claimHref}>
                  Use this for my real leads <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <p className="text-center text-xs text-muted-foreground">Free while we're small. One link for your texts and your website.</p>
              <Button asChild variant="ghost" className="rounded-full text-muted-foreground">
                <Link to={`/demo/${demo.slug}`}>
                  <RotateCcw className="h-4 w-4" /> Try the other door
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </Page>
  );
};
