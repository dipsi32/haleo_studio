// /shortlist: "I already have names. Help me pick."
//
// For the homeowner mid-search: they asked Nextdoor, Reddit, a WhatsApp group
// or a friend, and now they're drowning in names. They bring what they have
// (pasted text, screenshots, or a name typed in), we pull out the contractors,
// check each one against CSLB and San Jose permit records, put them in order
// for their project, and help them ask the best few for a bid, explaining the
// project once.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  X,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { track } from "@/lib/analytics";
import { useIntake } from "@/lib/intake";
import { buildBriefSnapshot, cslbDeepLink, tierChipClass, trustChecks, trustTier } from "@/lib/contractors";
import {
  bidRequestMessage,
  type Candidate,
  type CheckedCandidate,
  clearShortlist,
  fitLine,
  formatPhone,
  fromExtraction,
  licenseState,
  loadShortlist,
  mailtoHref,
  manualCandidate,
  mergeCandidates,
  neighborRead,
  PROJECT_OPTIONS,
  projectFromRoom,
  projectOption,
  redFlag,
  saveShortlist,
  type ShortlistProject,
  smsHref,
} from "@/lib/shortlist";
import { useShortlistCheck } from "@/lib/useShortlistCheck";

type Step = "bring" | "confirm" | "compare" | "request";
type Shot = { id: string; name: string; preview: string; media_type: string; data: string };

const MAX_SHOTS = 6;
const CSLB_NAME_SEARCH = "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/CheckLicense.aspx";

// Screenshots go to the model as base64. Downscale first: phones take huge images,
// and text in a thread stays readable at this size.
const shrinkImage = (file: File): Promise<Shot> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1568;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      URL.revokeObjectURL(url);
      resolve({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        name: file.name,
        preview: dataUrl,
        media_type: "image/jpeg",
        data: dataUrl.split(",")[1] ?? "",
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable image"));
    };
    img.src = url;
  });

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{children}</p>
);

