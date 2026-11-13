// /i/:token/send: the last step of an invited brief.
//
// The homeowner sees exactly what goes to the contractor who invited them,
// consents, and sends. The server decides who receives it (the inviter, only),
// so nothing on this page can redirect the brief. Afterwards they see the
// contractor's public record in their own city, and a quiet way to compare.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Send } from "lucide-react";
import CobrandLogo, { type Cobrand } from "@/components/CobrandLogo";
import ProofPanel from "@/components/contractors/ProofPanel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import HomeownerEase from "@/components/HomeownerEase";
import ProjectSummaryCard from "@/components/ProjectSummaryCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { loadAddressRisk } from "@/lib/addressRisk";
import { loadParcelFacts } from "@/lib/parcelFacts";
import { cleanContext, hasContext, type HomeownerContext } from "@/lib/prepTypes";
import VisitContextForm from "@/components/brief/VisitContextForm";
import VisitTimesPicker from "@/components/brief/VisitTimesPicker";
import { formatVisitTime } from "@/lib/visitTimes";
import { buildBriefSnapshot, getSessionId, projectKeywords, projectTypeLabel, type BriefSnapshot } from "@/lib/contractors";
import {
  INVITE_ERROR_COPY,
  clearActiveInvite,
  contractorDisplayName,
  contractorFromActive,
  demoSlugOf,
  fetchInvite,
  getActiveInvite,
  isDemoToken,
  invitePath,
  sendInvitedBrief,
  setActiveInvite,
  type InvitePublic,
} from "@/lib/invites";
import { cleanName, useIntake } from "@/lib/intake";
import { Input } from "@/components/ui/input";
import { saveDemoBrief } from "@/lib/demo";

const Shell = ({ children, brand }: { children: React.ReactNode; brand?: Cobrand | null }) => (
  <div className="min-h-screen bg-gradient-warm">
    <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
      <CobrandLogo brand={brand} />
    </header>
    <main className="mx-auto max-w-3xl px-6 pb-24 pt-4">{children}</main>
  </div>
);

