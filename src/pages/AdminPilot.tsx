// /admin/pilot: run the contractor pilot.
//   - Add any contractor to the pilot and get their three links: the demo,
//     the claim link (for the kickoff call), and their own link once claimed.
//   - Record their normal numbers at kickoff (the baseline the scorecard compares against).
//   - The launch scorecard: seven questions, for all pilots and for each one.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, Copy, Plus, RefreshCw, Search } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { demoUrl, titleCase } from "@/lib/demo";
import { frontDoorHandle, frontDoorUrl } from "@/lib/frontDoor";
import { scorecard, totalRow, type Answer, type Baseline, type PilotRow, type Verdict } from "@/lib/pilotScorecard";

type Found = { id: string; slug: string; name: string; company: string | null; city: string | null; claimed: boolean };

const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  good: { label: "On track", cls: "border-sage/40 bg-sage/10 text-sage" },
  watch: { label: "Watch", cls: "border-amber-400/40 bg-amber-50 text-amber-700" },
  concern: { label: "Concern", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
  early: { label: "Too early", cls: "border-border bg-secondary text-muted-foreground" },
};

const BASELINE_FIELDS: { key: keyof Baseline; label: string }[] = [
  { key: "inquiries", label: "Inquiries a month" },
  { key: "visits", label: "Site visits a month" },
  { key: "jobs_won", label: "Jobs won a month" },
  { key: "minutes_per_lead", label: "Minutes on texts/calls per lead before a visit" },
  { key: "late_mismatches_per_10_visits", label: "Of 10 visits, how many hit a surprise that should've been caught earlier" },
];

const origin = typeof window !== "undefined" ? window.location.origin : "";

const Answers = ({ answers }: { answers: Answer[] }) => (
  <ol className="grid gap-3 md:grid-cols-2">
    {answers.map((a) => (
      <li key={a.n} className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {a.n}. {a.question}
          </p>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold", VERDICT[a.verdict].cls)}>{VERDICT[a.verdict].label}</span>
        </div>
        <p className="mt-1.5 font-display text-lg leading-snug">{a.headline}</p>
        <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
          {a.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </li>
    ))}
  </ol>
);

const CopyLine = ({ label, value }: { label: string; value: string }) => {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate rounded-lg bg-muted/50 px-2 py-1 text-xs">{value}</code>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          await navigator.clipboard.writeText(value).catch(() => undefined);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};

const PilotCard = ({ row, onChanged }: { row: PilotRow; onChanged: () => void }) => {
  const [open, setOpen] = useState(false);
  const [baseline, setBaseline] = useState<Record<string, string>>(
    Object.fromEntries(BASELINE_FIELDS.map((f) => [f.key, row.baseline?.[f.key] != null ? String(row.baseline[f.key]) : ""])),
  );
  const [price, setPrice] = useState(row.price_offered_monthly != null ? String(row.price_offered_monthly) : "");
  const [handle, setHandle] = useState<string | null>(null);
  const answers = useMemo(() => scorecard(row), [row]);
  const brand = titleCase(row.name);

  useEffect(() => {
    if (!row.claimed) return;
    supabase
      .from("contractor_accounts")
      .select("company_name, front_door_handle")
      .eq("contractor_id", row.contractor_id)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as { company_name?: string | null; front_door_handle?: string | null } | null;
        setHandle(frontDoorHandle({ chosen: d?.front_door_handle, companyName: d?.company_name ?? brand, slug: row.slug }));
      });
  }, [row.claimed, row.contractor_id, row.slug, brand]);

  const update = async (patch: Record<string, unknown>, what: string) => {
    const { error } = await supabase.from("contractor_pilots").update({ ...patch, updated_at: new Date().toISOString() }).eq("contractor_id", row.contractor_id);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    track("pilot_updated", { what });
    toast({ title: "Saved" });
    onChanged();
  };

  const verdicts = answers.map((a) => a.verdict);

  return (
    <li className="rounded-3xl border border-border bg-card p-5 shadow-soft">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center justify-between gap-3 text-left">
        <span>
          <span className="block font-display text-xl">{brand}</span>
          <span className="block text-xs text-muted-foreground">
            {row.status} · since {new Date(row.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} ·{" "}
            {row.claimed ? "claimed" : "not claimed yet"} · {row.briefs_sent} brief{row.briefs_sent === 1 ? "" : "s"}
          </span>
        </span>
        <span className="flex gap-1" aria-label="Scorecard at a glance">
          {verdicts.map((v, i) => (
            <span key={i} title={`${i + 1}. ${VERDICT[v].label}`} className={cn("h-2.5 w-5 rounded-full border", VERDICT[v].cls)} />
          ))}
        </span>
      </button>

      {open && (
        <div className="mt-5 space-y-6">
          <div className="space-y-2 rounded-2xl border border-border bg-background/60 p-4">
            <p className="text-sm font-medium">Links</p>
            <CopyLine label="Demo" value={demoUrl({ slug: row.slug, brand, person: null, recordName: row.name }, origin)} />
            <CopyLine label="Claim (call)" value={`${origin}/pro/${row.slug}/claim`} />
            {handle ? <CopyLine label="Their link" value={frontDoorUrl(handle, "text", origin)} /> : <p className="text-xs text-muted-foreground">Their own link appears once they claim.</p>}
          </div>

          <div className="rounded-2xl border border-border bg-background/60 p-4">
            <p className="text-sm font-medium">Their normal intake, before Haleo</p>
            <p className="text-xs text-muted-foreground">Ask on the kickoff call. The scorecard compares against these.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {BASELINE_FIELDS.map((f) => (
                <label key={f.key} className="text-xs text-muted-foreground">
                  {f.label}
                  <Input
                    value={baseline[f.key]}
                    onChange={(e) => setBaseline((b) => ({ ...b, [f.key]: e.target.value.replace(/[^\d.]/g, "").slice(0, 5) }))}
                    inputMode="decimal"
                    className="mt-1 h-9 rounded-xl"
                  />
                </label>
              ))}
            </div>
            <Button
              size="sm"
              className="mt-3 rounded-full"
              onClick={() =>
                void update(
                  { baseline: Object.fromEntries(Object.entries(baseline).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])) },
                  "baseline",
                )
              }
            >
              Save baseline
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-background/60 p-4">
            <label className="text-xs text-muted-foreground">
              Status
              <select
                value={row.status}
                onChange={(e) => void update({ status: e.target.value }, "status")}
                className="mt-1 block h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              >
                {["invited", "active", "paused", "ended"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Price offered ($/month)
              <Input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1 h-9 w-28 rounded-xl" />
            </label>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => void update({ price_offered_monthly: price ? Number(price) : null }, "price")}>
              Save price
            </Button>
            <Button
              size="sm"
              variant={row.paying_since ? "ghost" : "default"}
              className="rounded-full"
              onClick={() => void update({ paying_since: row.paying_since ? null : new Date().toISOString() }, "paying")}
            >
              {row.paying_since ? "Mark not paying" : "Mark paying"}
            </Button>
          </div>

          <Answers answers={answers} />
        </div>
      )}
    </li>
  );
};

