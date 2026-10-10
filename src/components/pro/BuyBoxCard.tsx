// A contractor's fit criteria. The deal read uses them to say "fits", "worth a
// look" or "outside what you look for". Empty means "show me everything".
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import type { Json } from "@/integrations/supabase/types";
import { PROJECT_KIND_LABEL, hasBuyBoxCriteria, toBuyBox, type BuyBox, type ProjectKind } from "@/lib/dealRead";

const KINDS = Object.keys(PROJECT_KIND_LABEL) as ProjectKind[];

type Props = {
  accountId: string;
  initial: unknown;
  onSaved?: () => void;
};

export default function BuyBoxCard({ accountId, initial, onSaved }: Props) {
  const { toast } = useToast();
  const [minBudget, setMinBudget] = useState("");
  const [minSqft, setMinSqft] = useState("");
  const [kinds, setKinds] = useState<ProjectKind[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const b = toBuyBox(initial);
    setMinBudget(b?.min_budget_k ? String(b.min_budget_k) : "");
    setMinSqft(b?.min_sqft ? String(b.min_sqft) : "");
    setKinds(b?.project_types ?? []);
  }, [initial]);

  const toggle = (k: ProjectKind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const save = async () => {
    const num = (v: string) => {
      const n = parseFloat(v.replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };
    const box: BuyBox = { min_budget_k: num(minBudget), min_sqft: num(minSqft), project_types: kinds.length ? kinds : null };
    setSaving(true);
    try {
      const { error } = await supabase
        .from("contractor_accounts")
        .update({ buy_box: hasBuyBoxCriteria(box) ? (box as unknown as Json) : null })
        .eq("id", accountId);
      if (error) throw error;
      track("buy_box_saved", { has_budget: !!box.min_budget_k, has_sqft: !!box.min_sqft, kinds: kinds.length });
      toast({ title: "Fit criteria saved", description: "New briefs will be read against them." });
      onSaved?.();
    } catch (e) {
      toast({ title: "Couldn't save", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section id="fit" className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-xl">What you take on</h2>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">
        Every brief gets a read against this: fits, worth a look, or outside what you look for. Leave a field empty to
        skip it. Nothing is hidden from you either way.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Smallest budget, in $K</span>
          <Input
            inputMode="numeric"
            value={minBudget}
            onChange={(e) => setMinBudget(e.target.value)}
            placeholder="e.g. 200"
            className="mt-1 h-11 rounded-xl bg-background"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Smallest addition, in sq ft</span>
          <Input
            inputMode="numeric"
            value={minSqft}
            onChange={(e) => setMinSqft(e.target.value)}
            placeholder="e.g. 400"
            className="mt-1 h-11 rounded-xl bg-background"
          />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Project types</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {KINDS.map((k) => {
            const on = kinds.includes(k);
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(k)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground/80 hover:border-foreground/40"
                }`}
              >
                {PROJECT_KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save} disabled={saving} className="rounded-full">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </section>
  );
}
