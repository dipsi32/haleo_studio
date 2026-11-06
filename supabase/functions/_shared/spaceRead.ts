// The compact photo read: what the homeowner needs in 15 seconds, and a
// one-glance site brief for the contractor. Pure, so vitest can test it
// (src/lib/spaceRead.test.ts). Used by analyze-space.

export type Basis = "grounded" | "inferred" | "question";

export type Noticed = { kind: "good" | "watch" | "unknown"; title: string; note: string; photo_url: string | null };

export type ReadQuestion = { id: string; question: string; why: string; options: string[]; photo_url: string | null };

export const TRADES = [
  "Electrical",
  "Plumbing",
  "HVAC",
  "Structural",
  "Framing",
  "Drywall & paint",
  "Flooring",
  "Cabinets & counters",
  "Tile",
  "Windows & doors",
  "Roofing",
  "Exterior",
  "Design",
  "Other",
] as const;

export type SiteBrief = {
  likely_work: { trade: string; work: string; basis: Basis }[];
  watch_outs: { text: string; basis: Basis }[];
  check_on_site: string[];
  job_size: "small" | "medium" | "large" | "unclear";
  trades: string[];
  duration: string;
};

export type SpaceRead = {
  headline: string;
  noticed: Noticed[];
  questions: ReadQuestion[];
  photo_request: string | null;
  site_brief: SiteBrief;
};

export const SPACE_READ_TOOL = {
  type: "function",
  function: {
    name: "emit_space_read",
    description: "Return the compact read of the homeowner's photos.",
    parameters: {
      type: "object",
      properties: {
        headline: { type: "string", description: "One plain sentence, at most 16 words." },
        noticed: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["good", "watch", "unknown"] },
              title: { type: "string", description: "At most 8 words." },
              note: { type: "string", description: "At most 20 words: what you see and why it matters." },
              photo: { type: ["integer", "null"] },
            },
            required: ["kind", "title", "note"],
            additionalProperties: false,
          },
        },
        questions: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            properties: {
              question: { type: "string", description: "At most 12 words, answerable in one tap." },
              why: { type: "string", description: "At most 16 words, for the contractor." },
              options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
              photo: { type: ["integer", "null"] },
            },
            required: ["question", "why", "options"],
            additionalProperties: false,
          },
        },
        photo_request: { type: ["string", "null"], description: "What one more photo would show, at most 10 words, or null." },
        site_brief: {
          type: "object",
          properties: {
            likely_work: {
              type: "array",
              maxItems: 5,
              items: {
                type: "object",
                properties: {
                  trade: { type: "string", enum: [...TRADES] },
                  work: { type: "string", description: "At most 14 words." },
                  basis: { type: "string", enum: ["grounded", "inferred", "question"] },
                },
                required: ["trade", "work", "basis"],
                additionalProperties: false,
              },
            },
            watch_outs: {
              type: "array",
              maxItems: 3,
              items: {
                type: "object",
                properties: {
                  text: { type: "string", description: "At most 22 words." },
                  basis: { type: "string", enum: ["grounded", "inferred", "question"] },
                },
                required: ["text", "basis"],
                additionalProperties: false,
              },
            },
            check_on_site: { type: "array", maxItems: 4, items: { type: "string" } },
            job_size: { type: "string", enum: ["small", "medium", "large", "unclear"] },
            trades: { type: "array", maxItems: 5, items: { type: "string" } },
            duration: { type: "string", description: 'Rough working time, e.g. "about 2–4 weeks", or "unclear".' },
          },
          required: ["likely_work", "watch_outs", "check_on_site", "job_size", "trades", "duration"],
          additionalProperties: false,
        },
      },
      required: ["headline", "noticed", "questions", "site_brief"],
      additionalProperties: false,
    },
  },
};

const str = (v: unknown, max = 240): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const basisOf = (v: unknown): Basis => (v === "grounded" || v === "inferred" || v === "question" ? v : "inferred");
const photoOf = (v: unknown, urls: string[]): string | null =>
  typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= urls.length ? urls[v - 1] : null;
const arr = (v: unknown): Record<string, unknown>[] =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];

