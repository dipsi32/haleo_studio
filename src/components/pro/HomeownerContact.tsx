// The homeowner's number, when they gave one in the contractor's link:
// one tap to call or text them back.
import { MessageSquare, Phone } from "lucide-react";
import { cleanPhone } from "@/lib/phone";
import { track } from "@/lib/analytics";

export default function HomeownerContact({ name, phone, compact = false }: { name?: string | null; phone?: string | null; compact?: boolean }) {
  const shown = cleanPhone(phone);
  if (!shown) return null;
  const digits = `+1${shown.replace(/\D/g, "")}`;
  const first = name?.split(" ")[0];
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-border bg-card ${compact ? "p-3" : "px-4 py-3"}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {first ? `Reach ${first}` : "Their number"}
        </span>
        <span className="block text-sm font-medium tabular-nums">{shown}</span>
      </span>
      <a
        href={`sms:${digits}`}
        onClick={() => track("homeowner_contacted", { via: "text" })}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-accent/50"
      >
        <MessageSquare className="h-3.5 w-3.5" /> Text
      </a>
      <a
        href={`tel:${digits}`}
        onClick={() => track("homeowner_contacted", { via: "call" })}
        className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground"
      >
        <Phone className="h-3.5 w-3.5" /> Call
      </a>
    </div>
  );
}
