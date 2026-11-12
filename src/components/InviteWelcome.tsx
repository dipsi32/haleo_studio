// The welcome a homeowner sees in a contractor's experience, shared by a
// contractor's personal link (/i/:token) and their front door (/c/:slug).
// It should feel like the contractor's own process, not a third-party app.
//
// It reads like a conversation: why they're here ("Matt would love to hear
// about your project"), what they get out of it (a clear brief that's theirs
// to keep), then two easy questions, one at a time: what to call them, and
// the best number to reach them. Who the contractor is lives in one glance
// card underneath, which opens the full record for anyone who wants it.
// Nothing here points to other contractors.
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BadgeCheck, ChevronRight, FileText } from "lucide-react";
import CobrandLogo, { type Cobrand } from "@/components/CobrandLogo";
import ProofPanel from "@/components/contractors/ProofPanel";
import LicenseLine from "@/components/LicenseLine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { track } from "@/lib/analytics";
import { cleanName } from "@/lib/intake";
import { cleanPhone, typingPhone } from "@/lib/phone";
import { contractorDisplayName, personFirstName, type InviteContractor } from "@/lib/invites";
import { recordGlance } from "@/lib/recordHighlights";
import { useLicense, usePermits } from "@/lib/useContractorRecord";

/** The contractor's page: their name up top, Haleo only as a quiet footnote. */
export const Shell = ({ children, brand, style }: { children: ReactNode; brand?: Cobrand | null; style?: CSSProperties }) => (
  <div className="flex min-h-screen flex-col bg-gradient-warm" style={style}>
    <header className="mx-auto flex w-full max-w-xl items-center justify-between px-6 py-5">
      <CobrandLogo brand={brand} quiet={!!brand} />
    </header>
    <main className="mx-auto w-full max-w-xl flex-1 px-6 pb-16 pt-2">{children}</main>
    {brand && (
      <footer className="pb-6 text-center text-[11px] text-muted-foreground/70">
        Powered by <span className="font-medium">Haleo</span>
      </footer>
    )}
  </div>
);

export type HomeownerStart = { name?: string; phone?: string };

type Props = {
  contractor: InviteContractor;
  brand: Cobrand;
  /** "personal": a link made for this homeowner. "front": the contractor's website door. */
  door: "personal" | "front";
  hasBrief: boolean;
  busy?: boolean;
  /** What they've told us before, if anything. */
  defaultName?: string;
  defaultPhone?: string;
  onStart: (who: HomeownerStart) => void;
  onResume?: (who: HomeownerStart) => void;
  /** Brand theme variables, for pages where the global theme isn't on yet. */
  style?: CSSProperties;
};

export default function InviteWelcome({
  contractor: c,
  brand,
  door,
  hasBrief,
  busy = false,
  defaultName,
  defaultPhone,
  onStart,
  onResume,
  style,
}: Props) {
  const name = contractorDisplayName(c);
  // "Matt" when we know what clients call them, otherwise the company.
  const person = c.personName?.trim() || personFirstName(c);
  const short = person ?? name;
  const [homeowner, setHomeowner] = useState(defaultName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const first = cleanName(homeowner)?.split(" ")[0];
  const phoneOk = !phone.trim() || !!cleanPhone(phone);
  const ready = !!first && phoneOk;
  const who = (): HomeownerStart => ({ name: cleanName(homeowner), phone: cleanPhone(phone) });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    track("homeowner_welcome_completed", { contractor_id: c.id, door, gave_phone: !!cleanPhone(phone) });
    onStart(who());
  };

  return (
    <Shell brand={brand} style={style}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
          {door === "personal" ? `A personal note from ${short}` : "Start your project"}
        </p>
        <h1 className="mt-3 font-display text-[2.1rem] font-light leading-[1.12] md:text-[2.6rem]">
          {short} would love to hear <span className="italic">about your project.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Share a few photos and your rough idea, however it comes out. You don't need to know construction, and if
          you're not sure about budget or scope yet, say so. {short} comes to your first visit already knowing your
          space.
        </p>

        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-accent-soft/50 px-4 py-3">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p className="text-sm leading-relaxed text-foreground/85">
            <span className="font-medium">You'll leave with a clear project brief:</span> what you want, what's there
            today, and the questions worth asking. It's yours to keep and share with anyone.
          </p>
        </div>

        {/* Two easy questions, one at a time. */}
        <form onSubmit={submit} className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <label htmlFor="homeowner-name" className="block text-[15px] font-medium">
            First, what should {short} call you?
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

          <AnimatePresence initial={false}>
            {first && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <label htmlFor="homeowner-phone" className="mt-5 flex items-baseline justify-between gap-3 text-[15px] font-medium">
                  <span>
                    Nice to meet you, {first}. What's the best number for {short} to reach you?
                  </span>
                  <span className="shrink-0 text-xs font-normal text-muted-foreground">Optional</span>
                </label>
                <Input
                  id="homeowner-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(typingPhone(e.target.value))}
                  placeholder="(408) 555-0123"
                  autoComplete="tel-national"
                  aria-invalid={!phoneOk}
                  className="mt-2 h-12 rounded-xl bg-background text-base"
                />
                <p className={`mt-1.5 text-xs ${phoneOk ? "text-muted-foreground" : "text-destructive"}`}>
                  {phoneOk
                    ? `Just for ${short}, to text you back and set up a visit.`
                    : "That number looks a digit or two short."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <Button type="submit" size="lg" disabled={!ready || busy} className="mt-5 h-12 w-full rounded-full text-base">
            {busy ? "One moment…" : first ? `Let's go, ${first}` : "Start my project"} <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="mt-2.5 text-center text-xs text-muted-foreground">About five minutes. Skip anything you like.</p>
          {hasBrief && onResume && (
            <button
              type="button"
              onClick={() => onResume(who())}
              disabled={busy}
              className="mt-3 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Or continue the brief I already started
            </button>
          )}
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
