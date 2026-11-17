// Contractor Discovery — surfaces real San Jose contractors who pulled
// permits matching the homeowner's project type, ranked by how their record lines up with this job (src/lib/jobFit.ts).
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Check,
  Send, X, Info, Sparkles, AlertCircle, Paperclip,
  CheckCircle2, FileText, Clock, Wallet, Home, ChevronDown,
} from "lucide-react";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useIntake, type IntakeData } from "@/lib/intake";
import { useJobFit } from "@/lib/useJobFit";
import JobFitBreakdown from "@/components/contractors/JobFitBreakdown";
import { useContractors, type RankedContractor } from "@/lib/useContractors";
import { loadParcelFacts } from "@/lib/parcelFacts";
import { projectTypeLabel, buildBriefSnapshot, getSessionId, type BriefSnapshot } from "@/lib/contractors";
import { declaredCost, groupContractors, money, nearbyCount, nearbyLine, permitLight } from "@/lib/contractorGroups";
import { workFor } from "@/lib/recordHighlights";
import { clearPicks, readPicks, savePicks } from "@/lib/picks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";

const ContractorCard = ({
  rc, selected, onToggle, data, live, reason,
}: {
  rc: RankedContractor;
  selected: boolean;
  onToggle: () => void;
  data: IntakeData;
  /** Why they're in this group, in one plain line. */
  reason?: string | null;
  /** Fetch the city's inspection sign-offs for this card (the first few on screen). */
  live: boolean;
}) => {
  const navigate = useNavigate();
  const { contractor, license } = rc;
  const name = contractor.company ?? contractor.name;
  const fit = useJobFit(contractor.id, rc.permits, data, license, live);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative overflow-hidden rounded-3xl border bg-card p-6 shadow-soft transition-smooth ${
        selected ? "border-accent shadow-accent" : "border-border hover:-translate-y-0.5 hover:shadow-lift"
      }`}
    >
      {selected && (
        <div className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground shadow-soft">
          <Check className="h-4 w-4" />
        </div>
      )}
      <h3 className="pr-8 font-display text-lg font-medium leading-tight text-foreground">{name}</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {contractor.specialty ?? "General"} · {contractor.city ?? "San Jose"}
      </p>
      {reason && <p className="mt-2 text-[14px] leading-snug text-foreground">{reason}</p>}

      <JobFitBreakdown fit={fit} who={name} className="mt-4" surface="discovery" />

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => navigate(`/contractors/${contractor.id}`)}
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          See every permit →
        </button>
        <Button size="sm" variant={selected ? "default" : "outline"} onClick={onToggle} className="rounded-full">
          {selected ? <><Check className="h-3.5 w-3.5" /> Asking them</> : "Ask if they're interested"}
        </Button>
      </div>
    </motion.div>
  );
};

// ───── Phased loading, while we read the records ─────
const LOADING_PHASES = [
  { label: "Reading San José permit records…", ms: 900 },
  { label: "Cross-checking CSLB license files…", ms: 900 },
  { label: "Reading the city's inspection sign-offs…", ms: 900 },
  { label: "Lining each record up with your job…", ms: 700 },
];

const MatchingProgress = ({ note }: { note?: string | null }) => {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (phase >= LOADING_PHASES.length - 1) return;
    const t = setTimeout(() => setPhase(p => p + 1), LOADING_PHASES[phase].ms);
    return () => clearTimeout(t);
  }, [phase]);
  const pct = Math.round(((phase + 1) / LOADING_PHASES.length) * 100);
  return (
    <div className="mt-10 rounded-3xl border border-border bg-card p-6 shadow-soft md:p-8">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-amber-600" />
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">Reading the records</p>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-400 to-accent"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <ul className="mt-5 space-y-2.5">
        {LOADING_PHASES.map((p, i) => {
          const done = i < phase;
          const active = i === phase;
          return (
            <motion.li
              key={p.label}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: i <= phase ? 1 : 0.35, x: 0 }}
              className="flex items-center gap-2.5 text-sm"
            >
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                done ? "border-sage/40 bg-sage/15 text-sage" :
                active ? "border-accent/40 bg-accent/10 text-accent" :
                "border-border bg-secondary/50 text-muted-foreground"
              }`}>
                {done ? <Check className="h-3 w-3" /> : active ? <Sparkles className="h-3 w-3 animate-pulse" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />}
              </span>
              <span className={done ? "text-foreground/75" : active ? "font-medium text-foreground" : "text-muted-foreground"}>
                {p.label}
              </span>
            </motion.li>
          );
        })}
      </ul>
      {note && <p className="mt-4 text-[11px] italic text-muted-foreground">{note}</p>}
    </div>
  );
};

