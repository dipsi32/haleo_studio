import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Download,
  Edit3,
  Send,
  ShieldCheck,
  Calendar,
  DollarSign,
  Image as ImageIcon,
  FileText,
  ChevronRight,
} from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ROOM_LABELS, useIntake, type IntakeData } from "@/lib/intake";

const fmtMoney = (v?: number) => (v == null ? "" : v >= 500 ? "$500K+" : `$${v}K`);

const buildHomeownerLayer = (d: IntakeData): string => {
  const room = d.room ? ROOM_LABELS[d.room].toLowerCase() : "space";
  const pains = d.painPoints.slice(0, 3).map((p) => p.toLowerCase());
  const vibes = d.vibes.slice(0, 2).map((v) => v.toLowerCase());

  const painsLine =
    pains.length > 0
      ? `It's ${pains.join(", ").replace(/, ([^,]*)$/, " and $1")}.`
      : "It just hasn't worked the way we live.";
  const vibeLine =
    vibes.length > 0
      ? `We want it to feel ${vibes.join(" and ")} — somewhere we actually want to spend time.`
      : "We want it to feel like ours, finally.";

  const opener =
    d.room === "addition"
      ? "We're adding on to our home."
      : d.room === "full-home"
        ? "We're remodeling our whole home."
        : `We're remodeling the ${room}.`;

  return `${opener} ${painsLine} ${vibeLine}`;
};

const buildContractorLayer = (d: IntakeData): string[] => {
  const lines: string[] = [];
  if (d.room === "kitchen") {
    lines.push("Full kitchen gut renovation. Removal of non-load-bearing partition between kitchen and dining (verify framing).");
    if (d.painPoints.includes("No island")) lines.push("New island addition with plumbing rough-in and electrical for prep zone.");
    if (d.painPoints.includes("Too dark") || d.painPoints.includes("Poor lighting"))
      lines.push("Recessed lighting redesign — estimated 12–15 cans across 2–3 zones, dimmer-controlled.");
    if (d.painPoints.includes("Dated cabinets") || d.painPoints.includes("No storage"))
      lines.push("Full cabinet replacement; countertop template post-install (stone or quartz TBD).");
    if (d.painPoints.includes("Appliances need upgrading"))
      lines.push("Appliance upgrade: 36\" range, built-in refrigerator, panel-ready dishwasher.");
  } else if (d.room === "bathroom") {
    lines.push("Full bathroom gut renovation. New waterproofing membrane, tile setting, fixture rough-ins.");
    if (d.painPoints.includes("Tiny shower") || d.painPoints.includes("No bathtub"))
      lines.push("Reconfigure wet area: enlarge shower footprint and/or add freestanding tub w/ supply lines.");
    if (d.painPoints.includes("Single vanity")) lines.push("Double vanity install — verify min 60\" width, dual P-traps, GFCI to code.");
    if (d.painPoints.includes("Bad ventilation")) lines.push("New 110+ CFM ducted exhaust fan, humidity-sensing.");
  } else if (d.room === "addition") {
    lines.push(
      `New ${d.additionType ?? "structure"} addition, approximately ${d.additionSize ?? "TBD"} sq ft, on ${
        d.additionLocation ?? "site"
      } elevation.`,
    );
    lines.push("Foundation, framing, roof tie-in, MEP rough-in, insulation, and finishes — full scope.");
    lines.push("Structural and energy compliance (Title 24) calcs required at permit submission.");
  } else if (d.room === "full-home") {
    lines.push("Whole-home renovation. Phased approach recommended to maintain habitability.");
    lines.push("Full MEP review, insulation upgrade, finish replacement throughout.");
  } else {
    lines.push(`Full ${d.room ?? "room"} renovation. Surface and finish replacement, electrical and lighting upgrades as scoped.`);
  }
  if (d.painPoints.includes("Bad flow") || d.painPoints.includes("Layout doesn't work"))
    lines.push("Layout reconfiguration — confirm load paths, headers may be required.");
  return lines;
};

const buildPermitFlag = (d: IntakeData): { likely: boolean; reason: string } => {
  const heavy =
    d.room === "addition" ||
    d.room === "full-home" ||
    d.painPoints.includes("Layout doesn't work") ||
    d.painPoints.includes("Bad flow") ||
    d.painPoints.includes("No island");
  return heavy
    ? { likely: true, reason: "Structural or MEP changes typically require San Jose permits." }
    : { likely: false, reason: "Mostly cosmetic — likely permit-exempt, but always verify with your contractor." };
};

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground/80">{children}</span>
);

