import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeCardProps {
  redFlagCount: number;
  onUpgrade?: () => void;
}

const UpgradeCard = ({ redFlagCount, onUpgrade }: UpgradeCardProps) => {
  return (
    <div className="bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] border-2 border-primary/20 rounded-2xl p-6 my-6 text-center">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Shield className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-serif text-lg text-foreground mb-2">
        You've uncovered {redFlagCount} issue{redFlagCount !== 1 ? "s" : ""} worth discussing with your contractor.
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5 leading-relaxed">
        Your full report includes the exact contract language to reference, what to ask, and a step-by-step action plan.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={onUpgrade} className="gap-2">
          Unlock Full Report — $29
        </Button>
        <Button variant="outline" onClick={onUpgrade} className="text-xs">
          Full Journey Access — $299
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-4">
        One-time payment · No subscription required · Instant access
      </p>
    </div>
  );
};

export default UpgradeCard;
