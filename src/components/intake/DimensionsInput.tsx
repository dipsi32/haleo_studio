// Structured measurements — length × width × height in ft or m.
// Live area readout so the user can sanity-check their guess.
import { Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  type Dimensions,
  type LengthUnit,
  dimensionsArea,
} from "@/lib/intake";
import { cn } from "@/lib/utils";

type Props = {
  value?: Dimensions;
  onChange: (d: Dimensions) => void;
};

const DimensionsInput = ({ value, onChange }: Props) => {
  const dim: Dimensions = {
    unit: value?.unit ?? "ft",
    length: value?.length,
    width: value?.width,
    height: value?.height,
  };
  const set = (patch: Partial<Dimensions>) => onChange({ ...dim, ...patch });
  const num = (s: string): number | undefined => {
    if (!s.trim()) return undefined;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const area = dimensionsArea(dim);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 font-display text-sm font-medium">
          <Ruler className="h-4 w-4 text-accent" /> Measurements
        </label>
        {/* unit toggle */}
        <div className="flex items-center rounded-full border border-border bg-background p-0.5 text-[11px] font-medium">
          {(["ft", "m"] as LengthUnit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => set({ unit: u })}
              className={cn(
                "rounded-full px-2.5 py-0.5 transition-smooth",
                dim.unit === u
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            { key: "length", label: "Length" },
            { key: "width", label: "Width" },
            { key: "height", label: "Ceiling" },
          ] as const
        ).map(({ key, label }) => (
          <div key={key}>
            <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </label>
            <div className="relative mt-1">
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                placeholder="—"
                value={dim[key] ?? ""}
                onChange={(e) => set({ [key]: num(e.target.value) } as Partial<Dimensions>)}
                className="rounded-xl bg-background pr-9 text-sm tabular-nums"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase text-muted-foreground">
                {dim.unit}
              </span>
            </div>
          </div>
        ))}
      </div>

      {area != null && (
        <p className="mt-3 text-xs text-muted-foreground">
          Approx floor area:{" "}
          <span className="font-medium text-foreground">{area} sq ft</span>
        </p>
      )}
    </div>
  );
};

export default DimensionsInput;
