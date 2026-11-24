// Tapping a contractor's name: a short, warm hand-off instead of a jump.
// "You'd like to see more of Ji Inc. We're pulling everything we have…"
// while we find their record (and read their San José permits from the city
// if we hold too little), then open their profile.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { tidyName } from "@/lib/houseReport";
import { pickPermitMatch } from "@/lib/shortlist";
import type { Contractor } from "@/lib/contractors";

const words = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !["INC", "LLC", "CO", "CORP", "THE", "AND", "DBA"].includes(w));

/**
 * Their record in Haleo, by name. Whole words only, then the shortlist's
 * strict matcher: "Ji Inc" must never open "Edens, Jim". A weak match
 * returns null rather than someone else's record.
 */
const findByName = async (raw: string): Promise<{ id: string; permits: number } | null> => {
  // "DOVE, DONALD" is also filed as "DONALD DOVE": try the words in both orders.
  const w = words(raw).slice(0, 3);
  if (!w.length) return null;
  const filters = [w, [...w].reverse()]
    .map((ws) => ws.join("%"))
    .flatMap((core) => [core, `${core} %`, `% ${core}`, `% ${core} %`])
    .flatMap((p) => [`company.ilike.${p}`, `name.ilike.${p}`])
    .join(",");
  const { data } = await supabase.from("contractors").select("*").or(filters).order("permit_count", { ascending: false }).limit(25);
  const row = pickPermitMatch(raw, (data ?? []) as Contractor[]);
  return row ? { id: row.id, permits: row.permit_count ?? 0 } : null;
};

/** The job they did on this house, so their profile can say so. */
export type HouseJob = { what: string; year: number | null; state: string };

const STEPS = ["Every permit they've pulled in San José", "What the city signed off, and what it didn't", "Their license with the state board"];

export function useContractorJump(context: { from: string; zip?: string; street?: string | null }) {
  const navigate = useNavigate();
  const [who, setWho] = useState<{ name: string; id?: string; job?: HouseJob } | null>(null);
  const [step, setStep] = useState(0);

  const open = useCallback((name: string, id?: string, job?: HouseJob) => {
    track("house_crew_opened", { has_id: !!id, from_permit: !!job });
    setStep(0);
    setWho({ name, id, job });
  }, []);

  useEffect(() => {
    if (!who) return;
    let alive = true;
    const tick = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length)), 650);
    (async () => {
      const started = Date.now();
      let id = who.id ?? null;
      let found = id ? { id, permits: 99 } : await findByName(who.name);
      // We hold little or nothing on them: read their permits from the city first.
      if (!found || found.permits < 3) {
        await supabase.functions.invoke("fetch-sj-permits", { body: { contractor: who.name, limit: 300 } }).catch(() => undefined);
        found = (await findByName(who.name)) ?? found;
      }
      id = found?.id ?? null;
      // Let the moment land: never flash by.
      const wait = Math.max(0, 2000 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      if (!alive) return;
      const state = { from: context.from, zip: context.zip, street: context.street, name: who.name, job: who.job };
      if (id) navigate(`/contractors/${id}`, { state });
      // Not in the city's records under that name: check them by name and license instead.
      else navigate(`/shortlist?${new URLSearchParams({ go: "1", name: who.name, zip: context.zip ?? "" }).toString()}`);
    })();
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [who, context.from, context.zip, context.street, navigate]);

  const element = (
    <AnimatePresence>
      {who && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Pulling ${tidyName(who.name)}'s record`}
        >
          <motion.div
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            className="relative w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-lift"
          >
            <button type="button" aria-label="Close" onClick={() => setWho(null)} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full hover:bg-secondary">
              <X className="h-4 w-4" />
            </button>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Their record</p>
            <h3 className="mt-2 pr-8 font-display text-[24px] font-light leading-tight">
              Pulling everything on <span className="italic">{tidyName(who.name)}</span>
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              You'd like to see more of their work. We're gathering it all in one place, from the city's records and the state license board.
            </p>
            <ul className="mt-5 space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-[14.5px]">
                  {step > i ? (
                    <motion.span initial={{ scale: 0.4 }} animate={{ scale: 1 }} className="grid h-6 w-6 place-items-center rounded-full bg-sage/15 text-sage">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </motion.span>
                  ) : (
                    <span className="grid h-6 w-6 place-items-center">
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    </span>
                  )}
                  <span className={step > i ? "" : "text-muted-foreground"}>{s}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return { open, element };
}
