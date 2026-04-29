// Public, unauthenticated contractor profile page.
// URL: /pro/:slug  (optionally with ?ref=homeowner)
// Shows the contractor's public record + a warm "claim" banner.
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Hammer, MapPin, ShieldCheck, Sparkles, Globe, Instagram, Facebook, Mail, Star, Image as ImageIcon } from "lucide-react";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  type Contractor,
  type Permit,
  type LicenseStatus,
  computeTrustScore,
  cslbDeepLink,
} from "@/lib/contractors";
import CslbSignals from "@/components/CslbSignals";

type ContractorRow = Contractor & {
  slug: string;
  claimed: boolean;
  claimed_at: string | null;
};

type PublicProfile = {
  company_name: string | null;
  tagline: string | null;
  bio: string | null;
  promo_text: string | null;
  public_email: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  houzz: string | null;
  yelp: string | null;
  tiktok: string | null;
  logo_url: string | null;
  gallery_urls: string[] | null;
  years_in_business: number | null;
  service_areas: string | null;
  specialties: string | null;
};

const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—";

const normalizeUrl = (u: string) => (u.startsWith("http") ? u : `https://${u}`);

const PublicContractorProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fromHomeowner = params.get("ref") === "homeowner";

  const [contractor, setContractor] = useState<ContractorRow | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      const { data: c } = await supabase
        .from("contractors")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (!c || cancelled) {
        setLoading(false);
        return;
      }
      const row = c as unknown as ContractorRow;
      setContractor(row);

      // Fire-and-forget profile_viewed_at funnel ping (only first time)
      if (!row.claimed) {
        supabase
          .from("contractors")
          .update({ profile_viewed_at: new Date().toISOString() })
          .eq("id", row.id)
          .is("profile_viewed_at", null)
          .then(() => {});
      }

      const [{ data: p }, { data: l }, { data: pp }] = await Promise.all([
        supabase
          .from("contractor_permits")
          .select("*")
          .eq("contractor_id", row.id)
          .order("issued_date", { ascending: false }),
        supabase
          .from("contractor_license_cache")
          .select("*")
          .eq("license_number", row.license_number)
          .maybeSingle(),
        supabase
          .from("contractor_profiles_public" as never)
          .select("*")
          .eq("contractor_id", row.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setPermits((p ?? []) as Permit[]);
      setLicense(
        l
          ? ({ ...l, deep_link: cslbDeepLink(row.license_number) } as LicenseStatus)
          : null,
      );
      if (pp) {
        const pr = pp as unknown as PublicProfile & { gallery_urls: unknown };
        setProfile({
          ...pr,
          gallery_urls: Array.isArray(pr.gallery_urls) ? (pr.gallery_urls as string[]) : [],
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const score = contractor ? computeTrustScore(contractor, permits, license, ["remodel"]) : null;

  const breakdown = permits.reduce<Record<string, number>>((acc, p) => {
    const key = p.work_type ?? "Other";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const startClaim = () => navigate(`/pro/${slug}/claim${fromHomeowner ? "?ref=homeowner" : ""}`);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
        Opening profile…
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-light">Profile not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This contractor isn't on Haleo yet — or the link is wrong.
          </p>
          <Button asChild variant="outline" className="mt-6 rounded-full">
            <Link to="/">Back to Haleo</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName = profile?.company_name || contractor.company || contractor.name;
  const showBanner = !contractor.claimed;
  const gallery = profile?.gallery_urls ?? [];
  const specialtyList = (profile?.specialties ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const socials: Array<{ label: string; href: string; icon: typeof Globe }> = [];
  if (profile?.website) socials.push({ label: "Website", href: normalizeUrl(profile.website), icon: Globe });
  if (profile?.instagram) socials.push({ label: `@${profile.instagram.replace(/^@/, "")}`, href: `https://instagram.com/${profile.instagram.replace(/^@/, "")}`, icon: Instagram });
  if (profile?.facebook) socials.push({ label: "Facebook", href: normalizeUrl(profile.facebook), icon: Facebook });
  if (profile?.houzz) socials.push({ label: "Houzz", href: normalizeUrl(profile.houzz), icon: Globe });
  if (profile?.yelp) socials.push({ label: "Yelp", href: normalizeUrl(profile.yelp), icon: Globe });
  if (profile?.tiktok) socials.push({ label: `@${profile.tiktok.replace(/^@/, "")}`, href: `https://tiktok.com/@${profile.tiktok.replace(/^@/, "")}`, icon: Globe });
  if (profile?.public_email) socials.push({ label: profile.public_email, href: `mailto:${profile.public_email}`, icon: Mail });

  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Public profile
          </span>
        </div>
      </header>

      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-b border-accent/20 bg-accent/10"
        >
          <div className="container max-w-5xl py-5">
            <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                  {fromHomeowner ? "A homeowner wants to send you a brief" : "This is your public record on Haleo"}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                  {fromHomeowner ? (
                    <>
                      A homeowner planning a renovation in your area wants to send you their project brief through Haleo. Claim your profile to receive it.
                    </>
                  ) : (
                    <>
                      Homeowners planning renovations in your area can already see this profile. Claim it to receive project briefs directly.
                    </>
                  )}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 md:items-end">
                <Button onClick={startClaim} className="rounded-full">
                  This is me — claim my profile
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <a
                  href="mailto:hello@haleo.studio?subject=Not%20my%20business%20-%20Haleo%20profile"
                  className="text-[11px] text-muted-foreground underline-offset-4 hover:underline"
                >
                  Not your business? Let us know →
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <main className="container max-w-5xl py-10">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-display text-4xl font-light tracking-tight md:text-5xl">{displayName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {contractor.specialty && <span>{contractor.specialty}</span>}
            {contractor.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {contractor.city}, {contractor.state}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Hammer className="h-3.5 w-3.5" /> {contractor.permit_count} permits on record
            </span>
            {contractor.last_permit_date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Last job {formatDate(contractor.last_permit_date)}
              </span>
            )}
            {contractor.claimed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-3 w-3" /> Claimed
              </span>
            )}
          </div>
        </div>

        {/* Trust score */}
        {score && (
          <section className="mb-10 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-xl font-light">Trust score</h2>
              <div>
                <span className="font-display text-4xl font-light">{score.total}</span>
                <span className="text-sm text-muted-foreground">/100</span>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {score.components.map((c) => (
                <div key={c.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-foreground">{c.label}</span>
                    <span className="text-muted-foreground">
                      {c.earned}/{c.weight}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(c.earned / c.weight) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CSLB signals */}
        {license && (
          <section className="mb-10">
            <h2 className="mb-3 font-display text-xl font-light">License standing</h2>
            <CslbSignals
              license={license}
              licenseNumber={contractor.license_number}
              permitDisplayName={contractor.company || contractor.name}
              variant="profile"
            />
          </section>
        )}

        {/* Project mix */}
        {Object.keys(breakdown).length > 0 && (
          <section className="mb-10 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
            <h2 className="font-display text-xl font-light">Project mix</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              From {permits.length} permits on file with the City.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {Object.entries(breakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([type, count]) => (
                  <div key={type} className="rounded-2xl border border-border bg-background/50 p-4">
                    <div className="font-display text-2xl font-light">{count}</div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{type}</div>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Recent permits */}
        {permits.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 font-display text-xl font-light">Recent permits</h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {permits.slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col gap-1 border-b border-border/60 px-5 py-3 text-sm last:border-b-0 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-medium text-foreground">{p.work_type ?? "Permit"}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.address ?? "—"} · {p.city ?? ""}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(p.issued_date)}
                    {p.valuation && ` · $${Math.round(p.valuation).toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bottom CTA — repeat for unclaimed */}
        {showBanner && (
          <section className="rounded-3xl border border-accent/30 bg-accent/5 p-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-accent" />
            <h2 className="mt-3 font-display text-2xl font-light">
              Everything above already exists. We just made it visible.
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Claim this profile to receive homeowner briefs the moment they land.
            </p>
            <Button onClick={startClaim} className="mt-5 rounded-full">
              This is me — claim my profile
              <ArrowRight className="h-4 w-4" />
            </Button>
          </section>
        )}
      </main>
    </div>
  );
};

export default PublicContractorProfile;
