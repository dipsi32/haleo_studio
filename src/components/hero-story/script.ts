// "Text From Mike" — narrative data for the interactive hero story.
// Kept separate from animation/orchestration code so copy can be tuned
// without touching component logic. See the plan doc for the full
// beat-by-beat rationale.

export type Sender = "mike" | "user";

export interface ScriptMessage {
  id: string;
  sender: Sender;
  text: string;
}

export interface Choice {
  id: string;
  label: string;
  /** Mike's dismissive follow-up once this choice is tapped. */
  followUp: string;
}

export interface MessageStep {
  type: "messages";
  id: string;
  /** Stage-direction timestamp shown above the beat, e.g. "Tue 9:14 AM". */
  timestamp?: string;
  messages: ScriptMessage[];
  advance:
    | { kind: "button"; label: string }
    | { kind: "choices"; choices: Choice[] };
}

export type Step =
  | { type: "lure"; id: "lure" }
  | MessageStep
  | { type: "invoice"; id: "invoice" }
  | { type: "resolution"; id: "resolution" };

export const CONTRACTOR_NAME = "Mike — TotalHome Remodeling";

export const ORIGINAL_QUOTE = 34500;
export const FINAL_INVOICE = 61400;
export const OVERAGE = FINAL_INVOICE - ORIGINAL_QUOTE;
export const FAIR_VALUE = 36800;
export const OVER_MARKET_PCT = Math.round(((FINAL_INVOICE - FAIR_VALUE) / FAIR_VALUE) * 100);

export const STEPS: Step[] = [
  { type: "lure", id: "lure" },
  {
    type: "messages",
    id: "good-news",
    messages: [
      { id: "m1", sender: "mike", text: "Hey! So excited to work with you on the kitchen 🙌 Sending over the numbers now." },
      { id: "m2", sender: "mike", text: `$${ORIGINAL_QUOTE.toLocaleString()} total. Let's get started — just need your signature by Friday!` },
    ],
    advance: { kind: "button", label: "👍 Sounds good" },
  },
  {
    type: "messages",
    id: "first-crack",
    timestamp: "Tue 9:14 AM",
    messages: [
      { id: "m3", sender: "mike", text: "Quick update — inspector flagged the old wiring. Electrician pass is an extra $2,800." },
      { id: "m4", sender: "mike", text: "Should still finish on time though!" },
    ],
    advance: {
      kind: "choices",
      choices: [
        { id: "go_ahead", label: "Okay, go ahead", followUp: "You're the best, this is gonna look amazing 😊" },
        { id: "breakdown", label: "Can I see the breakdown?", followUp: "It's pretty standard stuff, I'll itemize it in the final invoice — don't worry about it 😊" },
      ],
    },
  },
  {
    type: "messages",
    id: "escalation",
    timestamp: "2 weeks later",
    messages: [
      { id: "m5", sender: "mike", text: "So... the cabinets we quoted are on backorder." },
      { id: "m6", sender: "mike", text: "Found a ‘comparable’ option, it's nicer tbh" },
      { id: "m7", sender: "mike", text: "Only +$6,200" },
    ],
    advance: {
      kind: "choices",
      choices: [
        { id: "okay", label: "...okay", followUp: "Totally normal for a project this size, don't stress 🙏" },
        { id: "alot", label: "Wait, that's a lot", followUp: "Totally normal for a project this size, don't stress 🙏" },
      ],
    },
  },
  {
    type: "messages",
    id: "final-message",
    messages: [
      { id: "m8", sender: "mike", text: `Ok final invoice attached 📎 — total comes to $${FINAL_INVOICE.toLocaleString()}. Net 7, thanks!` },
    ],
    advance: { kind: "button", label: "See the invoice" },
  },
  { type: "invoice", id: "invoice" },
  { type: "resolution", id: "resolution" },
];
