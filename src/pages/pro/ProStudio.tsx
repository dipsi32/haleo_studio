// "My Profile" — the contractor's home base after login.
// Warm, editable landing page + a leads ticker that pulls them into the inbox.
// Every edit here syncs straight to their public profile and the homeowner-facing card.
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Inbox, Bell, ArrowRight, Pencil, Check, X, Plus, Image as ImageIcon,
  Instagram, Globe, Facebook, Phone, Mail, MapPin, Tag, Calendar, Loader2,
  ExternalLink, Camera, Trash2, Megaphone, Heart, Star,
} from "lucide-react";
import Logo from "@/components/Logo";
import NotificationBell from "@/components/NotificationBell";
import ProHeader from "@/components/pro/ProHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useContractorAccount } from "@/hooks/useContractorAccount";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ---------- Inline editable field ----------
function InlineField({
  label, value, placeholder, multiline, icon, onSave, prefix,
}: {
  label: string;
  value: string | null | undefined;
  placeholder: string;
  multiline?: boolean;
  icon?: React.ReactNode;
  prefix?: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(value ?? ""); }, [value]);

  const save = async () => {
    setBusy(true);
    try { await onSave(draft.trim()); setEditing(false); }
    finally { setBusy(false); }
  };

  const isEmpty = !value || value.trim() === "";

  return (
    <div className="group relative rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:border-accent/40 hover:bg-card">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {icon} {label}
        </p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-accent"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {multiline ? (
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              rows={4}
              className="resize-none rounded-xl bg-background"
            />
          ) : (
            <div className="flex items-center gap-1">
              {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
              <Input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={placeholder}
                className="h-9 rounded-xl bg-background"
                onKeyDown={(e) => { if (e.key === "Enter" && !multiline) save(); if (e.key === "Escape") setEditing(false); }}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={save} disabled={busy} className="h-7 rounded-full px-3 text-xs">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(value ?? ""); setEditing(false); }} className="h-7 rounded-full px-3 text-xs">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="block w-full text-left">
          {isEmpty ? (
            <p className="text-sm italic text-muted-foreground/70">{placeholder}</p>
          ) : (
            <p className={`text-sm text-foreground ${multiline ? "whitespace-pre-wrap leading-relaxed" : ""}`}>
              {prefix}{value}
            </p>
          )}
        </button>
      )}
    </div>
  );
}

// ---------- Specialties multi-select with custom add ----------
const SPECIALTY_SUGGESTIONS = [
  "Kitchen remodels", "Bathroom remodels", "Whole-home remodels", "ADUs",
  "Additions", "Outdoor living", "Decks & patios", "Roofing", "Solar",
  "Historic homes", "New construction", "Garage conversions",
  "Basement finishing", "Tile & flooring", "Cabinetry & millwork",
  "Painting", "Electrical", "Plumbing", "HVAC", "Landscaping",
];

