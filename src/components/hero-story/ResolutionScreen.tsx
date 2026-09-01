import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { FAIR_VALUE, FINAL_INVOICE, OVER_MARKET_PCT } from "./script";
import { setPendingQuoteText } from "@/lib/quoteHandoff";
import { track } from "@/lib/analytics";

const SAMPLE_QUOTE_TEXT =
  `Kitchen remodel — final invoice: $${FINAL_INVOICE.toLocaleString()}. ` +
  "Cabinets (swapped for a 'comparable' option), electrical pass, labor, backordered materials.";

type Phase = "line1" | "line2" | "handoff";

interface ResolutionScreenProps {
  reducedMotion: boolean;
}

/** The Sweep primitive at its largest scale: the same motion that revealed a
 * message and then the invoice now expands to fill the whole viewport,
 * turning cold charcoal into warm dawn light in one continuous pass. This
 * component owns that transition and the calm product handoff that follows. */
export function ResolutionScreen({ reducedMotion }: ResolutionScreenProps) {
  const [phase, setPhase] = useState<Phase>(reducedMotion ? "handoff" : "line1");
  const navigate = useNavigate();

  useEffect(() => {
    if (reducedMotion) return;
    const t1 = setTimeout(() => setPhase("line2"), 2200);
    const t2 = setTimeout(() => setPhase("handoff"), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (phase === "handoff") track("hero_story_completed");
  }, [phase]);

  const goToRoast = () => {
    setPendingQuoteText(SAMPLE_QUOTE_TEXT);
    track("cta_roast_clicked", { where: "hero_story" });
    navigate("/roast");
  };

  return (
    <div className="hero-story__stage hero-story--warm">
      {phase !== "handoff" ? (
        <motion.p
          key={phase}
          className="hero-story__resolution-line"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          {phase === "line1"
            ? "You didn't need a lawyer. You didn't need a construction degree."
            : "You needed someone in your corner before you said yes."}
        </motion.p>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%" }}
        >
          <p className="hero-story__resolution-signoff">That's Haleo.</p>

          <div className="hero-story__handoff-card" style={{ marginTop: "2rem" }}>
            <p className="hero-story__handoff-label">If this were your quote</p>
            <p
              style={{
                fontFamily: "var(--hs-font-display)",
                fontSize: "1.5rem",
                letterSpacing: "-0.02em",
                margin: "0.5rem 0",
              }}
            >
              Fair value: ~${FAIR_VALUE.toLocaleString()}
            </p>
            <p style={{ fontSize: "0.875rem", opacity: 0.75, marginBottom: "1.25rem" }}>
              {OVER_MARKET_PCT}% over market · 3 line items flagged
            </p>
            <button type="button" className="hero-story__cta" onClick={goToRoast}>
              Upload your quote — see this for yours
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
