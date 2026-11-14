// The homepage gateway: "Where are you in your search?" Four honest answers,
// each with what happens next (feedforward), and the hand-off into the flow
// that answers it. Pure helpers here; the hand-offs that touch storage are in
// homeStart.ts. Tested in homeGateway.test.ts.
import type { ShortlistProject } from "@/lib/shortlist";

export type GatewayPath = "scratch" | "thread" | "one" | "quote";

export const GATEWAY: {
  id: GatewayPath;
  title: string;
  sub: string;
  next: [string, string, string];
}[] = [
  {
    id: "scratch",
    title: "I'm just getting started",
    sub: "No one in mind yet. Tell us what you want done, and we'll find who has built it near you.",
    next: ["Describe it in your words", "See who has built it near you", "Send your brief to the ones you like"],
  },
  {
    id: "thread",
    title: "I have a few names from neighbors",
    sub: "From Nextdoor, Reddit or a group chat. Paste the thread or add screenshots. Don't worry about the mess, we'll narrow it down.",
    next: ["We pull out every name", "We read each one's permits, inspections and license", "You see the best fit for your job"],
  },
  {
    id: "one",
    title: "I have a contractor in mind",
    sub: "Paste their name, license number or their quote. We'll dig into their work record for you.",
    next: ["We find their city record", "We check it against your job", "You see what lines up, and what to ask"],
  },
  {
    id: "quote",
    title: "I have a quote",
    sub: "Upload it or paste it. We'll review it line by line before you sign.",
    next: ["We read every line", "We check it against what's normal nearby", "You see what to push back on"],
  },
];

export const GATEWAY_PROJECTS: { id: ShortlistProject; label: string }[] = [
  { id: "kitchen", label: "Kitchen" },
  { id: "bathroom", label: "Bathroom" },
  { id: "addition", label: "ADU or addition" },
  { id: "full-home", label: "Whole home" },
  { id: "other", label: "Something else" },
];

/** "1025687", "Lic #1025687" → "1025687". */
export const licenseIn = (s: string): string | null => s.match(/\b(\d{6,8})\b/)?.[1] ?? null;
/** A US phone number, as typed. */
export const phoneIn = (s: string): string | null => s.match(/(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/)?.[1] ?? null;

/** The shortlist URL that runs straight through: no form, no confirm step. */
export const shortlistUrl = (o: {
  text?: string;
  name?: string;
  project?: ShortlistProject | null;
  zip?: string;
  shots?: boolean;
}): string => {
  const q = new URLSearchParams({ go: "1" });
  if (o.text?.trim()) q.set("text", o.text.trim().slice(0, 6000));
  if (o.name?.trim()) q.set("name", o.name.trim().slice(0, 200));
  if (o.project) q.set("project", o.project);
  if (o.zip && /^\d{5}$/.test(o.zip)) q.set("zip", o.zip);
  if (o.shots) q.set("shots", "1");
  return `/shortlist?${q.toString()}`;
};

/** "Acme Builders 408-555-0199 Lic #1025687" → the name, phone and license, apart. */
export const contractorFromTyped = (raw: string): { name: string; phone: string; license: string } => {
  const phone = phoneIn(raw) ?? "";
  const license = licenseIn(raw.replace(phone, "")) ?? "";
  const name = raw
    .replace(phone, " ")
    .replace(/\b(lic(ense)?\.?\s*(#|no\.?|number)?\s*:?\s*)?\d{6,8}\b/i, " ")
    .replace(/[,;|·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { name: name || (license ? `License #${license}` : raw.trim()), phone, license };
};
