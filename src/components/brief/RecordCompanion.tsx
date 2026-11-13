// While a homeowner fills in their project through a contractor's link, the
// contractor's track record keeps them company in one place: a strip pinned
// at the top, never in the form.
//
//   - The strip: a few numbers that answer as they go. Pick "Kitchen" and it
//     says how many kitchen permits; add the address and it says how many
//     jobs in their ZIP; the city's inspection sign-offs; the license.
//   - Tap it: a sheet with each fact, the streets of nearby jobs (never a
//     house number or an owner), and their recent jobs with what the city
//     signed off.
//
// Sources: San Jose permits, San Jose inspection records, the state license
// board. Counts, never ratings. A source that didn't answer is left out.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BadgeCheck, Check, ChevronRight, ClipboardCheck, FileText, Hammer, MapPin } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { IntakeData } from "@/lib/intake";
import { trackChips, trackRecord, type TrackRecord } from "@/lib/trackRecord";
import { useContractorRecord, useInspections, useLicense, useLicenseNumber, type ContractorRecord } from "@/lib/useContractorRecord";

export default function RecordCompanion({ data }: { data: IntakeData }) {
  const record = useContractorRecord();
  if (!record) return null;
  return <Companion record={record} data={data} />;
}

const Companion = ({ record, data }: { record: ContractorRecord; data: IntakeData }) => {
  const inspections = useInspections(record.contractorId, true);
  const licenseNumber = useLicenseNumber(record.contractorId, record.licenseNumber);
  const license = useLicense(licenseNumber);
  const t = useMemo(
    () => trackRecord(record.permits, data, inspections, license ? { status: license.status, classifications: license.classifications, issue_date: license.issue_date } : null),
    [record.permits, data, inspections, license],
  );
  const chips = trackChips(t);
  const owner = record.person ? `${record.person}'s` : `${record.who}'s`;
  const [open, setOpen] = useState(false);

  // A chip that just appeared (an answer unlocked it) glows for a moment.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const key = chips.map((c) => c.text).join("|");
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(chips.map((c) => c.text));
      return;
    }
    const n = chips.find((c) => !seen.current!.has(c.text));
    chips.forEach((c) => seen.current!.add(c.text));
    if (!n) return;
    setFresh(n.text);
    track("record_highlight_shown", { kind: n.id });
    const timer = setTimeout(() => setFresh(null), 4000);
    return () => clearTimeout(timer);
    // chips derive from key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-sage/15 bg-background/90 backdrop-blur">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            track("record_companion_opened", { chips: chips.length, inspections: !!t.inspections, license: !!t.license });
          }}
          className="container flex w-full items-center gap-2 py-2 text-left"
          aria-label={`See ${owner} track record`}
        >
          <span className="shrink-0 text-[11px] font-semibold text-foreground">{owner} record</span>
          <span className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {chips.map((c) => (
              <motion.span
                key={c.text}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] transition-colors",
                  fresh === c.text ? "border-sage bg-sage/15 text-foreground" : "border-sage/25 bg-sage/[0.06] text-foreground/80",
                )}
              >
                <Check className="h-3 w-3 text-sage" />
                {c.text}
              </motion.span>
            ))}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[88vh]">
          <div className="mx-auto w-full max-w-lg overflow-y-auto px-5 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="font-display text-2xl font-light">
                {owner} track record, <span className="italic">for your project</span>
              </DrawerTitle>
              <DrawerDescription>
                From San Jose permit and inspection records{licenseNumber ? " and the state license board" : ""}. Counts, not ratings: Haleo doesn't rate or endorse contractors.
              </DrawerDescription>
            </DrawerHeader>
            <Sheet t={t} licenseNumber={licenseNumber} checkingLicense={!!licenseNumber && license === undefined} checkingInspections={inspections === null} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

const Row = ({ icon: Icon, title, children }: { icon: typeof Check; title: string; children?: React.ReactNode }) => (
  <li className="rounded-2xl border border-sage/20 bg-sage/[0.04] px-4 py-3">
    <p className="flex items-start gap-2.5 text-sm font-medium leading-snug">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
      {title}
    </p>
    {children && <div className="ml-[26px] mt-1 text-[13px] leading-snug text-muted-foreground">{children}</div>}
  </li>
);

const Sheet = ({ t, licenseNumber, checkingLicense, checkingInspections }: { t: TrackRecord; licenseNumber: string | null; checkingLicense: boolean; checkingInspections: boolean }) => (
  <>
    <ul className="space-y-2">
      {licenseNumber && (
        <Row
          icon={BadgeCheck}
          title={
            t.license
              ? `California license ${licenseNumber}: ${t.license.active ? "active" : t.license.status}`
              : checkingLicense
                ? `California license ${licenseNumber}: checking with the state…`
                : `California license ${licenseNumber}: the state board didn't answer just now`
          }
        >
          {t.license && [t.license.classes.join(", "), t.license.since ? `licensed since ${t.license.since}` : null].filter(Boolean).join(" · ")}
        </Row>
      )}
      {t.matching && (
        <Row icon={Hammer} title={`${t.matching.count} ${t.matching.word} permit${t.matching.count === 1 ? "" : "s"} on file`}>
          The kind of work you're planning.
        </Row>
      )}
      {t.nearby && (
        <Row icon={MapPin} title={`${t.nearby.count} job${t.nearby.count === 1 ? "" : "s"} in ${t.nearby.zip}, your ZIP code`}>
          {t.nearby.streets.length ? `On ${t.nearby.streets.join(", ")}.` : null} They know your neighborhood's homes and inspectors.
        </Row>
      )}
      {t.inspections ? (
        <Row icon={ClipboardCheck} title={`${t.inspections.signoffs} city inspection sign-off${t.inspections.signoffs === 1 ? "" : "s"} on their ${t.inspections.checked} most recent permit${t.inspections.checked === 1 ? "" : "s"}`}>
          {[t.inspections.trades.join(", "), t.inspections.finaled ? `${t.inspections.finaled} fully finaled` : null].filter(Boolean).join(" · ")}
        </Row>
      ) : checkingInspections ? (
        <Row icon={ClipboardCheck} title="Checking the city's inspection records…" />
      ) : null}
      <Row icon={FileText} title={`${t.permits} San Jose permit${t.permits === 1 ? "" : "s"} on file${t.since ? ` since ${t.since}` : ""}`} />
    </ul>

    {t.recent.length > 0 && (
      <>
        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent jobs</p>
        <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
          {t.recent.map((j, i) => (
            <li key={i} className="px-4 py-2.5 text-[13px]">
              <p className="text-foreground/90">{j.what}</p>
              <p className="text-xs text-muted-foreground">{[j.street, j.zip, j.when].filter(Boolean).join(" · ")}</p>
              {j.signoffs.length > 0 && (
                <p className="mt-1 inline-flex flex-wrap gap-1">
                  {j.signoffs.map((s) => (
                    <span key={s} className="rounded-full bg-sage/10 px-2 py-0.5 text-[10.5px] font-medium text-sage">
                      {s} passed
                    </span>
                  ))}
                </p>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted-foreground">Streets only. Haleo never shows a house number or an owner's name.</p>
      </>
    )}
  </>
);

