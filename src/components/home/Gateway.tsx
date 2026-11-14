// "Where are you in your search?" One question, four honest answers. Picking
// one opens just what that path needs, and says what happens next, so
// nobody has to guess. Every path runs end to end from here.
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ImagePlus, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { GATEWAY, GATEWAY_PROJECTS, shortlistUrl, type GatewayPath } from "@/lib/homeGateway";
import { setPendingShots, startOwnSearch } from "@/lib/homeStart";
import { setPendingQuoteFile, setPendingQuoteText } from "@/lib/quoteHandoff";
import { classifyHomeEntry } from "@/lib/homeEntry";
import type { ShortlistProject } from "@/lib/shortlist";

type Props = { selected: GatewayPath | null; onSelect: (p: GatewayPath | null) => void; where: "hero" | "closing" };

const Next = ({ steps }: { steps: readonly string[] }) => (
  <ol className="mt-4 grid gap-2 sm:grid-cols-3">
    {steps.map((s, i) => (
      <li key={s} className="flex gap-2 text-[12.5px] leading-snug text-muted-foreground">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-[11px] text-foreground">{i + 1}</span>
        {s}
      </li>
    ))}
  </ol>
);

const Go = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background transition-smooth hover:opacity-90 sm:w-auto"
  >
    {children} <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
  </button>
);

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

  const startScratch = () => {
    startOwnSearch(note);
    go("scratch", note.trim() ? `/brief?note=${encodeURIComponent(note.trim().slice(0, 500))}` : "/brief", { has_note: !!note.trim() });
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

  return (
    <div className="w-full rounded-[28px] border border-border bg-card p-2 shadow-soft">
      <p className="px-4 pb-2 pt-4 font-display text-[19px] leading-snug">Where are you in your search?</p>
      <ul className="space-y-1">
        {GATEWAY.map((g) => {
          const open = selected === g.id;
          return (
            <li key={g.id} className={cn("rounded-[22px] transition-smooth", open ? "bg-secondary/60" : "hover:bg-secondary/40")}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  setNudge(false);
                  onSelect(open ? null : g.id);
                  if (!open) track("home_door_clicked", { door: g.id, where });
                }}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
              >
                <span
                  className={cn(
                    "mt-1 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-smooth",
                    open ? "border-foreground" : "border-foreground/30",
                  )}
                >
                  {open && <span className="h-2 w-2 rounded-full bg-foreground" />}
                </span>
                <span>
                  <span className="block text-[16px] font-medium leading-snug">{g.title}</span>
                  <span className="mt-0.5 block text-[13.5px] leading-snug text-muted-foreground">{g.sub}</span>
                </span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-5 pl-[46px]">
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
                          <p className="mt-2 text-[12.5px] text-muted-foreground">One sentence is plenty. You can skip this and pick from a list.</p>
                          <Next steps={g.next} />
                          <Go onClick={startScratch}>Start my project</Go>
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
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