const Shortlist = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: intake } = useIntake();
  const saved = useMemo(() => loadShortlist(), []);

  const [step, setStep] = useState<Step>(saved ? "compare" : "bring");
  const [project, setProject] = useState<ShortlistProject | null>(saved?.project ?? projectFromRoom(intake.room));
  const [text, setText] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualLicense, setManualLicense] = useState("");
  const [manual, setManual] = useState<Candidate[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>(saved?.candidates ?? []);
  const [extracting, setExtracting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(saved?.selected ?? []));
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [needInput, setNeedInput] = useState(false);

  const { results: liveResults, running, run, reset } = useShortlistCheck();
  const [restored, setRestored] = useState<CheckedCandidate[]>(saved?.results ?? []);
  const results = liveResults.length > 0 ? liveResults : restored;

  // The project is optional. Without one, "like yours" means any remodel or repair.
  const opt = projectOption(project ?? "other");
  const hasBrief = !!intake.room && (!!intake.scope || intake.painPoints.length > 0 || !!intake.notes);
  const homeownerName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ?? null;

  useEffect(() => {
    track("shortlist_started", { restored: !!saved });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the shortlist through a detour (building a brief, a reload).
  useEffect(() => {
    if (results.length === 0 || running) return;
    saveShortlist({ project: project ?? "other", candidates, results, selected: [...selected] });
  }, [project, candidates, results, selected, running]);

  // "Not them": drop a wrong permit match from that card.
  const shown: CheckedCandidate[] = useMemo(
    () =>
      results.map((r) =>
        rejected.has(r.candidate.id) ? { ...r, contractor: null, permits: [], likeYours: 0, score: null } : r,
      ),
    [results, rejected],
  );

  // ───── Step 1 → 2: find the contractors ─────
  const addShots = async (files: FileList | null) => {
    if (!files) return;
    const room = MAX_SHOTS - shots.length;
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    const out: Shot[] = [];
    for (const f of picked) {
      try {
        out.push(await shrinkImage(f));
      } catch {
        toast({ title: `Couldn't read ${f.name}`, description: "Try a PNG or JPG screenshot." });
      }
    }
    setShots((s) => [...s, ...out.filter((o) => !s.some((x) => x.id === o.id))]);
  };

  const addManual = () => {
    if (!manualName.trim()) return;
    setManual((m) => [...m, manualCandidate({ name: manualName, phone: manualPhone, license_number: manualLicense })]);
    setManualName("");
    setManualPhone("");
    setManualLicense("");
  };

  const hasInput = text.trim().length > 0 || shots.length > 0 || manual.length > 0 || manualName.trim().length > 0;

  const findContractors = async () => {
    // Never a dead grey button: say what's missing and point at it.
    if (!hasInput) {
      setNeedInput(true);
      textRef.current?.focus();
      return;
    }
    const typed = manualName.trim() ? [manualCandidate({ name: manualName, phone: manualPhone, license_number: manualLicense })] : [];
    let found: Candidate[] = [];
    if (text.trim() || shots.length) {
      setExtracting(true);
      try {
        const { data, error } = await supabase.functions.invoke("extract-referrals", {
          body: { text: text.trim() || undefined, images: shots.map(({ media_type, data }) => ({ media_type, data })) },
        });
        if (error || !data?.ok) throw new Error(data?.error ?? "We couldn't read that.");
        found = fromExtraction(data.candidates, shots.length && !text.trim() ? "screenshot" : "pasted");
      } catch (e) {
        toast({
          title: "We couldn't read that",
          description: e instanceof Error ? e.message : "Try again, or add the names by hand.",
          variant: "destructive",
        });
        setExtracting(false);
        if (manual.length + typed.length === 0) return;
      }
      setExtracting(false);
    }
    const all = mergeCandidates([...found, ...manual, ...typed]);
    track("shortlist_extracted", {
      found: found.length,
      manual: manual.length + typed.length,
      merged: all.length,
      has_text: !!text.trim(),
      screenshots: shots.length,
    });
    if (all.length === 0) {
      toast({ title: "No contractors in there", description: "We didn't spot a contractor's name. Add one by hand below." });
      return;
    }
    setManualName("");
    setManualPhone("");
    setManualLicense("");
    setCandidates(all);
    setStep("confirm");
  };

  // ───── Step 2 → 3: check them ─────
  const editCandidate = (id: string, patch: Partial<Candidate>) =>
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const checkThem = () => {
    const list = candidates.filter((c) => c.name.trim());
    if (list.length === 0) return;
    setRejected(new Set());
    setSelected(new Set());
    setRestored([]);
    setStep("compare");
    track("shortlist_checked", { count: list.length, with_license: list.filter((c) => c.license_number).length, project: opt.id });
    void run(list, opt.keywords);
  };

  const startOver = () => {
    clearShortlist();
    reset();
    setRestored([]);
    setCandidates([]);
    setManual([]);
    setText("");
    setShots([]);
    setSelected(new Set());
    setRejected(new Set());
    setMessages({});
    setSentIds(new Set());
    setStep("bring");
  };

  // ───── Step 3 → 4: request bids ─────
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const chosen = shown.filter((r) => selected.has(r.candidate.id));
  const snapshot = useMemo(() => (hasBrief ? buildBriefSnapshot(intake, homeownerName ?? undefined) : null), [hasBrief, intake, homeownerName]);

  const goRequest = () => {
    const msgs: Record<string, string> = {};
    for (const r of chosen) {
      msgs[r.candidate.id] =
        messages[r.candidate.id] ??
        bidRequestMessage({
          contractorName: r.candidate.name,
          personName: r.candidate.person,
          homeownerName,
          projectLabel: opt?.id === "other" ? "home project" : `${opt?.word ?? "home"} project`,
          snapshot,
        });
    }
    setMessages(msgs);
    setStep("request");
    track("shortlist_request_opened", { count: chosen.length, has_brief: hasBrief });
  };

  const markSent = (id: string, via: "text" | "email" | "copy") => {
    setSentIds((s) => new Set(s).add(id));
    track("shortlist_bid_requested", { via, has_brief: hasBrief });
  };

  const top = shown.find((r) => r.status === "done" && !redFlag(r) && (r.score || licenseState(r.license) !== "not_checked"));
  const doneCount = shown.filter((r) => r.status === "done").length;

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto max-w-3xl px-5 pb-32 pt-28 sm:px-6 md:pt-32">
        <AnimatePresence mode="wait">
          {/* ───── 1. Bring your names ───── */}
          {step === "bring" && (
            <motion.section key="bring" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Eyebrow>Already have names?</Eyebrow>
              <h1 className="mt-4 font-display text-[2rem] font-light leading-[1.08] tracking-tight md:text-[2.8rem]">
                Forty replies, three good ones. <span className="italic">Let's find them.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                Bring whatever your neighbors sent you. We'll pull out every contractor, check their license and their
                permit history, and show you who's built a project like yours.
              </p>

              <div className="mt-10 space-y-6">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ClipboardPaste className="h-4 w-4 text-accent" /> Paste the thread
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">Nextdoor, Reddit, a WhatsApp group, texts. Messy is fine.</p>
                  <Textarea
                    ref={textRef}
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setNeedInput(false);
                    }}
                    placeholder={"\"We used Acme Builders for our kitchen, on time and on budget. 408-555-0199\"\n\"+1 for Acme. Also try Pacific Remodeling, Lic #1023456\""}
                    className="mt-3 min-h-[140px] resize-y text-[15px]"
                  />
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImagePlus className="h-4 w-4 text-accent" /> Or add screenshots
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">Up to {MAX_SHOTS}. Phone screenshots of the thread work best.</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      void addShots(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <div className="mt-3 flex flex-wrap gap-3">
                    {shots.map((s) => (
                      <div key={s.id} className="relative h-24 w-16 overflow-hidden rounded-lg border border-border">
                        <img src={s.preview} alt={s.name} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          aria-label={`Remove ${s.name}`}
                          onClick={() => setShots((xs) => xs.filter((x) => x.id !== s.id))}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {shots.length < MAX_SHOTS && (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex h-24 w-16 items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-secondary"
                        aria-label="Add screenshots"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                  <p className="text-sm font-medium">Or add someone by name</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">A license number makes the check much stronger, if you have it.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                    <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="Business or name" />
                    <Input value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} placeholder="Phone (optional)" inputMode="tel" />
                    <Input value={manualLicense} onChange={(e) => setManualLicense(e.target.value)} placeholder="License # (optional)" inputMode="numeric" />
                    <Button type="button" variant="outline" onClick={addManual} disabled={!manualName.trim()}>
                      Add
                    </Button>
                  </div>
                  {manual.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {manual.map((m) => (
                        <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-sm">
                          {m.name}
                          <button type="button" aria-label={`Remove ${m.name}`} onClick={() => setManual((xs) => xs.filter((x) => x.id !== m.id))}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <p className="text-sm font-medium">
                  What are you planning? <span className="font-normal text-muted-foreground">Optional</span>
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">It helps us spot who has built something like yours.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PROJECT_OPTIONS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={project === p.id}
                      onClick={() => setProject((cur) => (cur === p.id ? null : p.id))}
                      className={`rounded-full border px-4 py-2 text-sm transition-smooth ${
                        project === p.id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button size="lg" className="rounded-full px-7" disabled={extracting} onClick={findContractors}>
                  {extracting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading the replies…
                    </>
                  ) : (
                    <>
                      Find the contractors <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                {needInput && !hasInput && (
                  <p role="status" className="text-sm text-accent">
                    Paste a thread, add a screenshot, or type a name above.
                  </p>
                )}
              </div>
              <p className="mt-4 text-[13px] text-muted-foreground">
                We only read what you give us, and we don't contact anyone. You decide who hears from you.
              </p>
            </motion.section>
          )}

          {/* ───── 2. Is this right? ───── */}
          {step === "confirm" && (
            <motion.section key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Eyebrow>Here's who we found</Eyebrow>
              <h1 className="mt-4 font-display text-[1.9rem] font-light leading-tight tracking-tight md:text-[2.4rem]">
                {candidates.length} contractor{candidates.length === 1 ? "" : "s"}. Anything we got wrong?
              </h1>
              <p className="mt-4 max-w-xl text-muted-foreground">
                Fix a name, add a license number if you have one, or drop anyone you've already ruled out.
              </p>
              <ul className="mt-8 space-y-3">
                {candidates.map((c) => (
                  <li key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                    <div className="flex items-start gap-3">
                      <div className="grid flex-1 gap-2 sm:grid-cols-[1.5fr_1fr_1fr]">
                        <Input value={c.name} onChange={(e) => editCandidate(c.id, { name: e.target.value })} aria-label="Name" />
                        <Input value={c.phone ?? ""} onChange={(e) => editCandidate(c.id, { phone: e.target.value || null })} placeholder="Phone" aria-label="Phone" />
                        <Input
                          value={c.license_number ?? ""}
                          onChange={(e) => editCandidate(c.id, { license_number: e.target.value.replace(/\D/g, "") || null })}
                          placeholder="License #"
                          aria-label="License number"
                          inputMode="numeric"
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => setCandidates((cs) => cs.filter((x) => x.id !== c.id))}
                        className="mt-2 rounded-full p-1 text-muted-foreground hover:bg-secondary"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {c.mention_count > 0 && (c.mention_count > 1 || c.quotes.length > 0) && (
                      <p className="mt-2 text-[13px] text-muted-foreground">
                        Mentioned by {c.mention_count} {c.mention_count === 1 ? "person" : "people"}
                        {c.trade ? ` · ${c.trade}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" className="rounded-full px-7" onClick={checkThem} disabled={candidates.length === 0}>
                  Check {candidates.length === 1 ? "them" : `all ${candidates.length}`} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="ghost" className="rounded-full" onClick={() => setStep("bring")}>
                  Back
                </Button>
              </div>
            </motion.section>
          )}

          {/* ───── 3. Compare ───── */}
          {(step === "compare" || step === "request") && (
            <motion.section key="compare" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {step === "compare" && (
                <>
                  <Eyebrow>Your shortlist{project ? ` · ${opt.label}` : ""}</Eyebrow>
                  <h1 className="mt-4 font-display text-[1.9rem] font-light leading-tight tracking-tight md:text-[2.4rem]">
                    {running
                      ? `Checking ${shown.length - doneCount} of ${shown.length}…`
                      : top
                        ? <>Start with <span className="italic">{top.candidate.name}</span>.</>
                        : "Here's what the records show."}
                  </h1>
                  <p className="mt-4 max-w-xl text-muted-foreground">
                    {running
                      ? "Looking each one up with the state license board and San Jose's permit records."
                      : top
                        ? `${fitLine(top, opt?.word ?? "similar")}. Everyone's in order below, with the reasons.`
                        : "Not much on public record for these names yet. A license number is the fastest way to know more."}
                  </p>

                  <ul className="mt-8 space-y-4">
                    {shown.map((r, i) => (
                      <ResultCard
                        key={r.candidate.id}
                        rank={i + 1}
                        r={r}
                        projectWord={opt?.word ?? "similar"}
                        selected={selected.has(r.candidate.id)}
                        onToggle={() => toggle(r.candidate.id)}
                        onReject={() => {
                          setRejected((s) => new Set(s).add(r.candidate.id));
                          track("shortlist_match_rejected", {});
                        }}
                      />
                    ))}
                  </ul>

                  <div className="mt-8 flex flex-wrap gap-3 text-sm">
                    <button type="button" onClick={startOver} className="text-muted-foreground underline-offset-4 hover:underline">
                      Start a new shortlist
                    </button>
                  </div>
                  <p className="mt-6 text-[12px] leading-relaxed text-muted-foreground">
                    Haleo doesn't vet, endorse or rate contractors. We show what the public record says: the CSLB license
                    file and permits filed with the City of San Jose. Neighbors' comments are their words, shown as written.
                  </p>
                </>
              )}

              {step === "request" && (
                <RequestBids
                  chosen={chosen}
                  hasBrief={hasBrief}
                  messages={messages}
                  sentIds={sentIds}
                  onEdit={(id, m) => setMessages((ms) => ({ ...ms, [id]: m }))}
                  onSent={markSent}
                  onBack={() => setStep("compare")}
                  onBuildBrief={() => {
                    track("shortlist_brief_started", {});
                    navigate("/brief");
                  }}
                  projectWord={opt?.word ?? "project"}
                />
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Sticky action while comparing */}
      {step === "compare" && !running && shown.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
          <div className="container mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
            <p className="text-sm text-muted-foreground">
              {selected.size === 0 ? "Pick two or three to ask for a bid." : `${selected.size} picked`}
            </p>
            <Button className="rounded-full px-6" disabled={selected.size === 0} onClick={goRequest}>
              Request bids <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </main>
  );
};

// ───── One contractor ─────

const ResultCard = ({
  rank,
  r,
  projectWord,
  selected,
  onToggle,
  onReject,
}: {
  rank: number;
  r: CheckedCandidate;
  projectWord: string;
  selected: boolean;
  onToggle: () => void;
  onReject: () => void;
}) => {
  const c = r.candidate;
  if (r.status === "checking") {
    return (
      <li className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="font-display text-lg">{c.name}</p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Checking the license board and city permits…</p>
      </li>
    );
  }
  const flag = redFlag(r);
  const state = licenseState(r.license);
  const neighbors = neighborRead(c);
  const tier = r.score ? trustTier(r.score.total, !!(r.license?.scrape_succeeded && r.license.has_disciplinary_action)) : null;
  const checks = r.score ? trustChecks(r.score) : null;
  const latest = r.permits.find((p) => p.issued_date);
  const license = r.license?.license_number ?? c.license_number;

  return (
    <li className={`rounded-2xl border bg-card p-5 shadow-soft transition-smooth ${selected ? "border-foreground" : "border-border"}`}>
      <div className="flex items-start gap-4">
        <span className="mt-1 font-display text-sm text-muted-foreground">{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-xl leading-tight">{c.name}</p>
            {tier && !flag && <span className={`rounded-full border px-2.5 py-0.5 text-[12px] ${tierChipClass(tier.tone)}`}>{tier.label}</span>}
          </div>
          <p className={`mt-1 text-[14px] ${flag ? "text-destructive" : "text-muted-foreground"}`}>{fitLine(r, projectWord)}</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
          <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Ask ${c.name} for a bid`} />
          <span className="hidden sm:inline">Ask for a bid</span>
        </label>
      </div>

      <dl className="mt-5 space-y-3 border-t border-border pt-4 text-[14px]">
        {/* License */}
        <div className="flex gap-3">
          {state === "active" || state === "expiring" ? (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
          ) : state === "not_checked" ? (
            <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <div>
            <dt className="font-medium">
              License
              <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Public record</span>
            </dt>
            <dd className="mt-0.5 text-muted-foreground">
              {state === "active" && <>Active with CSLB{r.license?.business_name ? ` as ${r.license.business_name}` : ""}. </>}
              {state === "expiring" && <>Active, but it expires within 90 days. </>}
              {state === "expired" && <>Expired on the CSLB record. </>}
              {state === "suspended" && <>Not active on the CSLB record. </>}
              {state === "not_checked" && (
                <>
                  {license ? "We couldn't reach the license board for this one. " : "We don't have a license number yet. "}
                  Ask them for it: a licensed contractor can give it to you in seconds.{" "}
                </>
              )}
              {(state === "active" || state === "expiring") && (
                <>
                  {r.license?.workers_comp_status ? `Workers' comp: ${r.license.workers_comp_status}. ` : ""}
                  {r.license?.bond_status ? `Bond: ${r.license.bond_status}.` : ""}
                </>
              )}
              <a
                href={license ? cslbDeepLink(license) : CSLB_NAME_SEARCH}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
              >
                {license ? "See it on CSLB" : "Search CSLB by name"} <ExternalLink className="h-3 w-3" />
              </a>
            </dd>
          </div>
        </div>

        {/* Permits */}
        <div className="flex gap-3">
          <span className="mt-0.5 h-4 w-4 shrink-0 text-center text-[13px] text-muted-foreground">§</span>
          <div>
            <dt className="font-medium">
              San Jose permits
              <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Public record</span>
            </dt>
            <dd className="mt-0.5 text-muted-foreground">
              {r.contractor ? (
                <>
                  {r.permits.length} on file, {r.likeYours} like your {projectWord === "similar" ? "" : `${projectWord} `}project
                  {latest?.issued_date ? `. Most recent ${new Date(latest.issued_date).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}
                  .{" "}
                  <span className="text-[13px]">
                    Matched to “{r.contractor.company ?? r.contractor.name}”.{" "}
                    <button type="button" onClick={onReject} className="text-foreground underline-offset-4 hover:underline">
                      Not them?
                    </button>
                  </span>
                </>
              ) : (
                <>No San Jose permits we could tie to this name. That's common for newer or out-of-city businesses, and it isn't a judgment.</>
              )}
            </dd>
          </div>
        </div>

        {checks && checks.total > 0 && (
          <p className="pl-7 text-[13px] text-muted-foreground">
            {checks.passed} of {checks.total} public records line up
            {/* The tier blurbs assume a checked, clean license. Only use them when that's true. */}
            {tier && !flag && (state === "active" || state === "expiring") ? `. ${tier.blurb}` : state === "not_checked" ? ". Permit record only, license not checked yet." : "."}
          </p>
        )}

        {/* Neighbors */}
        {c.quotes.length > 0 && (
          <div className="flex gap-3">
            <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="font-medium">
                What neighbors said
                <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Their words</span>
              </dt>
              <dd className="mt-1 space-y-1.5">
                {c.quotes.slice(0, 3).map((q) => (
                  <p key={q.text} className="flex gap-2 text-muted-foreground">
                    <span
                      aria-label={q.sentiment}
                      className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                        q.sentiment === "positive" ? "bg-sage" : q.sentiment === "negative" ? "bg-destructive" : "bg-amber-400"
                      }`}
                    />
                    <span className="italic">“{q.text}”</span>
                  </p>
                ))}
                {c.mention_count > 1 && (
                  <p className="text-[13px] text-muted-foreground">
                    {c.mention_count} people mentioned them
                    {neighbors.negative > 0 ? `, ${neighbors.negative} with a concern` : ""}.
                  </p>
                )}
              </dd>
            </div>
          </div>
        )}

        {(c.phone || c.email) && (
          <p className="pl-7 text-[13px] text-muted-foreground">
            {[formatPhone(c.phone), c.email].filter(Boolean).join(" · ")}
          </p>
        )}
      </dl>
    </li>
  );
};

// ───── Step 4: ask for bids ─────

const RequestBids = ({
  chosen,
  hasBrief,
  messages,
  sentIds,
  onEdit,
  onSent,
  onBack,
  onBuildBrief,
  projectWord,
}: {
  chosen: CheckedCandidate[];
  hasBrief: boolean;
  messages: Record<string, string>;
  sentIds: Set<string>;
  onEdit: (id: string, m: string) => void;
  onSent: (id: string, via: "text" | "email" | "copy") => void;
  onBack: () => void;
  onBuildBrief: () => void;
  projectWord: string;
}) => {
  const allSent = chosen.length > 0 && chosen.every((r) => sentIds.has(r.candidate.id));
  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(messages[id] ?? "");
      onSent(id, "copy");
      toast({ title: "Copied", description: "Paste it wherever you talk to them." });
    } catch {
      toast({ title: "Couldn't copy", description: "Select the text and copy it yourself." });
    }
  };

  return (
    <div>
      <Eyebrow>Request bids</Eyebrow>
      <h1 className="mt-4 font-display text-[1.9rem] font-light leading-tight tracking-tight md:text-[2.4rem]">
        Explain it once. <span className="italic">Send it to all of them.</span>
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Each message comes from you, by text or email, so they reply to you directly. Every one asks for the same
        things, which is what makes the bids comparable later.
      </p>

      {!hasBrief && (
        <div className="mt-8 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <p className="font-medium">Want sharper bids?</p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Contractors quote the same {projectWord} job very differently when the scope is vague. Describe it once,
            in about four minutes, and we'll put the scope in every request. Your shortlist stays right here.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button className="rounded-full" onClick={onBuildBrief}>
              Describe my project <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <span className="self-center text-sm text-muted-foreground">or send the short version below</span>
          </div>
        </div>
      )}

      <ul className="mt-8 space-y-5">
        {chosen.map((r) => {
          const c = r.candidate;
          const body = messages[c.id] ?? "";
          const sms = c.phone ? smsHref(c.phone, body) : null;
          const sent = sentIds.has(c.id);
          return (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-lg">{c.name}</p>
                {sent && (
                  <span className="inline-flex items-center gap-1 text-sm text-sage">
                    <Check className="h-4 w-4" /> Sent
                  </span>
                )}
              </div>
              <Textarea value={body} onChange={(e) => onEdit(c.id, e.target.value)} className="mt-3 min-h-[220px] text-[14px] leading-relaxed" />
              <div className="mt-3 flex flex-wrap gap-2">
                {sms && (
                  <Button asChild variant="outline" className="rounded-full" onClick={() => onSent(c.id, "text")}>
                    <a href={sms}>
                      <MessageSquare className="mr-2 h-4 w-4" /> Text {formatPhone(c.phone)}
                    </a>
                  </Button>
                )}
                {c.email && (
                  <Button asChild variant="outline" className="rounded-full" onClick={() => onSent(c.id, "email")}>
                    <a href={mailtoHref(c.email, `Bid request: ${projectWord} project`, body)}>
                      <Mail className="mr-2 h-4 w-4" /> Email
                    </a>
                  </Button>
                )}
                <Button variant="outline" className="rounded-full" onClick={() => void copy(c.id)}>
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
              </div>
              {!c.phone && !c.email && (
                <p className="mt-2 text-[13px] text-muted-foreground">No number in what you shared. Copy it and send it wherever you found them.</p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-10 rounded-2xl border border-border bg-secondary/40 p-5">
        <p className="font-medium">{allSent ? "Sent. Now the part most people dread." : "When the bids come back"}</p>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Drop them in and we'll read every line: what's included, what's missing, and whether the price is fair for
          your neighborhood. Bids written against the same scope compare cleanly.
        </p>
        <Button asChild variant="outline" className="mt-4 rounded-full">
          <Link to="/proposal">
            Check a bid <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <button type="button" onClick={onBack} className="mt-6 text-sm text-muted-foreground underline-offset-4 hover:underline">
        Back to the shortlist
      </button>
    </div>
  );
};

export default Shortlist;
