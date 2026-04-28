import { Shield } from "lucide-react";

const commonViolations = [
  { type: "Unpermitted additions", count: 5, note: "Most common issue in neighborhood" },
  { type: "Water heater strapping", count: 3, note: "Minor safety code updates" },
  { type: "Fence height violations", count: 2, note: "Usually easy fixes" },
  { type: "Electrical panel issues", count: 2, note: "Outdated panels flagged" },
];

const NeighborhoodViolationsSection = () => {
  return (
    <div className="bg-card rounded-lg p-6 shadow-warm animate-fade-in-up">
      <h2 className="font-serif text-xl text-foreground mb-1 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        Violations in Your Neighborhood
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        How does your property compare to nearby homes?
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-background rounded-lg p-3 text-center">
          <p className="text-2xl font-serif text-foreground">427</p>
          <p className="text-xs text-muted-foreground">Properties within 0.5 mi</p>
        </div>
        <div className="bg-background rounded-lg p-3 text-center">
          <p className="text-2xl font-serif text-foreground">12</p>
          <p className="text-xs text-muted-foreground">With active violations</p>
        </div>
        <div className="bg-background rounded-lg p-3 text-center">
          <p className="text-2xl font-serif text-warning">2.8%</p>
          <p className="text-xs text-muted-foreground">Violation rate</p>
        </div>
      </div>

      {/* Common violations */}
      <div className="space-y-2 mb-4">
        {commonViolations.map((v, i) => (
          <div key={v.type} className="flex items-center justify-between bg-background rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-4">{i + 1}.</span>
              <div>
                <p className="text-sm font-medium text-foreground">{v.type}</p>
                <p className="text-xs text-muted-foreground">{v.note}</p>
              </div>
            </div>
            <span className="text-sm font-medium text-foreground">{v.count}</span>
          </div>
        ))}
      </div>

      <div className="bg-background rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Why this matters: </span>
          Unpermitted additions are common in your neighborhood (built in 1970s–80s when rules were lax). City is cracking down now using aerial imagery and GIS data. If you're not alone — other neighbors dealing with same issue — there might be a pattern of contractors who did unpermitted work in the 80s.
        </p>
        <p className="text-sm text-primary mt-2 italic">
          💬 Ask neighbors: "Have you dealt with unpermitted work issues? Who helped you resolve it?"
        </p>
      </div>
    </div>
  );
};

export default NeighborhoodViolationsSection;
