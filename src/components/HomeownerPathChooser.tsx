import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, FileSearch, Hammer, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

/**
 * The "two doors" — the first thing a homeowner sees when they land in their
 * account. Most homeowners arrive in one of two emotional states:
 *
 *   1. They already have a proposal in hand and they're nervous about signing it.
 *   2. They have a project in mind and don't know which contractor to trust.
 *
 * We route both, gently and clearly, without overwhelming them with options.
 */
export default function HomeownerPathChooser() {
  const { user } = useAuth();
  const [analyzedCount, setAnalyzedCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const uploads = await supabase
        .from("proposal_analyses").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("status", "complete");
      let total = uploads.count ?? 0;
      if (user.email) {
        const { data: batches } = await supabase
          .from("outreach_batches").select("id").eq("homeowner_email", user.email);
        const batchIds = (batches ?? []).map((b: any) => b.id);
        if (batchIds.length > 0) {
          const { count } = await supabase.from("outreach_sends")
            .select("id", { count: "exact", head: true })
            .in("batch_id", batchIds)
            .not("proposal_submitted_at", "is", null);
          total += count ?? 0;
        }
      }
      if (!cancelled) setAnalyzedCount(total);
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.email]);

  return (
    <section aria-labelledby="paths-heading" className="mt-10">
      <h2 id="paths-heading" className="font-display text-xl font-medium">
        Where are you in the process?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Two doors. Both free to start.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {[
          {
            to: "/proposal",
            icon: FileSearch,
            eyebrow: "I have a bid in hand",
            title: "Audit my proposal",
            sub: "Line-by-line check against local pricing. ~1 minute.",
          },
          {
            to: "/brief?fresh=1",
            icon: Hammer,
            eyebrow: "I'm still looking",
            title: "Find the right contractor",
            sub: "Ranked by who's actually built nearby — not Yelp ads.",
          },
        ].map((p, i) => (
          <motion.div
            key={p.to}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <Link
              to={p.to}
              className="group flex h-full items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-soft"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft">
                <p.icon className="h-4 w-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {p.eyebrow}
                </p>
                <p className="mt-0.5 font-display text-lg font-light">{p.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
          </motion.div>
        ))}
      </div>

      {analyzedCount >= 2 && (
        <Link
          to="/proposal/compare"
          className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-accent/40"
        >
          <div className="flex items-center gap-2.5">
            <BarChart3 className="h-4 w-4 text-accent" />
            <span className="text-sm">
              Compare your <span className="font-medium">{analyzedCount} bids</span> side-by-side
            </span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      )}
    </section>
  );
}
