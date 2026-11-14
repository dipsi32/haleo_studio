// The homepage's one box: "Tell us about your project, or paste the names
// you've been given." Whatever they type, we work out which door it is, so
// they never have to pick one:
//   - a quote (prices and a total)       → the quote check
//   - names from neighbors (phones,
//     license numbers, business names,
//     "we used…", a link)                 → the shortlist, prefilled
//   - anything else is their project      → the brief, in their words
// Pure; tested in homeEntry.test.ts.

export type HomeEntry = "quote" | "names" | "project";

const PHONE = /(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/;
const LICENSE = /\b(lic(ense)?\.?\s*(#|no\.?|number)?\s*:?\s*\d{5,8}|cslb)\b/i;
const URL_RE = /https?:\/\/\S+/i;
const MONEY = /\$\s?\d[\d,]{2,}/g;
const QUOTE_WORDS = /\b(estimate|quote|proposal|bid|invoice|total|deposit|line items?|subtotal|allowance)\b/i;
// "Acme Builders", "Pacific Remodeling Inc", "Joe's Plumbing"
const BUSINESS = /\b[A-Z][\w'&.-]*(\s+[A-Z][\w'&.-]*)*\s+(Builders?|Construction|Contracting|Contractors?|Remodel(ing|ers)?|Renovations?|Plumbing|Electric(al)?|Roofing|Homes|Design(-|\s)?Build|Inc\.?|LLC|Co\.)\b/;
// A referral verb followed by a name: "we used Acme", "recommend Mike", "ask for Rosa".
// The verb can start a sentence; the name must be capitalized.
const REFERRAL = /\b(?:[Uu]sed|[Hh]ired|[Rr]ecommend(?:ed)?|[Tt]ry|[Cc]all(?:ed)?|[Aa]sk for|[Gg]o with|[Ww]ent with)\s+[A-Z][a-z]+|\b(?:[Mm]y|[Oo]ur|[Gg]reat) guy\b/;

export const classifyHomeEntry = (raw: string): HomeEntry => {
  const t = raw.trim();
  if (!t) return "project";
  const prices = t.match(MONEY)?.length ?? 0;
  if ((prices >= 2 || (prices >= 1 && QUOTE_WORDS.test(t))) && QUOTE_WORDS.test(t)) return "quote";
  if (PHONE.test(t) || LICENSE.test(t) || URL_RE.test(t)) return "names";
  if (BUSINESS.test(t)) return "names";
  // "Recommend Mike, he did our bathroom" reads as a referral, not a project.
  if (REFERRAL.test(t)) return "names";
  return "project";
};
