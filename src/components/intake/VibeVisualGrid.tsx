// Visual vibe picker — every option is a tiny moodboard, not just a word.
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { VIBE_OPTIONS } from "@/lib/intake";
import { cn } from "@/lib/utils";

type Props = {
  selected: string[];
  onToggle: (value: string) => void;
};

const VibeVisualGrid = ({ selected, onToggle }: Props) => {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {VIBE_OPTIONS.map((v) => {
        const active = selected.includes(v.value);
        return (
          <motion.button
            key={v.value}
            type="button"
            onClick={() => onToggle(v.value)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            aria-pressed={active}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-card p-3 text-left shadow-soft transition-smooth",
              active
                ? "border-accent ring-2 ring-accent/40 shadow-lift"
                : "border-border hover:border-accent/40 hover:shadow-lift",
            )}
          >
            {/* Moodboard preview */}
            <div
              className="relative h-24 w-full overflow-hidden rounded-xl"
              style={{ background: v.texture }}
            >
              {/* tri-color strip overlay */}
              <div className="absolute inset-x-2 bottom-2 flex h-5 overflow-hidden rounded-md ring-1 ring-background/40">
                {v.swatch.map((c, i) => (
                  <span
                    key={i}
                    className="flex-1"
                    style={{ background: `hsl(${c})` }}
                  />
                ))}
              </div>
              {active && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-accent-foreground shadow-soft">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
            <div className="mt-3 px-1">
              <p className="font-display text-sm font-medium leading-tight">{v.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{v.blurb}</p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};

export default VibeVisualGrid;