function SpecialtiesPicker({ value, onSave }: { value: string; onSave: (next: string) => Promise<void> }) {
  const selected = value.split(",").map((s) => s.trim()).filter(Boolean);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const commit = async (next: string[]) => {
    setBusy(true);
    try { await onSave(next.join(", ")); } finally { setBusy(false); }
  };

  const toggle = (item: string) => {
    const exists = selected.some((s) => s.toLowerCase() === item.toLowerCase());
    const next = exists
      ? selected.filter((s) => s.toLowerCase() !== item.toLowerCase())
      : [...selected, item];
    commit(next);
  };

  const addCustom = () => {
    const v = draft.trim();
    if (!v) return;
    if (selected.some((s) => s.toLowerCase() === v.toLowerCase())) { setDraft(""); return; }
    commit([...selected, v]);
    setDraft("");
  };

  const remove = (item: string) => commit(selected.filter((s) => s.toLowerCase() !== item.toLowerCase()));

  const suggestions = SPECIALTY_SUGGESTIONS.filter(
    (s) => !selected.some((sel) => sel.toLowerCase() === s.toLowerCase()),
  );

  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 p-4 transition-all hover:border-accent/40 hover:bg-card">
      <p className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <Tag className="h-3 w-3" /> Specialties
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      </p>

      {selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {s}
              <button onClick={() => remove(s)} className="hover:opacity-70" aria-label={`Remove ${s}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-3 text-xs italic text-muted-foreground/70">Tap what you do best — or type your own.</p>
      )}

      <div className="mb-3 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
          placeholder="Add your own…"
          className="h-9 rounded-xl bg-background"
        />
        <Button type="button" size="sm" variant="outline" onClick={addCustom} disabled={!draft.trim()} className="h-9 rounded-xl">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => toggle(s)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:border-accent/50 hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Page ----------
const ProStudio = () => {
  const { user } = useAuth();
  const { account, isContractor, loading, refetch } = useContractorAccount();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [unreadLeads, setUnreadLeads] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [recentLead, setRecentLead] = useState<{ when: string; project: string; hood: string | null } | null>(null);
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [cslbOnFile, setCslbOnFile] = useState<{ email: string | null; phone: string | null; city: string | null; state: string | null; zip: string | null; license_number: string | null } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const contractorId = account?.contractor_id;
  const gallery = useMemo<string[]>(() => {
    const g = (account?.gallery_urls as unknown) as string[] | undefined;
    return Array.isArray(g) ? g : [];
  }, [account?.gallery_urls]);

  // Send non-contractors away
  useEffect(() => {
    if (!loading && user && !isContractor) navigate("/account", { replace: true });
  }, [loading, user, isContractor, navigate]);

  // Lead counts + slug
  useEffect(() => {
    if (!contractorId) return;
    let active = true;
    (async () => {
      const [{ data: c }, { data: sends }, { data: unreadNotifs }] = await Promise.all([
        supabase.from("contractors").select("slug").eq("id", contractorId).maybeSingle(),
        supabase
          .from("outreach_sends")
          .select("id, sent_at, outreach_batches(neighborhood, brief_snapshot)")
          .eq("contractor_id", contractorId)
          .order("sent_at", { ascending: false })
          .limit(50),
        // Count DISTINCT briefs with unread notifications, not raw notification rows.
        // Multiple events about the same brief (received, clarification, etc.) used
        // to inflate this number — "3 new" when only one brief had landed.
        supabase
          .from("contractor_notifications")
          .select("outreach_send_id")
          .eq("contractor_id", contractorId)
          .eq("read", false)
          .not("outreach_send_id", "is", null),
      ]);
      if (!active) return;
      if (c?.slug) setProfileSlug(c.slug);
      const list = (sends ?? []) as Array<{ id: string; sent_at: string | null; outreach_batches: { neighborhood: string | null; brief_snapshot: { projectType?: string; scope_label?: string } | null } | null }>;
      setTotalLeads(list.length);
      const distinctUnread = new Set((unreadNotifs ?? []).map((n: { outreach_send_id: string | null }) => n.outreach_send_id).filter(Boolean));
      setUnreadLeads(distinctUnread.size);
      const top = list[0];
      if (top?.sent_at) {
        const snap = top.outreach_batches?.brief_snapshot ?? {};
        setRecentLead({
          when: top.sent_at,
          project: snap.projectType || snap.scope_label || "New project",
          hood: top.outreach_batches?.neighborhood ?? null,
        });
      }
    })();
    return () => { active = false; };
  }, [contractorId]);

  // Save helper
  const saveField = async (patch: Record<string, unknown>) => {
    if (!user) return;
    const { error } = await supabase.from("contractor_accounts").update(patch as never).eq("user_id", user.id);
    if (error) { toast({ title: "Couldn't save", description: error.message, variant: "destructive" }); return; }
    await refetch();
  };

  // Photo upload
  const onPickPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length || !user) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from("contractor-gallery").upload(path, file, { cacheControl: "31536000", upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("contractor-gallery").getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
      const next = [...gallery, ...newUrls];
      await saveField({ gallery_urls: next as never });
      toast({ title: "Photos added", description: `${newUrls.length} photo${newUrls.length === 1 ? "" : "s"} live on your profile.` });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Try a smaller file.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async (url: string) => {
    const next = gallery.filter((u) => u !== url);
    await saveField({ gallery_urls: next as never });
  };

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Opening your profile…</div>;
  }

  const company = account?.company_name || "there";
  const completion = (() => {
    const fields = [
      account?.tagline, account?.bio, account?.phone, account?.public_email,
      account?.website, account?.instagram, gallery.length > 0 ? "y" : "",
      account?.years_in_business, account?.service_areas, account?.specialties,
    ];
    const filled = fields.filter((f) => f && String(f).trim() !== "").length;
    return Math.round((filled / fields.length) * 100);
  })();

  return (
    <div className="min-h-screen bg-gradient-warm">
      {/* Header */}
      <ProHeader />

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10">
        {/* WELCOME + LEADS TICKER */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/15 via-accent/5 to-transparent p-8 shadow-soft md:p-10"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
                <Sparkles className="h-3 w-3" /> Welcome back
              </p>
              <h1 className="mt-4 font-display text-4xl font-light leading-[1.1] md:text-5xl">
                Hey {company.split(" ")[0]} —<br />
                {totalLeads > 0 ? (
                  <span>
                    you have{" "}
                    <span className="text-accent">{totalLeads} homeowner{totalLeads === 1 ? "" : "s"}</span>{" "}
                    waiting on you.
                  </span>
                ) : (
                  <span className="text-muted-foreground">your profile is live and ready.</span>
                )}
              </h1>
              <p className="mt-3 max-w-xl text-base text-muted-foreground">
                This is how homeowners on Haleo see you. Make it sing — every detail you add helps them choose you.
              </p>

              {recentLead && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-5 inline-flex items-center gap-3 rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm shadow-sm"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="font-medium">{recentLead.project}</span>
                  {recentLead.hood && <span className="text-muted-foreground">· {recentLead.hood}</span>}
                  {unreadLeads > 0 && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-foreground">
                      {unreadLeads} new
                    </span>
                  )}
                </motion.div>
              )}
            </div>

            <div className="shrink-0 md:text-right">
              <Button
                size="lg"
                onClick={() => navigate("/pro/inbox")}
                className="h-12 rounded-full px-6 text-base shadow-md"
              >
                {totalLeads > 0 ? "Open my inbox" : "View inbox"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                {totalLeads > 0 ? "Don't keep them waiting." : "We'll notify you the moment one lands."}
              </p>
            </div>
          </div>

          {/* Completion meter */}
          <div className="mt-8 rounded-2xl bg-background/60 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium uppercase tracking-wider text-muted-foreground">Profile strength</span>
              <span className="font-mono text-foreground">{completion}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${completion}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent/60"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {completion < 50 ? "A richer profile gets 3× more brief opens." :
               completion < 90 ? "Almost there — a couple more details and you're set." :
               "Your profile looks fantastic ✨"}
            </p>
          </div>
        </motion.section>

        {/* IDENTITY */}
        <section className="mt-10">
          <header className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-light">Your story</h2>
            <p className="text-xs text-muted-foreground">Click any card to edit</p>
          </header>
          <div className="grid gap-3 md:grid-cols-2">
            <InlineField
              label="Company name"
              icon={<Tag className="h-3 w-3" />}
              value={account?.company_name}
              placeholder="e.g., Bayview Build Co."
              onSave={(v) => saveField({ company_name: v || null })}
            />
            <InlineField
              label="One-line tagline"
              icon={<Sparkles className="h-3 w-3" />}
              value={account?.tagline}
              placeholder="e.g., Thoughtful kitchens, on time, no surprises."
              onSave={(v) => saveField({ tagline: v || null })}
            />
            <div className="md:col-span-2">
              <InlineField
                label="About us"
                icon={<Heart className="h-3 w-3" />}
                value={account?.bio}
                placeholder="Tell homeowners who you are. What kind of work lights you up? What's your team like? Why should they trust you with their home?"
                multiline
                onSave={(v) => saveField({ bio: v || null })}
              />
            </div>
          </div>
        </section>

        {/* PROMO */}
        <section className="mt-10">
          <header className="mb-4">
            <h2 className="flex items-center gap-2 font-display text-2xl font-light">
              <Megaphone className="h-5 w-5 text-accent" /> Running a promo?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Show off any current offer. It'll appear as a warm banner on your public profile.</p>
          </header>
          <InlineField
            label="Promotion"
            icon={<Star className="h-3 w-3" />}
            value={account?.promo_text}
            placeholder="e.g., Free 1-hour consultation for projects booked in May ✨"
            onSave={(v) => saveField({ promo_text: v || null })}
          />
        </section>

        {/* CONTACT */}
        <section className="mt-10">
          <header className="mb-4">
            <h2 className="font-display text-2xl font-light">How homeowners reach you</h2>
            <p className="mt-1 text-sm text-muted-foreground">These show only after a homeowner chooses to engage you — never publicly scraped.</p>
          </header>
          <div className="grid gap-3 md:grid-cols-2">
            <InlineField label="Phone" icon={<Phone className="h-3 w-3" />} value={account?.phone}
              placeholder="(408) 555-0142" onSave={(v) => saveField({ phone: v || null })} />
            <InlineField label="Public email" icon={<Mail className="h-3 w-3" />} value={account?.public_email}
              placeholder="hello@yourcompany.com" onSave={(v) => saveField({ public_email: v || null })} />
            <InlineField label="Service areas" icon={<MapPin className="h-3 w-3" />} value={account?.service_areas}
              placeholder="San Jose, Cupertino, Santa Clara, Sunnyvale" onSave={(v) => saveField({ service_areas: v || null })} />
            <InlineField label="Years in business" icon={<Calendar className="h-3 w-3" />} value={account?.years_in_business?.toString() ?? ""}
              placeholder="12" onSave={(v) => saveField({ years_in_business: v ? parseInt(v, 10) || null : null })} />
            <div className="md:col-span-2">
              <SpecialtiesPicker
                value={account?.specialties ?? ""}
                onSave={(v) => saveField({ specialties: v || null })}
              />
            </div>
          </div>
        </section>

        {/* SOCIAL */}
        <section className="mt-10">
          <header className="mb-4">
            <h2 className="font-display text-2xl font-light">Where else can they find you?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Just paste your handle or full URL — we'll figure it out.</p>
          </header>
          <div className="grid gap-3 md:grid-cols-2">
            <InlineField label="Website" icon={<Globe className="h-3 w-3" />} value={account?.website}
              placeholder="yourcompany.com" onSave={(v) => saveField({ website: v || null })} />
            <InlineField label="Instagram" icon={<Instagram className="h-3 w-3" />} value={account?.instagram}
              prefix="@" placeholder="yourhandle" onSave={(v) => saveField({ instagram: v.replace(/^@/, "") || null })} />
            <InlineField label="Facebook" icon={<Facebook className="h-3 w-3" />} value={account?.facebook}
              placeholder="facebook.com/yourpage" onSave={(v) => saveField({ facebook: v || null })} />
            <InlineField label="Houzz" icon={<Globe className="h-3 w-3" />} value={account?.houzz}
              placeholder="houzz.com/pro/yourcompany" onSave={(v) => saveField({ houzz: v || null })} />
            <InlineField label="Yelp" icon={<Globe className="h-3 w-3" />} value={account?.yelp}
              placeholder="yelp.com/biz/yourcompany" onSave={(v) => saveField({ yelp: v || null })} />
            <InlineField label="TikTok" icon={<Globe className="h-3 w-3" />} value={account?.tiktok}
              prefix="@" placeholder="yourhandle" onSave={(v) => saveField({ tiktok: v.replace(/^@/, "") || null })} />
          </div>
        </section>

        {/* GALLERY */}
        <section className="mt-10">
          <header className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl font-light">Show your work</h2>
              <p className="mt-1 text-sm text-muted-foreground">A few great photos beat a thousand words. JPG/PNG, up to 10MB each.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-full"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Add photos"}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onPickPhotos}
            />
          </header>

          {gallery.length === 0 ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="grid w-full place-items-center rounded-3xl border-2 border-dashed border-border bg-card/40 p-16 text-center transition hover:border-accent/40 hover:bg-card"
            >
              <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
              <p className="mt-4 font-display text-xl font-light">Drop in a few favorites</p>
              <p className="mt-1 text-sm text-muted-foreground">A finished kitchen, a happy client, a dramatic before/after.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-4 py-2 text-xs font-medium text-accent">
                <Plus className="h-3 w-3" /> Click to upload
              </span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              <AnimatePresence>
                {gallery.map((url) => (
                  <motion.div
                    key={url}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted"
                  >
                    <img src={url} alt="Project" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                    <button
                      onClick={() => removePhoto(url)}
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/80 text-foreground opacity-0 backdrop-blur transition hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-border bg-card/40 transition hover:border-accent/40 hover:bg-card"
              >
                <div className="text-center">
                  <Plus className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-1 text-xs text-muted-foreground">Add more</p>
                </div>
              </button>
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <section className="mt-12 rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
          <Bell className="mx-auto h-6 w-6 text-accent" />
          <h3 className="mt-3 font-display text-2xl font-light">Ready when they are.</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Every brief in your inbox is a real homeowner who already did the hard thinking. Your job: show up well.
          </p>
          <Button onClick={() => navigate("/pro/inbox")} className="mt-5 rounded-full">
            Go to inbox <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      </main>
    </div>
  );
};

export default ProStudio;
