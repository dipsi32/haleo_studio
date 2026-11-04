// The welcome a homeowner sees in a contractor's experience, shared by a
// contractor's personal link (/i/:token) and their front door (/c/:slug).
//
// The task comes first: a one-line greeting from the contractor, then one
// question (what should they call you?) and Start. Who the contractor is
// lives in one glance card underneath ("License active · 6 San Jose permits
// · Kitchen remodel"), which opens the full record for anyone who wants it.
// Nothing here points to other contractors.
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ChevronRight, Lock } from "lucide-react";
import CobrandLogo, { type Cobrand } from "@/components/CobrandLogo";
import ProofPanel from "@/components/contractors/ProofPanel";
import LicenseLine from "@/components/LicenseLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { track } from "@/lib/analytics";
import { cleanName } from "@/lib/intake";
import { contractorDisplayName, personFirstName, type InviteContractor } from "@/lib/invites";
import { recordGlance } from "@/lib/recordHighlights";
import { useLicense, usePermits } from "@/lib/useContractorRecord";

export const Shell = ({ children, brand, style }: { children: ReactNode; brand?: Cobrand | null; style?: CSSProperties }) => (
  <div className="min-h-screen bg-gradient-warm" style={style}>
    <header className="mx-auto flex max-w-xl items-center justify-between px-6 py-5">
      <CobrandLogo brand={brand} />
    </header>
    <main className="mx-auto max-w-xl px-6 pb-24 pt-2">{children}</main>
  </div>
);

type Props = {
  contractor: InviteContractor;
  brand: Cobrand;
  /** "personal": a link made for this homeowner. "front": the contractor's website door. */
  door: "personal" | "front";
  hasBrief: boolean;
  busy?: boolean;
  /** Their name as they typed it, if they've given it before. */
  defaultName?: string;
  onStart: (name: string | undefined) => void;
  onResume?: (name: string | undefined) => void;
  /** Brand theme variables, for pages where the global theme isn't on yet. */
  style?: CSSProperties;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function InviteWelcome({ contractor: c, brand, door, hasBrief, busy = false, defaultName, onStart, onResume, style }: Props) {
  const name = contractorDisplayName(c);
  // "Matt" when we know what clients call them, otherwise the company.
  const person = c.personName?.trim() || personFirstName(c);
  const short = person ?? name;
  const [homeowner, setHomeowner] = useState(defaultName ?? "");
  const ready = !!cleanName(homeowner);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    onStart(cleanName(homeowner));
  };

  return (
    <Shell brand={brand} style={style}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        {/* The greeting: who, in one line. */}
        <div className="flex items-center gap-3">
          {c.logoUrl ? (
            <img src={c.logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-border object-cover" />
          ) : (
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-base text-accent-soft-foreground">
              {initialsOf(person ?? name)}
            </div>
          )}
          <p className="min-w-0 text-sm text-muted-foreground">
            {door === "personal" ? "A personal invitation from " : "From "}
            <span className="font-medium text-foreground">{person ? `${person} at ${name}` : name}</span>
          </p>
        </div>

        <h1 className="mt-5 font-display text-[2.1rem] font-light leading-[1.12] md:text-[2.6rem]">
          Tell {short} <span className="italic">about your project.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          About five minutes. Photos help; everything else is optional. {short} comes to your first visit already knowing it.
        </p>

        {/* The task. */}
        <form onSubmit={submit} className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <label htmlFor="homeowner-name" className="text-sm font-medium">
            What should {short} call you?
          </label>
          <Input
            id="homeowner-name"
            value={homeowner}
            onChange={(e) => setHomeowner(e.target.value.slice(0, 40))}
            placeholder="Your first name"
            autoComplete="given-name"
            autoFocus
            className="mt-2 h-12 rounded-xl bg-background text-base"
          />
          <Button type="submit" size="lg" disabled={!ready || busy} className="mt-3 h-12 w-full rounded-full text-base">
            {busy ? "One moment…" : "Start my project"} <ArrowRight className="h-4 w-4" />
          </Button>
          {hasBrief && onResume && (
            <button
              type="button"
              onClick={() => onResume(cleanName(homeowner))}
              disabled={busy}
              className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Or continue the brief I already started
            </button>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Only {name} sees it, and it's yours to keep.
          </p>
        </form>

        {/* Who's coming, at a glance. More is one tap away. */}
        <RecordGlance contractor={c} short={short} name={name} />
      </motion.div>
    </Shell>
  );
}

const RecordGlance = ({ contractor: c, short, name }: { contractor: InviteContractor; short: string; name: string }) => {
  const permits = usePermits(c.id || null);
  const license = useLicense(c.licenseNumber);
  const [open, setOpen] = useState(false);
  const glance = permits ? recordGlance(permits) : null;
  const active = !!license?.status && /active|clear/i.test(license.status);

  const bits = [
    active ? "License active" : null,
    glance && glance.count > 0 ? `${glance.count} San Jose permit${glance.count === 1 ? "" : "s"}` : null,
    glance?.kinds[0] ?? null,
  ].filter(Boolean) as string[];

  if (bits.length === 0 && !c.tagline) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          track("record_glance_opened", { contractor_id: c.id });
        }}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3 text-left transition-smooth hover:bg-card"
      >
        <BadgeCheck className="h-5 w-5 shrink-0 text-sage" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">About {short}</span>
          <span className="block truncate text-xs text-muted-foreground">{bits.length ? bits.join(" · ") : c.tagline}</span>
        </span>
        <span className="inline-flex shrink-0 items-center text-xs font-medium text-muted-foreground">
          See record <ChevronRight className="h-3.5 w-3.5" />
        </span>
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[88vh]">
          <div className="mx-auto w-full max-w-lg overflow-y-auto px-5 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="font-display text-2xl font-light">
                About <span className="italic">{short}</span>
              </DrawerTitle>
              <DrawerDescription>From public records. Haleo doesn't rate or endorse contractors.</DrawerDescription>
            </DrawerHeader>
            <div className="space-y-4">
              {(c.tagline || c.specialties || c.yearsInBusiness) && (
                <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                  {c.tagline && <p className="font-display text-lg italic leading-snug">“{c.tagline}”</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    {c.yearsInBusiness ? <span className="rounded-full bg-secondary px-3 py-1">{c.yearsInBusiness} years in business</span> : null}
                    {c.specialties
                      ?.split(/[,;]/)
                      .map((x) => x.trim())
                      .filter(Boolean)
                      .slice(0, 4)
                      .map((x) => (
                        <span key={x} className="rounded-full bg-secondary px-3 py-1">{x}</span>
                      ))}
                  </div>
                  {(c.gallery?.length ?? 0) > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {c.gallery!.map((u) => (
                        <img key={u} src={u} alt={`Recent work by ${name}`} loading="lazy" className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {c.licenseNumber && <LicenseLine licenseNumber={c.licenseNumber} />}
              {c.id && <ProofPanel contractorId={c.id} city={c.city} variant="full" />}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
