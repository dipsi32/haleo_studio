// Contractor profile — permit timeline, license details, trust score breakdown.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, MapPin, Calendar, Hammer, Star, Image as ImageIcon, ChevronDown, ShieldCheck, MapPinned, AlertTriangle, Clock, Wallet, HardHat, FileCheck2 } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIntake } from "@/lib/intake";
import {
  type Contractor, type Permit, type LicenseStatus, type TrustSignals,
  computeTrustScore, projectKeywords, cslbDeepLink, projectTypeLabel,
  trustTier, trustChecks, tierChipClass,
} from "@/lib/contractors";
import CslbSignals from "@/components/CslbSignals";
import PermitInspectionItem from "@/components/PermitInspectionItem";

type ContractorPublicProfile = {
  company_name: string | null;
  tagline: string | null;
  bio: string | null;
  promo_text: string | null;
  gallery_urls: string[] | null;
  years_in_business: number | null;
  service_areas: string | null;
  specialties: string | null;
};

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const ContractorProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { data: intake } = useIntake();
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [profile, setProfile] = useState<ContractorPublicProfile | null>(null);
  const [signals, setSignals] = useState<TrustSignals>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data: c } = await supabase.from("contractors").select("*").eq("id", id).maybeSingle();
      if (!c || cancelled) { setLoading(false); return; }
      setContractor(c as Contractor);

      const [{ data: p }, { data: l }, { data: pp }, { data: ts }] = await Promise.all([
        supabase.from("contractor_permits").select("*").eq("contractor_id", id).order("issued_date", { ascending: false }),
        supabase.from("contractor_license_cache").select("*").eq("license_number", c.license_number).maybeSingle(),
        supabase.from("contractor_profiles_public" as never).select("*").eq("contractor_id", id).maybeSingle(),
        supabase.from("contractor_trust_signals").select("*").eq("contractor_id", id).maybeSingle(),
      ]);
      if (cancelled) return;
      setPermits((p ?? []) as Permit[]);
      setLicense(l ? { ...l, deep_link: cslbDeepLink(c.license_number) } as LicenseStatus : null);
      if (pp) {
        const pr = pp as unknown as ContractorPublicProfile & { gallery_urls: unknown };
        setProfile({ ...pr, gallery_urls: Array.isArray(pr.gallery_urls) ? (pr.gallery_urls as string[]) : [] });
      }
      if (ts) setSignals(ts as TrustSignals);

      // Kick off CSLB verification in the background if we don't have a fresh cache
      if (!l) {
        try {
          const { data: verified } = await supabase.functions.invoke("verify-cslb-license", { body: { license: c.license_number } });
          if (!cancelled && verified?.ok) {
            setLicense({ ...verified } as LicenseStatus);
          }
        } catch { /* ignore */ }
      }

      // Refresh SJ trust signals (code violations + expired permits) in background
      try {
        const { data: fresh } = await supabase.functions.invoke("fetch-sj-violations", { body: { contractor_id: id } });
        if (!cancelled && fresh?.ok) {
          setSignals({
            open_code_violations: fresh.open_code_violations ?? 0,
            addresses_with_violations: fresh.addresses_with_violations ?? 0,
            addresses_checked: fresh.addresses_checked ?? 0,
            expired_without_final: fresh.expired_without_final ?? 0,
            permits_old_enough: fresh.permits_old_enough ?? 0,
          });
        }
      } catch { /* ignore */ }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const keywords = projectKeywords(intake);
  const projectLabel = projectTypeLabel(intake);
  const score = contractor ? computeTrustScore(contractor, permits, license, keywords, signals) : null;

  // Project type breakdown
  const breakdown = permits.reduce<Record<string, number>>((acc, p) => {
    const key = p.work_type ?? "Other";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <Link to="/contractors" className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to results
          </Link>
        </div>
      </header>

      <main className="container max-w-5xl py-7 md:py-10">
        {loading && <p className="text-sm text-muted-foreground">Loading contractor profile…</p>}

        {contractor && (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{contractor.specialty ?? "General contractor"}</p>
              <h1 className="mt-2 font-display text-2xl font-light leading-tight md:text-3xl">
                {profile?.company_name ?? contractor.company ?? contractor.name}
              </h1>
              {profile?.tagline && (
                <p className="mt-3 max-w-2xl font-display text-lg font-light italic text-foreground/75 md:text-xl">
                  "{profile.tagline}"
                </p>
              )}
              <p className="mt-3 text-base text-muted-foreground">
                {contractor.permit_count} permit{contractor.permit_count === 1 ? "" : "s"} on file in {contractor.city ?? "San Jose"}.
                Last job {formatDate(contractor.last_permit_date)}.
              </p>
            </motion.div>

            {profile?.promo_text && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
                <Star className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <p className="text-sm font-medium text-foreground">{profile.promo_text}</p>
              </div>
            )}

            <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
              {/* Left column */}
              <div className="space-y-6">
                {/* About from contractor */}
                {(profile?.bio || profile?.years_in_business || profile?.service_areas) && (
                  <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                    <h2 className="font-display text-xl font-medium">About</h2>
                    {profile?.bio && (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{profile.bio}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                      {profile?.years_in_business != null && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" /> {profile.years_in_business} years in business
                        </span>
                      )}
                      {profile?.service_areas && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> Serves {profile.service_areas}
                        </span>
                      )}
                    </div>
                    {profile?.specialties && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {profile.specialties.split(",").map((s) => s.trim()).filter(Boolean).map((s) => (
                          <span key={s} className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-foreground">{s}</span>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Recent work gallery */}
                {profile?.gallery_urls && profile.gallery_urls.length > 0 && (
                  <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                    <h2 className="flex items-center gap-2 font-display text-xl font-medium">
                      <ImageIcon className="h-4 w-4 text-accent" /> Recent work
                    </h2>
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {profile.gallery_urls.map((url) => (
                        <div key={url} className="aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                          <img src={url} alt="Project" loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Trust Score — headline + grouped progressive disclosure */}
                {score && (() => {
                  const groups = [
                    {
                      key: 'track',
                      label: 'Local track record',
                      Icon: MapPinned,
                      blurb: 'How much real, recent, on-topic work they have nearby.',
                      match: (l: string) => ['Permits in your area', 'Recent activity', 'Right kind of work'].includes(l),
                    },
                    {
                      key: 'license',
                      label: 'License & insurance',
                      Icon: ShieldCheck,
                      blurb: 'CSLB standing, bond, and Workers\u2019 Comp coverage.',
                      match: (l: string) => ['License in good standing', 'Bond on file', "Workers' Comp coverage"].includes(l),
                    },
                    {
                      key: 'sites',
                      label: 'Past job sites',
                      Icon: AlertTriangle,
                      blurb: 'Open code-enforcement cases at addresses they\u2019ve worked.',
                      match: (l: string) => ['No code violations on past jobs'].includes(l),
                    },
                  ];
                  const penalties = score.components.filter(c => c.status === 'penalty');
                  const hasPenalty = penalties.length > 0;
                  const tier = trustTier(score.total, hasPenalty);
                  const checks = trustChecks(score);
                  return (
                    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-display text-xl font-medium">Permit-intelligence read</h2>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {checks.passed} of {checks.total} public-record signals line up
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-tight whitespace-nowrap ${tierChipClass(tier.tone)}`}>
                          <ShieldCheck className="h-3 w-3" /> {tier.label}
                        </span>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{tier.blurb}</p>
                      <details className="group/disc mt-1">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 hover:text-foreground">
                          How Haleo reads this
                          <ChevronDown className="h-3 w-3 transition-transform group-open/disc:rotate-180" />
                        </summary>
                        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/90">
                          Haleo doesn't vet, endorse, or rate contractors — we read public permit and CSLB records and group them by what the data shows.
                        </p>
                      </details>

                      <div className="mt-5 space-y-2">
                        {groups.map((g, idx) => {
                          const items = score.components.filter(c => g.match(c.label));
                          if (items.length === 0) return null;
                          const earned = items.reduce((s, c) => s + c.earned, 0);
                          const weight = items.reduce((s, c) => s + c.weight, 0);
                          const allPending = items.every(c => c.status === 'pending' || c.status === 'coming_soon');
                          const right = allPending
                            ? (g.key === 'license' ? 'Coming soon' : 'Pending')
                            : weight === 0 ? '—' : `${earned}/${weight}`;
                          return (
                            <details key={g.key} className="group rounded-2xl border border-border/60 bg-background/40 open:bg-background">
                              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-3 hover:bg-secondary/40">
                                <g.Icon className="h-4 w-4 shrink-0 text-accent" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-semibold leading-tight tracking-wide uppercase text-foreground/90">{g.label}</p>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">{g.blurb}</p>
                                </div>
                                <span className="font-mono text-xs text-muted-foreground">{right}</span>
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                              </summary>
                              <div className="space-y-4 border-t border-border/60 px-4 py-4">
                                {items.map(c => {
                                  const isPending = c.status === 'pending' || c.status === 'coming_soon';
                                  const cpct = c.weight > 0 ? Math.max(0, Math.min(100, (c.earned / c.weight) * 100)) : 0;
                                  const rightLabel = c.weight === 0 ? (c.status === 'coming_soon' ? 'Coming soon' : 'Pending') : `${c.earned}/${c.weight}`;
                                  const ItemIcon =
                                    c.label === 'Permits in your area' ? null :
                                    c.label === 'Recent activity' ? null :
                                    c.label === 'Right kind of work' ? null :
                                    c.label === 'License in good standing' ? ShieldCheck :
                                    c.label === 'Bond on file' ? Wallet :
                                    c.label === "Workers' Comp coverage" ? HardHat :
                                    c.label === 'No code violations on past jobs' ? FileCheck2 :
                                    AlertTriangle;
                                  return (
                                    <div key={c.label}>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground/85">
                                          {ItemIcon && <ItemIcon className="h-3.5 w-3.5 text-accent/80" />}
                                          {c.label}
                                        </span>
                                        <span className="font-mono text-xs text-muted-foreground">{rightLabel}</span>
                                      </div>
                                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                                        <div
                                          className={`h-full ${isPending ? 'bg-muted-foreground/30' : 'bg-accent'}`}
                                          style={{ width: isPending ? '100%' : `${cpct}%` }}
                                        />
                                      </div>
                                      <p className="mt-1 text-xs text-foreground/70">{isPending ? '⏳ ' : '→ '}{c.detail}</p>
                                      <details className="group/why mt-1">
                                        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 hover:text-foreground">
                                          Why this matters
                                          <ChevronDown className="h-3 w-3 transition-transform group-open/why:rotate-180" />
                                        </summary>
                                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/90">{c.what}</p>
                                      </details>
                                    </div>
                                  );
                                })}
                              </div>
                            </details>
                          );
                        })}

                        {penalties.length > 0 && (
                          <div className="mt-3 space-y-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
                            {penalties.map(c => (
                              <div key={c.label}>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium text-destructive">{c.label}</span>
                                  <span className="font-mono text-xs text-destructive">{c.earned > 0 ? '+' : ''}{c.earned} pts</span>
                                </div>
                                <p className="mt-1 text-xs text-destructive/90">⚠ {c.detail}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </section>
                  );
                })()}


                {/* Project breakdown */}
                <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                  <h2 className="font-display text-xl font-medium">Project type breakdown</h2>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Object.entries(breakdown).slice(0, 6).map(([type, count]) => (
                      <div key={type} className="rounded-2xl bg-secondary/60 p-3">
                        <p className="font-display text-2xl font-medium">{count}</p>
                        <p className="text-xs text-muted-foreground">{type}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Permit timeline — show 3, expand for rest. */}
                <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                  <h2 className="font-display text-xl font-medium">Recent permit history</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pulled directly from City of San José records. Tap any address to check its live inspection record.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {permits.slice(0, 3).map(p => (
                      <PermitInspectionItem key={p.id} permit={p} contractorId={contractor.id} />
                    ))}
                  </ul>
                  {permits.length > 3 && (
                    <details className="group mt-3">
                      <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary">
                        Show {Math.min(permits.length, 10) - 3} more permits
                        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="mt-3 space-y-3">
                        {permits.slice(3, 10).map(p => (
                          <PermitInspectionItem key={p.id} permit={p} contractorId={contractor.id} />
                        ))}
                      </ul>
                    </details>
                  )}
                </section>

              </div>

              {/* Right rail */}
              <aside className="space-y-4">
                <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CSLB License</p>
                  <p className="mt-1 font-mono text-sm">{contractor.license_number}</p>
                  <div className="mt-4">
                    <CslbSignals
                      license={license}
                      licenseNumber={contractor.license_number}
                      permitDisplayName={contractor.company ?? contractor.name}
                      variant="profile"
                    />
                  </div>
                  {license && license.scrape_succeeded && (
                    <a
                      href={cslbDeepLink(contractor.license_number)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
                    >
                      Verify on CSLB <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </section>

                <Link
                  to="/contractors"
                  state={{ preselectId: contractor.id, openOutreach: true }}
                >
                  <Button className="w-full rounded-full">
                    <span className="inline-flex items-center gap-1.5">Send project brief</span>
                  </Button>
                </Link>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ContractorProfile;
