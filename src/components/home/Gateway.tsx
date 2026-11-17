// "Where are you in your search?" One question, four honest answers. Picking
// one opens just what that path needs, and says what happens next, so
// nobody has to guess. Every path runs end to end from here.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, Compass, FileText, ImagePlus, MessagesSquare, Upload, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { GATEWAY, GATEWAY_PROJECTS, shortlistUrl, type GatewayPath } from "@/lib/homeGateway";
import { canMatchFrom, setPendingShots, startOwnSearch } from "@/lib/homeStart";
import { setPendingQuoteFile, setPendingQuoteText } from "@/lib/quoteHandoff";
import { classifyHomeEntry } from "@/lib/homeEntry";
import type { ShortlistProject } from "@/lib/shortlist";

type Props = { selected: GatewayPath | null; onSelect: (p: GatewayPath | null) => void; where: "hero" | "closing" };

const Next = ({ steps }: { steps: readonly string[] }) => (
  <div className="mt-5 rounded-2xl bg-secondary/60 p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">What happens next</p>
    <ol className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-4">
      {steps.map((step, i) => (
        <li key={step} className="flex gap-2.5 text-[13.5px] leading-snug">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-foreground text-[12px] font-medium text-background">{i + 1}</span>
          <span className="pt-0.5">{step}</span>
        </li>
      ))}
    </ol>
  </div>
);

const Go = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-foreground px-8 text-[16px] font-medium text-background shadow-lift transition-smooth hover:-translate-y-0.5 hover:opacity-95 sm:w-auto"
  >
    {children} <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
  </button>
);

// Each way in has its own look, a promise on the tile, and a confident reply once picked.
const LOOK: Record<GatewayPath, { icon: typeof Compass; tint: string; promise: string; reply: string }> = {
  scratch: {
    icon: Compass,
    tint: "bg-accent-soft text-accent-soft-foreground",
    promise: "We'll find who has built it near you.",
    reply: "Let's start with your project.",
  },
  thread: {
    icon: MessagesSquare,
    tint: "bg-sage-soft text-sage",
    promise: "We'll narrow it down to the strongest matches.",
    reply: "Paste it in. We'll do the sorting.",
  },
  one: {
    icon: UserCheck,
    tint: "bg-secondary text-foreground",
    promise: "We'll dig into their work record for you.",
    reply: "Who do you have in mind?",
  },
  quote: {
    icon: FileText,
    tint: "bg-accent-soft text-accent-soft-foreground",
    promise: "We'll check it line by line before you sign.",
    reply: "Let's look at it together.",
  },
};

/** Optional: the project and ZIP, so "like yours" and "near you" can be answered. */
const AboutJob = ({ project, setProject, zip, setZip }: { project: ShortlistProject | null; setProject: (p: ShortlistProject | null) => void; zip: string; setZip: (z: string) => void }) => (
  <div className="mt-4">
    <p className="text-[12.5px] text-muted-foreground">
      About your job <span className="opacity-70">· optional, it sharpens the match</span>
    </p>
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {GATEWAY_PROJECTS.map((p) => (
        <button
          key={p.id}
          type="button"
          aria-pressed={project === p.id}
          onClick={() => setProject(project === p.id ? null : p.id)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[13px] transition-smooth",
            project === p.id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary",
          )}
        >
          {p.label}
        </button>
      ))}
      <Input
        aria-label="Your ZIP"
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={5}
        value={zip}
        onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
        placeholder="ZIP"
        className="h-[34px] w-20 rounded-full text-[13px]"
      />
    </div>
  </div>
);

