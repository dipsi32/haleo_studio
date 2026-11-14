// The homepage walkthrough: each way in, played from the first tap to the
// best fit, so a homeowner sees exactly what will happen before they start.
// Example data, labelled as such. It follows the path they pick in the
// gateway; with nothing picked it plays them in turn.
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FileText, ImageIcon, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GatewayPath } from "@/lib/homeGateway";

type Level = "yes" | "some" | "no" | "not_checked";
const DOT: Record<Level, string> = {
  yes: "bg-sage border-sage",
  some: "bg-sage/40 border-sage/60",
  no: "border-foreground/25",
  not_checked: "border-dashed border-muted-foreground/50",
};
const Dots = ({ levels }: { levels: Level[] }) => (
  <span className="inline-flex gap-1">
    {levels.map((l, i) => (
      <motion.span
        key={i}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15 + i * 0.12, type: "spring", stiffness: 400, damping: 18 }}
        className={cn("h-2.5 w-2.5 rounded-full border", DOT[l])}
      />
    ))}
  </span>
);

const fade = (i: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.12 + i * 0.18 } });

const Typing = ({ text, className }: { text: string; className?: string }) => {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((x) => x + 1), 28);
    return () => clearTimeout(t);
  }, [n, text]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="ml-px inline-block h-4 w-px animate-pulse bg-foreground align-middle" />}
    </span>
  );
};

const Bubble = ({ who, children, i, mine = false }: { who?: string; children: React.ReactNode; i: number; mine?: boolean }) => (
  <motion.div {...fade(i)} className={cn("max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug", mine ? "ml-auto bg-foreground text-background" : "bg-secondary")}>
    {who && <p className="mb-0.5 text-[10.5px] font-medium text-muted-foreground">{who}</p>}
    {children}
  </motion.div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
);

const FitRow = ({ name, levels, line, i, best = false }: { name: string; levels: Level[]; line: string; i: number; best?: boolean }) => (
  <motion.div {...fade(i)} className={cn("rounded-2xl border bg-card p-3.5", best ? "border-foreground/30 shadow-soft" : "border-border")}>
    {best && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Best fit</p>}
    <p className="font-display text-[15px] leading-tight">{name}</p>
    <div className="mt-2 flex items-center gap-2">
      <Dots levels={levels} />
      <span className="text-[11.5px] text-muted-foreground">{line}</span>
    </div>
  </motion.div>
);

type Frame = { caption: string; body: React.ReactNode };

