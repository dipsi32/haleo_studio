import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface LockedSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  isLocked: boolean;
}

const LockedSection = ({ title, count, children, isLocked }: LockedSectionProps) => {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px] opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl px-6 py-4 shadow-warm text-center max-w-xs">
          <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">
            {title}{count ? ` (${count})` : ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Included in your full report
          </p>
        </div>
      </div>
    </div>
  );
};

export default LockedSection;
