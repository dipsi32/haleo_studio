// The unlock: the Birth Certificate is right there, its story blurred, and
// this card says what's waiting, in this house's own numbers. Signing in is
// the perk, not a wall: the free card above it stays free.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileText, Loader2, Mail, ScrollText, Sparkles, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { useAuthProviders } from "@/lib/useAuthProviders";
import type { HouseStory } from "@/lib/houseStory";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

type Props = { street: string; story: HouseStory; reason?: "certificate" | "story" };

export default function CertificateGate({ street, story, reason = "certificate" }: Props) {
  const providers = useAuthProviders();
  const [busy, setBusy] = useState(false);
  const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/house";
  const place = street.trim().replace(/\s+/g, " ").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
  const moments = story.moments.filter((m) => m.done).length;

  useEffect(() => {
    track("house_gate_viewed", { reason, permits: story.permits });
  }, [reason, story.permits]);

  // Remember why they signed in, so the unlock is counted once they're back.
  const mark = () => {
    try {
      sessionStorage.setItem("haleo:unlock", reason);
    } catch {
      /* fine */
    }
  };

  const google = async () => {
    setBusy(true);
    mark();
    track("house_gate_google", { reason });
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
    if (error) setBusy(false);
  };

  // What's waiting, in this house's numbers. Only what the record holds.
  const teaser = [
    story.permits ? `${plural(story.permits, "permit")}${story.since ? ` going back to ${story.since}` : ""}` : null,
    moments ? plural(moments, "big moment") : null,
    story.looseEnds ? plural(story.looseEnds, "loose end") : null,
  ].filter(Boolean) as string[];

  const perks = [
    { icon: ScrollText, text: "Its Birth Certificate, to print, frame or give" },
    { icon: FileText, text: "Every chapter: each permit, who did the work, and the city's own documents" },
    { icon: Sparkles, text: "Its 30-second story, made to share" },
    ...(story.looseEnds ? [{ icon: Wrench, text: "The loose ends to close before you sell or remodel" }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="relative mx-auto w-full max-w-[440px] rounded-[26px] border border-border bg-card/95 p-6 shadow-lift backdrop-blur"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{reason === "story" ? "Its story is ready" : "Its Birth Certificate is ready"}</p>
      <h3 className="mt-2 font-display text-[26px] font-light leading-[1.12]">
        There's more to <span className="italic">{place}</span>.
      </h3>
      {teaser.length > 0 && <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">We found {teaser.join(", ").replace(/, ([^,]*)$/, " and $1")} in the city's file.</p>}
      <ul className="mt-4 space-y-2.5">
        {perks.map((p) => (
          <li key={p.text} className="flex items-start gap-2.5 text-[14px] leading-snug">
            <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {p.text}
          </li>
        ))}
      </ul>

      <div className="mt-5 space-y-2">
        {providers.google && (
          <button
            type="button"
            onClick={google}
            disabled={busy}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-foreground px-5 text-[15.5px] font-medium text-background transition-smooth hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleMark />} Continue with Google
          </button>
        )}
        <Link
          to={`/login?mode=signup&next=${encodeURIComponent(here)}`}
          onClick={() => {
            mark();
            track("house_gate_email", { reason, google_offered: providers.google });
          }}
          className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-smooth ${
            providers.google || !providers.loaded ? "border border-border hover:bg-secondary" : "bg-foreground text-background hover:opacity-90"
          }`}
        >
          <Mail className="h-4 w-4" /> {providers.google ? "Use email instead" : "Continue with email"}
        </Link>
      </div>
      <p className="mt-3 text-center text-[12px] text-muted-foreground">Free. Takes a few seconds. Nothing is posted anywhere.</p>
    </motion.div>
  );
}
