// Two quick taps a contractor prices from first: how big the room is, and the
// finish level. Both optional. Sizes come with the usual range for the room,
// so "Medium" means something; an exact number is welcome but never required.
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { Room } from "@/lib/intake";
import { FINISH_LEVELS, parseSqft, sizeBuckets, type FinishLevel, type RoomSize } from "@/lib/roomFacts";

type Props = {
  room?: Room;
  size?: RoomSize;
  finish?: FinishLevel;
  onSize: (s: RoomSize) => void;
  onFinish: (f: FinishLevel) => void;
};

const Chip = ({ on, onClick, title, hint }: { on: boolean; onClick: () => void; title: string; hint?: string }) => (
  <button
    type="button"
    aria-pressed={on}
    onClick={onClick}
    className={cn(
      "rounded-2xl border px-3.5 py-2.5 text-left transition-colors",
      on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40",
    )}
  >
    <span className="block text-sm font-medium">{title}</span>
    {hint && <span className={cn("block text-[11px]", on ? "text-background/70" : "text-muted-foreground")}>{hint}</span>}
  </button>
);

export default function RoomFactsStep({ room, size, finish, onSize, onFinish }: Props) {
  const buckets = sizeBuckets(room);
  const [exact, setExact] = useState(size?.sqft ? String(size.sqft) : "");
  const noun = room === "full-home" ? "home" : room === "bathroom" ? "bathroom" : room === "kitchen" ? "kitchen" : "space";

  return (
    <section className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
      <p className="font-display text-xl font-light leading-tight">Roughly how big is the {noun}?</p>
      <p className="mt-1 text-sm text-muted-foreground">A guess is perfect. It's the first thing a contractor prices from. Optional.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {buckets.map((b) => (
          <Chip
            key={b.value}
            on={size?.bucket === b.value && !size?.sqft}
            title={b.label}
            hint={b.range}
            onClick={() => {
              setExact("");
              onSize({ bucket: b.value });
              track("room_size_picked", { bucket: b.value, room: room ?? null });
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Input
          value={exact}
          onChange={(e) => setExact(e.target.value.slice(0, 20))}
          onBlur={() => {
            const sqft = parseSqft(exact);
            if (sqft) {
              onSize({ bucket: size?.bucket && size.bucket !== "unsure" ? size.bucket : "medium", sqft });
              track("room_size_picked", { exact: true, room: room ?? null });
            }
          }}
          placeholder="Or the number: 150, or 12 x 14"
          inputMode="text"
          className="h-10 max-w-[15rem] rounded-xl"
          aria-label="Size in square feet"
        />
        <button
          type="button"
          onClick={() => {
            setExact("");
            onSize({ bucket: "unsure" });
          }}
          className={cn("text-sm underline-offset-4 hover:underline", size?.bucket === "unsure" ? "font-medium text-foreground" : "text-muted-foreground")}
        >
          Not sure
        </button>
      </div>

      <p className="mt-8 font-display text-xl font-light leading-tight">What finish level do you have in mind?</p>
      <p className="mt-1 text-sm text-muted-foreground">It shapes the price more than anything else. Optional.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FINISH_LEVELS.map((f) => (
          <Chip
            key={f.value}
            on={finish === f.value}
            title={f.label}
            hint={f.hint}
            onClick={() => {
              onFinish(f.value);
              track("finish_level_picked", { finish: f.value });
            }}
          />
        ))}
      </div>
    </section>
  );
}
