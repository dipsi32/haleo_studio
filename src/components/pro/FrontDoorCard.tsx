// "Your front door": one permanent link for the contractor's website, Google
// profile and text replies, in their color, with a ready button for their
// site. Every brief that comes through it lands in their inbox, tagged with
// where it came from.
import { useEffect, useState } from "react";
import { Check, Code2, Copy, ExternalLink, Globe, Palette, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import {
  FRONT_DOOR_SOURCES,
  checkHandle,
  frontDoorHandle,
  frontDoorUrl,
  isBrandColor,
  websiteButtonHtml,
  type FrontDoorSource,
} from "@/lib/frontDoor";
import type { Json } from "@/integrations/supabase/types";

type Props = {
  accountId: string;
  contractorId: string | null;
  branding: Json | null;
  /** The name on their account, which makes their default link. */
  companyName?: string | null;
  /** A link name they chose, if any. */
  handle?: string | null;
  onSaved?: () => void;
};

const HOW_TO: { site: string; steps: string }[] = [
  { site: "Wix", steps: "Edit your site, click your Contact button, choose Link → Web address, paste the website link." },
  { site: "Squarespace", steps: "Edit the page, click the button block, paste the website link as its URL." },
  { site: "WordPress", steps: "Add a Custom HTML block where you want the button and paste the button code." },
  { site: "Google Business Profile", steps: "Open your profile → Edit profile → Contact → Appointment links, paste the Google link." },
];

export default function FrontDoorCard({ accountId, contractorId, branding, companyName, handle: chosen, onSaved }: Props) {
  const { toast } = useToast();
  const [slug, setSlug] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savingHandle, setSavingHandle] = useState(false);
  const saved = branding && typeof branding === "object" && !Array.isArray(branding) ? (branding as { color?: unknown }).color : null;
  const [color, setColor] = useState<string>(isBrandColor(saved) ? saved : "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    if (!contractorId) return;
    supabase
      .from("contractors")
      .select("slug")
      .eq("id", contractorId)
      .maybeSingle()
      .then(({ data }) => setSlug((data as { slug?: string | null } | null)?.slug ?? null));
  }, [contractorId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const handle = slug ? frontDoorHandle({ chosen, companyName, slug }) : null;
  const url = (s: FrontDoorSource) => (handle ? frontDoorUrl(handle, s, origin) : "");
  const host = origin.replace(/^https?:\/\//, "");
  const draftCheck = checkHandle(draft);
  const draftHandle = "handle" in draftCheck ? draftCheck.handle : null;
  const draftWhy = "why" in draftCheck ? draftCheck.why : null;

  const saveHandle = async () => {
    if (!draftHandle) return;
    setSavingHandle(true);
    const { error } = await supabase.from("contractor_accounts").update({ front_door_handle: draftHandle }).eq("id", accountId);
    setSavingHandle(false);
    if (error) {
      const taken = /duplicate|unique/i.test(error.message);
      toast({ title: taken ? "Someone already has that link" : "Couldn't save your link", description: taken ? "Try a different name." : error.message, variant: "destructive" });
      return;
    }
    track("front_door_handle_saved", { length: draftHandle.length });
    toast({ title: "Your link is updated", description: `${host}/${draftHandle}` });
    setEditing(false);
    onSaved?.();
  };

  const copy = async (key: string, text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
      toast({ title: `${what} copied` });
      track("front_door_link_copied", { what: key });
    } catch {
      toast({ title: "Couldn't copy", description: "Select it and copy by hand.", variant: "destructive" });
    }
  };

  const saveColor = async () => {
    if (color && !isBrandColor(color)) {
      toast({ title: "That isn't a color code", description: "Use the picker, or a code like #E31B23.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const base = branding && typeof branding === "object" && !Array.isArray(branding) ? (branding as Record<string, Json>) : {};
    const next = { ...base, color: color || null } as Json;
    const { error } = await supabase.from("contractor_accounts").update({ branding: next }).eq("id", accountId);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save your color", description: error.message, variant: "destructive" });
      return;
    }
    track("front_door_color_saved", { has_color: !!color });
    toast({ title: "Saved", description: "Your clients will see your color from now on." });
    onSaved?.();
  };

  if (!contractorId) return null;

  return (
    <section id="front-door" className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <Globe className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl">Your front door</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            One link that never expires. Put it behind “Start your project” on your website and your Google profile.
            Visitors share their project in your colors instead of a contact form, and you get the brief with the
            visit already prepped.
          </p>
        </div>
      </div>

      {!slug ? (
        <div className="mt-5 h-24 animate-pulse rounded-2xl bg-muted/40" />
      ) : (
        <>
          {/* The link they share: their name, nothing else. */}
          <div className="mt-5 rounded-2xl border border-accent/30 bg-accent-soft/40 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Your link</p>
            <p className="mt-1 break-all font-display text-xl">
              <span className="text-muted-foreground">{host}/</span>
              {handle}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" className="rounded-full" onClick={() => copy("text", url("text"), "Link")}>
                {copied === "text" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy link
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  setDraft(handle ?? "");
                  setEditing((v) => !v);
                }}
              >
                <Pencil className="h-3.5 w-3.5" /> Change the name
              </Button>
              <a href={url("text")} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground underline underline-offset-4">
                See what your clients see <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {editing && (
              <div className="mt-4">
                <label htmlFor="front-door-handle" className="text-sm font-medium">
                  Pick a short name your clients will recognize
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">{host}/</span>
                  <Input
                    id="front-door-handle"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, 40))}
                    placeholder="uscb"
                    className="h-10 w-48 rounded-xl bg-background"
                  />
                  <Button size="sm" className="rounded-full" disabled={!draftHandle || savingHandle} onClick={saveHandle}>
                    {savingHandle ? "Saving…" : "Save"}
                  </Button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {draft && draftWhy
                    ? draftWhy
                    : draftHandle
                      ? `Your link: ${host}/${draftHandle}`
                      : "Letters, numbers and hyphens. Your old link keeps working."}
                </p>
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Text it to new inquiries, or put it in your email signature.</p>
          </div>

          {/* The same link, tagged, for the places that aren't a text. */}
          <ul className="mt-4 space-y-2">
            {FRONT_DOOR_SOURCES.filter((s) => s.id !== "text").map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-background/60 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.where}</p>
                </div>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => copy(s.id, url(s.id), "Link")}>
                  {copied === s.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy link
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">These carry a small tag, so each brief says where it came from.</p>

          {/* Their color */}
          <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Palette className="h-4 w-4 text-accent" /> Your color
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The main color of your website or logo. Your clients see it on every page of their brief.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="color"
                aria-label="Pick your color"
                value={isBrandColor(color) ? color : "#111827"}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-background p-1"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value.trim().slice(0, 7))}
                placeholder="#E31B23"
                aria-label="Color code"
                className="h-11 w-32 rounded-xl bg-background font-mono"
              />
              <Button onClick={saveColor} disabled={saving} className="h-11 rounded-full px-5">
                {saving ? "Saving…" : "Save color"}
              </Button>
            </div>
          </div>

          {/* The button for their site */}
          <div className="mt-6 rounded-2xl border border-border bg-background/60 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Code2 className="h-4 w-4 text-accent" /> Put it on your website
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Easiest: point your existing “Contact us” or “Get a quote” button at your website link. Or paste this button.
            </p>
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-5 text-center" dangerouslySetInnerHTML={{ __html: websiteButtonHtml(url("website"), color) }} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => copy("html", websiteButtonHtml(url("website"), color), "Button code")}>
                {copied === "html" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy button code
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={() => setShowHow((v) => !v)}>
                {showHow ? "Hide the steps" : "How to add it on Wix, Squarespace, WordPress or Google"}
              </Button>
            </div>
            {showHow && (
              <ul className="mt-3 space-y-2 text-sm">
                {HOW_TO.map((h) => (
                  <li key={h.site} className="rounded-xl bg-secondary/50 px-3 py-2">
                    <span className="font-medium">{h.site}:</span> <span className="text-foreground/80">{h.steps}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
