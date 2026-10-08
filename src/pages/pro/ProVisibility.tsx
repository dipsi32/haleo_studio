// Where a contractor shows up when a homeowner searches. Every number on this
// page comes from a dated scan (see supabase/functions/visibility-scan) and the
// page shows the search, the sample size and the listing we matched, so the
// contractor can check it. Where we can't measure something, it says so.
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Info, RefreshCw, Search, Sparkles, Star } from "lucide-react";
import ProHeader from "@/components/pro/ProHeader";
import ProofPanel from "@/components/contractors/ProofPanel";
import { Button } from "@/components/ui/button";
import { useContractorAccount } from "@/hooks/useContractorAccount";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { demoScan } from "@/lib/visibilityDemo";
import {
  cooldownLeftHours,
  rankLabel,
  reviewGap,
  summarizeAi,
  summarizeSearch,
  topRivals,
  type ScanResults,
  type ScanRow,
  type SearchChannel,
} from "@/lib/visibility";

const Tile = ({ label, big, sub, tone }: { label: string; big: string; sub: string; tone?: "good" | "mid" | "quiet" }) => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`mt-2 font-display text-3xl leading-none ${tone === "good" ? "text-sage" : tone === "mid" ? "text-amber-700" : "text-foreground"}`}>
      {big}
    </p>
    <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
  </div>
);

const Unavailable = ({ title, reason }: { title: string; reason: string }) => (
  <div className="rounded-2xl border border-dashed border-border bg-card/40 p-5">
    <p className="font-medium">{title}</p>
    <p className="mt-1 text-sm text-muted-foreground">{reason}</p>
  </div>
);

