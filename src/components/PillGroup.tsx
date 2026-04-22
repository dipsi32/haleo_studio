import { cn } from "@/lib/utils";

type Props = {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  multi?: boolean;
};

const PillGroup = ({ options, selected, onToggle, multi = true }: Props) => {
  return (
    <div className="flex flex-wrap justify-center gap-2.5">
      {options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => onToggle(o.value)}
            className={cn(
              "rounded-full border px-5 py-2.5 text-sm font-medium transition-smooth",
              active
                ? "border-accent bg-accent text-accent-foreground shadow-soft"
                : "border-border bg-card text-foreground/80 hover:border-foreground/30 hover:bg-secondary",
            )}
            aria-pressed={active}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

export default PillGroup;
