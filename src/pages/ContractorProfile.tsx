// A contractor's record, read the way a homeowner weighs a contractor:
//   1. The answer: who they are and what the city's records say, in one line.
//   2. Can I trust them?   license (state board), sign-offs, how recent.
//   3. Near me?            jobs in your ZIP and on your street (never house numbers).
//   4. My kind of job?     what they do, by kind.
//   5. Lately?             their latest permits.
//   6. Before you call:    questions already written, from what we found.
// Haleo doesn't vet or rate anyone: every line says where it came from.
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Loader2, MapPin } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { cslbDeepLink, type Contractor, type LicenseStatus, type Permit } from "@/lib/contractors";
import { contractorSummary } from "@/lib/contractorSummary";
import { readLicense } from "@/lib/jobFit";
import { isRealLicense } from "@/lib/shortlist";
import { tidyName } from "@/lib/houseReport";
import { copyText } from "@/lib/copyText";
import { toLicenseStatus } from "@/lib/useContractors";
import type { HouseJob } from "@/components/house/ContractorJump";

type FromHouse = { from?: string; zip?: string; street?: string | null; name?: string; job?: HouseJob } | null;
type PublicProfile = { tagline: string | null; bio: string | null; years_in_business: number | null; service_areas: string | null };

const CSLB_NAME_SEARCH = "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx";
const monthYear = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const listOf = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

