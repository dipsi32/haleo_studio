// Contractor profile — permit timeline, license details, trust score breakdown.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, MapPin, Calendar, Hammer } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIntake } from "@/lib/intake";
import {
  type Contractor, type Permit, type LicenseStatus,
  computeTrustScore, projectKeywords, cslbDeepLink, projectTypeLabel,
} from "@/lib/contractors";
import CslbSignals from "@/components/CslbSignals";

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const ContractorProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { data: intake } = useIntake();
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data: c } = await supabase.from("contractors").select("*").eq("id", id).maybeSingle();
      if (!c || cancelled) { setLoading(false); return; }
      setContractor(c as Contractor);

      const [{ data: p }, { data: l }] = await Promise.all([
        supabase.from("contractor_permits").select("*").eq("contractor_id", id).order("issued_date", { ascending: false }),
        supabase.from("contractor_license_cache").select("*").eq("license_number", c.license_number).maybeSingle(),
      ]);
      if (cancelled) return;
      setPermits((p ?? []) as Permit[]);
      setLicense(l ? { ...l, deep_link: cslbDeepLink(c.license_number) } as LicenseStatus : null);

      // Kick off CSLB verification in the background if we don't have a fresh cache
      if (!l) {
        try {
          const { data: verified } = await supabase.functions.invoke("verify-cslb-license", { body: { license: c.license_number } });
          if (!cancelled && verified?.ok) {
            setLicense({ ...verified } as LicenseStatus);
          }
        } catch { /* ignore */ }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const keywords = projectKeywords(intake);
  const projectLabel = projectTypeLabel(intake);
  const score = contractor ? computeTrustScore(contractor, permits, license, keywords) : null;

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

      <main className="container max-w-5xl py-10">
        {loading && <p className="text-sm text-muted-foreground">Loading contractor profile…</p>}

        {contractor && (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{contractor.specialty ?? "General contractor"}</p>
              <h1 className="mt-2 font-display text-4xl font-light leading-tight md:text-5xl">
                {contractor.company ?? contractor.name}
              </h1>
              <p className="mt-3 text-base text-muted-foreground">
                {contractor.permit_count} verified permit{contractor.permit_count === 1 ? "" : "s"} on file in {contractor.city ?? "San Jose"}.
                Last job {formatDate(contractor.last_permit_date)}.
              </p>
            </motion.div>

            <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
              {/* Left column */}
              <div className="space-y-6">
                {/* Trust Score breakdown */}
                {score && (
                  <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-xl font-medium">Haleo Trust Score</h2>
                      <span className="font-display text-3xl font-medium text-accent">{score.total}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Based on verified permit history, license status, and real completed work near you — not reviews or paid listings.
                    </p>
                    <div className="mt-5 space-y-3">
                      {score.components.map(c => (
                        <div key={c.label}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground/85">{c.label}</span>
                            <span className="font-mono text-xs text-muted-foreground">{c.earned}/{c.weight}</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full bg-accent" style={{ width: `${(c.earned / c.weight) * 100}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

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

                {/* Permit timeline */}
                <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                  <h2 className="font-display text-xl font-medium">Recent permit history</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Last 10 permits pulled by this contractor — directly from City of San Jose records.</p>
                  <ul className="mt-4 space-y-3">
                    {permits.slice(0, 10).map(p => (
                      <li key={p.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background p-3">
                        <Hammer className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">{p.work_type ?? "Permit"}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {p.address && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.address}</span>}
                            {p.issued_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(p.issued_date)}</span>}
                            {p.status && <span className="rounded-full bg-secondary px-2 py-0.5">{p.status}</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
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
                  <a
                    href={cslbDeepLink(contractor.license_number)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1 text-sm text-accent underline-offset-4 hover:underline"
                  >
                    Verify on CSLB <ExternalLink className="h-3.5 w-3.5" />
                  </a>
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
