// /share: where the phone's share sheet lands ("Share → Haleo" from Nextdoor,
// Messages, Yelp, an email with a quote). Routes without asking; the only
// screen it ever shows is the honest one for a link we can't read.
import { useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ImagePlus } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { routeShare } from "@/lib/shareIn";
import { setPendingQuoteText } from "@/lib/quoteHandoff";

export default function ShareIn() {
  const navigate = useNavigate();
  const route = useMemo(() => {
    const q = new URLSearchParams(window.location.search);
    return routeShare({ title: q.get("title"), text: q.get("text"), url: q.get("url") });
  }, []);

  useEffect(() => {
    track("share_received", { kind: route.kind, site: route.site ?? "none" });
    if (route.kind === "quote") {
      setPendingQuoteText(route.text);
      navigate("/roast", { replace: true });
    } else if (route.kind === "names") {
      navigate(`/shortlist?text=${encodeURIComponent(route.text.slice(0, 6000))}`, { replace: true });
    }
  }, [route, navigate]);

  if (route.kind !== "link_only") return null;

  const site = route.site && !route.site.includes(".") ? route.site : "That site";
  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto max-w-xl px-5 pb-32 pt-28 sm:px-6 md:pt-32">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Got your link</p>
        <h1 className="mt-4 font-display text-[2rem] font-light leading-[1.08] tracking-tight">
          {site} keeps posts behind a login. <span className="italic">A screenshot works.</span>
        </h1>
        <p className="mt-5 text-[17px] leading-relaxed text-muted-foreground">
          Screenshot the replies, then drop them in. We'll pull out every contractor and check each one against your job.
        </p>
        <Button asChild size="lg" className="mt-8 rounded-full px-7">
          <Link to="/shortlist">
            <ImagePlus className="mr-2 h-4 w-4" /> Add screenshots
          </Link>
        </Button>
      </div>
    </main>
  );
}
