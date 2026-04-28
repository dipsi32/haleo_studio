import { Info } from "lucide-react";

const categories = [
  { name: "Payment Risk", weight: "20%", score: 55, explanation: "The upfront payment is higher than we'd typically recommend. Worth discussing." },
  { name: "Legal Risk", weight: "20%", score: 72, explanation: "Arbitration clause is standard. No unusual liability exclusions." },
  { name: "Change Order Risk", weight: "15%", score: 40, explanation: "No defined change order process — this is the biggest gap to address." },
  { name: "Scope Clarity", weight: "15%", score: 78, explanation: "Scope is fairly detailed. A few allowances could use more specifics." },
  { name: "Timeline Realism", weight: "15%", score: 35, explanation: "No end date specified. This is a significant concern for accountability." },
  { name: "Public Record Intelligence", weight: "15%", score: 82, explanation: "Contractor is licensed, insured, and has a solid permit history." },
];

const overallScore = Math.round(
  categories.reduce((sum, c) => {
    const w = parseInt(c.weight) / 100;
    return sum + c.score * w;
  }, 0)
);

const getScoreColor = (score: number) => {
  if (score >= 70) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-danger";
};

const getBarColor = (score: number) => {
  if (score >= 70) return "bg-success";
  if (score >= 50) return "bg-warning";
  return "bg-danger";
};

const getOverallLabel = (score: number) => {
  if (score >= 75) return "Low Risk";
  if (score >= 55) return "Medium Risk";
  return "High Risk";
};

const RiskScoreSection = () => {
  return (
    <div className="bg-card rounded-lg p-6 shadow-warm animate-fade-in-up">
      <h2 className="font-serif text-xl text-foreground mb-1 flex items-center gap-2">
        Contractor Risk Score
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        Based on 6 weighted categories — here's how this proposal stacks up.
      </p>

      {/* Overall score */}
      <div className="flex items-center gap-6 mb-8 p-4 bg-background rounded-lg border border-border">
        <div className="text-center">
          <div className={`text-5xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</div>
          <div className="text-xs text-muted-foreground mt-1">out of 100</div>
        </div>
        <div className="flex-1">
          <p className={`font-medium ${getScoreColor(overallScore)}`}>{getOverallLabel(overallScore)}</p>
          <p className="text-sm text-muted-foreground">
            {overallScore >= 55
              ? "Some things to address, but nothing that can't be fixed with a conversation."
              : "We'd recommend addressing these concerns before moving forward."}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.name}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">{cat.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">({cat.weight})</span>
                <span className={`text-sm font-bold ${getScoreColor(cat.score)}`}>{cat.score}</span>
              </div>
            </div>
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(cat.score)}`}
                style={{ width: `${cat.score}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              {cat.explanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RiskScoreSection;
