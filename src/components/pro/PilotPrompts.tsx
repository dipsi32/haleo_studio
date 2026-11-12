// Two light check-ins at the top of the contractor's inbox, each one tap or
// two numbers, never both at once:
//   - Weekly: how many new inquiries came in, any way, and how many got your
//     link. It's how we know what Haleo didn't see.
//   - After a few calls with Haleo: would you pay to keep it?
// Both dismiss for the session, and come back next week if skipped.
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { PILOT_PRICE_MONTHLY, WOULD_PAY_AFTER_DECISIONS, weekStart } from "@/lib/pilotScorecard";

const DISMISS_KEY = "haleo:pilot_prompt_dismissed";

const dismissedThisSession = (kind: string) => {
  try {
    return sessionStorage.getItem(`${DISMISS_KEY}:${kind}`) === "1";
  } catch {
    return false;
  }
};
const dismiss = (kind: string) => {
  try {
    sessionStorage.setItem(`${DISMISS_KEY}:${kind}`, "1");
  } catch {
    /* fine */
  }
};

type Show = "none" | "weekly" | "pay";

export default function PilotPrompts({ contractorId }: { contractorId: string | null }) {
  const [show, setShow] = useState<Show>("none");
  const [inquiries, setInquiries] = useState("");
  const [sent, setSent] = useState("");
  const [thanks, setThanks] = useState<string | null>(null);
  const week = weekStart();

  useEffect(() => {
    if (!contractorId) return;
    let cancelled = false;
    (async () => {
      const [{ data: fb }, { count: decided }] = await Promise.all([
        supabase.from("contractor_feedback").select("kind, week_start").eq("contractor_id", contractorId),
        supabase.from("brief_outcomes").select("outreach_send_id", { count: "exact", head: true }).eq("contractor_id", contractorId).not("decision", "is", null),
      ]);
      if (cancelled) return;
      const rows = (fb ?? []) as { kind: string; week_start: string | null }[];
      const hasWeek = rows.some((r) => r.kind === "weekly_inquiries" && r.week_start === week);
      const hasPay = rows.some((r) => r.kind === "would_pay");
      if (!hasWeek && !dismissedThisSession("weekly")) setShow("weekly");
      else if (!hasPay && (decided ?? 0) >= WOULD_PAY_AFTER_DECISIONS && !dismissedThisSession("pay")) setShow("pay");
    })();
    return () => {
      cancelled = true;
    };
  }, [contractorId, week]);

  if (!contractorId) return null;
  if (thanks) return <p className="mb-6 rounded-2xl border border-sage/30 bg-sage/5 px-4 py-3 text-sm text-foreground/80">{thanks}</p>;
  if (show === "none") return null;

  const close = (kind: "weekly" | "pay") => {
    dismiss(kind);
    track("pilot_prompt_dismissed", { kind });
    setShow("none");
  };

  if (show === "weekly") {
    const n = Number(inquiries);
    const s = Number(sent);
    const valid = inquiries !== "" && Number.isInteger(n) && n >= 0 && n < 1000 && (sent === "" || (Number.isInteger(s) && s >= 0 && s <= n));
    return (
      <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium">Quick one for this week</p>
          <button type="button" onClick={() => close("weekly")} aria-label="Not now" className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            New inquiries this week, any way they came in
            <Input value={inquiries} onChange={(e) => setInquiries(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="e.g. 4" className="mt-1.5 h-10 rounded-xl" />
          </label>
          <label className="text-sm">
            How many got your Haleo link
            <Input value={sent} onChange={(e) => setSent(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="e.g. 3" className="mt-1.5 h-10 rounded-xl" />
          </label>
        </div>
        <Button
          size="sm"
          className="mt-3 rounded-full"
          disabled={!valid}
          onClick={async () => {
            await supabase.from("contractor_feedback").upsert(
              { contractor_id: contractorId, kind: "weekly_inquiries", week_start: week, value: { inquiries: n, sent_link: sent === "" ? 0 : s } },
              { onConflict: "contractor_id,kind,week_start" },
            );
            track("weekly_inquiries_reported", { inquiries: n, sent_link: sent === "" ? 0 : s });
            setThanks("Thanks. That helps us see what Haleo is and isn't catching.");
          }}
        >
          Save
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Once a week. It shows us which leads never reached Haleo.</p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">If Haleo cost ${PILOT_PRICE_MONTHLY} a month, would you keep using it?</p>
        <button type="button" onClick={() => close("pay")} aria-label="Not now" className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-secondary">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(["yes", "maybe", "no"] as const).map((a) => (
          <Button
            key={a}
            size="sm"
            variant="outline"
            className="rounded-full capitalize"
            onClick={async () => {
              await supabase.from("contractor_feedback").insert({ contractor_id: contractorId, kind: "would_pay", value: { answer: a, price: PILOT_PRICE_MONTHLY } });
              track("would_pay_answered", { answer: a, price: PILOT_PRICE_MONTHLY });
              setThanks(a === "no" ? "Thanks for being straight with us. Deepa may ask what would make it worth it." : "Thanks. That tells us a lot.");
            }}
          >
            {a}
          </Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Honest answer, nothing changes today. It's free while we're small.</p>
    </section>
  );
}
