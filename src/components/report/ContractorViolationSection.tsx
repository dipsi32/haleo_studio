import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Shield } from "lucide-react";

interface ViolationRecord {
  id: number;
  date: string;
  project: string;
  type: string;
  description: string;
  resolution: string;
  severity: "green" | "yellow" | "orange";
  take: string;
}

const violations: ViolationRecord[] = [
  {
    id: 1,
    date: "March 2023",
    project: "123 Elm St, Sunnyvale",
    type: "Stop-Work Order",
    description:
      "Work commenced without approved permit. All work must cease immediately until permit obtained.",
    resolution: "Permit obtained after 2 weeks. Work resumed. Fined $1,500.",
    severity: "yellow",
    take: "Martinez started work before the permit was approved (permit was submitted but not yet approved). This is a process violation — eager to start but didn't wait for city approval. Not a safety issue, but shows they might cut procedural corners to stay on schedule.",
  },
  {
    id: 2,
    date: "July 2023",
    project: "789 Oak Ave, Sunnyvale",
    type: "Correction Notice",
    description:
      "Framing not per approved plans. Load-bearing header undersized. Must be replaced with properly sized beam per structural calculations.",
    resolution: "Beam replaced, re-inspected, passed. Cost: $2,400 (Martinez absorbed).",
    severity: "orange",
    take: "This is more concerning. Martinez installed a structural beam that was too small for the load. Caught by inspector, required fix. Could be an honest mistake, or trying to save money. This is a quality/safety issue worth asking about.",
  },
  {
    id: 3,
    date: "November 2024",
    project: "456 Maple Dr, Sunnyvale",
    type: "Correction Notice",
    description:
      "Electrical rough-in failed inspection. GFCI outlets required but not installed on all countertop circuits per NEC 210.8.",
    resolution: "GFCI outlets installed, passed re-inspection.",
    severity: "green",
    take: "This is a minor code detail. Current code requires GFCI protection on all kitchen countertop outlets. Martinez's electrician missed a couple. Very common and not a serious issue — corrected quickly.",
  },
];

const severityColor = {
  green: { bg: "bg-success-bg", border: "border-success/20", icon: "text-success", label: "Minor" },
  yellow: { bg: "bg-warning-bg", border: "border-warning/20", icon: "text-warning", label: "Procedural" },
  orange: { bg: "bg-danger-bg", border: "border-danger/20", icon: "text-danger", label: "Quality/Safety" },
};

const ContractorViolationSection = () => {
  const [expanded, setExpanded] = useState<number | null>(null);

  const violationRate = 6.4;
  const industryAvg = "8–12%";

  return (
    <div className="bg-card rounded-lg p-6 shadow-warm animate-fade-in-up">
      <h2 className="font-serif text-xl text-foreground mb-1 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        Martinez's Violation History
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        I checked if Martinez has any code violations or stop-work orders associated with their projects:
      </p>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-background rounded-lg p-3 text-center">
          <p className="text-2xl font-serif text-foreground">47</p>
          <p className="text-xs text-muted-foreground">Projects checked</p>
        </div>
        <div className="bg-background rounded-lg p-3 text-center">
          <p className="text-2xl font-serif text-foreground">3</p>
          <p className="text-xs text-muted-foreground">With violations</p>
        </div>
        <div className="bg-background rounded-lg p-3 text-center col-span-2 sm:col-span-1">
          <p className="text-2xl font-serif text-foreground">{violationRate}%</p>
          <p className="text-xs text-muted-foreground">vs {industryAvg} industry avg</p>
        </div>
      </div>

      {/* Severity breakdown */}
      <div className="flex flex-wrap gap-2 mb-5">
        <span className="text-xs px-2 py-1 rounded-full bg-danger-bg text-danger border border-danger/20">
          1 quality/safety
        </span>
        <span className="text-xs px-2 py-1 rounded-full bg-warning-bg text-warning border border-warning/20">
          1 procedural
        </span>
        <span className="text-xs px-2 py-1 rounded-full bg-success-bg text-success border border-success/20">
          1 minor
        </span>
      </div>

      {/* Violations list */}
      <div className="space-y-3">
        {violations.map((v) => {
          const colors = severityColor[v.severity];
          const isExpanded = expanded === v.id;
          return (
            <div key={v.id} className={`${colors.bg} border ${colors.border} rounded-lg overflow-hidden`}>
              <button
                onClick={() => setExpanded(isExpanded ? null : v.id)}
                className="w-full text-left p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    {v.severity === "green" ? (
                      <CheckCircle2 className={`h-4 w-4 ${colors.icon} shrink-0`} />
                    ) : (
                      <AlertTriangle className={`h-4 w-4 ${colors.icon} shrink-0`} />
                    )}
                    <h3 className="font-medium text-foreground text-sm">{v.type}</h3>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.icon} border ${colors.border}`}>
                      {colors.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{v.date} · {v.project}</p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Issue:</p>
                    <p className="text-sm text-muted-foreground">"{v.description}"</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Resolution:</p>
                    <p className="text-sm text-muted-foreground">{v.resolution}</p>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-border">
                    <p className="text-sm font-medium text-foreground mb-1">🔍 My take:</p>
                    <p className="text-sm text-muted-foreground">{v.take}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall verdict */}
      <div className="bg-warning-bg border border-warning/20 rounded-lg p-4 mt-5">
        <p className="text-sm font-medium text-foreground mb-2">⚠️ My Overall Take on Martinez's Record</p>
        <p className="text-sm text-muted-foreground mb-3">
          The undersized beam in 2023 concerns me — that's a quality/safety issue. The other two are minor.
          At {violationRate}% violation rate (vs {industryAvg} industry average), Martinez is slightly better than average, but the structural issue warrants a conversation.
        </p>
        <p className="text-sm font-medium text-foreground mb-1">I'd ask Martinez:</p>
        <ol className="space-y-1 text-sm text-primary italic">
          <li>1. "What happened with that undersized beam in 2023?"</li>
          <li>2. "What have you changed since then?"</li>
          <li>3. "Who does your structural work now?"</li>
        </ol>
      </div>
    </div>
  );
};

export default ContractorViolationSection;
