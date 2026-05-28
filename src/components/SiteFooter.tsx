import Logo from "./Logo";

const SiteFooter = () => {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="container flex flex-col gap-6 py-8 md:py-12 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Haleo is the calm in the middle of your remodel.
            <br />
            Your unfair advantage from vision to final inspection.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <a href="/roast" className="transition-smooth hover:text-foreground">Roast a quote</a>
          <a href="/brief" className="transition-smooth hover:text-foreground">Find your contractor</a>
          <a href="/pro" className="transition-smooth hover:text-foreground">For contractors</a>
          <a href="mailto:hello@haleo.studio" className="transition-smooth hover:text-foreground">hello@haleo.studio</a>
          <span>© {new Date().getFullYear()} Haleo Studio</span>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