function SearchCard({ title, source, ch }: { title: string; source: { label: string; href: string }; ch: SearchChannel }) {
  if (ch.status !== "ok") return <Unavailable title={title} reason={ch.reason} />;
  const listing = ch.perQuery.find((q) => q.listing)?.listing ?? null;
  const conf = ch.perQuery.find((q) => q.listing)?.confidence;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg">{title}</h3>
        <a href={source.href} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Data from {source.label}
        </a>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {ch.perQuery.map((q) => (
          <li key={q.key} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="min-w-0 text-sm text-foreground/80">"{q.text}"</span>
            <span className={`shrink-0 text-sm font-medium ${q.rank == null ? "text-muted-foreground" : q.rank <= 3 ? "text-sage" : ""}`}>
              {rankLabel(q)}
            </span>
          </li>
        ))}
      </ul>

      {listing ? (
        <p className="mt-3 text-sm text-muted-foreground">
          We matched <span className="text-foreground">{listing.name}</span>
          {listing.rating != null && (
            <>
              {" "}
              · <Star className="inline h-3 w-3 -translate-y-px" /> {listing.rating.toFixed(1)}
              {listing.reviews != null && ` from ${listing.reviews.toLocaleString("en-US")} reviews`}
            </>
          )}
          {listing.url && (
            <>
              {" "}
              <a href={listing.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-foreground underline underline-offset-4">
                Open <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
          {conf === "name" && ". We matched on the name only, so check this is you."}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          We couldn't find a listing for you in these results. If you have one, it may be under a different name or phone number.
        </p>
      )}
    </section>
  );
}

function AiCard({ results }: { results: ScanResults }) {
  const ai = results.ai;
  if (ai.status !== "ok") return <Unavailable title="AI assistants" reason={ai.reason} />;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-lg">AI assistants</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        We asked each assistant the same homeowner question several times and counted how often you were named. Answers vary, so this is a rate, not a rank.
      </p>
      <div className="mt-4 space-y-5">
        {ai.models.map((m) => {
          const mentioned = m.perQuery.reduce((n, q) => n + q.mentioned, 0);
          const runs = m.perQuery.reduce((n, q) => n + q.runs, 0);
          return (
            <div key={m.id}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground">
                  named in {mentioned} of {runs} answers
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${m.label} named you in ${mentioned} of ${runs} answers`}>
                <div className="h-full rounded-full bg-sage" style={{ width: runs ? `${(mentioned / runs) * 100}%` : 0 }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        These come from the assistant's own knowledge, without a live web search. The apps people use may also browse the web, so treat this as a signal, not a ruling.
      </p>
    </section>
  );
}

export default function ProVisibility() {
  const { account } = useContractorAccount();
  const { toast } = useToast();
  const contractorId = account?.contractor_id ?? null;

  const [scan, setScan] = useState<ScanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [isDemo, setIsDemo] = useState(false);

  const load = useCallback(async () => {
    if (!contractorId) return;
    const { data } = await supabase
      .from("visibility_scans")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setScan((data as unknown as ScanRow) ?? null);
    setIsDemo(false);
    setLoading(false);
  }, [contractorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showSample = () => {
    setScan(demoScan(account?.company_name || "Your company", "San Jose"));
    setIsDemo(true);
  };

  const run = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("visibility-scan");
      if (error) {
        let body: { error?: string } | null = null;
        try {
          body = await (error as unknown as { context?: Response }).context?.json();
        } catch {
          /* no body */
        }
        if (body?.error === "cooldown") {
          track("visibility_scan_blocked");
          toast({ title: "Checked recently", description: "Results don't change hour to hour. Come back later today." });
        } else {
          // Live checks aren't connected yet: show a clearly labeled sample.
          showSample();
        }
        return;
      }
      setScan((data as { scan: ScanRow }).scan);
      setIsDemo(false);
      track("visibility_scan_run");
    } finally {
      setRunning(false);
    }
  };

  const results = scan?.results ?? null;
  const google = results ? summarizeSearch(results.google) : null;
  const yelp = results ? summarizeSearch(results.yelp) : null;
  const ai = results ? summarizeAi(results.ai) : null;
  const rivals = useMemo(() => (results ? topRivals(results) : []), [results]);
  const gap = results ? (reviewGap(results.google) ?? reviewGap(results.yelp)) : null;
  const wait = isDemo ? 0 : cooldownLeftHours(scan?.created_at ?? null);

  const searchTile = (s: ReturnType<typeof summarizeSearch>) =>
    !s
      ? { big: "Not measured", sub: "This source isn't connected yet.", tone: "quiet" as const }
      : s.found === 0
        ? { big: "Not found", sub: `You weren't in the results for any of ${s.searched} searches.`, tone: "mid" as const }
        : {
            big: `#${s.best}`,
            sub: `Your best spot. Found in ${s.found} of ${s.searched} searches.`,
            tone: s.best! <= 3 ? ("good" as const) : ("mid" as const),
          };

  const g = searchTile(google);
  const y = searchTile(yelp);

  return (
    <div className="min-h-screen bg-background">
      <ProHeader />
      <main className="mx-auto max-w-5xl px-6 py-7 md:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="font-display text-2xl font-light">Where homeowners find you</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              We run the searches a homeowner planning a big project would run and show you where you land, with the search
              and the listing we matched so you can check us. If we can't measure something, we say so.
            </p>
          </div>
          <div className="flex flex-col gap-1 sm:items-end">
            <Button onClick={run} disabled={running || !contractorId || wait > 0} className="rounded-full">
              <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
              {running ? "Checking…" : scan ? "Check again" : "Check my visibility"}
            </Button>
            {scan && !isDemo && (
              <p className="text-xs text-muted-foreground sm:text-right">
                {wait > 0 ? `Next check in about ${wait}h. ` : ""}Last checked {formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}
              </p>
            )}
          </div>
        </div>

        {isDemo && (
          <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-50 p-4 text-sm text-amber-900" role="status">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <span className="font-medium">Sample data.</span> This shows what a check looks like once Google, Yelp and the AI check are connected. These
              numbers and company names aren't real and aren't yours.
            </p>
          </div>
        )}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted/40" />)}</div>
        ) : !results ? (
          <div className="rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 font-display text-lg">No check yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              It takes about 30 seconds. We search Google and Yelp, and ask ChatGPT and Gemini who they'd recommend, for the
              kind of work you do in {account?.service_areas?.split(",")[0]?.trim() || "your city"}.
            </p>
            <button onClick={showSample} className="mt-4 text-sm text-foreground underline underline-offset-4 hover:text-accent">
              See a sample first
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Tile label="Google" {...g} />
              <Tile label="Yelp" {...y} />
              <Tile
                label="ChatGPT and Gemini"
                big={ai ? `${ai.mentioned} of ${ai.runs}` : "Not measured"}
                sub={ai ? "answers named you" : "This source isn't connected yet."}
                tone={!ai ? "quiet" : ai.mentioned / ai.runs >= 0.5 ? "good" : "mid"}
              />
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              Searches in {results.city}:{" "}
              {results.queries.map((q, i) => (
                <span key={q.key}>
                  {i > 0 && ", "}"{q.text}"
                </span>
              ))}
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <SearchCard title="Google" source={{ label: "Google Maps", href: "https://www.google.com/maps" }} ch={results.google} />
              <SearchCard title="Yelp" source={{ label: "Yelp", href: "https://www.yelp.com" }} ch={results.yelp} />
              <AiCard results={results} />
              <Unavailable
                title="Angi"
                reason="Angi doesn't share ranking data we can use, so we don't show a number. We'd rather leave it blank than guess."
              />
            </div>

            {(gap || rivals.length > 0) && (
              <section className="mt-6 rounded-2xl border border-foreground/15 bg-card p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <h2 className="font-display text-lg">What stands out</h2>
                </div>
                {gap && (
                  <p className="mt-3 text-sm leading-relaxed text-foreground/85">
                    You have {gap.yours.toLocaleString("en-US")} reviews. The top listings in these searches typically have about{" "}
                    {gap.typicalTop3.toLocaleString("en-US")}.{" "}
                    {gap.yours >= gap.typicalTop3
                      ? "You're at or above that."
                      : "Review count is one of the things Google and Yelp weigh, not the only one."}
                  </p>
                )}
                {rivals.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-muted-foreground">Who shows up most across the search results and AI answers:</p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {rivals.map((r) => (
                        <li key={r.name} className="rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                          {r.name} <span className="text-muted-foreground">· {r.appearances}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {contractorId && (
          <section className="mt-10">
            <h2 className="font-display text-xl">What homeowners see about you on Haleo</h2>
            <p className="mb-3 mt-1 max-w-2xl text-sm text-muted-foreground">
              Built from public permit and license records, counted by city. This is the record a homeowner sees when you send them a brief link.
            </p>
            <ProofPanel contractorId={contractorId} city={null} variant="full" />
          </section>
        )}
      </main>
    </div>
  );
}
