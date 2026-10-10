// Sample visibility results, shown only when live checks aren't connected and
// always labeled "Sample data" on the page. The competitor names are made up.
import type { Listing, ScanResults, ScanRow } from "./visibility";

const L = (name: string, rating: number, reviews: number): Listing => ({ name, rating, reviews, url: null });

export function demoScan(company: string, city = "San Jose"): ScanRow {
  const me = L(company, 4.9, 41);
  const tops = [L("Example Remodeling Co", 4.8, 312), L("Sample Custom Builders", 4.7, 205), L("Demo ADU Builders", 4.9, 160), L("Placeholder & Sons", 4.6, 98)];
  const q = (key: string, text: string, rank: number | null) => ({
    key,
    text,
    rank,
    total: 20,
    confidence: rank ? ("strong" as const) : ("none" as const),
    listing: rank ? me : null,
    top: tops,
  });
  const ai = (key: string, text: string, g: number, o: number, rival: string) => ({
    gemini: { key, text, runs: 4, mentioned: g, named: [{ name: rival, count: 3 }] },
    chatgpt: { key, text, runs: 4, mentioned: o, named: [{ name: rival, count: 4 }] },
  });
  const a1 = ai("gc", `general contractor in ${city}`, 0, 0, "Example Remodeling Co");
  const a2 = ai("remodel", `home remodel in ${city}`, 0, 1, "Sample Custom Builders");
  const a3 = ai("adu", `ADU builder in ${city}`, 1, 2, "Demo ADU Builders");
  const results: ScanResults = {
    city,
    queries: [
      { key: "gc", text: `general contractor in ${city}` },
      { key: "remodel", text: `home remodel in ${city}` },
      { key: "adu", text: `ADU builder in ${city}` },
    ],
    google: { status: "ok", perQuery: [q("gc", `general contractor in ${city}`, 14), q("remodel", `home remodel in ${city}`, null), q("adu", `ADU builder in ${city}`, 6)] },
    yelp: { status: "ok", perQuery: [q("gc", `general contractor in ${city}`, 9), q("remodel", `home remodel in ${city}`, 12), q("adu", `ADU builder in ${city}`, null)] },
    ai: {
      status: "ok",
      models: [
        { id: "gemini", label: "Gemini", perQuery: [a1.gemini, a2.gemini, a3.gemini] },
        { id: "chatgpt", label: "ChatGPT", perQuery: [a1.chatgpt, a2.chatgpt, a3.chatgpt] },
      ],
    },
  };
  return { id: "demo", contractor_id: "demo", created_at: new Date().toISOString(), city, results };
}
