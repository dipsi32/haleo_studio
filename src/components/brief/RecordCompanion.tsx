// While a homeowner fills in their project through a contractor's link, the
// contractor's public record keeps them company in one quiet place: a slim
// strip pinned at the top. It never sits in the form.
//
//   - Collapsed: "3 things in Matt's record match your project".
//   - When an answer unlocks a new fact, the strip opens for a few seconds
//     with that one fact, then folds back into the count.
//   - Tap it: a sheet with every matching fact, and under each, the permits
//     behind it (what, ZIP, month, status; never an address or an owner).
//
// Only true, favorable facts from the permit record (see recordHighlights).
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Check, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { IntakeData } from "@/lib/intake";
import { permitLine, recordHighlights, type Highlight } from "@/lib/recordHighlights";
import { useContractorRecord, useLicense, type ContractorRecord } from "@/lib/useContractorRecord";

const PEEK_MS = 5200;

const ORDER: Highlight["id"][] = ["work", "nearby", "structural", "track"];

export default function RecordCompanion({ data }: { data: IntakeData }) {
  const record = useContractorRecord();
  if (!record) return null;
  return <Companion record={record} data={data} />;
}

const Companion = ({ record, data }: { record: ContractorRecord; data: IntakeData }) => {
  const facts = useMemo(
    () => recordHighlights(record.permits, data, record.who).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)),
    [record, data],
  );
  const matched = facts.filter((f) => f.id !== "track");
  const owner = record.person ? `${record.person}'s` : `${record.who}'s`;

  // Peek at a fact the moment an answer unlocks it (or changes it).
  const seen = useRef<Map<string, string> | null>(null);
  const [peek, setPeek] = useState<Highlight | null>(null);
  const matchedKey = matched.map((f) => `${f.id}:${f.text}`).join("|");
  useEffect(() => {
    if (seen.current === null) {
      // What's true when the page opens isn't news: don't peek at it.
      seen.current = new Map(matched.map((f) => [f.id, f.text]));
      return;
    }
    const fresh = matched.find((f) => seen.current!.get(f.id) !== f.text);
    for (const f of matched) seen.current.set(f.id, f.text);
    if (!fresh) return;
    setPeek(fresh);
    track("record_highlight_shown", { kind: fresh.id });
    // matched is derived from matchedKey; keying on the text keeps this to real changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedKey]);
  useEffect(() => {
    if (!peek) return;
    const t = setTimeout(() => setPeek(null), PEEK_MS);
    return () => clearTimeout(t);
  }, [peek]);

  const [open, setOpen] = useState(false);
  const track0 = facts.find((f) => f.id === "track");

  return (
    <>
      <div className="sticky top-0 z-20 border-b border-sage/15 bg-background/90 backdrop-blur">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setPeek(null);
            track("record_companion_opened", { matched: matched.length });
          }}
          className="container flex w-full items-start gap-2.5 py-2 text-left"
          aria-label={`See ${owner} record`}
        >
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sage/15 text-sage">
            <Check className="h-3 w-3" />
          </span>
          <span className="min-w-0 flex-1">
            <AnimatePresence initial={false} mode="wait">
              {peek ? (
                <motion.span
                  key={`peek-${peek.text}`}
                  role="status"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.35 }}
                  className="block text-[13px] leading-snug text-foreground/90"
                  data-record={peek.id}
                >
                  {peek.text}
                  <span className="ml-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-sage">Public record</span>
                </motion.span>
              ) : (
                <motion.span
                  key="summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="block truncate text-[13px] text-foreground/80"
                >
                  {matched.length > 0 ? (
                    <>
                      <span className="font-medium text-foreground">
                        {matched.length} thing{matched.length === 1 ? "" : "s"} in {owner} record
                      </span>{" "}
                      {matched.length === 1 ? "matches" : "match"} your project
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{owner} record</span> · {record.permits.length} San Jose permit
                      {record.permits.length === 1 ? "" : "s"}
                    </>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
            See <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
        {/* A thin bar that drains while a fact is showing, so it never feels stuck. */}
        {peek && (
          <motion.span
            key={`bar-${peek.text}`}
            className="block h-0.5 origin-left bg-sage/40"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: PEEK_MS / 1000, ease: "linear" }}
          />
        )}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[85vh]">
          <div className="mx-auto w-full max-w-lg overflow-y-auto px-5 pb-8">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="font-display text-2xl font-light">
                {owner} record, <span className="italic">for your project</span>
              </DrawerTitle>
              <DrawerDescription>
                From San Jose permit records{record.licenseNumber ? " and the state license board" : ""}. Haleo doesn't rate or endorse contractors.
              </DrawerDescription>
            </DrawerHeader>

            {record.licenseNumber && <LicenseRow licenseNumber={record.licenseNumber} />}

            <ul className="mt-3 space-y-2">
              {matched.map((f) => (
                <FactRow key={f.id} fact={f} />
              ))}
              {track0 && <FactRow fact={track0} />}
            </ul>

            {matched.length === 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                As you describe your project and add your address, the parts of the record that match it show up here.
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

const LicenseRow = ({ licenseNumber }: { licenseNumber: string }) => {
  const license = useLicense(licenseNumber);
  const active = !!license?.status && /active|clear/i.test(license.status);
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm">
      <BadgeCheck className={cn("h-4 w-4 shrink-0", active ? "text-sage" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1">
        California license {licenseNumber}
        <span className="ml-1.5 text-muted-foreground">
          {license === undefined ? "· checking with the state…" : active ? `· ${license!.status}` : license ? `· ${license.status ?? "status not reported"}` : "· not checked yet"}
        </span>
      </span>
    </div>
  );
};

const FactRow = ({ fact }: { fact: Highlight }) => {
  const [open, setOpen] = useState(false);
  const permits = fact.permits ?? [];
  return (
    <li className="rounded-2xl border border-sage/20 bg-sage/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2.5 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
        <span className="min-w-0 flex-1 text-sm leading-snug text-foreground/90">{fact.text}</span>
        {permits.length > 0 && <ChevronDown className={cn("mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
      </button>
      <AnimatePresence initial={false}>
        {open && permits.length > 0 && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 pb-3"
          >
            {permits.slice(0, 8).map((p, i) => {
              const l = permitLine(p);
              return (
                <li key={i} className="flex items-start gap-2 border-t border-border/60 py-2 text-[13px]">
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground/90">{l.what}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[l.where, l.when, l.status].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </li>
              );
            })}
            {permits.length > 8 && <li className="pt-1 text-xs text-muted-foreground">And {permits.length - 8} more.</li>}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
};
