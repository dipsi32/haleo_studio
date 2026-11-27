// House Wrapped: the house's life story from the city's file, told like a
// year-in-review. Tap through a few full-screen moments, then land on one
// card made for Instagram stories and group texts. Every share carries the
// way in: "What's your house's story?" with haleo.studio/wrapped and a QR.
// Every fact is from the city's record. The persona is labelled "Our read".
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import QRCode from "qrcode";
import { Check, Download, Loader2, RotateCcw, Share2, X } from "lucide-react";
import { track } from "@/lib/analytics";
import type { HouseReport } from "@/lib/houseReport";
import { topKinds } from "@/lib/houseReport";
import { streetOnly } from "@/lib/houseCard";
import { fromRow, houseStory, storyLine } from "@/lib/houseStory";
import { elementImage, saveFile, shareFile } from "./shareImage";

const W = 360; // drawn at 360×640, saved at 1080×1920 (9:16, a full story)
const H = 640;
const SLIDE_MS = 4800;

const INK = "#1c1b19";
const CREAM = "#fbf6ea";
const BACKDROPS = [
  "radial-gradient(120% 80% at 20% 10%, #f6b452 0%, #e0763a 45%, #7a2f22 100%)",
  "radial-gradient(120% 80% at 80% 0%, #9fc3a6 0%, #3f6b4c 55%, #17301f 100%)",
  "radial-gradient(120% 80% at 10% 90%, #f3d9a8 0%, #c98b4b 50%, #4a2d1a 100%)",
  "radial-gradient(120% 80% at 90% 80%, #b9c7f0 0%, #5767b0 55%, #1d2350 100%)",
  "radial-gradient(120% 80% at 50% 0%, #f2a7a0 0%, #b5525a 55%, #3d1620 100%)",
  "radial-gradient(120% 80% at 30% 20%, #e9e3d3 0%, #8a8270 60%, #2a2722 100%)",
];

const titleCase = (s: string) => s.trim().replace(/\s+/g, " ").replace(/\b([a-z])/g, (m) => m.toUpperCase());

type Props = { report: Pick<HouseReport, "rows" | "street">; street: string; zip: string; onClose: () => void; onLooseEnds?: () => void };