const MIN_REVEAL_MS = 3200;

const Contractors = () => {
  const { user: authUser } = useAuth();
  const { data } = useIntake();
  const navigate = useNavigate();
  const location = useLocation();
  const { status, ranked, backfillNote, error, areaPermits, keywords } = useContractors(data);
  const projectLabel = projectTypeLabel(data);
  const neighborhood = data.address?.city || "your area";
  const zip = data.address?.zip || "your zip";

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState<{ count: number; names: string[] } | null>(null);
  const [showAll, setShowAll] = useState(false);
  // For someone not signed in: how contractors can reach them.
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [contactNudge, setContactNudge] = useState(false);

  // Auto-scroll to top on landing — homeowners shouldn't see brief footer first.
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, []);

  // Guarantee a minimum "magic moment" before revealing matches.
  const [mountedAt] = useState(() => Date.now());
  const [revealReady, setRevealReady] = useState(false);
  useEffect(() => {
    if (status !== "ready") return;
    const elapsed = Date.now() - mountedAt;
    const wait = Math.max(0, MIN_REVEAL_MS - elapsed);
    const t = setTimeout(() => setRevealReady(true), wait);
    return () => clearTimeout(t);
  }, [status, mountedAt]);

  // Fire contractors_viewed once results are revealed.
  const viewedFired = useRef(false);
  useEffect(() => {
    if (status !== "ready" || viewedFired.current) return;
    viewedFired.current = true;
    track("contractors_viewed", { count: ranked.length, project_type: projectLabel });
  }, [status, ranked.length, projectLabel]);
  const showLoader = status === "loading" || (status === "ready" && !revealReady);

  // Two kinds of evidence, never one leaderboard (src/lib/contractorGroups.ts).
  const light = permitLight(data);
  const homeZip = /^\d{5}$/.test(data.address?.zip ?? "") ? data.address!.zip! : null;
  const groups = useMemo(
    () => groupContractors(ranked.map((r) => ({ ...r, id: r.contractor.id })), homeZip, { permitLight: light }),
    [ranked, homeZip, light],
  );
  const work = workFor(data)?.word ?? projectLabel;
  const cost = useMemo(() => (light ? null : declaredCost(areaPermits, keywords)), [areaPermits, keywords, light]);
  // The brief is done once they've picked a timeline (its last step).
  const hasBrief = !!data.timeline;

  const selectedList = useMemo(
    () => ranked.filter(r => selected.has(r.contractor.id)),
    [ranked, selected]
  );

  // Build the high-level brief summary that goes into the email
  const homeownerName = (authUser?.user_metadata?.full_name as string | undefined)
    ?? (authUser?.email ? authUser.email.split("@")[0] : undefined);
  const briefSummary = useMemo(
    () => ({
      ...buildBriefSnapshot(data, homeownerName),
      projectType: projectLabel,
    }),
    [data, homeownerName, projectLabel]
  );

  // Honor pre-selection coming from a contractor profile "Send project brief" CTA.
  const navState = location.state as { preselectId?: string; openOutreach?: boolean } | null;
  useEffect(() => {
    if (!navState?.preselectId) return;
    if (status !== "ready") return;
    const exists = ranked.some(r => r.contractor.id === navState.preselectId);
    if (!exists) return;
    setSelected(prev => {
      if (prev.has(navState.preselectId!)) return prev;
      const next = new Set(prev);
      next.add(navState.preselectId!);
      return next;
    });
    if (navState.openOutreach) setOutreachOpen(true);
    // Clear nav state so back/forward doesn't re-trigger.
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, ranked, navState?.preselectId]);

  // Back from the brief with contractors they'd already picked: ready to send.
  const picksDone = useRef(false);
  useEffect(() => {
    if (picksDone.current || status !== "ready" || !hasBrief) return;
    const picks = readPicks().filter((p) => ranked.some((r) => r.contractor.id === p.id));
    if (picks.length === 0) return;
    picksDone.current = true;
    clearPicks();
    setSelected(new Set(picks.map((p) => p.id)));
    setOutreachOpen(true);
  }, [status, hasBrief, ranked]);

  // "Ask if they're interested": with a brief, send it; without one, a few
  // details first, framed as what these contractors need to answer.
  const askInterested = () => {
    const picks = selectedList.map((r) => ({ id: r.contractor.id, name: r.contractor.company ?? r.contractor.name }));
    // No sign-in wall: sending starts a guest session if they don't have one.
    if (hasBrief) return setOutreachOpen(true);
    savePicks(picks);
    track("match_interest_requested", { count: selectedList.length, has_brief: false });
    navigate("/brief");
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendBrief = async () => {
    if (selectedList.length === 0) return;
    // Contractors need a way to reply: a phone or an email, from whoever isn't signed in with one.
    const phone = guestPhone.trim();
    const email = guestEmail.trim();
    if (!authUser?.email && !phone && !/^\S+@\S+\.\S+$/.test(email)) {
      setContactNudge(true);
      return;
    }
    setSending(true);
    try {
      const sessionId = getSessionId();
      // No account needed: a guest session (anonymous sign-in) owns this request.
      let ownerId = authUser?.id ?? null;
      if (!ownerId) {
        const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
        if (anonErr || !anon.user) throw anonErr ?? new Error("Couldn't start a guest session");
        ownerId = anon.user.id;
      }

      // Pull cached address risk so contractors see the same hazard signals
      // the homeowner saw on their brief. Best-effort — never block the send.
      let addressRisk: NonNullable<BriefSnapshot["address_risk"]> | undefined;
      const addr = data.address;
      if (addr && !addr.skipped && addr.street && addr.city) {
        const key = [addr.street, addr.city, addr.state, addr.zip]
          .map((s) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " "))
          .join("|");
        try {
          const { data: risk } = await supabase
            .from("address_risk_signals")
            .select("fire_hazard_class, fire_hazard_zone, flood_zone, flood_zone_description, in_special_flood_hazard_area, seismic_hazard_type, seismic_hazard_zone")
            .eq("address_key", key)
            .maybeSingle();
          if (risk && (risk.fire_hazard_class || risk.flood_zone || risk.seismic_hazard_type)) {
            addressRisk = risk;
          }
        } catch (e) {
          console.warn("address risk lookup for snapshot failed", e);
        }
      }

      const parcel = await loadParcelFacts(data.address);
      const snapshot = {
        ...briefSummary,
        ...(addressRisk ? { address_risk: addressRisk } : {}),
        ...(parcel ? { parcel } : {}),
        ...(phone ? { homeowner_phone: phone } : {}),
      };
      const { data: batch, error: bErr } = await supabase
        .from("outreach_batches")
        .insert({
          session_id: sessionId,
          neighborhood,
          brief_snapshot: snapshot,
          recipient_count: selectedList.length,
          homeowner_user_id: ownerId,
          homeowner_name: guestName.trim() || homeownerName || null,
          homeowner_email: authUser?.email ?? (email || null),
        })
        .select("id")
        .single();
      if (bErr || !batch) throw bErr ?? new Error("Failed to create batch");

      const sends = selectedList.map(rc => ({
        batch_id: batch.id,
        contractor_id: rc.contractor.id,
        contractor_name: rc.contractor.company ?? rc.contractor.name,
        contractor_email: rc.contractor.email,
        personal_note: notes[rc.contractor.id] ?? null,
        status: "sent",
        is_simulated: true,
        sent_at: new Date().toISOString(),
      }));
      const { data: insertedSends, error: sErr } = await supabase
        .from("outreach_sends")
        .insert(sends)
        .select("id, contractor_id");
      if (sErr) throw sErr;

      // Fan out notifications (in-app + push + SMS stub) per recipient.
      // Fire-and-forget — don't block the success state on this.
      if (insertedSends?.length) {
        Promise.all(
          insertedSends.map((s) =>
            supabase.functions.invoke("notify-contractor-brief", {
              body: { outreach_send_id: s.id },
            })
          )
        ).catch((err) => console.error("notify fan-out failed", err));
      }

      // Log a homeowner-side notification so they see the brief left their hands.
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("homeowner_notifications").insert({
          user_id: user.id,
          type: "brief_sent",
          title: `Brief sent to ${selectedList.length} contractor${selectedList.length === 1 ? "" : "s"}`,
          body: `We'll let you know the moment one opens it.`,
        });
      }

      const names = selectedList.map(rc => rc.contractor.company ?? rc.contractor.name);
      setSentInfo({ count: selectedList.length, names });

      track("contractor_invited", {
        batch_id: batch.id,
        recipient_count: selectedList.length,
        neighborhood,
        has_personal_notes: Object.values(notes).some((n) => !!n?.trim()),
      });

      toast({
        title: "Brief sent ✨",
        description: `Delivered to ${selectedList.length} contractor${selectedList.length === 1 ? "" : "s"}. We'll notify you when they respond.`,
      });
      setSelected(new Set());
      setNotes({});
      // Keep modal open to show success state — user closes it
    } catch (e) {
      track("error_edge_function", {
        where: "outreach_send",
        message: e instanceof Error ? e.message : String(e),
      });
      toast({
        title: "Couldn't send brief",
        description: e instanceof Error ? e.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const closeOutreach = () => {
    setOutreachOpen(false);
    setSentInfo(null);
  };

  return (
    <div className="min-h-screen bg-gradient-warm pb-32">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            {authUser && (
              <NotificationBell table="homeowner_notifications" filter={{ column: "user_id", value: authUser.id }} />
            )}
            <Link to={hasBrief ? "/brief/result" : "/"} className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> {hasBrief ? "Back to brief" : "Home"}
            </Link>
          </div>
        </div>
      </header>

      <main className="container max-w-3xl py-7 md:py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {homeZip ? `Your ${projectLabel} · ${homeZip}` : `Your ${projectLabel}`}
          </p>
          <h1 className="mt-3 font-display text-2xl font-light leading-tight md:text-3xl text-balance">
            Contractors with relevant experience, <span className="italic">and why they're worth a call.</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            From San Jose's permit records. Pick the ones you'd like to hear from, and we'll ask if they're interested in your
            project. You stay in charge of who gets your details.
          </p>
        </motion.div>

        {/* Status states */}
        {showLoader && <MatchingProgress note={backfillNote} />}
        {status === "error" && (
          <div className="mt-8 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {status === "ready" && revealReady && ranked.length === 0 && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            We couldn't find San Jose permit records for {projectLabel} work{homeZip ? ` near ${homeZip}` : ""} yet. {backfillNote}
          </div>
        )}

        {status === "ready" && revealReady && ranked.length > 0 && (
          <>
            {/* The quick read: what similar jobs declared nearby */}
            {cost && (
              <div className="mt-8 rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">What similar jobs declared nearby</p>
                <p className="mt-2 font-display text-[28px] leading-none tracking-tight">
                  {money(cost.low)} – {money(cost.high)}
                </p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
                  The middle half of {cost.n} {work}-related permits filed in {homeZip} in the last three years. That's what was
                  declared to the city, usually below the final price, so treat it as a floor, not a quote.
                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Public record</span>
                </p>
              </div>
            )}

            {light && (
              <div className="mt-6 rounded-2xl border border-accent/30 bg-accent/5 p-4 text-[14px] leading-relaxed">
                <p className="font-medium">Jobs like this often don't need a permit.</p>
                <p className="mt-1 text-muted-foreground">
                  So the city's records can't show who has done them. We've put contractors who've worked in your neighborhood
                  first. Ask each one for photos of a similar job they finished.
                </p>
              </div>
            )}

            {(light
              ? [
                  { id: "neighborhood", items: groups.neighborhood },
                  { id: "experienced", items: groups.experienced },
                ]
              : [
                  { id: "experienced", items: groups.experienced },
                  { id: "neighborhood", items: groups.neighborhood },
                ]
            )
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <section key={g.id} className="mt-10">
                  <h2 className="font-display text-xl font-light md:text-2xl">
                    {g.id === "experienced"
                      ? light
                        ? "Most permitted work in San Jose"
                        : <>Most permits for jobs <span className="italic">like yours</span></>
                      : <>Others who've worked <span className="italic">in your neighborhood</span></>}
                  </h2>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
                    {g.id === "experienced"
                      ? light
                        ? "Licensed contractors associated with the most permit records in the city. A strong record, not a guarantee."
                        : `Associated with the most ${work}-related permit records in San Jose. A strong record, not a guarantee: ask to see similar work.`
                      : `Fewer permits on record, but they've had permitted jobs in ${homeZip}. Often smaller teams, and close by.`}
                  </p>
                  <div className="mt-5 grid gap-4">
                    {g.items.map((rc) => (
                      <ContractorCard
                        key={rc.contractor.id}
                        rc={rc}
                        selected={selected.has(rc.contractor.id)}
                        onToggle={() => toggle(rc.contractor.id)}
                        data={data}
                        live
                        reason={
                          g.id === "experienced"
                            ? light
                              ? `Associated with ${rc.permits.length} permit record${rc.permits.length === 1 ? "" : "s"} in San Jose`
                              : `Associated with ${rc.matchCount} ${work}-related permit record${rc.matchCount === 1 ? "" : "s"}${homeZip && nearbyCount(rc, homeZip) ? `, ${nearbyCount(rc, homeZip)} in ${homeZip}` : ""}`
                            : homeZip
                              ? `Permitted work near you: ${nearbyLine(rc, homeZip) ?? homeZip}`
                              : null
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}

            {groups.rest.length > 0 && !showAll && (
              <button
                type="button"
                onClick={() => {
                  setShowAll(true);
                  track("contractors_compared", { unlocked_more: true, visible_count: groups.experienced.length + groups.neighborhood.length });
                }}
                className="mt-8 w-full rounded-2xl border border-dashed border-border px-5 py-4 text-left text-[15px] transition-smooth hover:bg-secondary/50"
              >
                See everyone else we found ({groups.rest.length})
                <span className="block text-[13px] text-muted-foreground">Same records, same five questions. Fewer matches with your job.</span>
              </button>
            )}
            {showAll && groups.rest.length > 0 && (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {groups.rest.map((rc, i) => (
                  <ContractorCard
                    key={rc.contractor.id}
                    rc={rc}
                    selected={selected.has(rc.contractor.id)}
                    onToggle={() => toggle(rc.contractor.id)}
                    data={data}
                    live={i < 6}
                  />
                ))}
              </div>
            )}
          </>
        )}
        <div className="mt-12 rounded-3xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 text-accent" />
            <div>
              <p className="font-display text-lg font-medium">How we read each record</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Haleo doesn't vet, endorse or rate contractors. For each one we answer five questions about your job from
                public records: San Jose permits, the city's inspection sign-offs and the state license board. No paid
                placements, no stars, no score.
              </p>
              <ol className="mt-4 grid gap-2 text-sm md:grid-cols-5">
                {["Have they done this kind of job?", "Do they work near you?", "Are they active lately?", "Does their work pass inspection?", "Is their license active?"].map((q, i) => (
                  <li key={q} className="rounded-xl border border-border bg-secondary/40 p-3">
                    <p className="text-[11px] text-muted-foreground">{i + 1}</p>
                    <p className="text-xs font-medium text-foreground">{q}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-muted-foreground">
                Anything we couldn't check reads "Not checked", never a pass. Tap a contractor to see every permit behind the answers. You make the call.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Selection bar */}
      {selected.size > 0 && !outreachOpen && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 shadow-lift backdrop-blur"
        >
          <div className="container flex max-w-6xl items-center justify-between gap-4 py-4">
            <div>
              <p className="font-display text-base font-medium">
                Ask {selected.size} contractor{selected.size === 1 ? "" : "s"} if they're interested
              </p>
              <p className="text-xs text-muted-foreground">
                {hasBrief ? "They'll get your brief and can say whether it's a fit." : "Next: a few details so they can tell you whether it's a fit. About 3 minutes."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setSelected(new Set())} className="rounded-full">Clear</Button>
              <Button onClick={askInterested} className="rounded-full">
                <Send className="h-4 w-4" /> {hasBrief ? "Ask them" : "Continue"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Outreach drawer (inline, simple) */}
      {outreachOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/60 p-4 backdrop-blur"
          onClick={() => !sending && closeOutreach()}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={e => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-card p-6 shadow-lift md:p-8"
          >
            {sentInfo ? (
              // ───── Success state ─────
              <div className="py-4 text-center">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-sage/20 text-sage"
                >
                  <CheckCircle2 className="h-8 w-8" />
                </motion.div>
                <h2 className="mt-5 font-display text-2xl font-light">Your brief is on its way</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Delivered to <strong className="text-foreground">{sentInfo.count} contractor{sentInfo.count === 1 ? "" : "s"}</strong> with your full project brief attached.
                </p>
                <div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-background p-4 text-left">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sent to</p>
                  <ul className="mt-2 space-y-1.5">
                    {sentInfo.names.map((n, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                        <Check className="h-3.5 w-3.5 text-sage" /> {n}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-5 text-xs text-muted-foreground">
                  We'll notify you the moment a contractor opens or replies.
                </p>
                <div className="mt-6 flex justify-center gap-2">
                  <Button variant="ghost" onClick={closeOutreach} className="rounded-full">Keep browsing</Button>
                  <Button onClick={() => navigate("/brief/result")} className="rounded-full">Back to brief</Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Project brief preview</p>
                    <h2 className="mt-2 font-display text-2xl font-light">Sending to {selectedList.length} contractor{selectedList.length === 1 ? "" : "s"}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">This is exactly what each contractor will receive.</p>
                  </div>
                  <button onClick={closeOutreach} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>

                {/* Email-style preview */}
                <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-background">
                  {/* Subject line */}
                  <div className="border-b border-border px-5 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Subject</p>
                    <p className="mt-0.5 font-display text-sm font-medium text-foreground">
                      New {projectLabel} project in {neighborhood} — homeowner via Haleo
                    </p>
                  </div>

                  {/* Email body */}
                  <div className="space-y-4 px-5 py-5 text-sm text-foreground/85">
                    <p>Hi —</p>
                    <p>
                      I found you through Haleo: your permit records include {projectLabel} work in San Jose. I'm planning
                      the project below and would love to know if it's a fit for you.
                    </p>

                    {/* High-level project summary chips */}
                    <div className="rounded-xl border border-border/70 bg-secondary/40 p-4">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Project at a glance</p>
                      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        <div className="flex items-start gap-2">
                          <Home className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Project</p>
                            <p className="text-sm font-medium text-foreground">{projectLabel}{briefSummary.scope_label ? ` · ${briefSummary.scope_label}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                          <div>
                            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Location</p>
                            <p className="text-sm font-medium text-foreground">{neighborhood}{zip !== "your zip" ? ` · ${zip}` : ""}</p>
                          </div>
                        </div>
                        {briefSummary.timeline && (
                          <div className="flex items-start gap-2">
                            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Timeline</p>
                              <p className="text-sm font-medium text-foreground">{briefSummary.timeline}</p>
                            </div>
                          </div>
                        )}
                        {briefSummary.budget && (
                          <div className="flex items-start gap-2">
                            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                            <div>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Budget</p>
                              <p className="text-sm font-medium text-foreground">{briefSummary.budget}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vision */}
                    {briefSummary.vision && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">My vision</p>
                        <p className="mt-1 text-sm italic text-foreground/80">"{briefSummary.vision}"</p>
                      </div>
                    )}

                    {/* What I want solved */}
                    {briefSummary.frustrations.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">What I want solved</p>
                        <ul className="mt-1.5 space-y-1">
                          {briefSummary.frustrations.slice(0, 5).map((f, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-sm">
                              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                              <span className="text-foreground/80">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Scope highlights from contractor layer */}
                    {briefSummary.trade_groups.length > 0 && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Scope highlights</p>
                        <ul className="mt-1.5 space-y-1">
                          {briefSummary.trade_groups.slice(0, 3).map((g, i) => (
                            <li key={i} className="text-sm text-foreground/80">
                              <strong className="font-medium text-foreground">{g.trade}:</strong> {g.lines.slice(0, 2).join("; ")}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Attachment — clickable, opens full brief */}
                    {(() => {
                      const photos = data.media.filter(m => m.kind === "photo" || m.kind === "inspiration");
                      const videos = data.media.filter(m => m.kind === "video");
                      const plans = data.media.filter(m => m.kind === "floorplan");
                      const totalMedia = data.media.length;
                      return (
                        <a
                          href="/brief/result"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block rounded-xl border border-accent/40 bg-accent-soft/40 p-3 transition-smooth hover:border-accent hover:bg-accent-soft/70 hover:shadow-soft"
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  Haleo_Project_Brief.pdf
                                </p>
                                <span className="text-[10px] uppercase tracking-wider text-accent opacity-0 transition-smooth group-hover:opacity-100">
                                  Open ↗
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                Scope, must-haves, dimensions, inspiration & trade-by-trade requirements
                                {totalMedia > 0 && (
                                  <>
                                    {" · "}
                                    {photos.length > 0 && <>{photos.length} photo{photos.length > 1 ? "s" : ""}</>}
                                    {photos.length > 0 && (videos.length > 0 || plans.length > 0) && ", "}
                                    {videos.length > 0 && <>{videos.length} video{videos.length > 1 ? "s" : ""}</>}
                                    {videos.length > 0 && plans.length > 0 && ", "}
                                    {plans.length > 0 && <>{plans.length} floor plan{plans.length > 1 ? "s" : ""}</>}
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          {totalMedia > 0 && (
                            <div className="mt-3 flex gap-1.5 overflow-x-auto">
                              {data.media.slice(0, 8).map(m => (
                                <div
                                  key={m.id}
                                  className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-card"
                                  title={m.name}
                                >
                                  {(m.kind === "photo" || m.kind === "inspiration") && m.url ? (
                                    <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
                                  ) : m.kind === "video" ? (
                                    <div className="flex h-full w-full flex-col items-center justify-center bg-foreground/90 text-background">
                                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                      <span className="mt-0.5 text-[8px] uppercase tracking-wider">Video</span>
                                    </div>
                                  ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center bg-secondary text-foreground/70">
                                      <Paperclip className="h-3 w-3" />
                                      <span className="mt-0.5 text-[8px] uppercase tracking-wider">Plan</span>
                                    </div>
                                  )}
                                </div>
                              ))}
                              {totalMedia > 8 && (
                                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-card text-xs font-medium text-muted-foreground">
                                  +{totalMedia - 8}
                                </div>
                              )}
                            </div>
                          )}
                        </a>
                      );
                    })()}

                    <p>I'd love to get your quote and timeline. Reply directly and we can take it from there.</p>
                    <p className="text-foreground/70">Thanks —<br />Sent via Haleo</p>
                  </div>
                </div>

                {/* Personal notes */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Add a personal note (optional)</p>
                    <p className="text-[10px] text-muted-foreground">Appears at the top of each email</p>
                  </div>
                  {selectedList.map(rc => {
                    const jobs = rc.matchCount || rc.permits.length;
                    // Ground the prompt in what the homeowner actually saw on
                    // the card — permit counts, not invented compliments.
                    const hint = jobs > 0
                      ? `e.g. I saw your ${jobs} ${projectLabel} permit${jobs === 1 ? "" : "s"} in ${neighborhood} — mine looks like a similar scope. Are you taking work right now?`
                      : `e.g. Mine is a ${projectLabel} project in ${neighborhood}. Are you taking work right now?`;
                    return (
                      <div key={rc.contractor.id} className="rounded-2xl border border-border p-3">
                        <p className="text-sm font-medium">{rc.contractor.company ?? rc.contractor.name}</p>
                        <Textarea
                          placeholder={hint}
                          value={notes[rc.contractor.id] ?? ""}
                          onChange={e => setNotes(n => ({ ...n, [rc.contractor.id]: e.target.value }))}
                          rows={2}
                          className="mt-2 rounded-lg bg-background text-sm"
                        />
                      </div>
                    );
                  })}

                </div>

                {/* Not signed in: how contractors can reach them. No account, no confirmation email. */}
                {!authUser?.email && (
                  <div className="mt-6 rounded-2xl border border-border bg-background p-4">
                    <p className="text-sm font-medium">How should they reach you?</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">A phone or an email. No account needed; it only goes to the contractors you picked.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <Input aria-label="Your first name" placeholder="First name" autoComplete="given-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
                      <Input
                        aria-label="Your phone"
                        placeholder="Phone"
                        inputMode="tel"
                        autoComplete="tel"
                        value={guestPhone}
                        onChange={(e) => {
                          setGuestPhone(e.target.value);
                          setContactNudge(false);
                        }}
                      />
                      <Input
                        aria-label="Your email"
                        placeholder="Email"
                        type="email"
                        autoComplete="email"
                        value={guestEmail}
                        onChange={(e) => {
                          setGuestEmail(e.target.value);
                          setContactNudge(false);
                        }}
                      />
                    </div>
                    {contactNudge && <p className="mt-2 text-xs text-accent">Add a phone or an email so they can get back to you.</p>}
                  </div>
                )}

                <div className="mt-6 flex justify-end gap-2">
                  <Button variant="ghost" onClick={closeOutreach} disabled={sending} className="rounded-full">Cancel</Button>
                  <Button onClick={sendBrief} disabled={sending} className="rounded-full">
                    <Send className="h-4 w-4" />
                    {sending ? "Sending…" : `Send to ${selectedList.length} contractor${selectedList.length === 1 ? "" : "s"}`}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default Contractors;
