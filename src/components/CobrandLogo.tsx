// The header mark on a contractor's brief link. The homeowner is in the
// contractor's experience: their logo (or initials) and company name lead,
// with a quiet "powered by Haleo" underneath. Without a contractor, it's
// simply the Haleo logo.
import { Link } from "react-router-dom";
import Logo from "@/components/Logo";

export type Cobrand = { name: string; logoUrl?: string | null; href: string };

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /[A-Za-z0-9]/.test(w))
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function CobrandLogo({ brand, className = "" }: { brand?: Cobrand | null; className?: string }) {
  if (!brand) return <Logo className={className} />;
  return (
    <Link to={brand.href} className={`group inline-flex min-w-0 items-center gap-2.5 ${className}`} aria-label={`${brand.name}, powered by Haleo`}>
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-border object-cover" />
      ) : (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-sm text-accent-soft-foreground">
          {initialsOf(brand.name)}
        </span>
      )}
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-display text-[17px] font-medium tracking-tight">{brand.name}</span>
        <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
          powered by
          <span className="inline-grid h-3.5 w-3.5 place-items-center rounded-full bg-accent font-display text-[9px] leading-none text-accent-foreground">h</span>
          <span className="font-medium text-foreground/70">Haleo</span>
        </span>
      </span>
    </Link>
  );
}