export default function HouseWrapped({ report, street, zip, onClose, onLooseEnds }: Props) {
  const story = useMemo(() => {
    const loose = report.rows.filter((r) => r.state === "expired" || r.state === "open").length;
    return houseStory(report.rows.map(fromRow), loose);
  }, [report.rows]);
  const [hideNumber, setHideNumber] = useState(true);
  const place = hideNumber ? streetOnly(street) : titleCase(street);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://haleo.studio";
  const link = `${origin}/wrapped`;
  const linkLabel = `${origin.replace(/^https?:\/\//, "")}/wrapped`;
  const firstLoose = report.rows.find((r) => r.state === "expired" || r.state === "open");
  const age = story.since ? new Date().getFullYear() - story.since : null;
  const fav = report.street ? topKinds(report.street.kinds, 1) : null;

  // The slides, in order. Only what the record supports makes it in.
  const slides = useMemo(() => {
    const s: { key: string; body: React.ReactNode }[] = [];
    s.push({
      key: "intro",
      body: (
        <>
          <Kicker>House Wrapped</Kicker>
          <Big>{streetOnly(street)},</Big>
          <Big italic>wrapped.</Big>
          <Small>The story of your house, from the City of San José's own file.</Small>
        </>
      ),
    });
    if (story.since)
      s.push({
        key: "since",
        body: (
          <>
            <Kicker>On the city's books since</Kicker>
            <Huge>{story.since}</Huge>
            <Small>{age ? `${age} years of paperwork. ` : ""}That's the oldest permit the city has on file for this address.</Small>
          </>
        ),
      });
    s.push({
      key: "count",
      body: story.permits ? (
        <>
          <Kicker>In that time</Kicker>
          <Huge>{story.permits}</Huge>
          <Big>permit{story.permits === 1 ? "" : "s"}.</Big>
          <Small>
            {story.signedOff} signed off by the city{story.decade ? `. Its busiest decade: the ${story.decade.decade}s, with ${story.decade.count}.` : "."}
          </Small>
        </>
      ) : (
        <>
          <Kicker>On file</Kicker>
          <Big>No permits yet.</Big>
          <Small>The city's online file is empty for this address. Older work often predates online records.</Small>
        </>
      ),
    });
    if (story.moments.length)
      s.push({
        key: "moments",
        body: (
          <>
            <Kicker>The big moments</Kicker>
            <ol className="mt-5 space-y-4">
              {story.moments.map((m, i) => (
                <motion.li key={m.kind} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.45 }} className="flex items-baseline gap-4">
                  <span className="w-14 shrink-0 font-display text-[28px] font-light tabular-nums">{m.year}</span>
                  <span className="text-[19px] leading-snug">{m.line.replace(/ in \d{4}$/, "")}</span>
                </motion.li>
              ))}
            </ol>
          </>
        ),
      });
    if (report.street && report.street.total > 0)
      s.push({
        key: "street",
        body: (
          <>
            <Kicker>Meanwhile, on {report.street.name}</Kicker>
            <Huge>{report.street.total}</Huge>
            <Big>permits next door.</Big>
            <Small>{fav ? `The neighbors' favorite project: ${fav}.` : "Your street keeps the city busy."}</Small>
          </>
        ),
      });
    s.push({
      key: "persona",
      body: (
        <>
          <Kicker>Your house is</Kicker>
          <Big italic>{story.persona.name}.</Big>
          <Small>{story.persona.line}</Small>
          <p className="mt-6 inline-flex rounded-full border border-white/40 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/80">Our read</p>
        </>
      ),
    });
    if (firstLoose)
      s.push({
        key: "loose",
        body: (
          <>
            <Kicker>One loose end</Kicker>
            <Big>
              {story.looseEnds === 1 ? "One permit" : `${story.looseEnds} permits`} never got {story.looseEnds === 1 ? "its" : "their"} final.
            </Big>
            <Small>
              {`Start with the ${firstLoose.year ? `${firstLoose.year} ` : ""}one: ${firstLoose.what}. `}Unfinished permits follow a house to the sale. Closing one is often a single inspection.
            </Small>
            {onLooseEnds && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLooseEnds();
                }}
                className="relative z-10 mt-6 inline-flex min-h-[44px] items-center rounded-full bg-white px-5 text-[14px] font-medium text-[#1c1b19]"
              >
                See how to close it
              </button>
            )}
          </>
        ),
      });
    s.push({ key: "card", body: null });
    return s;
  }, [story, street, report.street, fav, age, firstLoose, onLooseEnds]);

  const [i, setI] = useState(0);
  const last = slides.length - 1;
  const onCard = i === last;
  const next = useCallback(() => setI((x) => Math.min(x + 1, last)), [last]);
  const prev = useCallback(() => setI((x) => Math.max(x - 1, 0)), []);

  useEffect(() => {
    track("house_wrapped_opened", { permits: story.permits, moments: story.moments.length });
  }, [story.permits, story.moments.length]);
  useEffect(() => {
    if (onCard) track("house_wrapped_completed", { permits: story.permits });
  }, [onCard, story.permits]);
  // Auto-advance, like a story. Stops on the card.
  useEffect(() => {
    if (onCard) return;
    const t = setTimeout(next, slides[i].key === "moments" ? SLIDE_MS + story.moments.length * 450 : SLIDE_MS);
    return () => clearTimeout(t);
  }, [i, onCard, next, slides, story.moments.length]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", k);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={`${streetOnly(street)}, wrapped`}
    >
      <div className="relative h-full w-full max-w-[480px] overflow-hidden sm:h-[min(92vh,860px)] sm:rounded-[28px]">
        {/* Progress */}
        <div className="absolute inset-x-3 top-3 z-20 flex gap-1.5">
          {slides.map((s, n) => (
            <div key={s.key} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
              <motion.div
                key={`${s.key}-${i}`}
                className="h-full bg-white"
                initial={{ width: n < i ? "100%" : "0%" }}
                animate={{ width: n < i || (n === i && onCard) ? "100%" : n === i ? "100%" : "0%" }}
                transition={n === i && !onCard ? { duration: (s.key === "moments" ? SLIDE_MS + story.moments.length * 450 : SLIDE_MS) / 1000, ease: "linear" } : { duration: 0 }}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-6 z-30 grid h-11 w-11 place-items-center rounded-full text-white/90 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>

        <AnimatePresence mode="wait">
          {!onCard ? (
            <motion.div
              key={slides[i].key}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex flex-col justify-center px-8 pb-16 pt-20 text-white"
              style={{ background: BACKDROPS[i % BACKDROPS.length] }}
            >
              {/* Tap left to go back, right to go on. */}
              <button type="button" aria-label="Previous" onClick={prev} className="absolute inset-y-0 left-0 z-0 w-1/3" />
              <button type="button" aria-label="Next" onClick={next} className="absolute inset-y-0 right-0 z-0 w-2/3" />
              <div className="pointer-events-none relative z-10 [&_button]:pointer-events-auto">{slides[i].body}</div>
              <p className="pointer-events-none absolute inset-x-8 bottom-6 text-[11px] text-white/60">From City of San José permit records · Tap to continue</p>
            </motion.div>
          ) : (
            <motion.div key="card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute inset-0 overflow-y-auto bg-[#141311] px-4 pb-8 pt-12">
              <WrappedCard
                place={place}
                zip={zip}
                hideNumber={hideNumber}
                story={story}
                link={link}
                linkLabel={linkLabel}
                onHideNumber={setHideNumber}
                onReplay={() => setI(0)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const Kicker = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-white/80">{children}</p>
);
const Huge = ({ children }: { children: React.ReactNode }) => (
  <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mt-3 font-display text-[96px] font-light leading-none tabular-nums tracking-tight">
    {children}
  </motion.p>
);
const Big = ({ children, italic }: { children: React.ReactNode; italic?: boolean }) => (
  <motion.p
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.25 }}
    className={`mt-2 font-display text-[38px] font-light leading-[1.08] tracking-tight ${italic ? "italic" : ""}`}
  >
    {children}
  </motion.p>
);
const Small = ({ children }: { children: React.ReactNode }) => (
  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-5 max-w-[30ch] text-[16px] leading-relaxed text-white/85">
    {children}
  </motion.p>
);

/** The card they post. What's on screen is exactly the image. */
function WrappedCard({
  place,
  zip,
  hideNumber,
  story,
  link,
  linkLabel,
  onHideNumber,
  onReplay,
}: {
  place: string;
  zip: string;
  hideNumber: boolean;
  story: ReturnType<typeof houseStory>;
  link: string;
  linkLabel: string;
  onHideNumber: (v: boolean) => void;
  onReplay: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const [done, setDone] = useState<"shared" | "saved" | null>(null);

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 0, width: 220, color: { dark: INK, light: CREAM } })
      .then(setQr)
      .catch(() => undefined);
  }, [link]);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / W)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fileName = `haleo-wrapped-${place.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
  const image = () => (ref.current ? elementImage(ref.current, { name: fileName, width: 1080, drawnAt: W, background: INK }) : Promise.resolve(null));

  const go = async (how: "share" | "save") => {
    setBusy(how);
    try {
      const file = await image();
      if (!file) return;
      const text = `${storyLine(place, story)} What's your house's story? ${link}`;
      const result = how === "share" ? await shareFile(file, text) : (saveFile(file), "saved" as const);
      track(how === "share" ? "house_wrapped_shared" : "house_wrapped_downloaded", { via: result, hidden_number: hideNumber, permits: story.permits });
      setDone(result);
      setTimeout(() => setDone(null), 2400);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") console.warn("wrapped share failed", e);
    } finally {
      setBusy(null);
    }
  };

  const facts = [
    story.since ? { n: String(story.since), l: "on the books since" } : null,
    { n: String(story.permits), l: story.permits === 1 ? "permit" : "permits" },
    story.permits ? { n: String(story.signedOff), l: "signed off" } : null,
  ].filter(Boolean) as { n: string; l: string }[];

  return (
    <div className="mx-auto w-full max-w-[380px]">
      <div ref={boxRef} className="mx-auto w-full" style={{ height: H * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: W }}>
          <div
            ref={ref}
            style={{
              width: W,
              height: H,
              borderRadius: 28,
              overflow: "hidden",
              position: "relative",
              background: `radial-gradient(130% 70% at 85% 0%, #e0763a 0%, rgba(224,118,58,0) 55%), radial-gradient(120% 70% at 0% 100%, #3f6b4c 0%, rgba(63,107,76,0) 60%), ${INK}`,
              color: CREAM,
              fontFamily: "Figtree, system-ui, sans-serif",
              padding: "30px 26px 22px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 600, opacity: 0.8 }}>House Wrapped · Haleo</div>
            <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 300, fontSize: 38, lineHeight: 1.04, marginTop: 14, letterSpacing: "-0.01em" }}>{place}</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>San José{hideNumber ? "" : ` ${zip}`}</div>

            <div style={{ display: "flex", gap: 18, marginTop: 24 }}>
              {facts.map((f) => (
                <div key={f.l}>
                  <div style={{ fontFamily: "Outfit, sans-serif", fontWeight: 300, fontSize: 34, lineHeight: 1 }}>{f.n}</div>
                  <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 5, maxWidth: 82, lineHeight: 1.25 }}>{f.l}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 24, borderTop: "1px solid rgba(251,246,234,0.18)", paddingTop: 16, flex: 1 }}>
              {story.moments.length ? (
                story.moments.map((m) => (
                  <div key={m.kind} style={{ display: "flex", gap: 14, alignItems: "baseline", marginBottom: 11 }}>
                    <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 18, width: 44, opacity: 0.9 }}>{m.year}</div>
                    <div style={{ fontSize: 15.5, lineHeight: 1.3 }}>{m.line.replace(/ in \d{4}$/, "")}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.4 }}>A quiet file. The best stories aren't always on paper.</div>
              )}
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.7 }}>This house is</div>
                <div style={{ fontFamily: "Outfit, sans-serif", fontStyle: "italic", fontWeight: 300, fontSize: 26, marginTop: 4 }}>{story.persona.name}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, background: CREAM, color: INK, borderRadius: 18, padding: "11px 12px" }}>
              {qr && <img src={qr} alt="" width={52} height={52} style={{ display: "block" }} />}
              <div>
                <div style={{ fontFamily: "Outfit, sans-serif", fontSize: 16, lineHeight: 1.15 }}>What's your house's story?</div>
                <div style={{ fontSize: 11, marginTop: 3, opacity: 0.75 }}>{linkLabel} · free</div>
              </div>
            </div>
            <div style={{ fontSize: 9, opacity: 0.55, marginTop: 9 }}>From City of San José permit records. "This house is" is our read.</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => go("share")} disabled={!!busy} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-white text-[15px] font-medium text-[#1c1b19] disabled:opacity-60">
          {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : done === "shared" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {done === "shared" ? "Shared" : "Share"}
        </button>
        <button type="button" onClick={() => go("save")} disabled={!!busy} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/30 text-[15px] font-medium text-white disabled:opacity-60">
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : done === "saved" ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {done === "saved" ? "Saved" : "Save image"}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between text-[13px] text-white/75">
        <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2">
          <input type="checkbox" checked={!hideNumber} onChange={(e) => onHideNumber(!e.target.checked)} className="h-4 w-4 accent-white" />
          Show my house number
        </label>
        <button type="button" onClick={onReplay} className="inline-flex min-h-[40px] items-center gap-1.5 hover:text-white">
          <RotateCcw className="h-3.5 w-3.5" /> Replay
        </button>
      </div>
    </div>
  );
}
