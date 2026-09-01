import { motion } from "framer-motion";
import type { ScriptMessage } from "./script";

interface ChatBubbleProps {
  message: ScriptMessage;
  reducedMotion: boolean;
}

/** One message bubble. The Sweep primitive at its smallest scale: a soft
 * light band drags across the bubble as it arrives, like a highlighter
 * writing the message into being — the same idea reused at every scale
 * in this experience (see InvoiceReveal and ResolutionScreen). */
export function ChatBubble({ message, reducedMotion }: ChatBubbleProps) {
  return (
    <li className={`hero-story__row hero-story__row--${message.sender}`}>
      <motion.div
        className={`hero-story__bubble hero-story__bubble--${message.sender}`}
        initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 460, damping: 24, mass: 0.6 }
        }
      >
        {message.text}
        {!reducedMotion && (
          <motion.span
            className="hero-story__sweep"
            aria-hidden="true"
            initial={{ x: "-120%" }}
            animate={{ x: "120%" }}
            transition={{ duration: 0.5, ease: "easeInOut", delay: 0.05 }}
          />
        )}
      </motion.div>
    </li>
  );
}