export default function Gateway({ selected, onSelect, where }: Props) {
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [thread, setThread] = useState("");
  const [shots, setShots] = useState<{ file: File; url: string }[]>([]);
  const [who, setWho] = useState("");
  const [quoteText, setQuoteText] = useState("");
  const [pasteQuote, setPasteQuote] = useState(false);
  const [project, setProject] = useState<ShortlistProject | null>(null);
  const [zip, setZip] = useState("");
  const [nudge, setNudge] = useState(false);
  const shotRef = useRef<HTMLInputElement>(null);
  const quoteRef = useRef<HTMLInputElement>(null);

  const go = (path: GatewayPath, to: string, extra: Record<string, unknown> = {}) => {
    track("home_entry_started", { where, kind: path, ...extra });
    navigate(to);
  };

  // Their words and a ZIP are enough to show who has done this nearby (and
  // what similar jobs declared) before asking for anything else.
  const startScratch = () => {
    startOwnSearch(note, zip);
    if (canMatchFrom(note, zip)) return go("scratch", "/contractors", { has_note: true, match_first: true });
    go("scratch", note.trim() ? `/brief?note=${encodeURIComponent(note.trim().slice(0, 500))}` : "/brief", { has_note: !!note.trim(), match_first: false });
  };

  const startThread = () => {
    if (!thread.trim() && shots.length === 0) return setNudge(true);
    startOwnSearch();
    if (shots.length) setPendingShots(shots.map((s) => s.file));
    go("thread", shortlistUrl({ text: thread, project, zip, shots: shots.length > 0 }), { screenshots: shots.length });
  };

  const startOne = () => {
    if (!who.trim()) return setNudge(true);
    startOwnSearch();
    // Pasted their quote instead of a name: that's the quote check.
    if (classifyHomeEntry(who) === "quote") {
      setPendingQuoteText(who.trim());
      return go("quote", "/roast", { via: "one" });
    }
    go("one", shortlistUrl({ name: who, project, zip }));
  };

  const startQuoteText = () => {
    if (quoteText.trim().length < 40) return setNudge(true);
    startOwnSearch();
    setPendingQuoteText(quoteText.trim());
    go("quote", "/roast", { mode: "paste" });
  };

  const chosen = GATEWAY.find((g) => g.id === selected) ?? null;
  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="w-full">
      <div className="px-1">
        <p className="font-display text-[22px] leading-snug md:text-[24px]">Where are you in your search?</p>
        <p className="mt-1 text-[14.5px] text-muted-foreground">Pick the one that sounds like you. We'll take it from there.</p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {GATEWAY.map((g) => {
          const open = selected === g.id;
          const look = LOOK[g.id];
          const Icon = look.icon;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={open}
              onClick={() => {
                setNudge(false);
                onSelect(open ? null : g.id);
                if (!open) {
                  track("home_door_clicked", { door: g.id, where });
                  // On phones the panel opens below the tiles: bring it into view.
                  setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 260);
                }
              }}
              className={cn(
                "group relative flex items-start gap-4 rounded-3xl border bg-card p-4 text-left shadow-soft transition-all duration-200 sm:flex-col sm:gap-0 sm:p-5",
                open
                  ? "border-foreground ring-1 ring-foreground"
                  : selected
                    ? "border-border opacity-70 hover:opacity-100"
                    : "border-border hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-lift",
              )}
            >
              <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl", look.tint)}>
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </span>
              {open && (
                <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-foreground text-background">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              )}
              <span className="min-w-0 pr-6 sm:pr-0">
                <span className="block font-display text-[17px] leading-snug sm:mt-4 sm:text-[18px]">{g.title}</span>
                <span className="mt-1 block text-[13.5px] leading-snug text-muted-foreground sm:mt-1.5">{look.promise}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {chosen && (
          <motion.div
            ref={panelRef}
            key={chosen.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="mt-4 scroll-mt-6 rounded-3xl border border-border bg-card p-5 shadow-lift md:p-6"
          >
            <p className="font-display text-[22px] leading-snug">{LOOK[chosen.id].reply}</p>
            <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{chosen.sub}</p>
            <div className="mt-5">
              {[chosen].map((g) => (
                <div key={g.id}>
                      {g.id === "scratch" && (
                        <>
                          <Textarea
                            autoFocus
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            placeholder="“Our kitchen is dark and cramped. We'd love to open it up.”"
                            className="resize-none rounded-2xl bg-card text-[15px]"
                          />
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Input
                              aria-label="Your ZIP"
                              inputMode="numeric"
                              autoComplete="postal-code"
                              maxLength={5}
                              value={zip}
                              onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                              placeholder="Your ZIP"
                              className="h-10 w-28 rounded-full bg-card text-[14px]"
                            />
                            <span className="text-[12.5px] text-muted-foreground">So we can show who has done this near you</span>
                          </div>
                          <Next steps={g.next} />
                          <Go onClick={startScratch}>{canMatchFrom(note, zip) ? "Show me who's done this nearby" : "Start my project"}</Go>
                        </>
                      )}

                      {g.id === "thread" && (
                        <>
                          <Textarea
                            autoFocus
                            value={thread}
                            onChange={(e) => {
                              setThread(e.target.value);
                              setNudge(false);
                            }}
                            rows={4}
                            placeholder={"Paste the replies here, messy is fine.\n“We used Oak & Stone, on time and on budget…”"}
                            className="resize-none rounded-2xl bg-card text-[15px]"
                          />
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => shotRef.current?.click()}
                              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] transition-smooth hover:bg-secondary"
                            >
                              <ImagePlus className="h-3.5 w-3.5" /> {shots.length ? "Add more screenshots" : "Or add screenshots"}
                            </button>
                            {shots.map((s, i) => (
                              <span key={s.url} className="relative">
                                <img src={s.url} alt={`Screenshot ${i + 1}`} className="h-9 w-9 rounded-lg border border-border object-cover" />
                                <button
                                  type="button"
                                  aria-label={`Remove screenshot ${i + 1}`}
                                  onClick={() => setShots((xs) => xs.filter((x) => x.url !== s.url))}
                                  className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-foreground text-background"
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </span>
                            ))}
                            <input
                              ref={shotRef}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/"));
                                setShots((xs) => [...xs, ...files.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 6));
                                setNudge(false);
                                e.target.value = "";
                              }}
                            />
                          </div>
                          <AboutJob project={project} setProject={setProject} zip={zip} setZip={setZip} />
                          <Next steps={g.next} />
                          {nudge && <p className="mt-3 text-[13px] text-accent">Paste the replies or add a screenshot, and we'll take it from there.</p>}
                          <Go onClick={startThread}>Find my best fit</Go>
                        </>
                      )}

                      {g.id === "one" && (
                        <>
                          <Textarea
                            autoFocus
                            value={who}
                            onChange={(e) => {
                              setWho(e.target.value);
                              setNudge(false);
                            }}
                            rows={2}
                            placeholder="Their name or license number, or paste their quote"
                            className="resize-none rounded-2xl bg-card text-[15px]"
                          />
                          <AboutJob project={project} setProject={setProject} zip={zip} setZip={setZip} />
                          <Next steps={g.next} />
                          {nudge && <p className="mt-3 text-[13px] text-accent">Type their name or license number first.</p>}
                          <Go onClick={startOne}>{classifyHomeEntry(who) === "quote" ? "Check their quote" : "Look them up"}</Go>
                        </>
                      )}

                      {g.id === "quote" && (
                        <>
                          <input
                            ref={quoteRef}
                            type="file"
                            accept="application/pdf,image/*,.txt,.doc,.docx"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              startOwnSearch();
                              setPendingQuoteFile(f);
                              go("quote", "/roast", { mode: "upload" });
                            }}
                          />
                          {!pasteQuote ? (
                            <>
                              <button
                                type="button"
                                onClick={() => quoteRef.current?.click()}
                                className="flex w-full flex-col items-center gap-1.5 rounded-2xl border border-dashed border-foreground/25 bg-card px-4 py-6 text-center transition-smooth hover:border-foreground/50"
                              >
                                <Upload className="h-5 w-5" strokeWidth={1.8} />
                                <span className="text-[15px] font-medium">Upload your quote</span>
                                <span className="text-[12.5px] text-muted-foreground">PDF, photo or screenshot</span>
                              </button>
                              <button type="button" onClick={() => setPasteQuote(true)} className="mt-2 text-[13px] text-muted-foreground underline-offset-4 hover:underline">
                                Or paste the text
                              </button>
                              <Next steps={g.next} />
                            </>
                          ) : (
                            <>
                              <Textarea
                                autoFocus
                                value={quoteText}
                                onChange={(e) => {
                                  setQuoteText(e.target.value);
                                  setNudge(false);
                                }}
                                rows={5}
                                placeholder={"Kitchen remodel\nCabinets: $31,000\nCountertops: $9,400\n…\nTotal: $84,200"}
                                className="resize-none rounded-2xl bg-card text-[14px]"
                              />
                              <Next steps={g.next} />
                              {nudge && <p className="mt-3 text-[13px] text-accent">Paste the whole quote, line items and total.</p>}
                              <Go onClick={startQuoteText}>Check my quote</Go>
                            </>
                          )}
                        </>
                      )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 px-1 text-[13px] text-muted-foreground">
        {["Free to use", "No sign-up to start", "Public records, not ads or ratings"].map((t) => (
          <li key={t} className="inline-flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-sage" strokeWidth={2.5} /> {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
