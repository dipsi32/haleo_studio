import { useEffect, useRef, useState } from "react";
import { animate, motion } from "framer-motion";
import { FINAL_INVOICE, ORIGINAL_QUOTE, OVERAGE } from "./script";

interface InvoiceRevealProps {
  reducedMotion: boolean;
  /** Fired once the number has finished climbing and the forced pause has
   * elapsed — the caller decides when to offer a way to continue. */
  onDone: () => void;
}

/** The Sweep primitive at its medium scale: the same light-band motion that
 * writes each chat message now drags across the invoice, and in its wake it
 * leaves the struck-through original price and the climbing real total. */
export function InvoiceReveal({ reducedMotion, onDone }: InvoiceRevealProps) {
  const [display, setDisplay] = useState(reducedMotion ? FINAL_INVOICE : ORIGINAL_QUOTE);
  const [settled, setSettled] = useState(reducedMotion);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reducedMotion) {
      const t = setTimeout(() => doneRef.current(), 500);
      return () => clearTimeout(t);
    }

    const controls = animate(ORIGINAL_QUOTE, FINAL_INVOICE, {
      duration: 1.3,
      ease: [0.16, 1, 0.3, 1],
      delay: 0.4,
      onUpdate: (v) => setDisplay(Math.round(v)),
      onComplete: () => {
        setSettled(true);
        setTimeout(() => doneRef.current(), 1400);
      },
    });
    return () => controls.stop();
  }, [reducedMotion]);

  return (
    <div className="hero-story__invoice" role="status" aria-live="polite">
      <div className="hero-story__invoice-old">${ORIGINAL_QUOTE.toLocaleString()}</div>
      <div className="hero-story__invoice-new">${display.toLocaleString()}</div>

      {settled && (
        <motion.p
          className="hero-story__invoice-diff"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          This is roughly ${OVERAGE.toLocaleString()} more than you agreed to.
        </motion.p>
      )}

      {!reducedMotion && (
        <motion.span
          className="hero-story__sweep"
          aria-hidden="true"
          initial={{ x: "-140%" }}
          animate={{ x: "140%" }}
          transition={{ duration: 1.3, ease: "easeInOut", delay: 0.4 }}
        />
      )}
    </div>
  );
}
