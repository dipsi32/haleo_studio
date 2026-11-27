// "Which city next?" Haleo reads San José's records today. Anyone elsewhere
// votes for their city instead of hitting a dead end, sees the live board,
// and gets a link to bring their neighbors. The board is the demand map.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Copy, Loader2, MapPin, Share2 } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { copyText } from "@/lib/copyText";
import { cityKey, isSanJose, leaderboard, parseCity, STATES, stateForZip, tidyCity, voteLink, type TallyRow } from "@/lib/cityNext";

const ROLES = [
  { value: "homeowner", label: "Homeowner" },
  { value: "contractor", label: "Contractor" },
  { value: "realtor", label: "Realtor" },
] as const;
const VOTED_KEY = "haleo:city-vote";

const readVoted = (): { key: string; city: string; state: string | null } | null => {
  try {
    return JSON.parse(localStorage.getItem(VOTED_KEY) ?? "null");
  } catch {
    return null;
  }
};

export default function CityNext() {
  const [params] = useSearchParams();
  const zip = (params.get("zip") ?? "").trim();
  const from = params.get("from") ?? params.get("ref") ?? "direct";
  const shared = params.get("city") ? parseCity(`${params.get("city")}${params.get("state") ? `, ${params.get("state")}` : ""}`) : null;

  const [city, setCity] = useState(shared?.city ?? "");
  const [state, setState] = useState(shared?.state ?? stateForZip(zip) ?? "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voted, setVoted] = useState(readVoted);
  const [tally, setTally] = useState<TallyRow[] | null>(null);
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://haleo.studio";

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("city_vote_tally" as never, { max_rows: 50 } as never);
    if (e) console.warn("city tally failed", e);
    setTally(((data as TallyRow[] | null) ?? []).map((r) => ({ ...r, votes: Number(r.votes), total_votes: Number(r.total_votes), total_cities: Number(r.total_cities) })));
  }, []);

  useEffect(() => {
    track("city_next_viewed", { from, has_zip: !!zip, shared: !!shared });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const board = useMemo(() => leaderboard(tally ?? [], voted?.key), [tally, voted]);
  const totals = tally?.[0] ? { votes: tally[0].total_votes, cities: tally[0].total_cities } : null;
  const mine = tally?.find((r) => r.city_key === voted?.key);
  const sj = city.trim().length > 1 && isSanJose(city, state);

  const vote = async () => {
    const name = tidyCity(city);
    if (name.length < 2) return setError("Which city?");
    if (state && !STATES.has(state)) return setError("Pick the state.");
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("That email doesn't look right. It's optional.");
    setError(null);
    setBusy(true);
    const key = cityKey(name, state || null);
    const { error: e } = await supabase.from("city_votes" as never).insert({
      city: name,
      state: state || null,
      city_key: key,
      zip: /^\d{5}$/.test(zip) ? zip : null,
      email: email.trim() || null,
      role,
      source: from.slice(0, 30),
    } as never);
    setBusy(false);
    // 23505: this email already voted for this city. That's a vote already counted.
    if (e && e.code !== "23505") return setError("That didn't go through. Try once more?");
    const mineNow = { key, city: name, state: state || null };
    try {
      localStorage.setItem(VOTED_KEY, JSON.stringify(mineNow));
    } catch {
      /* private mode: fine */
    }
    setVoted(mineNow);
    track("city_vote_cast", { state: state || null, has_email: !!email.trim(), role, from });
    load();
  };

  const link = voted ? voteLink(origin, voted.city, voted.state) : `${origin}/next`;
  const shareText = voted
    ? `I voted for Haleo to come to ${voted.city}: your home's permit history and the contractors your neighbors actually hired. Add your vote:`
    : "Vote for Haleo to come to your city:";
  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: shareText, url: link });
        track("city_vote_shared", { via: "share_sheet" });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
    }
    if (copyText(`${shareText} ${link}`)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      track("city_vote_shared", { via: "copy" });
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <SiteHeader />
      <div className="container mx-auto max-w-3xl px-4 pb-28 pt-28 sm:px-6 md:pt-32">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Which city next?</p>
        <h1 className="mt-4 font-display text-[2.2rem] font-light leading-[1.06] tracking-tight md:text-[3rem]">
          San José first. <span className="italic">Where should we go next?</span>
        </h1>
        <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
          {zip && !voted
            ? `${zip} is outside San José, and for now we read San José's records only. Vote for your city: the ones with the most votes get Haleo next.`
            : "Haleo reads San José's permit records today. Vote for your city: the ones with the most votes get Haleo next."}
        </p>

        {!voted ? (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-7 rounded-3xl border border-border bg-card p-5 shadow-soft md:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
              <label className="block">
                <span className="text-[13px] font-medium">Your city</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && vote()}
                  placeholder="Palo Alto"
                  autoComplete="address-level2"
                  className="mt-1 min-h-[48px] w-full rounded-xl border border-border bg-background px-3 text-[16px]"
                />
              </label>
              <label className="block">
                <span className="text-[13px] font-medium">State</span>
                <select value={state} onChange={(e) => setState(e.target.value)} className="mt-1 min-h-[48px] w-full rounded-xl border border-border bg-background px-2 text-[16px]">
                  <option value="">–</option>
                  {[...STATES].sort().map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {sj ? (
              <p className="mt-3 rounded-2xl bg-accent-soft/60 p-3 text-[14px]">
                San José is already here.{" "}
                <Link to="/house" className="font-medium underline underline-offset-4">
                  Look up your house
                </Link>
              </p>
            ) : (
              <>
                <label className="mt-4 block">
                  <span className="text-[13px] font-medium">
                    Email <span className="font-normal text-muted-foreground">(optional, and only to tell you when your city opens)</span>
                  </span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="mt-1 min-h-[48px] w-full rounded-xl border border-border bg-background px-3 text-[16px]"
                  />
                </label>
                <div className="mt-4">
                  <span className="text-[13px] font-medium">
                    I'm a <span className="font-normal text-muted-foreground">(optional)</span>
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        aria-pressed={role === r.value}
                        onClick={() => setRole(role === r.value ? null : r.value)}
                        className={`min-h-[40px] rounded-full border px-4 text-[14px] transition-smooth ${role === r.value ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:border-foreground/40"}`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <p className="mt-3 text-[13.5px] text-destructive">{error}</p>}
                <button
                  type="button"
                  onClick={vote}
                  disabled={busy}
                  className="mt-5 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-foreground text-[16px] font-medium text-background disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} Vote for {tidyCity(city) || "my city"}
                </button>
              </>
            )}
          </motion.section>
        ) : (
          <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-7 rounded-3xl border border-accent/30 bg-accent-soft/40 p-5 shadow-soft md:p-6">
            <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">
              <Check className="h-4 w-4" /> Vote counted
            </p>
            <h2 className="mt-2 font-display text-[26px] font-light leading-tight">
              {mine ? (
                <>
                  {voted.city} has <span className="italic">{mine.votes} vote{mine.votes === 1 ? "" : "s"}</span>
                  {mine && board.rows.find((r) => r.mine) ? `, #${board.rows.find((r) => r.mine)!.rank} on the board.` : "."}
                </>
              ) : (
                <>You voted for {voted.city}.</>
              )}
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Every neighbor who votes moves {voted.city} up. Send it to the group chat or post it in your neighborhood thread.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={share} className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-foreground px-5 text-[15px] font-medium text-background">
                {copied ? <Check className="h-4 w-4" /> : navigator.share ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Link copied" : `Get ${voted.city} more votes`}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem(VOTED_KEY);
                  } catch {
                    /* fine */
                  }
                  setVoted(null);
                }}
                className="min-h-[48px] rounded-full px-4 text-[14px] text-muted-foreground underline-offset-4 hover:underline"
              >
                Vote for another city
              </button>
            </div>
          </motion.section>
        )}

        <section className="mt-9">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-[22px] font-light">The board</h2>
            {totals && (
              <p className="text-[13px] text-muted-foreground">
                {totals.votes} vote{totals.votes === 1 ? "" : "s"} from {totals.cities} cit{totals.cities === 1 ? "y" : "ies"}
              </p>
            )}
          </div>
          {tally === null ? (
            <p className="mt-3 flex items-center gap-2 text-[14px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-accent" /> Counting votes…
            </p>
          ) : board.rows.length === 0 ? (
            <p className="mt-3 text-[15px] text-muted-foreground">No votes yet. Yours puts your city at the top.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {board.rows.map((r) => (
                <li key={r.city_key} className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${r.mine ? "border-accent/50 bg-accent-soft/40" : "border-border bg-card"}`}>
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-accent/10"
                    initial={{ width: 0 }}
                    animate={{ width: `${(r.votes / board.max) * 100}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                  <span className="relative flex items-center justify-between gap-3 text-[15px]">
                    <span className="min-w-0 truncate">
                      <span className="mr-2 tabular-nums text-muted-foreground">{r.rank}</span>
                      {r.city}
                      {r.state ? `, ${r.state}` : ""}
                      {r.mine && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">You</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{r.votes}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <Link
          to="/house"
          className="mt-10 flex items-center justify-between gap-3 rounded-3xl border border-border bg-card p-5 shadow-soft transition-smooth hover:-translate-y-0.5"
        >
          <span>
            <span className="block text-[15px] font-medium">Know a home in San José?</span>
            <span className="block text-[13.5px] text-muted-foreground">See every permit the city has on file for it, free.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      </div>
    </main>
  );
}
