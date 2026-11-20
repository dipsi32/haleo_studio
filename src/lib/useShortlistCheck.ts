// Check each name on the homeowner's shortlist against public records:
//   1. CSLB, when we have a license number (theirs, or one on the permit record)
//   2. San Jose permit records, searched by business name
// then score with the same public-record trust score Discovery uses.
//
// Every lookup is best effort. A lookup that fails leaves that part
// "not checked", which the page says out loud, rather than blocking the rest.
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeTrustScore, type Contractor, type LicenseStatus, type Permit } from "@/lib/contractors";
import { toLicenseStatus } from "@/lib/useContractors";
import {
  type Candidate,
  type CheckedCandidate,
  isLicenseOnlyName,
  isRealLicense,
  licensePeople,
  likeYoursCount,
  normalizeName,
  personSearches,
  tidyBusinessName,
  nameOrders,
  pickPermitMatch,
  rankShortlist,
  searchTerm,
} from "@/lib/shortlist";

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

/** The license, plus the people the board names on it (the qualifying individual). */
export const readLicenseRecord = async (num: string): Promise<{ license: LicenseStatus; people: string[] } | null> => {
  try {
    const res = await withTimeout(supabase.functions.invoke("verify-cslb-license", { body: { license: num } }), 25_000);
    const d = res?.data;
    if (!d?.ok) return null;
    const people = [d.licensee_name, ...licensePeople(d.raw_data?.rendered_excerpt)].filter(
      (n): n is string => typeof n === "string" && n.trim().length > 0,
    );
    return { license: toLicenseStatus({ ...d, license_number: d.license_number ?? num }), people: [...new Set(people)] };
  } catch {
    return null;
  }
};

export const verifyLicense = async (num: string): Promise<LicenseStatus | null> => (await readLicenseRecord(num))?.license ?? null;

/** Find this business in San Jose permit records, pulling fresh records for the name first. */
export const findPermitRecord = async (name: string): Promise<{ contractor: Contractor; permits: Permit[] } | null> => {
  const term = searchTerm(name);
  if (!term) return null;
  // "Mehdi Bakhtiary" is filed as "BAKHTIARY, MEHDI": a two-word name is searched both ways.
  const orders = nameOrders(name);
  try {
    await withTimeout(
      Promise.all(orders.map((o) => supabase.functions.invoke("fetch-sj-permits", { body: { contractor: o, limit: 200 } }))),
      20_000,
    );
  } catch {
    // Fall through to whatever is already indexed.
  }
  // ilike over the words, in order. Only letters, digits and spaces reach the filter.
  const filters = orders.flatMap((o) => {
    const pattern = `%${o.split(" ").join("%")}%`;
    return [`company.ilike.${pattern}`, `name.ilike.${pattern}`];
  });
  const { data: rows } = await supabase
    .from("contractors")
    .select("*")
    .or(filters.join(","))
    .order("permit_count", { ascending: false })
    .limit(25);
  const match = pickPermitMatch(name, (rows ?? []) as Contractor[]);
  if (!match) return null;
  const { data: permits } = await supabase
    .from("contractor_permits")
    .select("*")
    .eq("contractor_id", match.id)
    .order("issued_date", { ascending: false })
    .limit(200);
  return { contractor: match, permits: (permits ?? []) as Permit[] };
};

/** A contractor already in Haleo's records under this license number, with their permits. */
export const findByLicense = async (license: string): Promise<{ contractor: Contractor; permits: Permit[] } | null> => {
  const num = license.replace(/\D/g, "");
  if (!/^\d{5,8}$/.test(num)) return null;
  try {
    const { data: rows } = await supabase
      .from("contractors")
      .select("*")
      .or(`license_number.eq.${num},claimed_license_number.eq.${num}`)
      .order("permit_count", { ascending: false })
      .limit(1);
    const match = (rows ?? [])[0] as Contractor | undefined;
    if (!match) return null;
    const { data: permits } = await supabase
      .from("contractor_permits")
      .select("*")
      .eq("contractor_id", match.id)
      .order("issued_date", { ascending: false })
      .limit(200);
    return { contractor: match, permits: (permits ?? []) as Permit[] };
  } catch {
    return null;
  }
};


export const checkCandidate = async (c: Candidate, keywords: string[]): Promise<CheckedCandidate> => {
  const read = c.license_number ? await readLicenseRecord(c.license_number) : null;
  let license = read?.license ?? null;

  // A license number: Haleo's own records first (a contractor imported with
  // it, or who claimed their profile with it), then the name.
  let record = c.license_number ? await findByLicense(c.license_number) : null;
  if (!record) record = await findPermitRecord(c.name);
  // Search permits under the licensed business name too, when CSLB gave us one.
  if (!record && license?.business_name && normalizeName(license.business_name) !== normalizeName(c.name)) {
    record = await findPermitRecord(license.business_name);
  }
  // A license reissued to a company keeps the person's older permits under
  // the person's own name: search the qualifying individual the board names.
  for (const person of read?.people ?? []) {
    for (const term of personSearches(person)) {
      if (record) break;
      record = await findPermitRecord(term);
    }
  }

  if (!license && record && isRealLicense(record.contractor.license_number)) {
    license = await verifyLicense(record.contractor.license_number);
  }

  const permits = record?.permits ?? [];
  const subject: Contractor = record?.contractor ?? {
    id: c.id,
    license_number: c.license_number ?? "",
    name: c.person ?? c.name,
    company: c.name,
    specialty: c.trade,
    phone: c.phone,
    email: c.email,
    website: c.website,
    city: null,
    state: null,
    zip: null,
    lat: null,
    lng: null,
    permit_count: 0,
    last_permit_date: null,
  };
  const hasAnything = !!record || !!license?.scrape_succeeded;
  // Known only by number until now: call them what the license board does.
  const named = isLicenseOnlyName(c.name) && license?.business_name ? { ...c, name: tidyBusinessName(license.business_name) } : c;
  return {
    candidate: named,
    status: "done",
    contractor: record?.contractor ?? null,
    permits,
    license,
    score: hasAnything ? computeTrustScore(subject, permits, license, keywords) : null,
    likeYours: likeYoursCount(permits, keywords),
  };
};

const pending = (c: Candidate): CheckedCandidate => ({
  candidate: c,
  status: "checking",
  contractor: null,
  permits: [],
  license: null,
  score: null,
  likeYours: 0,
});

export const useShortlistCheck = () => {
  const [results, setResults] = useState<CheckedCandidate[]>([]);
  const [running, setRunning] = useState(false);
  const runId = useRef(0);

  const run = useCallback(async (candidates: Candidate[], keywords: string[]) => {
    const id = ++runId.current;
    setRunning(true);
    const byId = new Map<string, CheckedCandidate>(candidates.map((c) => [c.id, pending(c)]));
    const publish = () => {
      if (id === runId.current) setResults(rankShortlist([...byId.values()]));
    };
    publish();
    const CONCURRENCY = 3;
    for (let i = 0; i < candidates.length; i += CONCURRENCY) {
      if (id !== runId.current) return;
      await Promise.all(
        candidates.slice(i, i + CONCURRENCY).map(async (c) => {
          try {
            byId.set(c.id, await checkCandidate(c, keywords));
          } catch {
            byId.set(c.id, { ...pending(c), status: "done" });
          }
          publish();
        }),
      );
    }
    if (id === runId.current) setRunning(false);
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    setResults([]);
    setRunning(false);
  }, []);

  return { results, running, run, reset };
};
