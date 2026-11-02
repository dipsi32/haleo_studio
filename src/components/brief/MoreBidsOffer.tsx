// Shown only AFTER a homeowner has sent their brief to the contractor who
// invited them. Never inside the contractor's flow before that: a contractor's
// link has to stay their lead, or they stop sending it.
//
// Matched bids aren't built yet. This measures real demand first: "Get early
// access" records interest (waitlist + event), and charges nothing.
import { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

type Props = {
  contractorName: string;
  email: string | null;
  projectNoun: string;
  city: string | null;
};

const MoreBidsOffer = ({ contractorName, email, projectNoun, city }: Props) => {
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    setBusy(true);
    track("matched_bids_interest", { source: "invite_sent", has_email: !!email });
    if (email) {
      // Already on the list is fine: the interest still counts.
      await supabase.from("waitlist").insert({
        email,
        project_type: "matched_bids",
        message: `Wants matched bids. Project: ${projectNoun}${city ? `, ${city}` : ""}. Sent their brief to ${contractorName} first.`,
      });
    }
    setBusy(false);
    setJoined(true);
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-5">
      <p className="font-display text-lg">Your brief is yours to keep</p>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
        {contractorName} has it now. Most people collect two or three bids before deciding, and the brief you just
        wrote is what makes them comparable: every bid answers the same scope.
      </p>
      <div className="mt-4 rounded-xl border border-accent/25 bg-accent/5 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-accent" /> Matched bids
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
            Coming soon
          </span>
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          We pick contractors whose city permit records show {projectNoun} work{city ? ` in ${city}` : ""} and whose
          state license is active and clean, and send them this same brief. You compare the bids side by side. A
          one-time fee, shown before you pay anything.
        </p>
        {joined ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-sage">
            <Check className="h-4 w-4" /> You're on the early list. We'll email you before it opens.
          </p>
        ) : (
          <Button variant="outline" className="mt-3 rounded-full" disabled={busy} onClick={join}>
            {busy ? "One moment…" : "Get early access"}
          </Button>
        )}
      </div>
    </div>
  );
};

export default MoreBidsOffer;
