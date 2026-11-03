// Shown only AFTER a homeowner has sent their brief to the contractor who
// invited them, never before: a contractor's link has to stay their lead, or
// they stop sending it. A quiet note, no link: the homeowner should leave
// this page with their contractor, not a detour.
import { ShieldCheck } from "lucide-react";

type Props = {
  contractorName: string;
  projectNoun: string;
  city: string | null;
};

const MoreBidsOffer = ({ contractorName, projectNoun, city }: Props) => (
  <div className="rounded-2xl border border-border bg-card/70 p-5">
    <p className="font-display text-lg">Your brief is yours to keep</p>
    <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
      {contractorName} has it now. Most people collect two or three bids before deciding, and the brief you just wrote
      is what makes them comparable: every bid answers the same scope.
    </p>
    <p className="mt-3 flex max-w-xl items-start gap-2 text-sm leading-relaxed text-muted-foreground">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <span>
        If you ever want more bids, Haleo can send this same brief to contractors whose city permit records show{" "}
        {projectNoun} work{city ? ` in ${city}` : ""} and whose state license is active and clean, for a one-time fee.
      </span>
    </p>
  </div>
);

export default MoreBidsOffer;
