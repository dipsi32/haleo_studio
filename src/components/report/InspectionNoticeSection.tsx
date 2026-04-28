import { useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp, Copy, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

type NoticeStatus = "clean" | "minor" | "serious";

interface MinorNotice {
  number: string;
  issued: string;
  type: string;
  status: string;
  description: string;
  requiredAction: string;
  deadline: string;
  costMin: number;
  costMax: number;
  timeToFix: string;
  howToFix: string[];
  questionToAsk: string;
}

interface SeriousNotice {
  number: string;
  issued: string;
  type: string;
  status: string;
  description: string;
  complianceDeadline: string;
  penalties: string[];
  whatItMeans: string;
  costMin: number;
  costMax: number;
  costBreakdown: { item: string; range: string }[];
  timeline: string;
  whatToDo: string[];
  questionToAsk: string;
}

// Mock data — Scenario B (Minor) for demo
const minorNotices: MinorNotice[] = [
  {
    number: "2023-4567",
    issued: "August 15, 2023",
    type: "Correction Notice",
    status: "OPEN",
    description:
      "Water heater in garage not properly strapped per seismic code. Two straps required — only one currently installed.",
    requiredAction: "Install second water heater strap per UPC 508.2",
    deadline: "None specified (non-urgent safety item)",
    costMin: 50,
    costMax: 150,
    timeToFix: "30 minutes",
    howToFix: [
      "Buy earthquake strap kit from Home Depot ($25)",
      "Install second strap on water heater",
      "Call city to schedule inspection ($0)",
      "Inspector verifies and closes notice",
    ],
    questionToAsk:
      "There's an open inspection notice about the water heater strapping. Can you include fixing that in your scope, and how much would you charge?",
  },
];

// Scenario C (Serious) data
const seriousNotices: SeriousNotice[] = [
  {
    number: "2024-8901",
    issued: "January 8, 2025",
    type: "NOTICE OF VIOLATION",
    status: "ACTIVE",
    description:
      "Unpermitted bathroom addition identified during routine inspection. Structure added without building permit.",
    complianceDeadline: "March 8, 2025",
    penalties: [
      "$500 citation",
      "Daily fines of $100 after deadline",
      "Lien on property possible",
      "Cannot pull new permits until resolved",
    ],
    whatItMeans:
      "Someone built a bathroom without permits. The city found out and issued a violation. You must resolve this even though you didn't do the work — it's tied to the property, not the person.",
    costMin: 5000,
    costMax: 11500,
    costBreakdown: [
      { item: "After-the-fact permit", range: "$2,500–4,000" },
      { item: "Required corrections", range: "$1,000–5,000+" },
      { item: "Structural engineer report", range: "$1,500–2,500" },
    ],
    timeline: "6–10 weeks",
    whatToDo: [
      "Call the city building department — reference Notice #2024-8901",
      "Hire a contractor who does after-the-fact permits",
      "Get this resolved BEFORE starting kitchen",
      "Adjust your timeline accordingly",
    ],
    questionToAsk:
      "I just found out there's an unpermitted bathroom addition on the property with an active violation notice. Can you help me get this permitted after the fact? And how does this affect our timeline?",
  },
];

// For demo, show Scenario B (minor). Toggle to show different scenarios.
const InspectionNoticeSection = () => {
  const [scenario] = useState<NoticeStatus>("minor");
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);
  const [copiedQ, setCopiedQ] = useState<string | null>(null);

  const copyQuestion = (q: string, id: string) => {
    navigator.clipboard.writeText(q);
    setCopiedQ(id);
    setTimeout(() => setCopiedQ(null), 2000);
  };

  if (scenario === "clean") {
    return (
      <div className="bg-success-bg border border-success/20 rounded-lg p-6 animate-fade-in-up">
        <h2 className="font-serif text-xl text-foreground mb-1 flex items-center gap-2">
          <Shield className="h-5 w-5 text-success" />
          Inspection Notice Check
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          I checked for any code violations, stop-work orders, or inspection notices at your address:
        </p>
        <div className="bg-card rounded-lg p-5">
          <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Great News: No Issues Found
          </h3>
          <p className="text-sm text-foreground mb-3">Your property (456 Oak St) has a clean record:</p>
          <ul className="space-y-2 mb-4">
            {[
              "No outstanding code violations",
              "No stop-work orders (current or past 5 years)",
              "No unpermitted work citations",
              "No open correction notices",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            This means previous work was properly permitted, no hidden issues that could delay your project, and a smooth path for your remodel permits. You're starting from a solid foundation.
          </p>
        </div>
      </div>
    );
  }

  if (scenario === "minor") {
    return (
      <div className="bg-warning-bg border border-warning/20 rounded-lg p-6 animate-fade-in-up">
        <h2 className="font-serif text-xl text-foreground mb-1 flex items-center gap-2">
          <Shield className="h-5 w-5 text-warning" />
          Inspection Notice Check
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          I checked for code violations, stop-work orders, and inspection notices at your address:
        </p>

        {minorNotices.map((notice) => {
          const isExpanded = expandedNotice === notice.number;
          return (
            <div key={notice.number} className="bg-card rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedNotice(isExpanded ? null : notice.number)}
                className="w-full text-left p-5 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                    <h3 className="font-medium text-foreground text-sm">
                      Minor Issue Found — Easy to Address
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notice #{notice.number} · {notice.type} · ⚠ {notice.status}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Issue:</p>
                    <p className="text-sm text-muted-foreground">"{notice.description}"</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Required Action:</p>
                    <p className="text-sm text-muted-foreground">{notice.requiredAction}</p>
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <p className="text-sm font-medium text-foreground">Estimated Cost</p>
                      <p className="text-sm text-muted-foreground">${notice.costMin}–${notice.costMax}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Time to Fix</p>
                      <p className="text-sm text-muted-foreground">{notice.timeToFix}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">How to handle it:</p>
                    <ol className="space-y-1.5">
                      {notice.howToFix.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-muted-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="bg-background rounded-lg p-3 border border-border">
                    <p className="text-sm font-medium text-foreground mb-1">💬 What I'd ask your contractor:</p>
                    <p className="text-sm text-primary italic mb-2">"{notice.questionToAsk}"</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => copyQuestion(notice.questionToAsk, notice.number)}
                    >
                      <Copy className="h-3 w-3" />
                      {copiedQ === notice.number ? "Copied!" : "Copy Question"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground mt-4">
          This is a minor safety issue that needs fixing before any new permits can be finaled. Good news: it's easy and cheap.
        </p>
      </div>
    );
  }

  // Scenario C: Serious
  return (
    <div className="bg-danger-bg border border-danger/20 rounded-lg p-6 animate-fade-in-up">
      <h2 className="font-serif text-xl text-foreground mb-1 flex items-center gap-2">
        <Shield className="h-5 w-5 text-danger" />
        Inspection Notice Check
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        I found {seriousNotices.length} inspection notice(s) that need your attention BEFORE starting any remodel:
      </p>

      <div className="space-y-4">
        {seriousNotices.map((notice) => {
          const isExpanded = expandedNotice === notice.number;
          return (
            <div key={notice.number} className="bg-card rounded-lg border border-danger/20 overflow-hidden">
              <button
                onClick={() => setExpandedNotice(isExpanded ? null : notice.number)}
                className="w-full text-left p-5 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4 text-danger shrink-0" />
                    <h3 className="font-medium text-foreground text-sm">
                      🚨 {notice.type}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notice #{notice.number} · 🔴 {notice.status} · Deadline: {notice.complianceDeadline}
                  </p>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                  <p className="text-sm text-muted-foreground">"{notice.description}"</p>
                  <p className="text-sm text-foreground">{notice.whatItMeans}</p>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Estimated cost to resolve:</p>
                    <div className="space-y-1">
                      {notice.costBreakdown.map((item) => (
                        <div key={item.item} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.item}</span>
                          <span className="text-foreground font-medium">{item.range}</span>
                        </div>
                      ))}
                      <div className="border-t border-border pt-1 mt-1 flex justify-between text-sm">
                        <span className="font-medium text-foreground">Total</span>
                        <span className="font-medium text-danger">${notice.costMin.toLocaleString()}–${notice.costMax.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Penalties if not resolved:</p>
                    <ul className="space-y-1">
                      {notice.penalties.map((p) => (
                        <li key={p} className="flex items-start gap-2 text-sm">
                          <XCircle className="h-3.5 w-3.5 text-danger shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">What to do RIGHT NOW:</p>
                    <ol className="space-y-1.5">
                      {notice.whatToDo.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="w-5 h-5 rounded-full bg-danger/10 text-danger flex items-center justify-center text-xs font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-muted-foreground">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="bg-background rounded-lg p-3 border border-border">
                    <p className="text-sm font-medium text-foreground mb-1">💬 What I'd ask:</p>
                    <p className="text-sm text-primary italic mb-2">"{notice.questionToAsk}"</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => copyQuestion(notice.questionToAsk, notice.number)}
                    >
                      <Copy className="h-3 w-3" />
                      {copiedQ === notice.number ? "Copied!" : "Copy Question"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-4">
        This information is from public records and is provided for informational purposes only. Costs are estimates. Consult with a licensed contractor and/or attorney for specific advice.
      </p>
    </div>
  );
};

export default InspectionNoticeSection;
