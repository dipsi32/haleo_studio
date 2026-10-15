// A few optional questions the homeowner can answer so their contractor
// arrives prepared. Framed as help for the visit, never as screening: every
// question is skippable, none asks for financial detail beyond how they plan
// to pay, and nothing is required to send.
import { Input } from "@/components/ui/input";
import {
  CONTEXT_TEXT_LIMIT,
  FUNDING_OPTIONS,
  SHOPPING_OPTIONS,
  WHO_DECIDES_OPTIONS,
  WHY_NOW_OPTIONS,
  type HomeownerContext,
} from "@/lib/prepTypes";

type Props = {
  name: string;
  value: HomeownerContext;
  onChange: (next: HomeownerContext) => void;
};

type Opts = readonly { value: string; label: string }[];

function Chips({ legend, options, value, onSelect }: { legend: string; options: Opts; value?: string; onSelect: (v?: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(on ? undefined : o.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function VisitContextForm({ name, value, onChange }: Props) {
  const set = <K extends keyof HomeownerContext>(k: K, v: HomeownerContext[K]) => onChange({ ...value, [k]: v });

  return (
    <section aria-labelledby="visit-context-h" className="mt-8 rounded-2xl border border-border bg-card/70 p-5">
      <h2 id="visit-context-h" className="font-display text-lg">
        Help {name} show up prepared
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
        A few quick taps so your first visit starts where you are, not at the basics. Every one is optional, and you can skip them all.
      </p>

      <div className="mt-5 space-y-5">
        <Chips legend="What's prompting this project?" options={WHY_NOW_OPTIONS} value={value.why_now} onSelect={(v) => set("why_now", v as HomeownerContext["why_now"])} />
        <Chips legend="Who weighs in on the decision?" options={WHO_DECIDES_OPTIONS} value={value.who_decides} onSelect={(v) => set("who_decides", v as HomeownerContext["who_decides"])} />
        <Chips legend="How are you planning to pay for it?" options={FUNDING_OPTIONS} value={value.funding} onSelect={(v) => set("funding", v as HomeownerContext["funding"])} />
        <Chips legend="Are you talking with other contractors?" options={SHOPPING_OPTIONS} value={value.shopping} onSelect={(v) => set("shopping", v as HomeownerContext["shopping"])} />

        <div>
          <label htmlFor="ctx-date" className="text-sm font-medium">
            Is there a date this has to be done by?
          </label>
          <Input
            id="ctx-date"
            value={value.hard_date ?? ""}
            onChange={(e) => set("hard_date", e.target.value.slice(0, CONTEXT_TEXT_LIMIT))}
            placeholder="e.g. Before my mother arrives in September"
            className="mt-2 rounded-xl"
          />
        </div>

        <div>
          <label htmlFor="ctx-past" className="text-sm font-medium">
            Anything from past projects you'd like handled differently?
          </label>
          <Input
            id="ctx-past"
            value={value.past_note ?? ""}
            onChange={(e) => set("past_note", e.target.value.slice(0, CONTEXT_TEXT_LIMIT))}
            placeholder="e.g. Clear updates, and no surprise changes to the price"
            className="mt-2 rounded-xl"
          />
        </div>
      </div>
    </section>
  );
}
