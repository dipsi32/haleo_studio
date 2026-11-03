// One fact from the contractor's public record, shown right under the field
// that unlocked it. Eases in when it appears or changes.
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Highlight } from "@/lib/recordHighlights";
import { track } from "@/lib/analytics";

export default function RecordTidbit({ h, className = "" }: { h?: Highlight; className?: string }) {
  useEffect(() => {
    if (h && h.id !== "track") track("record_highlight_shown", { kind: h.id });
  }, [h?.id, h?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence initial={false} mode="wait">
      {h && (
        <motion.p
          key={h.text}
          role="status"
          data-record={h.id}
          initial={{ opacity: 0, y: 4, backgroundColor: "hsl(var(--sage) / 0.16)" }}
          animate={{ opacity: 1, y: 0, backgroundColor: "hsl(var(--sage) / 0.06)" }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.45, backgroundColor: { duration: 2 } }}
          className={`flex items-start gap-2 rounded-xl border border-sage/20 px-3 py-2 text-left text-[13.5px] leading-snug text-foreground/85 ${className}`}
        >
          <Check className="mt-[3px] h-3.5 w-3.5 shrink-0 text-sage" />
          <span>
            {h.text}{" "}
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">· Public record</span>
          </span>
        </motion.p>
      )}
    </AnimatePresence>
  );
}
