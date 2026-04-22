import { Link } from "react-router-dom";

const Logo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`group inline-flex items-center gap-2 ${className}`}>
    <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-accent-foreground font-display text-lg leading-none transition-smooth group-hover:scale-105">
      h
    </span>
    <span className="font-display text-xl font-medium tracking-tight">Haleo</span>
  </Link>
);

export default Logo;
