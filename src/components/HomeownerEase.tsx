// One tap after a homeowner sends their brief: how easy was that? If it was
// hard, one optional line on what got in the way. It's how we know whether
// the brief helps homeowners too, not just contractors.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

type Ease = "easy" | "okay" | "hard";

const OPTIONS: { value: Ease; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "okay", label: "Okay" },
  { value: "hard", label: "Hard" },
];

export default function HomeownerEase({ sendId, contractorId }: { sendId: string | null; contractorId: string | null }) {
  const [picked, setPicked] = useState<Ease | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(false);

  const pick = async (ease: Ease) => {
    setPicked(ease);
    track("homeowner_ease_rated", { ease, contractor_id: contractorId });
    const { data } = await supabase
      .from("homeowner_feedback")
      .insert({ outreach_send_id: sendId, contractor_id: contractorId, ease })
      .select("id")
      .maybeSingle();
    setRowId(data?.id ?? null);
    if (ease === "easy") setDone(true);
  };

  if (done) return <p className="mt-6 text-sm text-muted-foreground">Thanks for telling us.</p>;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card/70 p-4">
      <p className="text-sm font-medium">How easy was that?</p>
      <div className="mt-2 flex gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={picked === o.value}
            onClick={() => void pick(o.value)}
            disabled={!!picked}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors disabled:cursor-default",
              picked === o.value ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {picked && picked !== "easy" && (
        <div className="mt-3 flex gap-2">
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="What got in the way? Optional"
            className="h-10 rounded-xl"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-10 rounded-full"
            onClick={async () => {
              if (comment.trim() && rowId) {
                await supabase.from("homeowner_feedback").update({ comment: comment.trim() }).eq("id", rowId);
                track("homeowner_ease_rated", { ease: picked, has_comment: true });
              }
              setDone(true);
            }}
          >
            {comment.trim() ? "Send" : "Skip"}
          </Button>
        </div>
      )}
    </div>
  );
}
