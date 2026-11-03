// "When could they come by?" A day, then morning / afternoon / evening, up to
// three. Light enough to finish in a few taps; the contractor confirms one.
import { useMemo, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import { DAY_PARTS, MAX_VISIT_TIMES, formatVisitTime, upcomingDays, visitKey, type DayPart } from "@/lib/visitTimes";

type Props = {
  name: string;
  value: string[];
  onChange: (next: string[]) => void;
};

export default function VisitTimesPicker({ name, value, onChange }: Props) {
  const days = useMemo(() => upcomingDays(12), []);
  const [day, setDay] = useState<string>(days[0]?.iso ?? "");
  const full = value.length >= MAX_VISIT_TIMES;

  const toggle = (part: DayPart) => {
    const key = visitKey(day, part);
    if (value.includes(key)) onChange(value.filter((v) => v !== key));
    else if (!full) onChange([...value, key].sort());
  };

  const countOn = (iso: string) => value.filter((v) => v.startsWith(iso)).length;

  return (
    <section aria-labelledby="visit-times-h" className="mt-8 rounded-2xl border border-border bg-card/70 p-5">
      <h2 id="visit-times-h" className="flex items-center gap-2 font-display text-lg">
        <CalendarDays className="h-5 w-5 text-accent" /> When could {name} come by?
      </h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Pick up to three times that work. {name} will confirm one with you. Optional.
      </p>

      <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label="Day">
        {days.map((d) => {
          const on = d.iso === day;
          const n = countOn(d.iso);
          return (
            <button
              key={d.iso}
              type="button"
              role="option"
              aria-selected={on}
              aria-label={`${d.weekday} ${d.month} ${d.day}`}
              onClick={() => setDay(d.iso)}
              className={`relative flex w-14 shrink-0 flex-col items-center rounded-2xl border py-2 transition-colors ${
                on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40"
              }`}
            >
              <span className={`text-[11px] uppercase tracking-wide ${on ? "text-background/70" : "text-muted-foreground"}`}>{d.weekday}</span>
              <span className="font-display text-lg leading-tight">{d.day}</span>
              <span className={`text-[10px] ${on ? "text-background/70" : "text-muted-foreground"}`}>{d.month}</span>
              {n > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-background" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {DAY_PARTS.map((p) => {
          const on = value.includes(visitKey(day, p.id));
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(p.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors disabled:opacity-40 ${
                on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40"
              }`}
            >
              {p.label} <span className={on ? "text-background/70" : "text-muted-foreground"}>{p.hours}</span>
            </button>
          );
        })}
      </div>

      {value.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Times you picked">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-sm text-foreground">
              {formatVisitTime(v)}
              <button type="button" aria-label={`Remove ${formatVisitTime(v)}`} onClick={() => onChange(value.filter((x) => x !== v))}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full && <p className="mt-2 text-xs text-muted-foreground">That's three. Remove one to pick another.</p>}
    </section>
  );
}