const InviteSend = () => {
  const { token = "" } = useParams<{ token: string }>();
  const { user } = useAuth();
  const guest = !!user?.is_anonymous;
  const { data, update } = useIntake();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InvitePublic | null | undefined>(undefined);
  const [consent, setConsent] = useState(false);
  const [note, setNote] = useState("");
  const [context, setContext] = useState<HomeownerContext>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);

  // The contractor demo never touches the server: the "link" is the active demo.
  const demo = isDemoToken(token);

  useEffect(() => {
    if (demo) {
      const active = getActiveInvite();
      setInvite(active?.demo && active.token === token ? { status: "open", contractor: contractorFromActive(active) } : null);
      return;
    }
    let cancelled = false;
    fetchInvite(token).then((inv) => {
      if (cancelled) return;
      setInvite(inv);
      if (inv?.status === "open") setActiveInvite(token, inv.contractor);
    });
    return () => {
      cancelled = true;
    };
  }, [token, demo]);

  // The name they gave the contractor wins; their account name is the fallback.
  const homeownerName =
    data.homeownerName ||
    ((user?.user_metadata?.full_name as string | undefined) ?? (user?.email ? user.email.split("@")[0] : undefined));
  const city = data.address?.city && !data.address.skipped ? data.address.city : null;
  const keywords = useMemo(() => projectKeywords(data), [data]);
  const preview = useMemo(() => buildBriefSnapshot(data, homeownerName), [data, homeownerName]);

  if (invite === undefined) {
    return (
      <Shell>
        <div className="h-64 animate-pulse rounded-3xl border border-border bg-card/60" aria-label="Loading" />
      </Shell>
    );
  }

  if (invite === null) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-light">This link isn't valid</h1>
        <p className="mt-3 text-muted-foreground">{INVITE_ERROR_COPY.invite_not_found}</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/brief">Start a brief</Link>
        </Button>
      </Shell>
    );
  }

  const name = contractorDisplayName(invite.contractor);
  const brand: Cobrand = { name, logoUrl: invite.contractor.logoUrl ?? null, href: invitePath(token) };

  // ───── Sent ─────
  if (sent) {
    return (
      <Shell brand={brand}>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-sage/15 text-sage">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <h1 className="font-display text-3xl font-light">Sent to {name}</h1>
          </div>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            {name} now has your photos, what you want, and the questions worth asking, so your first conversation starts
            with your project, not a blank page.{" "}
            {guest
              ? data.homeownerPhone
                ? `They'll reach you at ${data.homeownerPhone}.`
                : "They'll be in touch."
              : "If they have questions, you'll see them in your notifications. Your brief is saved in your account."}
          </p>

          <HomeownerEase sendId={sentId} contractorId={invite.contractor.id} />

          {(context.visit_times?.length ?? 0) > 0 && (
            <div className="mt-6 rounded-2xl border border-sage/25 bg-sage/5 p-5">
              <p className="font-display text-lg">Times you suggested</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {context.visit_times!.map((t) => (
                  <li key={t} className="rounded-full bg-background px-3 py-1 text-sm">{formatVisitTime(t)}</li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-muted-foreground">{name} will confirm one with you. You'll see it in your notifications.</p>
            </div>
          )}

          <div className="mt-8">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              What the public record shows for {name}{city ? ` in ${city}` : ""}
            </p>
            <ProofPanel contractorId={invite.contractor.id} city={city ?? invite.contractor.city} keywords={keywords} variant="full" />
          </div>

          {/* This is the contractor's own link: nothing here points to other contractors. */}
          {!guest && (
            <Button className="mt-8 rounded-full" onClick={() => navigate("/account")}>
              Go to my account
            </Button>
          )}
        </motion.div>
      </Shell>
    );
  }

  // ───── Link can't be used ─────
  if (invite.status !== "open") {
    const msg =
      invite.status === "completed"
        ? INVITE_ERROR_COPY.invite_used
        : invite.status === "expired"
          ? INVITE_ERROR_COPY.invite_expired
          : INVITE_ERROR_COPY.invite_revoked;
    return (
      <Shell brand={brand}>
        <h1 className="font-display text-3xl font-light">This link can't be used</h1>
        <p className="mt-3 max-w-md text-muted-foreground">{msg}</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/account">Go to my account</Link>
        </Button>
      </Shell>
    );
  }

  // ───── No brief yet ─────
  if (!data.room) {
    return (
      <Shell brand={brand}>
        <h1 className="font-display text-3xl font-light">Let's build your brief first</h1>
        <p className="mt-3 max-w-md text-muted-foreground">{name} will see it as soon as you send it. It takes about five minutes.</p>
        <Button asChild className="mt-6 rounded-full">
          <Link to={invitePath(token)}>Start my brief</Link>
        </Button>
      </Shell>
    );
  }


  const send = async () => {
    if ((!user && !demo) || !consent) return;
    setSending(true);
    try {
      const [addressRisk, parcel] = await Promise.all([loadAddressRisk(data.address), loadParcelFacts(data.address)]);
      const ctx = cleanContext(context);
      const snapshot = {
        ...buildBriefSnapshot(data, homeownerName),
        projectType: projectTypeLabel(data),
        ...(addressRisk ? { address_risk: addressRisk } : {}),
        ...(parcel ? { parcel } : {}),
        ...(ctx ? { context: ctx } : {}),
      } as BriefSnapshot & { projectType: string };

      if (demo) {
        // Everything above was real (their brief, the city's records for their
        // address). Instead of sending, show the contractor what they'd receive.
        saveDemoBrief(demoSlugOf(token), snapshot, note.trim() || null);
        track("demo_brief_sent", { demo: demoSlugOf(token), has_parcel: !!parcel, visit_times: ctx?.visit_times?.length ?? 0 });
        navigate(`/demo/${demoSlugOf(token)}/matt`);
        return;
      }

      const res = await sendInvitedBrief({
        token,
        snapshot,
        neighborhood: data.address?.city || "your area",
        homeownerName,
        sessionId: getSessionId(),
        note: note.trim() || null,
      });
      if (res.ok === false) {
        track("error_edge_function", { where: "send_invited_brief", message: res.code });
        toast({ title: "Couldn't send your brief", description: res.message, variant: "destructive" });
        return;
      }

      // In-app and push alert for the contractor, and a receipt for the homeowner.
      // Neither blocks the confirmation.
      supabase.functions
        .invoke("notify-contractor-brief", { body: { outreach_send_id: res.sendId } })
        .catch((err) => console.error("notify failed", err));
      supabase
        .from("homeowner_notifications")
        .insert({
          user_id: user.id,
          type: "brief_sent",
          title: `Brief sent to ${name}`,
          body: "We'll let you know the moment they reply.",
        })
        .then(() => undefined, () => undefined);

      track("invite_brief_sent", { contractor_id: invite.contractor.id, has_note: !!note.trim(), has_context: hasContext(context), has_parcel: !!parcel, visit_times: context.visit_times?.length ?? 0 });
      clearActiveInvite();
      setSentId(res.sendId);
      setSent(true);
      window.scrollTo({ top: 0, behavior: "auto" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Shell brand={brand}>
      <button
        onClick={() => navigate("/brief/result")}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to my brief
      </button>

      <h1 className="font-display text-3xl font-light leading-tight">Send your brief to {name}</h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        This is what {name} will see. It goes to them and no one else.
      </p>

      <ProjectSummaryCard
        className="mt-6"
        snapshot={{ ...preview, projectType: projectTypeLabel(data) }}
        audience="homeowner"
        contractorName={invite.contractor.personName || name}
      />
      {!city && (
        <p className="mt-3 text-sm text-muted-foreground">
          You haven't added an address, so {name} can't check permits and hazard zones for your property.{" "}
          <Link to="/brief/result" className="text-foreground underline underline-offset-4 hover:text-accent">
            Add it
          </Link>
        </p>
      )}

      {!data.homeownerName && (
        <div className="mt-8">
          <label htmlFor="homeowner-name" className="block text-sm font-medium">
            What should {invite.contractor.personName || name} call you?
          </label>
          <Input
            id="homeowner-name"
            defaultValue={homeownerName ?? ""}
            onBlur={(e) => update({ homeownerName: cleanName(e.target.value) })}
            placeholder="Your first name"
            autoComplete="given-name"
            className="mt-2 h-11 max-w-xs rounded-xl bg-background"
          />
        </div>
      )}

      <VisitContextForm name={name} value={context} onChange={setContext} />

      <VisitTimesPicker
        name={name}
        value={context.visit_times ?? []}
        onChange={(visit_times) => setContext((c) => ({ ...c, visit_times }))}
      />

      <label htmlFor="invite-note" className="mt-8 block text-sm font-medium">
        Anything you want {name} to know before you meet? <span className="font-normal text-muted-foreground">(optional)</span>
      </label>
      <Textarea
        id="invite-note"
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 500))}
        rows={3}
        placeholder="e.g. We'd love to start before the school year. My architect is already working on plans."
        className="mt-2 rounded-xl"
      />

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card/70 p-4">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[hsl(var(--accent))]"
        />
        <span className="text-sm leading-relaxed">
          I'm sharing this brief, including the photos and plans above, with {name}. They can reply to me through Haleo.
        </span>
      </label>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="lg" className="rounded-full" disabled={!consent || sending} onClick={send}>
          <Send className="h-4 w-4" /> {sending ? "Sending…" : `Send to ${name}`}
        </Button>
      </div>
    </Shell>
  );
};

export default InviteSend;
