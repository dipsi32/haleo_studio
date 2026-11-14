// Shared into Haleo from another app (the phone's share sheet → /share).
// Decide where it goes, without asking: a quote goes to the quote check,
// anything with names in it goes to the shortlist, and a bare link we can't
// read (Nextdoor and Facebook keep posts behind a login) gets an honest
// "screenshot it instead". Pure; tested in shareIn.test.ts.

export type ShareIn = { title?: string | null; text?: string | null; url?: string | null };
export type ShareRoute = { kind: "quote" | "names" | "link_only"; text: string; site: string | null };

const URL_RE = /https?:\/\/\S+/gi;

const siteOf = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    if (/nextdoor\./.test(host)) return "Nextdoor";
    if (/facebook\.|fb\.com/.test(host)) return "Facebook";
    if (/reddit\./.test(host)) return "Reddit";
    if (/yelp\./.test(host)) return "Yelp";
    if (/google\./.test(host)) return "Google";
    return host;
  } catch {
    return null;
  }
};

/** Titles like "Acme Builders - San Jose - Yelp" → "Acme Builders - San Jose". */
const cleanTitle = (t: string) => t.replace(/\s*[-|·]\s*(Yelp|Google Maps|Nextdoor|Facebook|Reddit|Houzz|Angi|Thumbtack)\b.*$/i, "").trim();

export const routeShare = (s: ShareIn): ShareRoute => {
  const rawUrl = s.url?.trim() || (s.text?.match(URL_RE)?.[0] ?? null);
  const site = siteOf(rawUrl);
  const words = (s.text ?? "").replace(URL_RE, " ").replace(/\s+/g, " ").trim();
  const title = s.title ? cleanTitle(s.title) : "";
  const body = [title, words].filter(Boolean).join("\n").trim();

  const looksLikeQuote =
    /\$\s?\d[\d,]{2,}/.test(body) && /\b(estimate|quote|proposal|bid|invoice|total|scope of work|deposit|line items?)\b/i.test(body);
  if (looksLikeQuote) return { kind: "quote", text: body, site };

  // Letters beyond a site name: there's something to read.
  if (body.replace(/[^a-z]/gi, "").length >= 3) return { kind: "names", text: [body, rawUrl].filter(Boolean).join("\n"), site };

  return { kind: "link_only", text: rawUrl ?? "", site };
};