/** Keep only what's well-formed, within the limits the page is designed for. Null if there's no usable read. */
export const normalizeSpaceRead = (raw: unknown, photoUrls: string[]): SpaceRead | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const headline = str(r.headline, 160);
  if (!headline) return null;

  const noticed = arr(r.noticed)
    .map((n) => ({
      kind: (n.kind === "good" || n.kind === "watch" || n.kind === "unknown" ? n.kind : "unknown") as Noticed["kind"],
      title: str(n.title, 80),
      note: str(n.note, 200),
      photo_url: photoOf(n.photo, photoUrls),
    }))
    .filter((n) => n.title)
    .slice(0, 3);

  const questions = arr(r.questions)
    .map((q, i) => {
      const options = (Array.isArray(q.options) ? q.options : []).map((o) => str(o, 40)).filter(Boolean).slice(0, 4);
      return { id: `q${i + 1}`, question: str(q.question, 120), why: str(q.why, 160), options, photo_url: photoOf(q.photo, photoUrls) };
    })
    .filter((q) => q.question && q.options.length >= 2)
    .slice(0, 3);

  const sb = (r.site_brief && typeof r.site_brief === "object" ? r.site_brief : {}) as Record<string, unknown>;
  const site_brief: SiteBrief = {
    likely_work: arr(sb.likely_work)
      .map((w) => ({ trade: str(w.trade, 40) || "Other", work: str(w.work, 140), basis: basisOf(w.basis) }))
      .filter((w) => w.work)
      .slice(0, 5),
    watch_outs: arr(sb.watch_outs)
      .map((w) => ({ text: str(w.text, 200), basis: basisOf(w.basis) }))
      .filter((w) => w.text)
      .slice(0, 3),
    check_on_site: (Array.isArray(sb.check_on_site) ? sb.check_on_site : []).map((c) => str(c, 140)).filter(Boolean).slice(0, 4),
    job_size: (["small", "medium", "large"].includes(sb.job_size as string) ? sb.job_size : "unclear") as SiteBrief["job_size"],
    trades: (Array.isArray(sb.trades) ? sb.trades : []).map((t) => str(t, 40)).filter(Boolean).slice(0, 5),
    duration: str(sb.duration, 40) || "unclear",
  };

  const photo_request = str(r.photo_request, 100) || null;
  return { headline, noticed, questions, photo_request, site_brief };
};

const SIZE_LABEL: Record<SiteBrief["job_size"], string> = {
  small: "Small job",
  medium: "Medium job",
  large: "Large job",
  unclear: "Size unclear",
};

/** "Medium job · electrician, finish carpenter · about 2–4 weeks". Our inference, and labelled so. */
export const atAGlance = (b: SiteBrief): string =>
  [SIZE_LABEL[b.job_size], b.trades.join(", "), b.duration && b.duration !== "unclear" ? b.duration : null].filter(Boolean).join(" · ");

/** The site brief as the sections the contractor inbox already renders. */
export const siteBriefSections = (
  b: SiteBrief,
  answers: { question: string; answer: string }[] = [],
): { key: string; title: string; description: string; items: { text: string; basis: Basis }[] }[] => {
  const out = [];
  out.push({
    key: "job_summary",
    title: "Job summary",
    description: "Size, trades and duration: Haleo's estimate from the photos.",
    items: [{ text: atAGlance(b), basis: "inferred" as Basis }],
  });
  if (answers.length) {
    out.push({
      key: "homeowner_answers",
      title: "Homeowner's answers",
      description: "What they told us about their photos.",
      items: answers.map((a) => ({ text: `${a.question} ${a.answer}`, basis: "grounded" as Basis })),
    });
  }
  if (b.likely_work.length) {
    out.push({
      key: "scope_of_work",
      title: "Scope of work",
      description: "By trade, from the photos and their answers.",
      items: b.likely_work.map((w) => ({ text: `${w.trade}: ${w.work}`, basis: w.basis })),
    });
  }
  if (b.watch_outs.length) {
    out.push({ key: "risks", title: "Risks & unknowns", description: "What could change the scope or the price.", items: b.watch_outs });
  }
  if (b.check_on_site.length) {
    out.push({
      key: "verify_on_site",
      title: "Verify on site",
      description: "What only a visit can settle.",
      items: b.check_on_site.map((c) => ({ text: c, basis: "question" as Basis })),
    });
  }
  return out;
};

// ───── The small tag next to each line ─────
// No tag for what's plainly in the photo or what the homeowner said: that's
// the normal case. "Likely" for an assumption, "Verify on site" for an
// unknown, "Estimate" for the job summary. Never a section name glued to a
// tag ("Likely work · Seen").
export type BasisTag = { label: string; tone: "estimate" | "likely" | "verify" } | null;

export const basisTag = (basis: Basis, sectionTitle?: string): BasisTag => {
  const t = (sectionTitle ?? "").toLowerCase();
  if (t === "job summary") return { label: "Estimate", tone: "estimate" };
  if (t === "homeowner's answers" || t === "verify on site") return null;
  if (basis === "inferred") return { label: "Likely", tone: "likely" };
  if (basis === "question") return { label: "Verify on site", tone: "verify" };
  return null;
};
