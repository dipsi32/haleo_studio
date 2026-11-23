// Cloudflare Pages Function for /house: a shared report link gets a preview
// that names the house, instead of the site-wide one. The page itself is the
// normal app (next()); only the <head> tags change.
//
// /house?street=1488+Luning+Dr&zip=95118 → "What's on file for 1488 Luning Dr"

type Ctx = { request: Request; next: () => Promise<Response> };
type El = { setAttribute: (k: string, v: string) => void; setInnerContent: (s: string) => void };
declare const HTMLRewriter: new () => {
  on: (selector: string, handler: { element: (e: El) => void }) => InstanceType<typeof HTMLRewriter>;
  transform: (r: Response) => Response;
};

export const onRequestGet = async ({ request, next }: Ctx): Promise<Response> => {
  const res = await next();
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  const q = new URL(request.url).searchParams;
  const street = (q.get("street") ?? "").replace(/[^\w .#'-]/g, "").trim().slice(0, 80);
  const title = street ? `What's on file for ${street}` : "What's on file for your house?";
  const description = street
    ? "Permits, inspector sign-offs and hazard zones for this house, read in plain words. From San José's records."
    : "Every permit on file for your San José home, what the city signed off, and its hazard zones. Free, one minute.";
  const setContent = (content: string) => ({ element: (e: El) => e.setAttribute("content", content) });
  return new HTMLRewriter()
    .on("title", { element: (e) => e.setInnerContent(`${title} · Haleo`) })
    .on('meta[property="og:title"]', setContent(title))
    .on('meta[name="twitter:title"]', setContent(title))
    .on('meta[name="description"]', setContent(description))
    .on('meta[property="og:description"]', setContent(description))
    .on('meta[name="twitter:description"]', setContent(description))
    .transform(res);
};