export default function AdminPilot() {
  const [rows, setRows] = useState<PilotRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("admin_pilot_scorecard");
    if (e) {
      setError(/not_admin/.test(e.message) ? "Admins only." : e.message);
      setRows([]);
      return;
    }
    setRows((data as unknown as PilotRow[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setFound([]);
      return;
    }
    const t = setTimeout(async () => {
      const like = `%${q.replace(/[%_,()]/g, " ")}%`;
      const { data } = await supabase
        .from("contractors")
        .select("id, slug, name, company, city, claimed")
        .or(`name.ilike.${like},company.ilike.${like}`)
        .limit(8);
      setFound((data ?? []) as Found[]);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const add = async (c: Found) => {
    const { error: e } = await supabase.from("contractor_pilots").insert({ contractor_id: c.id, status: "invited" });
    if (e) {
      toast({ title: /duplicate/i.test(e.message) ? "Already in the pilot" : "Couldn't add", description: e.message, variant: "destructive" });
      return;
    }
    track("pilot_contractor_added", { contractor_id: c.id });
    setQuery("");
    setFound([]);
    void load();
  };

  const total = rows && rows.length > 1 ? totalRow(rows) : null;
  const inPilot = new Set((rows ?? []).map((r) => r.contractor_id));

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Logo />
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Admin
        </Link>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-24">
        <h1 className="font-display text-3xl font-light">Contractor pilot</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Add a contractor, demo it, claim it with them on a call, and watch the seven questions fill in. Everything here
          comes from what they and their homeowners actually did.
        </p>

        <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-soft">
          <label htmlFor="pilot-search" className="text-sm font-medium">
            Add a contractor
          </label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="pilot-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name on their permits or license" className="h-11 rounded-xl pl-9" />
          </div>
          {found.length > 0 && (
            <ul className="mt-3 divide-y divide-border rounded-2xl border border-border">
              {found.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-medium">{titleCase(c.company || c.name)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.city ?? "—"} · {c.claimed ? "claimed" : "not claimed"}
                    </span>
                  </span>
                  {inPilot.has(c.id) ? (
                    <span className="text-xs text-muted-foreground">In the pilot</span>
                  ) : (
                    <Button size="sm" className="rounded-full" onClick={() => void add(c)}>
                      <Plus className="h-3.5 w-3.5" /> Add
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        {rows === null ? (
          <div className="mt-8 h-40 animate-pulse rounded-3xl bg-muted/40" />
        ) : rows.length === 0 ? (
          <p className="mt-8 text-sm text-muted-foreground">No contractors in the pilot yet. Add one above.</p>
        ) : (
          <>
            <div className="mt-10 flex items-center justify-between">
              <h2 className="font-display text-2xl font-light">Launch scorecard</h2>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void load()}>
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </Button>
            </div>
            {total && (
              <div className="mt-4">
                <p className="mb-3 text-sm text-muted-foreground">All {rows.length} pilots together</p>
                <Answers answers={scorecard(total)} />
              </div>
            )}
            <ul className="mt-8 space-y-4">
              {rows.map((r) => (
                <PilotCard key={r.contractor_id} row={r} onChanged={() => void load()} />
              ))}
            </ul>
          </>
        )}
      </main>
    </div>
  );
}
