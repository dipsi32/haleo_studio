import { motion } from "framer-motion";

/** The three-dot "…" bubble. Reused as both the pre-click lure and the
 * in-thread indicator that precedes each incoming message. */
export function TypingIndicator() {
  return (
    <div className="hero-story__typing" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="hero-story__dot"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}
