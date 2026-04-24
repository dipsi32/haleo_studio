// Address step — frames the ask around what the user gets back: real permit
// data and neighborhood intel. The skip path is honored and remembered.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ShieldCheck, Sparkles, Lock, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { Address } from "@/lib/intake";

type Props = {
  value?: Address;
  onSave: (a: Address) => void;
  onSkip: () => void;
  onContinue: () => void;
};

const PERKS = [
  {
    icon: ShieldCheck,
    title: "Real permit history",
    body: "We pull the actual filings on your block — so the brief reflects what the city has approved nearby.",
  },
  {
    icon: Sparkles,
    title: "Neighborhood cost intel",
    body: "Bids get checked against what comparable projects in your zip code have cost, not a national average.",
  },
  {
    icon: Lock,
    title: "Yours alone",
    body: "Your street address is private. Contractors only see the city in the brief.",
  },
];

const AddressStep = ({ value, onSave, onSkip, onContinue }: Props) => {
  const [draft, setDraft] = useState<Address>({
    street: value?.street ?? "",
    city: value?.city ?? "",
    state: value?.state ?? "",
    zip: value?.zip ?? "",
  });
  const [editing, setEditing] = useState(!value?.city || value?.skipped);

  const isComplete = draft.street && draft.city && draft.zip;

  const save = () => {
    onSave({ ...draft, skipped: false });
    setEditing(false);
  };

  return (
    <div className="space-y-8">
      <div className="grid items-stretch gap-4 md:grid-cols-[1.2fr_1fr]">
        {/* Left — the why */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            Why we ask
          </p>
          <p className="mt-3 font-display text-2xl font-light leading-tight">
            Your address helps us find what's actually happening near you.
          </p>
          <ul className="mt-5 space-y-4">
            {PERKS.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.title} className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-sm font-medium">{p.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right — the form (or saved card) */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
          <AnimatePresence mode="wait">
            {!editing && value?.city && !value.skipped ? (
              <motion.div
                key="saved"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Project address
                </p>
                <div className="mt-3 flex items-start gap-3 rounded-2xl bg-secondary/60 p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-base font-medium leading-tight">
                      {value.street}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {value.city}
                      {value.state ? `, ${value.state}` : ""}
                      {value.zip ? ` ${value.zip}` : ""}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setEditing(true)}
                  className="mt-3 text-xs font-medium text-accent underline-offset-4 hover:underline"
                >
                  Edit address
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Project address
                </p>
                <div className="space-y-2">
                  <Label htmlFor="street" className="text-xs">Street</Label>
                  <Input
                    id="street"
                    autoComplete="address-line1"
                    placeholder="1 Main St"
                    value={draft.street ?? ""}
                    onChange={(e) => setDraft({ ...draft, street: e.target.value })}
                    className="rounded-xl bg-background"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-xs">City</Label>
                    <Input
                      id="city"
                      autoComplete="address-level2"
                      placeholder="San Jose"
                      value={draft.city ?? ""}
                      onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                      className="rounded-xl bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-xs">State</Label>
                    <Input
                      id="state"
                      autoComplete="address-level1"
                      placeholder="CA"
                      maxLength={2}
                      value={draft.state ?? ""}
                      onChange={(e) => setDraft({ ...draft, state: e.target.value.toUpperCase() })}
                      className="rounded-xl bg-background uppercase"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zip" className="text-xs">Zip</Label>
                  <Input
                    id="zip"
                    autoComplete="postal-code"
                    placeholder="95110"
                    inputMode="numeric"
                    maxLength={10}
                    value={draft.zip ?? ""}
                    onChange={(e) => setDraft({ ...draft, zip: e.target.value })}
                    className="rounded-xl bg-background"
                  />
                </div>
                <Button
                  onClick={save}
                  disabled={!isComplete}
                  className="mt-2 w-full rounded-full"
                >
                  Save address
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button
          onClick={onContinue}
          size="lg"
          className="rounded-full px-8"
          disabled={!value?.city && !value?.skipped}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          onClick={() => {
            onSkip();
            onContinue();
          }}
          className="text-sm text-muted-foreground underline-offset-4 transition-smooth hover:text-foreground hover:underline"
        >
          Skip — I'll share the address later
        </button>
      </div>
    </div>
  );
};

export default AddressStep;