const Badge = ({ children, tone = "record" }: { children: string; tone?: "record" | "theirs" | "read" }) => (
  <span
    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
      tone === "record" ? "border-sage/30 bg-sage/10 text-sage" : tone === "theirs" ? "border-border bg-secondary text-muted-foreground" : "border-amber-400/40 bg-amber-50 text-amber-700"
    }`}
  >
    {children}
  </span>
);

const DOT = { finaled: "bg-sage", expired: "bg-destructive", open: "bg-amber-500" } as const;
const STATE_WORD = { finaled: "Signed off", expired: "Expired, no final", open: "Open" } as const;

const LICENSE_READ = {
  active: { word: "Active", tone: "text-sage", line: "In good standing with the state board." },
  expiring: { word: "Active", tone: "text-amber-700", line: "Active, but it expires within 90 days." },
  inactive: { word: "Not active", tone: "text-destructive", line: "The state board doesn't list it as active. Don't hire until that's fixed." },
  discipline: { word: "On record", tone: "text-destructive", line: "The state board lists disciplinary action. Read it before you hire." },
  not_checked: { word: "Not checked", tone: "text-muted-foreground", line: "We don't have their license number yet." },
} as const;

const ContractorProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ctx = (useLocation().state ?? null) as FromHouse;
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      const { data: c } = await supabase.from("contractors").select("*").eq("id", id).maybeSingle();
      if (!alive) return;
      if (!c) {
        setLoading(false);
        return;
      }
      setContractor(c as Contractor);
      track("contractor_profile_viewed", { contractor_id: id, from_house: !!ctx?.from });
      const [{ data: p }, { data: pp }] = await Promise.all([
        supabase.from("contractor_permits").select("*").eq("contractor_id", id).order("issued_date", { ascending: false }).limit(500),
        supabase.from("contractor_profiles_public" as never).select("tagline, bio, years_in_business, service_areas").eq("contractor_id", id).maybeSingle(),
      ]);
      if (!alive) return;
      setPermits((p ?? []) as Permit[]);
      if (pp) setProfile(pp as unknown as PublicProfile);
      setLoading(false);

      // The license, from the state board, only when we hold a real number.
      if (!isRealLicense(c.license_number)) return;
      setLicenseLoading(true);
      const { data: cached } = await supabase.from("contractor_license_cache").select("*").eq("license_number", c.license_number).maybeSingle();
      if (cached && alive) setLicense({ ...(cached as unknown as LicenseStatus), deep_link: cslbDeepLink(c.license_number) });
      if (!cached) {
        try {
          const { data: v } = await supabase.functions.invoke("verify-cslb-license", { body: { license: c.license_number } });
          if (alive && v?.ok) setLicense(toLicenseStatus({ ...v, license_number: v.license_number ?? c.license_number }));
        } catch {
          // Stays "not checked", and says so.
        }
      }
      if (alive) setLicenseLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const s = useMemo(() => contractorSummary(permits, { zip: ctx?.zip, street: ctx?.street, recent: 40 }), [permits, ctx?.zip, ctx?.street]);
  const name = contractor ? tidyName(contractor.company || contractor.name) : tidyName(ctx?.name ?? "");
  const lic = readLicense(license);
  const realLicense = !!contractor && isRealLicense(contractor.license_number);
  const yourStreet = s.streets.find((x) => x.yours);
  const done = s.finaled + s.expired;

  // The answer, in one line, before any detail.
  const answer = (() => {
    if (!s.total) return `We don't hold any San José permits for ${name} yet.`;
    // "Mostly" only when it's true: the kind is a real share of their permits.
    const kinds = s.kinds.filter((k) => k.count >= 2 && k.count / s.total >= 0.3).slice(0, 2).map((k) => k.kind.toLowerCase());
    // The job on their house can predate the feeds we hold: say "other", not a smaller history.
    const older = !!ctx?.job?.year && !!s.since && ctx.job.year < s.since;
    const parts = [`${plural(s.total, older ? "other permit" : "permit")} in San José since ${s.since}`];
    if (kinds.length) parts.push(`mostly ${listOf(kinds)}`);
    let line = parts.join(", ") + ".";
    if (yourStreet) line += ` ${plural(yourStreet.count, "job")} on your street.`;
    else if (ctx?.zip && s.inZip) line += ` ${plural(s.inZip, "job")} in ${ctx.zip}.`;
    return line;
  })();

  // Questions worth asking, written from what the records show.
  const questions = [
    !realLicense || lic === "not_checked" ? "What's your CSLB license number? I'd like to check it with the state board." : null,
    lic === "inactive" ? "The state board doesn't show your license as active. Can you explain?" : null,
    s.expired > 0 ? `I saw ${s.expired === 1 ? "one of your permits" : `${s.expired} of your permits`} expired without a final inspection. What happened there?` : null,
    s.kinds[0] ? `How many ${s.kinds[0].kind.toLowerCase()} jobs like mine have you finished in the last two years? Can I see one?` : null,
    "Who pulls the permit and books the final inspection, you or me?",
  ].filter((q): q is string => !!q).slice(0, 3);

  const recent = s.recent.slice(0, showAll ? 40 : 5);
  const checkHref = `/shortlist?${new URLSearchParams({ go: "1", name, zip: ctx?.zip ?? "" }).toString()}`;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto max-w-3xl px-4 pb-32 pt-24 sm:px-6 md:pt-28">
        <button
          type="button"
          onClick={() => (ctx?.from ? navigate(ctx.from) : navigate(-1))}
          className="inline-flex min-h-[40px] items-center gap-1.5 text-[13px] text-foreground/70 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {ctx?.from ? "Back to your house" : "Back"}
        </button>

        {loading && (
          <div className="mt-10 flex items-center gap-3 text-[15px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-accent" /> Pulling everything on {name || "them"}…
          </div>
        )}

        {!loading && !contractor && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-soft">
            <h1 className="font-display text-[26px] font-light">We couldn't find that record.</h1>
            <Link to="/shortlist" className="mt-4 inline-flex items-center gap-1.5 text-[15px] font-medium text-accent">
              Check a contractor by name <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {contractor && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {/* 1. The answer */}
            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Their record</p>
            <h1 className="mt-2 font-display text-[32px] font-light leading-[1.1] md:text-[40px]">
              <span className="italic">{name}</span>
            </h1>
            <p className="mt-3 text-[16px] leading-relaxed text-foreground/80">{answer}</p>
            {ctx?.job && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <p className="text-[14.5px] leading-relaxed">
                  <span className="font-medium">On your house:</span> {ctx.job.what}
                  {ctx.job.year ? `, ${ctx.job.year}` : ""}. {ctx.job.state}.
                </p>
              </div>
            )}
            {profile?.tagline && <p className="mt-2 text-[14px] italic text-muted-foreground">"{profile.tagline}" <Badge tone="theirs">Their words</Badge></p>}

            {/* 2. At a glance */}
            <section className="mt-6 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-soft">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">License</p>
                <p className={`mt-1 font-display text-[20px] leading-tight ${LICENSE_READ[lic].tone}`}>
                  {licenseLoading ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-accent" /> : LICENSE_READ[lic].word}
                </p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">State board</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-soft">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Signed off</p>
                <p className="mt-1 font-display text-[20px] leading-tight">{done ? `${s.finaled} of ${done}` : "—"}</p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{done ? "finished permits" : "none finished yet"}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3.5 shadow-soft">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest</p>
                <p className="mt-1 font-display text-[20px] leading-tight">{monthYear(s.latest)}</p>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{plural(s.lastYear, "permit")} this year</p>
              </div>
            </section>

            {/* License, said plainly */}
            <section className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[14.5px] leading-relaxed">
                  {licenseLoading ? "Checking their license with the state board…" : LICENSE_READ[lic].line}
                  {lic !== "not_checked" && license?.classifications?.length ? ` Licensed for ${license.classifications.slice(0, 3).join(", ")}.` : ""}
                  {lic !== "not_checked" && license?.expiration_date ? ` Expires ${monthYear(license.expiration_date)}.` : ""}
                  {lic === "not_checked" && !licenseLoading && " Ask them for it, or look them up by name on the state board's site. It takes a minute."}
                </p>
                <Badge>Public record</Badge>
              </div>
              <a
                href={realLicense ? cslbDeepLink(contractor.license_number) : CSLB_NAME_SEARCH}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("contractor_profile_cslb", { real: realLicense })}
                className="mt-2 inline-flex min-h-[40px] items-center gap-1 text-[14px] font-medium text-accent"
              >
                {realLicense ? `License #${contractor.license_number} on the state board` : "Look them up on the state board"} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </section>

            {s.expired > 0 && (
              <p className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-[14px] leading-relaxed">
                {plural(s.expired, "permit")} expired without a final inspection. That's worth asking about: unfinished permits stay with the house they were pulled on.
              </p>
            )}

            {/* 3. Near you */}
            {s.streets.length > 0 && (
              <section className="mt-8">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-[22px] font-light">Where they've worked</h2>
                  <Badge>Public record</Badge>
                </div>
                <p className="mt-1 text-[14px] text-muted-foreground">
                  {ctx?.zip && s.inZip ? `${plural(s.inZip, "job")} in ${ctx.zip}. ` : ""}Streets only, never house numbers.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.streets.slice(0, 10).map((st) => (
                    <span
                      key={st.name}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] ${st.yours ? "border-accent/40 bg-accent/10 font-medium" : "border-border bg-card"}`}
                    >
                      {st.yours && <MapPin className="h-3.5 w-3.5 text-accent" />}
                      {st.name}
                      {st.yours && " (yours)"}
                      <span className="text-muted-foreground">{st.count}</span>
                    </span>
                  ))}
                  {s.streets.length > 10 && <span className="px-2 py-1.5 text-[13px] text-muted-foreground">+{s.streets.length - 10} more</span>}
                </div>
              </section>
            )}

            {/* 4. What they do */}
            {s.kinds.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-[22px] font-light">What they do</h2>
                <div className="mt-3 space-y-2">
                  {s.kinds.slice(0, 5).map((k) => (
                    <div key={k.kind} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-[14px]">{k.kind}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <span className="block h-full rounded-full bg-accent/70" style={{ width: `${Math.max(6, (k.count / s.kinds[0].count) * 100)}%` }} />
                      </span>
                      <span className="w-8 text-right text-[13px] text-muted-foreground">{k.count}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 5. Lately */}
            {s.recent.length > 0 && (
              <section className="mt-8">
                <h2 className="font-display text-[22px] font-light">Their latest permits</h2>
                <ol className="mt-3 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                  {recent.map((r, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-3">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[r.state]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-medium">{r.kind}</p>
                        <p className="truncate text-[12.5px] text-muted-foreground">
                          {[r.street, STATE_WORD[r.state]].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-[12.5px] text-muted-foreground">{monthYear(r.date)}</span>
                    </li>
                  ))}
                </ol>
                {!showAll && s.total > 5 && (
                  <button type="button" onClick={() => setShowAll(true)} className="mt-2 min-h-[40px] text-[14px] font-medium text-accent">
                    {s.total > 40 ? `Show 40 of their ${s.total} permits` : `Show all ${s.total}`}
                  </button>
                )}
              </section>
            )}

            {/* In their words, when they've told us */}
            {(profile?.bio || profile?.years_in_business || profile?.service_areas) && (
              <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-[20px] font-light">In their words</h2>
                  <Badge tone="theirs">Their words</Badge>
                </div>
                {profile.bio && <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground/85">{profile.bio}</p>}
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {[profile.years_in_business != null ? `${profile.years_in_business} years in business` : null, profile.service_areas ? `Serves ${profile.service_areas}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </section>
            )}

            {/* 6. Before you call */}
            <section className="mt-8">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[22px] font-light">
                  Before you <span className="italic">call them</span>
                </h2>
                <Badge tone="read">Our read</Badge>
              </div>
              <p className="mt-1 text-[14px] text-muted-foreground">Questions worth asking, from what their record shows. Tap to copy.</p>
              <div className="mt-3 space-y-2">
                {questions.map((q, i) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      if (copyText(q)) {
                        setCopied(i);
                        setTimeout(() => setCopied(null), 1600);
                      }
                      track("contractor_profile_question_copied", { index: i });
                    }}
                    className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left text-[14.5px] leading-relaxed shadow-soft hover:border-accent/40"
                  >
                    <span className="min-w-0 flex-1">"{q}"</span>
                    {copied === i ? <Check className="mt-1 h-4 w-4 shrink-0 text-sage" /> : <Copy className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />}
                  </button>
                ))}
              </div>
            </section>

            <p className="mt-8 text-[12px] leading-relaxed text-muted-foreground">
              From City of San José permit records and the California State License Board. Haleo doesn't vet, endorse or rate contractors.
            </p>
          </motion.div>
        )}
      </div>

      {contractor && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl gap-2">
            <Link
              to={checkHref}
              onClick={() => track("contractor_profile_check", { from_house: !!ctx?.from })}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full bg-foreground px-5 text-[15px] font-medium text-background"
            >
              Check them for my job <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </main>
  );
};

export default ContractorProfile;
