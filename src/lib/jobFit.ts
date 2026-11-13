// Job fit: how a contractor's public record lines up with THIS homeowner's
// job, answered as the five questions a careful neighbor would ask. It
// replaces the 0–100 "trust score" on the homeowner side.
//
// Why not a score: a number about a person is a rating, and Haleo doesn't
// rate people. It also hides its own gaps: when the license board didn't
// answer, a weighted score quietly renormalizes and looks better than it is.
// Here every answer is a fact with its source, and a source that didn't
// answer reads "Not checked", never a pass.
//
//   1. Have they done this kind of job?   (San Jose permits)
//   2. Do they work near you?             (San Jose permits, your ZIP)
//   3. Are they active lately?            (San Jose permits, last 12 months)
//   4. Does their work pass inspection?   (San Jose inspection sign-offs)
//   5. Is their license active?           (State license board)
//
// The headline counts answers, not quality: "Lines up with your kitchen job
// on 4 of 5." Pure; tested in jobFit.test.ts.
import type { IntakeData } from "@/lib/intake";
import type { LicenseStatus } from "@/lib/contractors";
import { trackRecord, type Inspection, type TrackPermit } from "@/lib/trackRecord";
import { workFor } from "@/lib/recordHighlights";

export type FitLevel = "yes" | "some" | "no" | "not_checked" | "flag";
export type FitId = "done_it" | "near_you" | "active" | "inspections" | "license";

export type FitRow = {
  id: FitId;
  question: string;
  level: FitLevel;
  /** The fact behind the answer, in plain words. */
  fact: string;
  source: "Public record" | "Not checked";
};

