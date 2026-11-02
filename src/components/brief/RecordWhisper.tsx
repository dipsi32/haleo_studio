// A slim card at the top of each brief step when the homeowner came through a
// contractor's link. As they describe their project, the contractor's public
// record speaks to it: their kind of job, their ZIP code, bigger scopes.
// The newest fact eases in, so each answer feels answered.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { IntakeData } from "@/lib/intake";
import { getActiveInvite } from "@/lib/invites";
import { recordHighlights, type RecordPermit } from "@/lib/recordHighlights";
import { track } from "@/lib/analytics";

export default function RecordWhisper({ intake }: { intake: IntakeData }) {
  const invite = useMemo(() => getActiveInvite(), []);
  const [permits, setPermits] = useState<RecordPermit[] | null>(null);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!invite) return;
    let cancelled = false;
    supabase
      .from("contractor_permits")
      .select("city, zip, issued_date, work_type, description")
      .eq("contractor_id", invite.contractorId)
      .order("issued_date", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (!cancelled) setPermits((data ?? []) as RecordPermit[]);
      });
    return () => {
      cancelled = true;
    };
  }, [invite]);

  const highlights = useMemo(
    () => (invite && permits ? recordHighlights(permits, intake, invite.contractorName) : []),
    [invite, permits, intake],
  );

  // The newest fact: the last one unlocked that this card hasn't shown yet.
  const fresh = highlights.filter((h) => !seen.current.has(h.id)).map((h) => h.id);
  useEffect(() => {
    for (const h of highlights) {
      if (!seen.current.has(h.id) && h.id !== "track") track("record_highlight_shown", { kind: h.id });
      seen.current.add(h.id);
    }
  }, [highlights]);

  if (!invite || highlights.length === 0) return null;

  return (
    <aside aria-label={`${invite.contractorName}'s record for your project`} className="mx-auto mb-6 max-w-xl rounded-2xl border border-sage/25 bg-card/80 px-4 py-3 shadow-soft backdrop-blur">
      <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        <span>{invite.contractorName}, for your project</span>
        <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] tracking-wide">Public record</span>
      </p>
      <ul className="mt-2 space-y-1.5">
        <AnimatePresence initial={false}>
          {highlights.map((h) => (
            <motion.li
              key={h.id}
              layout
              initial={{ opacity: 0, y: 6, backgroundColor: "hsl(var(--accent) / 0.12)" }}
              animate={{ opacity: 1, y: 0, backgroundColor: "hsl(var(--accent) / 0)" }}
              transition={{ duration: 0.5, backgroundColor: { duration: 2.4 } }}
              className="-mx-1.5 flex items-start gap-2 rounded-lg px-1.5 py-0.5 text-[13.5px] leading-snug"
              data-fresh={fresh.includes(h.id) || undefined}
            >
              <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-sage" />
              <span>{h.text}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </aside>
  );
}
