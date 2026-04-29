import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Instagram, Globe, Plus, X, Loader2, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useContractorAccount, type PortfolioLink } from "@/hooks/useContractorAccount";
import { toast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";

const detectLinkType = (url: string): PortfolioLink["type"] => {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("houzz.com")) return "houzz";
  if (u.includes("yelp.com")) return "yelp";
  return "website";
};

const ProOnboarding = () => {
  const { user } = useAuth();
  const { account, refetch, loading } = useContractorAccount();
  const navigate = useNavigate();

  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [links, setLinks] = useState<PortfolioLink[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && account) {
      setCompanyName(account.company_name ?? "");
      setLogoUrl(account.logo_url ?? "");
      const existing = (account.portfolio_links as unknown as PortfolioLink[]) ?? [];
      setLinks(existing);
    }
  }, [loading, account]);

  const addLink = () => {
    if (!newUrl.trim()) return;
    let url = newUrl.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    const link: PortfolioLink = { url, type: detectLinkType(url), status: "pending" };
    setLinks((l) => [...l, link]);
    setNewUrl("");
  };

  const removeLink = (idx: number) => setLinks((l) => l.filter((_, i) => i !== idx));

  const handleFinish = async () => {
    if (!user) return;
    if (!companyName.trim()) {
      toast({ title: "Company name needed", description: "Just so we know how to label your portal.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("contractor_accounts")
        .update({
          company_name: companyName.trim(),
          logo_url: logoUrl || null,
          portfolio_links: links as never,
          onboarded_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      // Fire-and-forget portfolio scrape for each link
      if (links.length > 0) {
        supabase.functions.invoke("scrape-portfolio-link", {
          body: { user_id: user.id, links: links.map((l) => l.url) },
        }).catch(() => { /* background; we don't block */ });
      }

      await refetch();
      toast({ title: "Workspace ready", description: "Welcome in." });
      navigate("/pro/profile", { replace: true });
    } catch (err) {
      toast({
        title: "Couldn't save",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const linkIcon = (type?: PortfolioLink["type"]) => {
    if (type === "instagram") return <Instagram className="h-4 w-4" />;
    return <Globe className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-warm px-6 py-10">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Logo />
        <span className="text-xs text-muted-foreground">Setup · 2 minutes</span>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto mt-12 max-w-2xl"
      >
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Build your portal
          </span>
          <h1 className="mt-5 font-display text-4xl font-light leading-tight">
            Tell us who you are.<br />
            <span className="text-muted-foreground">We'll do the rest.</span>
          </h1>
        </div>

        <div className="mt-12 space-y-8 rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
          {/* Company */}
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Company name
            </label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Bayview Build Co"
              className="mt-2 h-12 rounded-xl bg-background text-lg"
            />
            {account?.contractor_id && (
              <p className="mt-2 text-xs text-muted-foreground">
                ✓ We matched your email to a CSLB record. Edit if needed.
              </p>
            )}
          </div>

          {/* Logo */}
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Logo URL <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://yoursite.com/logo.png"
              className="mt-2 h-12 rounded-xl bg-background"
            />
          </div>

          {/* Portfolio */}
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Show us your work
            </label>
            <p className="mt-1 text-sm text-muted-foreground">
              Paste your Instagram, website, Houzz, or Yelp. We'll pull your best photos automatically.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
                placeholder="instagram.com/yourhandle"
                className="h-12 rounded-xl bg-background"
              />
              <Button onClick={addLink} type="button" variant="outline" className="h-12 rounded-xl">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>

            <AnimatePresence>
              {links.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 space-y-2"
                >
                  {links.map((link, idx) => (
                    <motion.li
                      key={`${link.url}-${idx}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3"
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent">
                        {linkIcon(link.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{link.url}</p>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {link.type}
                        </p>
                      </div>
                      <button
                        onClick={() => removeLink(idx)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remove"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <Button
            onClick={handleFinish}
            disabled={saving || !companyName.trim()}
            size="lg"
            className="h-12 w-full rounded-full text-base"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Setting up your portal…
              </>
            ) : (
              <>
                Open my workspace <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            We'll keep scraping in the background. You can add more links anytime.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default ProOnboarding;