const FRAMES: Record<GatewayPath, Frame[]> = {
  thread: [
    {
      caption: "Paste the thread, or a screenshot of it",
      body: (
        <div className="space-y-2">
          <Label>Nextdoor · Willow Glen</Label>
          <Bubble i={0} mine>Anyone have a good contractor for a kitchen remodel?</Bubble>
          <Bubble i={1} who="Dana">We used Oak & Stone Builders. On time, on budget.</Bubble>
          <Bubble i={2} who="Mark">+1 Oak & Stone. Also try Brightline Remodeling, 408-555-0142</Bubble>
          <Bubble i={3} who="Lena">Casa Verde did our bath. Slow, but great work.</Bubble>
          <Bubble i={4} who="Sam">Summit Home Co was fine. Pricey.</Bubble>
        </div>
      ),
    },
    {
      caption: "We pull out every name your neighbors mentioned",
      body: (
        <div className="space-y-2.5">
          <Label>6 contractors found</Label>
          {[
            ["Oak & Stone Builders", "2 neighbors vouched"],
            ["Brightline Remodeling", "1 mention, with a phone"],
            ["Casa Verde Construction", "1 mention"],
            ["Summit Home Co", "1 mention"],
            ["Ridgeline Builders", "1 mention"],
            ["Bay Craft Homes", "1 mention"],
          ].map(([n, m], i) => (
            <motion.div key={n} {...fade(i)} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
              <span className="text-[13px] font-medium">{n}</span>
              <span className="text-[11px] text-muted-foreground">{m}</span>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      caption: "We read each one's permits, city inspections and license",
      body: (
        <div className="space-y-2.5">
          <Label>Reading public records</Label>
          {["Oak & Stone Builders", "Brightline Remodeling", "Casa Verde Construction", "Summit Home Co"].map((n, i) => (
            <motion.div key={n} {...fade(i)} className="rounded-xl border border-border bg-card px-3 py-2.5">
              <p className="text-[13px] font-medium">{n}</p>
              <div className="mt-1.5 flex gap-3 text-[11px] text-muted-foreground">
                {["Permits", "Inspections", "License"].map((s, j) => (
                  <motion.span key={s} initial={{ opacity: 0.35 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.25 + j * 0.15 }} className="inline-flex items-center gap-1">
                    <Check className="h-3 w-3 text-sage" /> {s}
                  </motion.span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      caption: "You see the best fit for your job, and why",
      body: (
        <div className="space-y-2.5">
          <Label>Your best fit · Kitchen · 95125</Label>
          <FitRow i={0} best name="Oak & Stone Builders" levels={["yes", "yes", "yes", "yes", "yes"]} line="Lines up on 5 of 5" />
          <FitRow i={1} best name="Brightline Remodeling" levels={["yes", "some", "yes", "yes", "not_checked"]} line="4 of 5 · 1 not checked" />
          <motion.p {...fade(2)} className="rounded-xl border border-dashed border-border px-3 py-2 text-[11.5px] text-muted-foreground">
            4 more checked. See why they're further down.
          </motion.p>
          <motion.div {...fade(3)} className="rounded-xl bg-secondary px-3 py-2 text-[11.5px] leading-snug">
            <span className="font-medium">Oak & Stone:</span> 6 kitchen permits, 3 in your ZIP, 21 city sign-offs, license active.
          </motion.div>
        </div>
      ),
    },
    {
      caption: "Ask for a bid. The message is already written",
      body: (
        <div className="space-y-3">
          <Label>To Oak & Stone Builders</Label>
          <Bubble i={0} mine>
            Hi! We're remodeling our kitchen in Willow Glen, about 150 sq ft, mid-range finishes. Could you send an itemized bid and your
            license number? Here's our brief with photos.
          </Bubble>
          <motion.div {...fade(1)} className="flex items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-[13px] font-medium text-background">
            <Send className="h-3.5 w-3.5" /> Send from my phone
          </motion.div>
        </div>
      ),
    },
  ],
  one: [
    {
      caption: "Type their name, or their license number",
      body: (
        <div className="space-y-3">
          <Label>The contractor you have in mind</Label>
          <div className="rounded-xl border border-foreground/30 bg-card px-3 py-2.5 text-[14px]">
            <Typing text="Oak & Stone Builders" />
          </div>
          <motion.div {...fade(3)} className="flex flex-wrap gap-1.5 text-[11.5px]">
            <span className="rounded-full bg-foreground px-2.5 py-1 text-background">Kitchen</span>
            <span className="rounded-full border border-border px-2.5 py-1">95125</span>
          </motion.div>
        </div>
      ),
    },
    {
      caption: "We find their record with the city and the state",
      body: (
        <div className="space-y-2.5">
          <Label>Oak & Stone Builders · since 2016</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["14", "San Jose permits"],
              ["6", "kitchen jobs"],
              ["3", "in your ZIP"],
              ["21", "city sign-offs"],
            ].map(([n, l], i) => (
              <motion.div key={l} {...fade(i)} className="rounded-xl border border-border bg-card p-3">
                <p className="font-display text-2xl leading-none">{n}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{l}</p>
              </motion.div>
            ))}
          </div>
          <motion.p {...fade(4)} className="text-[11.5px] text-muted-foreground">
            Streets they've worked on near you: Cabana Dr, Minnesota Av
          </motion.p>
        </div>
      ),
    },
    {
      caption: "Checked against your job, five plain questions",
      body: (
        <div className="space-y-2">
          <Label>Lines up with your kitchen job on 5 of 5</Label>
          {[
            ["Have they done kitchen work?", "6 kitchen permits"],
            ["Do they work near you?", "3 jobs in 95125"],
            ["Are they active lately?", "5 permits this year"],
            ["Does their work pass inspection?", "21 city sign-offs"],
            ["Is their license active?", "Active, state license board"],
          ].map(([q, a], i) => (
            <motion.div key={q} {...fade(i)} className="flex gap-2.5">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border border-sage bg-sage" />
              <div>
                <p className="text-[12.5px] font-medium leading-tight">{q}</p>
                <p className="text-[11px] text-muted-foreground">{a} · Public record</p>
              </div>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      caption: "Ask them for a bid. The message is already written",
      body: (
        <div className="space-y-3">
          <Label>To Oak & Stone Builders</Label>
          <Bubble i={0} mine>
            Hi! We're planning a kitchen remodel in Willow Glen. Could you send an itemized bid, your license number and when you could
            start?
          </Bubble>
          <motion.div {...fade(1)} className="flex items-center justify-center gap-2 rounded-full bg-foreground py-2.5 text-[13px] font-medium text-background">
            <Send className="h-3.5 w-3.5" /> Send from my phone
          </motion.div>
          <motion.p {...fade(2)} className="text-center text-[11.5px] text-muted-foreground">
            When their bid comes back, we'll check it line by line.
          </motion.p>
        </div>
      ),
    },
  ],
  scratch: [
    {
      caption: "Tell us what you want done, in your words",
      body: (
        <div className="space-y-3">
          <Label>What do you need done?</Label>
          <div className="min-h-[96px] rounded-xl border border-foreground/30 bg-card px-3 py-2.5 text-[14px] leading-snug">
            <Typing text="Our kitchen is dark and cramped. We'd love to open it up and get more light." />
          </div>
        </div>
      ),
    },
    {
      caption: "A few quick taps, and a photo or two",
      body: (
        <div className="space-y-3">
          <Label>Your project</Label>
          <motion.div {...fade(0)} className="flex gap-1.5">
            {["bg-amber-100", "bg-stone-200", "bg-orange-100"].map((c) => (
              <div key={c} className={cn("grid h-14 w-14 place-items-center rounded-lg", c)}>
                <ImageIcon className="h-4 w-4 text-foreground/40" />
              </div>
            ))}
          </motion.div>
          {[
            ["Size", "Medium, 100–200 sq ft"],
            ["Finish", "Mid-range"],
            ["Budget", "$60K – $90K"],
            ["Start", "In 1–3 months"],
          ].map(([k, v], i) => (
            <motion.div key={k} {...fade(i + 1)} className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-[12.5px]">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      caption: "We show you who has built it near you",
      body: (
        <div className="space-y-2.5">
          <Label>Who's built this near you</Label>
          <FitRow i={0} best name="Oak & Stone Builders" levels={["yes", "yes", "yes", "yes", "yes"]} line="5 of 5" />
          <FitRow i={1} name="Ridgeline Builders" levels={["yes", "yes", "some", "yes", "not_checked"]} line="4 of 5 · 1 not checked" />
          <FitRow i={2} name="Bay Craft Homes" levels={["some", "yes", "yes", "some", "yes"]} line="5 of 5" />
        </div>
      ),
    },
    {
      caption: "Send your brief to the ones you like",
      body: (
        <div className="space-y-3">
          <Label>Your brief · what they get</Label>
          <motion.div {...fade(0)} className="rounded-2xl border border-border bg-card p-3.5">
            <p className="font-display text-[16px]">Kitchen remodel · Willow Glen</p>
            <p className="mt-1 text-[12px] italic text-foreground/80">“Dark and cramped. Open it up, more light.”</p>
            <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11px]">
              {["~150 sq ft", "Mid-range", "$60K – $90K", "1–3 months"].map((t) => (
                <span key={t} className="rounded-md bg-secondary px-2 py-1">{t}</span>
              ))}
            </div>
          </motion.div>
          <motion.div {...fade(2)} className="flex items-center justify-center gap-2 rounded-full bg-sage/15 py-2.5 text-[13px] font-medium text-sage">
            <Check className="h-3.5 w-3.5" /> Sent to 2 contractors
          </motion.div>
        </div>
      ),
    },
  ],
  quote: [
    {
      caption: "Upload the quote, or paste it",
      body: (
        <div className="space-y-3">
          <Label>Your quote</Label>
          <motion.div {...fade(0)} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <FileText className="h-5 w-5 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">Kitchen_quote.pdf</p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
                <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 1.4 }} className="h-full bg-foreground" />
              </div>
            </div>
          </motion.div>
          <motion.p {...fade(4)} className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading every line…
          </motion.p>
        </div>
      ),
    },
    {
      caption: "Every line, checked against what's normal nearby",
      body: (
        <div className="space-y-1.5">
          <Label>$84,200 · kitchen · 95128</Label>
          {[
            ["Cabinets & install", "$31,000", "In range", "text-sage"],
            ["Quartz countertops", "$9,400", "In range", "text-sage"],
            ["Demolition & haul-away", "$6,200", "High", "text-amber-700"],
            ["City permit fee", "$2,800", "Check", "text-destructive"],
            ["“Finish allowance”", "$7,500", "Ask", "text-muted-foreground"],
          ].map(([n, a, v, c], i) => (
            <motion.div key={n} {...fade(i)} className="flex items-center justify-between border-b border-border py-2 text-[12.5px] last:border-0">
              <span>{n}</span>
              <span className="flex items-center gap-3">
                <span className="tabular-nums">{a}</span>
                <span className={cn("w-14 text-right text-[11px]", c)}>{v}</span>
              </span>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      caption: "You know what to push back on before you sign",
      body: (
        <div className="space-y-2.5">
          <Label>Ask before you sign</Label>
          {[
            "Demolition runs $2,400–$3,600 nearby. What's in the $6,200?",
            "What's the $7,500 allowance for, exactly?",
            "The city's fee for this scope is lower. Can you itemize the permit line?",
          ].map((q, i) => (
            <motion.div key={q} {...fade(i)} className="rounded-xl bg-secondary px-3 py-2 text-[12.5px] leading-snug">
              {q}
            </motion.div>
          ))}
        </div>
      ),
    },
  ],
};

const ORDER: GatewayPath[] = ["thread", "one", "scratch", "quote"];
const STEP_MS = 3200;

const TAB: Record<GatewayPath, string> = {
  scratch: "Just starting",
  thread: "Names from neighbors",
  one: "One contractor",
  quote: "A quote",
};

export default function PathDemo({ path, onPath, className }: { path: GatewayPath | null; onPath?: (p: GatewayPath) => void; className?: string }) {
  const [auto, setAuto] = useState<GatewayPath>("thread");
  const current = path ?? auto;
  const frames = FRAMES[current];
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    setStep(0);
  }, [current]);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => {
      if (step < frames.length - 1) return setStep(step + 1);
      if (path) return setStep(0);
      setAuto(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
    }, step === frames.length - 1 ? STEP_MS + 1400 : STEP_MS);
    return () => clearTimeout(t);
  }, [step, frames.length, paused, reduced, path, current]);

  return (
    <div className={cn("w-full", className)} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="See how each way in works">
        {ORDER.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === current}
            onClick={() => (onPath ? onPath(p) : setAuto(p))}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] transition-smooth",
              p === current ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {TAB[p]}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-5 w-full max-w-[360px]">
        <div className="flex gap-1" aria-hidden>
          {frames.map((_, i) => (
            <button key={i} type="button" tabIndex={-1} onClick={() => setStep(i)} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
              <motion.span
                key={`${current}-${i}-${step}`}
                className="block h-full bg-foreground"
                initial={{ width: i < step ? "100%" : "0%" }}
                animate={{ width: i < step ? "100%" : i === step ? "100%" : "0%" }}
                transition={{ duration: i === step && !paused && !reduced ? STEP_MS / 1000 : 0, ease: "linear" }}
              />
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={`${current}-${step}-cap`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 min-h-[44px] font-display text-[17px] leading-snug"
          >
            <span className="mr-1.5 text-muted-foreground">{step + 1}.</span>
            {frames[step].caption}
          </motion.p>
        </AnimatePresence>

        <div className="relative mt-3 h-[420px] overflow-hidden rounded-[30px] border border-border bg-background p-4 shadow-lift">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Haleo</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">Example</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`${current}-${step}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
            >
              {frames[step].body}
            </motion.div>
          </AnimatePresence>
        </div>
        {reduced && (
          <div className="mt-3 flex justify-center gap-4 text-[13px]">
            <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="underline-offset-4 hover:underline disabled:opacity-40">
              Back
            </button>
            <button type="button" disabled={step === frames.length - 1} onClick={() => setStep(step + 1)} className="underline-offset-4 hover:underline disabled:opacity-40">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
