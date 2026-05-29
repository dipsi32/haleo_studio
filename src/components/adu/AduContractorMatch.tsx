import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Hammer, MapPin } from "lucide-react";
import { track } from "@/lib/analytics";

interface AduContractor {
  id: string;
  slug: string | null;
  name: string;
  company: string | null;
  city: string | null;
  zip: string | null;
  adu_permit_count: number;
}

export default function AduContractorMatch({ zip }: { zip: string | null }) {
  const [loading, setLoading] = useState(true);
  const [contractors, setContractors] = useState<AduContractor[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Find permits that look like ADU work in the homeowner's zip cluster
        // (first 4 digits matches nearby zips).
        const zipPrefix = zip ? zip.slice(0, 4) : null;
        let q = supabase
          .from("contractor_permits")
          .select("contractor_id, zip, description, work_type")
          .or("description.ilike.%adu%,description.ilike.%accessory dwelling%,work_type.ilike.%adu%");
        if (zipPrefix) q = q.ilike("zip", `${zipPrefix}%`);
        const { data: permits } = await q.limit(500);

        if (!permits || permits.length === 0) {
          if (!cancelled) {
            setContractors([]);
            setLoading(false);
          }
          return;
        }

        const counts = new Map<string, number>();
        for (const p of permits) {
          if (!p.contractor_id) continue;
          counts.set(p.contractor_id, (counts.get(p.contractor_id) ?? 0) + 1);
        }
        const topIds = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id]) => id);

        const { data: rows } = await supabase
          .from("contractors")
          .select("id, slug, name, company, city, zip")
          .in("id", topIds);

        if (cancelled) return;
        const ranked: AduContractor[] = (rows ?? [])
          .map((r) => ({ ...r, adu_permit_count: counts.get(r.id) ?? 0 }))
          .sort((a, b) => b.adu_permit_count - a.adu_permit_count);
        setContractors(ranked);
        if (ranked.length > 0) track("adu_contractor_matched", { count: ranked.length, zip });
      } catch (e) {
        console.error("adu contractor match failed", e);
        if (!cancelled) setContractors([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [zip]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (contractors.length === 0) {
    return (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
        <p className="font-medium">No verified ADU contractors in your area yet</p>
        <p className="text-muted-foreground">
          We're still building our ADU contractor network in your zip code. Join the waitlist and
          we'll notify you when verified ADU contractors are available nearby.
        </p>
        <Link
          to="/waitlist"
          onClick={() => track("adu_waitlist_joined", { zip })}
          className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Join the waitlist
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contractors.map((c) => (
        <Link
          key={c.id}
          to={c.slug ? `/pro/${c.slug}` : `/contractors/${c.id}`}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-smooth hover:bg-secondary"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Hammer className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{c.company || c.name}</p>
            <p className="flex items-center gap-1 truncate text-[12px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {c.city || "San Jose"} · {c.adu_permit_count} ADU permit
              {c.adu_permit_count === 1 ? "" : "s"} on record
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
