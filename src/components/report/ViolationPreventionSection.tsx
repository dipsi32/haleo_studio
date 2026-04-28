import { useState } from "react";
import { Shield, Download, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CheckItem {
  text: string;
  note: string;
}

const beforeWork: CheckItem[] = [
  { text: "Verify permit is APPROVED (not just submitted)", note: "Don't let contractor start with 'pending permit'" },
  { text: "Post permit visibly on job site", note: "Required by law — inspectors look for this" },
  { text: "Verify contractor's license is active", note: "Check state board: cslb.ca.gov" },
  { text: "Get copy of approved plans", note: "Keep on-site for inspectors to reference" },
];

const duringWork: CheckItem[] = [
  { text: "Don't let contractor skip inspections", note: "Some try to avoid rough-in inspections — don't allow it" },
  { text: "Schedule inspections BEFORE covering work", note: "Once drywall goes up, inspector can't see what's behind it" },
  { text: "Keep inspection card posted and updated", note: "Inspector stamps card at each visit" },
  { text: "Don't make changes without updating permit", note: "'Small changes' add up to big violations" },
];

const atEnd: CheckItem[] = [
  { text: "Get final inspection before final payment", note: "Once paid, contractor has less incentive" },
  { text: "Verify permit is finaled/closed", note: "Check online or call building dept" },
  { text: "Keep permit documents forever", note: "Future owners/buyers will want these" },
];

const ViolationPreventionSection = () => {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (text: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(text)) next.delete(text);
      else next.add(text);
      return next;
    });
  };

  const renderGroup = (title: string, items: CheckItem[]) => (
    <div className="mb-5">
      <h3 className="font-medium text-foreground text-sm mb-3 uppercase tracking-wide">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.text}
            onClick={() => toggle(item.text)}
            className="w-full text-left flex items-start gap-3 bg-background rounded-lg px-4 py-3 border border-border hover:border-primary/30 transition-colors"
          >
            <div
              className={`w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                checked.has(item.text)
                  ? "bg-success border-success"
                  : "border-border"
              }`}
            >
              {checked.has(item.text) && <CheckCircle2 className="h-3.5 w-3.5 text-success-foreground" />}
            </div>
            <div>
              <p className={`text-sm font-medium ${checked.has(item.text) ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {item.text}
              </p>
              <p className="text-xs text-muted-foreground">{item.note}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const total = beforeWork.length + duringWork.length + atEnd.length;
  const completed = checked.size;

  return (
    <div className="bg-card rounded-lg p-6 shadow-warm animate-fade-in-up">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="font-serif text-xl text-foreground mb-1 flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" />
            How to Avoid Violations on Your Project
          </h2>
          <p className="text-sm text-muted-foreground">
            Based on common violations in your area, here's how to stay compliant:
          </p>
        </div>
        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium shrink-0">
          {completed}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 rounded-full bg-secondary mb-6 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      {renderGroup("Before Work Starts", beforeWork)}
      {renderGroup("During Construction", duringWork)}
      {renderGroup("At Project End", atEnd)}

      <Button variant="outline" className="gap-2 mt-2">
        <Download className="h-4 w-4" />
        Download Printable Checklist
      </Button>
    </div>
  );
};

export default ViolationPreventionSection;
