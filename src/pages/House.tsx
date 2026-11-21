// /house — "What's on file for your house?" The free lookup: every permit
// pulled on a San Jose home, who did the work, and what the city signed off
// (or never did). The hook is curiosity about your own home; the next step
// is "planning a project? here's who has done this near you".
// Shareable: /house?street=…&zip=… reopens a lookup; sharing sends the tool.
import { NAV } from "@/lib/nav";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Home } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Input } from "@/components/ui/input";
import HouseReport from "@/components/house/HouseReport";
import { useHomeData } from "@/lib/useHomeData";
import type { Reader } from "@/lib/houseReport";
import { shortlistUrl } from "@/lib/homeGateway";
import { track } from "@/lib/analytics";
import { houseAddress, houseUrl, isSanJoseZip, looksLikeStreet } from "@/lib/houseLookup";
import { startOwnSearch } from "@/lib/homeStart";
import { saveIntakeStart } from "@/lib/intake";

export default function House() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const qStreet = params.get("street") ?? "";
  const qZip = params.get("zip") ?? "";
  const [street, setStreet] = useState(qStreet);
  const [zip, setZip] = useState(qZip);
  const [nudge, setNudge] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const ready = looksLikeStreet(qStreet) && isSanJoseZip(qZip);
  const address = useMemo(() => (ready ? houseAddress(qStreet, qZip) : undefined), [ready, qStreet, qZip]);
  const home = useHomeData(address);
  const qFor = params.get("for");
  const [reader, setReaderState] = useState<Reader>(qFor === "project" || qFor === "deal" ? qFor : "owner");
  const streetRef = useRef<HTMLInputElement>(null);

  // Keep "who's reading" in the link, so a shared report opens the same way.
  const setReader = (r: Reader) => {
    setReaderState(r);
    const next = new URLSearchParams(params);
    next.set("for", r);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (!address) return;
    track("house_lookup", { zip: address.zip });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  }, [address]);

  const lookUp = () => {
    if (!looksLikeStreet(street)) return setNudge("Add the house number and street, like 1553 Ilikai Ave.");
    if (!/^\d{5}$/.test(zip.trim())) return setNudge("Add your 5-digit ZIP.");
    if (!isSanJoseZip(zip)) return setNudge("For now we read San Jose's records only. Other cities are coming.");
    setNudge(null);
    navigate(`${houseUrl(street, zip)}&for=${reader}`);
  };

  // Their address is already known: the brief starts with it filled in.
  const planProject = () => {
    if (!address) return;
    track("house_next", { to: "project" });
    startOwnSearch(undefined, address.zip);
    saveIntakeStart({ address });
    navigate("/brief");
  };

  // A contractor who worked on this house: their own record, read the same way.
  const checkContractor = (name: string) => {
    track("house_next", { to: "contractor" });
    startOwnSearch(undefined, address?.zip);
    navigate(shortlistUrl({ name, project: null, zip: address?.zip ?? "" }));
  };

  // The house they're touring, or the one next door.
  const another = () => {
    track("house_next", { to: "another" });
    setStreet("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => streetRef.current?.focus(), 450);
  };

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto max-w-3xl px-5 pb-28 pt-28 sm:px-6 md:pt-32">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{NAV.house.label} · Free</p>
          <h1 className="mt-4 font-display text-[2.2rem] font-light leading-[1.06] tracking-tight md:text-[3.2rem]">
            What's on file <span className="italic">for your house?</span>
          </h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
            The permits the city has on file for your home, who did the work, and whether the city signed it off. Unfinished
            permits follow a house to the next job and to the sale. Better to know now.
          </p>

          <div className="mt-8 rounded-3xl border border-border bg-card p-4 shadow-soft md:p-5">
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Input
                ref={streetRef}
                aria-label="Street address"
                autoComplete="address-line1"
                placeholder="Street address, like 1553 Ilikai Ave"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookUp()}
                className="h-12 flex-1 rounded-full px-5 text-[16px]"
              />
              <Input
                aria-label="ZIP"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder="ZIP"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => e.key === "Enter" && lookUp()}
                className="h-12 rounded-full px-5 text-[16px] sm:w-28"
              />
              <button
                type="button"
                onClick={lookUp}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-smooth hover:opacity-90"
              >
                Look it up <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {nudge && <p className="mt-3 px-2 text-[13px] text-accent">{nudge}</p>}
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 px-2 text-[12.5px] text-muted-foreground">
              {["No sign-up", "City records, read for you", "We don't share your address"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-sage" strokeWidth={2.5} /> {t}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {address && (
          <div ref={resultRef} className="mt-10 scroll-mt-24">
            <p className="mb-4 flex items-center gap-2 text-[14px] text-muted-foreground">
              <Home className="h-4 w-4" /> {address.street}, San Jose {address.zip}
            </p>
            <HouseReport
              key={`${address.street}|${address.zip}`}
              street={address.street}
              zip={address.zip}
              data={home}
              reader={reader}
              onReader={setReader}
              onProject={planProject}
              onCheck={checkContractor}
              onAnother={another}
            />
          </div>
        )}
      </div>
    </main>
  );
}