export type JobFit = {
  rows: FitRow[];
  /** Answers that line up (yes or some). */
  lined: number;
  /** Answers we could check at all. */
  checked: number;
  total: number;
  /** "Lines up with your kitchen job on 4 of 5" or the red flag. */
  headline: string;
  flag: string | null;
  /** Sort key: flags last, then more lined-up answers, then more of the same work. */
  rank: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type LicenseRead = "active" | "expiring" | "inactive" | "discipline" | "not_checked";

/** Only a license the board actually answered for counts. */
export const readLicense = (l: LicenseStatus | null | undefined, now = new Date()): LicenseRead => {
  if (!l || !l.scrape_succeeded || !l.status?.trim()) return "not_checked";
  if (l.has_disciplinary_action) return "discipline";
  const s = l.status.toLowerCase();
  const exp = l.expiration_date ? new Date(l.expiration_date) : null;
  if (/suspend|revoke|inactive|expired|cancel/.test(s) || (exp && exp.getTime() < now.getTime())) return "inactive";
  if (!/active|current|clear/.test(s)) return "not_checked";
  if (exp && exp.getTime() - now.getTime() < 90 * 864e5) return "expiring";
  return "active";
};

export const jobFit = (
  permits: TrackPermit[],
  data: IntakeData,
  /** noRecord: we couldn't tie this name to any city record, so the permit answers are unknown, not "no". */
  opts: { inspections?: Inspection[] | null; license?: LicenseStatus | null; now?: Date; noRecord?: boolean } = {},
): JobFit => {
  const now = opts.now ?? new Date();
  const t = trackRecord(permits, data, opts.inspections ?? null, null);
  const work = workFor(data);
  const word = work?.word ?? "this kind of";
  const rows: FitRow[] = [];

  // 1. Done this kind of job
  const same = t.matching?.count ?? 0;
  if (!work) {
    rows.push({ id: "done_it", question: "Have they done this kind of job?", level: "not_checked", fact: "Tell us the project to check this.", source: "Not checked" });
  } else {
    rows.push({
      id: "done_it",
      question: `Have they done ${word} work?`,
      level: same >= 3 ? "yes" : same >= 1 ? "some" : "no",
      fact: same > 0 ? `${plural(same, `${word} permit`)} on their San Jose record` : `No ${word} permits on their San Jose record`,
      source: "Public record",
    });
  }

  // 2. Near you
  const zip = data.address && !data.address.skipped ? data.address.zip?.trim() : undefined;
  if (!zip || !/^\d{5}$/.test(zip)) {
    rows.push({ id: "near_you", question: "Do they work near you?", level: "not_checked", fact: "Add your ZIP to check this.", source: "Not checked" });
  } else {
    const n = t.nearby?.count ?? 0;
    const streets = t.nearby?.streets ?? [];
    rows.push({
      id: "near_you",
      question: "Do they work near you?",
      level: n >= 2 ? "yes" : n === 1 ? "some" : "no",
      fact: n > 0 ? `${plural(n, "job")} in ${zip}${streets.length ? `, on ${streets.slice(0, 2).join(" and ")}` : ""}` : `No permitted jobs in ${zip} yet`,
      source: "Public record",
    });
  }

  // 3. Active lately
  const yearAgo = now.getTime() - 365 * 864e5;
  const recent = permits.filter((p) => p.issued_date && new Date(p.issued_date).getTime() >= yearAgo).length;
  rows.push({
    id: "active",
    question: "Are they active lately?",
    level: recent >= 3 ? "yes" : recent >= 1 ? "some" : "no",
    fact: recent > 0 ? `${plural(recent, "permit")} in the last 12 months` : permits.length ? "No new permits in the last 12 months" : "No San Jose permits on record",
    source: "Public record",
  });

  // 4. Inspections
  const insp = t.inspections;
  if (!insp) {
    rows.push({ id: "inspections", question: "Does their work pass inspection?", level: "not_checked", fact: permits.length ? "City sign-offs not checked yet." : "No permits to check.", source: "Not checked" });
  } else {
    rows.push({
      id: "inspections",
      question: "Does their work pass inspection?",
      level: insp.signoffs >= 3 ? "yes" : insp.signoffs >= 1 ? "some" : "no",
      fact:
        insp.signoffs > 0
          ? `${plural(insp.signoffs, "city sign-off")} across ${plural(insp.checked, "recent permit")}${insp.finaled ? `, ${insp.finaled} closed out` : ""}`
          : `No sign-offs yet on the ${plural(insp.checked, "permit")} we checked. Often that means the work is still underway.`,
      source: "Public record",
    });
  }

  // 5. License
  const lic = readLicense(opts.license, now);
  const licFact: Record<LicenseRead, string> = {
    active: `Active with the state license board${opts.license?.business_name ? ` as ${opts.license.business_name}` : ""}`,
    expiring: "Active, but it expires within 90 days",
    inactive: "Not active on the state license board",
    discipline: "The state license board has a disciplinary record. Read it before you call.",
    not_checked: "Not checked yet. Ask for their license number; it takes them seconds.",
  };
  rows.push({
    id: "license",
    question: "Is their license active?",
    level: lic === "active" ? "yes" : lic === "expiring" ? "some" : lic === "not_checked" ? "not_checked" : "flag",
    fact: licFact[lic],
    source: lic === "not_checked" ? "Not checked" : "Public record",
  });

  // No city record tied to this name: the permit answers are unknown, not "no".
  if (opts.noRecord) {
    for (const r of rows) {
      if (r.id === "license") continue;
      r.level = "not_checked";
      r.source = "Not checked";
      r.fact = r.id === "done_it" ? "We couldn't tie this name to a San Jose permit record. A license number helps." : "Needs their permit record.";
    }
  }

  const lined = rows.filter((r) => r.level === "yes" || r.level === "some").length;
  const checked = rows.filter((r) => r.level !== "not_checked").length;
  const flag = lic === "inactive" ? "License not active on the state record." : lic === "discipline" ? "Disciplinary record on the state license." : null;
  const job = work ? `your ${work.word} job` : "your job";
  const open = rows.length - checked;
  const headline = flag
    ? flag
    : checked === 0
      ? "Not enough on public record to check yet"
      : `Lines up with ${job} on ${lined} of ${rows.length}${open ? ` · ${open} not checked yet` : ""}`;

  const weight = (id: FitId, l: FitLevel) => (l === "yes" ? 2 : l === "some" ? 1 : 0) * (id === "done_it" || id === "license" ? 2 : 1);
  const rank = (flag ? -1000 : 0) + rows.reduce((s, r) => s + weight(r.id, r.level), 0) * 100 + Math.min(same, 99);

  return { rows, lined, checked, total: rows.length, headline, flag, rank };
};