const BriefResult = () => {
  const { data } = useIntake();
  const [showContractor, setShowContractor] = useState(false);

  const homeowner = useMemo(() => buildHomeownerLayer(data), [data]);
  const contractor = useMemo(() => buildContractorLayer(data), [data]);
  const permit = useMemo(() => buildPermitFlag(data), [data]);

  const budgetLabel = data.budgetSkipped
    ? "Not shared"
    : data.budgetMin != null
      ? `${fmtMoney(data.budgetMin)} – ${fmtMoney(data.budgetMax)}`
      : "—";

  const timelineLabel =
    data.timeline === "asap"
      ? "Ready to start"
      : data.timeline === "1-3"
        ? "1–3 months"
        : data.timeline === "3-6"
          ? "3–6 months"
          : "Exploring";

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Link to="/brief" className="text-sm text-muted-foreground transition-smooth hover:text-foreground">
            Edit brief
          </Link>
        </div>
      </header>

      <main className="container max-w-4xl py-12 md:py-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Your project brief</p>
          <h1 className="mt-3 font-display text-5xl font-light leading-tight text-balance md:text-6xl">
            We translated your <em className="italic text-accent">vision.</em>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            Here's your project, in your words and in language any contractor can bid on.
          </p>
        </motion.div>

        {/* Quick facts */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-wrap items-center gap-3"
        >
          {data.room && <Pill>{ROOM_LABELS[data.room]}</Pill>}
          <Pill>
            <DollarSign className="mr-1 inline h-3 w-3" />
            {budgetLabel}
          </Pill>
          <Pill>
            <Calendar className="mr-1 inline h-3 w-3" />
            {timelineLabel}
          </Pill>
          <Pill>
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            {permit.likely ? "Permit likely required" : "Probably permit-exempt"}
          </Pill>
        </motion.div>

        {/* Brief card */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-lift"
        >
          <div className="grid items-center gap-3 border-b border-border bg-secondary/30 px-6 py-4 sm:grid-cols-[1fr_auto] md:px-8">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-accent text-accent-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-base font-medium">Your brief</p>
                <p className="text-xs text-muted-foreground">Both layers below — toggle the lens.</p>
              </div>
            </div>
            <button
              onClick={() => setShowContractor((v) => !v)}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-smooth hover:bg-accent"
            >
              {showContractor ? "Show how you said it" : "See how contractors read this"}
              <ChevronRight
                className={`h-4 w-4 transition-smooth ${showContractor ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-border p-6 md:border-b-0 md:border-r md:p-10">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">In your words</p>
              <p className="mt-3 font-display text-2xl font-light leading-snug text-foreground/90">
                "{homeowner}"
              </p>
            </div>

            <div className="relative bg-secondary/40 p-6 md:p-10">
              <p className="text-[11px] uppercase tracking-wider text-accent">For your contractor</p>
              <AnimatePresence mode="wait">
                {showContractor ? (
                  <motion.ul
                    key="reveal"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-3 space-y-3"
                  >
                    {contractor.map((line, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.08 }}
                        className="flex items-start gap-3 font-mono text-[13px] leading-relaxed text-foreground/85"
                      >
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        {line}
                      </motion.li>
                    ))}
                  </motion.ul>
                ) : (
                  <motion.div
                    key="hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-6 grid place-items-center"
                  >
                    <button
                      onClick={() => setShowContractor(true)}
                      className="group flex flex-col items-center gap-3 rounded-2xl border border-dashed border-accent/40 bg-card/40 px-8 py-10 text-center transition-smooth hover:border-accent hover:bg-card"
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground transition-smooth group-hover:scale-110">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                      <p className="font-display text-base font-medium">
                        Reveal the contractor translation
                      </p>
                      <p className="max-w-xs text-xs text-muted-foreground">
                        The same vision, in language they can bid on.
                      </p>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Permit + thumbs */}
          <div className="grid gap-6 border-t border-border bg-card px-6 py-6 md:grid-cols-2 md:px-10 md:py-8">
            <div className="flex items-start gap-3">
              <div className={`grid h-9 w-9 place-items-center rounded-full ${permit.likely ? "bg-accent-soft text-accent" : "bg-sage-soft text-sage"}`}>
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="font-display text-sm font-medium">
                  {permit.likely ? "Permit likely required" : "Probably permit-exempt"}
                </p>
                <p className="text-xs text-muted-foreground">{permit.reason}</p>
              </div>
            </div>
            {(data.hasPhotos || data.hasFloorPlan || data.hasInspiration) && (
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
                  <ImageIcon className="h-4 w-4" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.hasWalkthrough && <Pill>Walkthrough video</Pill>}
                  {data.hasFloorPlan && <Pill>Floor plan</Pill>}
                  {data.hasPhotos && <Pill>Photos</Pill>}
                  {data.hasInspiration && <Pill>Inspiration</Pill>}
                </div>
              </div>
            )}
          </div>
        </motion.section>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 grid gap-3 sm:grid-cols-3"
        >
          <Button size="lg" className="rounded-full" disabled>
            <Send className="h-4 w-4" />
            Send to contractor
          </Button>
          <Button size="lg" variant="outline" className="rounded-full" disabled>
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button size="lg" variant="outline" className="rounded-full" asChild>
            <Link to="/brief">
              <Edit3 className="h-4 w-4" />
              Edit brief
            </Link>
          </Button>
        </motion.div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Sending and PDF export come online when Lovable Cloud is enabled.
        </p>

        {/* Next step */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 rounded-3xl bg-foreground p-8 text-background md:p-12"
        >
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Next step</p>
          <h2 className="mt-3 font-display text-3xl font-light leading-tight md:text-4xl">
            Got proposals back? <em className="italic text-accent">Run the audit.</em>
          </h2>
          <p className="mt-4 max-w-lg text-sm text-background/70">
            We'll cross-check every line item against San Jose permit data and tell you exactly
            where the numbers stand — before you sign anything.
          </p>
          <Link
            to="/audit"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-smooth hover:bg-accent/90"
          >
            Start a forensic audit
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.section>
      </main>
    </div>
  );
};

export default BriefResult;
