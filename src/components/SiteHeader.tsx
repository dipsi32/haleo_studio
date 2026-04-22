import { Link } from "react-router-dom";
import Logo from "./Logo";

const SiteHeader = () => {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="container flex h-20 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#how" className="transition-smooth hover:text-foreground">How it works</a>
          <a href="#pricing" className="transition-smooth hover:text-foreground">Pricing</a>
          <Link to="/brief" className="transition-smooth hover:text-foreground">For homeowners</Link>
          <Link to="/audit" className="transition-smooth hover:text-foreground">For contractors</Link>
        </nav>
        <Link
          to="/brief"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-soft transition-smooth hover:bg-secondary"
        >
          Jump back in
        </Link>
      </div>
    </header>
  );
};

export default SiteHeader;
