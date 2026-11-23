// The house card: the home's record on one image, ready to text, post or
// save. What's on screen is exactly what gets shared (the image is taken from
// this card), and every card carries the way back to Haleo: "What's on file
// for your house?" with a link and a QR code to the free lookup.
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toBlob } from "html-to-image";
import { Check, ClipboardCopy, Download, Loader2, MessageCircle, Share2 } from "lucide-react";
import { track } from "@/lib/analytics";
import type { HouseReport, Tone } from "@/lib/houseReport";
import { cardFileName, cardLink, cardLinkLabel, houseCard } from "@/lib/houseCard";
import { smsLink } from "@/lib/houseReport";

const WIDTH = 360; // drawn at 360px, saved at 1080×1620 (2:3): a full phone screen, clean in Messages
const RATIO = 1.5;

// The card's fonts, inlined, so the saved image looks the same on every phone
// (html-to-image can't read the Google Fonts stylesheet across origins).
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Outfit:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Figtree:wght@400;500;600&display=swap";
let fontCache: Promise<string> | null = null;
const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
const embeddedFonts = () =>
  (fontCache ??= (async () => {
    try {
      let css = await (await fetch(FONT_CSS)).text();
      // Latin only: the card is English, and it keeps the image fast.
      css = css
        .split("/*")
        .filter((block) => !block.trim() || /^\s*latin \*\//.test(block))
        .map((block, i) => (i === 0 ? block : `/*${block}`))
        .join("");
      const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))];
      const inlined = await Promise.all(urls.map(async (u) => [u, await toDataUrl(await (await fetch(u)).blob())] as const));
      for (const [u, data] of inlined) css = css.split(u).join(data);
      return css;
    } catch {
      return "";
    }
  })()); // drawn at 340px, saved at 1080px wide (4:5, right for Messages and Instagram)

const TINT: Record<Tone | "unknown", { bg: string; dot: string; chip: string; mark: string }> = {
  clear: { bg: "linear-gradient(160deg,#eef4ee 0%,#fbfaf6 55%)", dot: "#5f8a6b", chip: "#e3eee5;#3f6b4c", mark: "✓" },
  watch: { bg: "linear-gradient(160deg,#fdf0d8 0%,#fbfaf6 55%)", dot: "#d08a1c", chip: "#fbe9c6;#94600d", mark: "!" },
  act: { bg: "linear-gradient(160deg,#fbe4df 0%,#fbfaf6 55%)", dot: "#c2412d", chip: "#f8dcd6;#9a2f1f", mark: "!" },
  unknown: { bg: "linear-gradient(160deg,#efeeea 0%,#fbfaf6 55%)", dot: "#a3a29c", chip: "#ecebe6;#5d5c57", mark: "?" },
};

type Props = {
  report: HouseReport;
  street: string;
  zip: string;
  /** The same record as text, with a link, for "Text it" and "Copy text". */
  message: string;
};

const MARK = { clear: "✓", zone: "!", unrated: "?", unchecked: "?" } as const;
const ZONE_WORD = { clear: "Clear", zone: "Zone", unrated: "Unrated", unchecked: "—" } as const;
const HISTORY_MARK = {
  done: { glyph: "✓", word: "Signed off", color: "#5f8a6b" },
  open: { glyph: "•", word: "Open", color: "#d08a1c" },
  unfinished: { glyph: "!", word: "No final", color: "#c2412d" },
  unknown: { glyph: "?", word: "Unclear", color: "#a3a29c" },
} as const;
const MARK_COLOR = { clear: "#5f8a6b", zone: "#d08a1c", unrated: "#a3a29c", unchecked: "#a3a29c" } as const;

const tile: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #ece9e1",
  borderRadius: 18,
  padding: "10px 10px 11px",
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};
const tileLabel: React.CSSProperties = { fontSize: 8.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a877f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const tileValue: React.CSSProperties = { fontFamily: '"Outfit", sans-serif', fontSize: 14.5, fontWeight: 500, lineHeight: 1.15, marginTop: 6, letterSpacing: "-0.01em", whiteSpace: "nowrap" };
const tileDetail: React.CSSProperties = { fontSize: 10, lineHeight: 1.3, color: "#6f6c64", marginTop: 4 };

export default function HouseCard({ report, street, zip, message }: Props) {
  const [hideNumber, setHideNumber] = useState(false);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [done, setDone] = useState<"shared" | "saved" | "copied" | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // On narrow phones the preview scales down to fit; the saved image is always full size.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / WIDTH)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Phones: once the card scrolls away, a slim bar keeps "Share your house card" one tap away.
  const [cardGone, setCardGone] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCardGone(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://haleo.studio";
  const onPhone = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);
  const card = useMemo(() => houseCard(report, { street, zip, hideNumber }), [report, street, zip, hideNumber]);
  const tint = TINT[card.badge.tone];

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(cardLink(origin), { margin: 0, width: 240, color: { dark: "#1c1b19", light: "#ffffff" } })
      .then((url) => alive && setQr(url))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [origin]);

  const image = async (): Promise<File | null> => {
    if (!cardRef.current) return null;
    const fontEmbedCSS = await embeddedFonts();
    const blob = await toBlob(cardRef.current, {
      pixelRatio: 1080 / WIDTH,
      cacheBust: true,
      backgroundColor: "#fbfaf6",
      ...(fontEmbedCSS ? { fontEmbedCSS } : { skipFonts: true }),
    });
    return blob ? new File([blob], cardFileName(card.place), { type: "image/png" }) : null;
  };

  const save = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const flash = (d: "shared" | "saved" | "copied") => {
    setDone(d);
    setTimeout(() => setDone(null), 2400);
  };

  const share = async () => {
    setBusy("share");
    try {
      const file = await image();
      if (!file) return;
      const text = `${card.place}: ${card.verdict.join(" ")} What's on file for your house? ${cardLink(origin)}`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        track("house_card_shared", { tone: report.tone, hidden_number: hideNumber, via: "share_sheet" });
        flash("shared");
      } else {
        save(file);
        track("house_card_shared", { tone: report.tone, hidden_number: hideNumber, via: "download" });
        flash("saved");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") console.warn("house card share failed", e);
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    setBusy("download");
    try {
      const file = await image();
      if (!file) return;
      save(file);
      track("house_card_downloaded", { tone: report.tone, hidden_number: hideNumber });
      flash("saved");
    } catch (e) {
      console.warn("house card download failed", e);
    } finally {
      setBusy(null);
    }
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(message);
      track("house_report_shared", { tone: report.tone, via: "copy" });
      flash("copied");
    } catch {
      /* clipboard blocked */
    }
  };

  const pill = "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-smooth disabled:opacity-60";

  return (
    <div>
      <div ref={boxRef} className="mx-auto w-full" style={{ maxWidth: WIDTH, height: WIDTH * RATIO * scale }}>
        <div style={{ width: WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {/* The card. Inline styles, so the saved image matches the screen exactly. */}
          <div
            ref={cardRef}
            data-testid="house-card"
            style={{
              width: WIDTH,
              height: WIDTH * RATIO,
              background: tint.bg,
              borderRadius: 32,
              border: "1px solid #e7e4dc",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              fontFamily: '"Figtree", ui-sans-serif, system-ui, sans-serif',
              color: "#1c1b19",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, background: "#f59e0b", display: "grid", placeItems: "center", fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: 13 }}>h</span>
                <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 500, fontSize: 15, letterSpacing: "-0.01em" }}>Haleo</span>
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a877f" }}>Home record · {card.checkedOn}</span>
            </div>

            <div style={{ marginTop: 14, fontFamily: '"Outfit", sans-serif', fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.15 }}>
              {card.place} <span style={{ color: "#8a877f", fontWeight: 400, fontSize: 13 }}>{card.city}</span>
            </div>
            <div style={{ marginTop: 6, fontFamily: '"Outfit", sans-serif', fontSize: 25, fontWeight: 300, lineHeight: 1.06, letterSpacing: "-0.02em" }}>
              {card.verdict[0]} <span style={{ fontStyle: "italic" }}>{card.verdict[1]}</span>
            </div>

            {/* The home's own record: its permit history, newest first. */}
            <div style={{ marginTop: 14, background: "#ffffff", border: "1px solid #ece9e1", borderRadius: 20, padding: "12px 14px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={tileLabel}>Permit history</span>
                <span style={{ fontSize: 9.5, color: card.house.tone === "act" ? "#9a2f1f" : "#8a877f", fontWeight: 600 }}>{card.house.value}</span>
              </div>
              {card.history.length ? (
                <div style={{ marginTop: 6 }}>
                  {card.history.map((h, i) => (
                    <div
                      key={i}
                      style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", borderTop: i ? "1px solid #f2efe8" : "none", fontSize: 12 }}
                    >
                      <span style={{ width: 30, color: "#8a877f", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{h.year ?? "—"}</span>
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.what}</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9.5, fontWeight: 600, color: HISTORY_MARK[h.mark].color, flexShrink: 0 }}>
                        <span style={{ width: 14, height: 14, borderRadius: 999, background: HISTORY_MARK[h.mark].color, color: "#fff", fontSize: 8.5, display: "grid", placeItems: "center" }}>
                          {HISTORY_MARK[h.mark].glyph}
                        </span>
                        {HISTORY_MARK[h.mark].word}
                      </span>
                    </div>
                  ))}
                  {card.historyMore > 0 && <div style={{ fontSize: 10, color: "#8a877f", marginTop: 3 }}>+ {card.historyMore} more on file</div>}
                </div>
              ) : (
                <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.4 }}>{card.house.detail ?? "No open or expired permits on file."}</div>
              )}
              {card.crew.length > 0 && (
                <div style={{ marginTop: 7, paddingTop: 7, borderTop: "1px solid #f2efe8", fontSize: 10.5, color: "#6f6c64", lineHeight: 1.35 }}>
                  Work by <span style={{ color: "#1c1b19", fontWeight: 500 }}>{card.crew.join(", ")}</span>
                </div>
              )}
            </div>

            {/* The zones the house sits in. */}
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {card.ground.map((g) => (
                <div key={g.label} style={{ background: "#ffffff", border: "1px solid #ece9e1", borderRadius: 14, padding: "7px 9px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11.5 }}>{g.label}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 600, color: MARK_COLOR[g.status] }}>
                    {ZONE_WORD[g.status]}
                    <span style={{ width: 15, height: 15, borderRadius: 999, background: MARK_COLOR[g.status], color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center" }}>
                      {MARK[g.status]}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            {card.highlight && (
              <div style={{ marginTop: 11, display: "flex", gap: 8, fontSize: 12, lineHeight: 1.4, padding: "0 2px", fontWeight: 500 }}>
                <span style={{ width: 16, height: 16, borderRadius: 999, background: TINT[card.highlight.tone].dot, color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                  {TINT[card.highlight.tone].mark}
                </span>
                <span>{card.highlight.text}</span>
              </div>
            )}

            <div style={{ flex: 1 }} />

            <div style={{ marginTop: 8, fontSize: 8, color: "#8a877f", lineHeight: 1.35, padding: "0 2px" }}>From public records: {card.sources}.</div>
            <div style={{ marginTop: 7, background: "#1c1b19", color: "#fbfaf6", borderRadius: 22, padding: "10px 10px 10px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontFamily: '"Outfit", sans-serif', fontSize: 14.5, lineHeight: 1.15 }}>
                  What's on file for <span style={{ fontStyle: "italic" }}>your</span> house?
                </div>
                <div style={{ fontSize: 10.5, color: "#f5c46b", marginTop: 3 }}>Look yours up free · {cardLinkLabel(origin)}</div>
              </div>
              <div style={{ width: 48, height: 48, background: "#ffffff", borderRadius: 12, padding: 5, flexShrink: 0, boxSizing: "border-box" }}>
                {qr && <img src={qr} alt="" style={{ width: "100%", height: "100%", display: "block" }} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share it: one quiet row, so the next steps stay the main event. */}
      <div className="mx-auto mt-3 flex flex-wrap items-center justify-center gap-2" style={{ maxWidth: WIDTH }}>
        <button type="button" onClick={share} disabled={!!busy} className={`${pill} flex-1 bg-foreground text-background hover:opacity-90`}>
          {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : done === "shared" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          {done === "shared" ? "Shared" : "Share"}
        </button>
        {onPhone ? (
          <a
            href={smsLink(message)}
            onClick={() => track("house_report_shared", { tone: report.tone, via: "sms" })}
            className={`${pill} flex-1 border border-border hover:bg-secondary`}
          >
            <MessageCircle className="h-4 w-4" /> Text
          </a>
        ) : (
          <button type="button" onClick={copyText} className={`${pill} flex-1 border border-border hover:bg-secondary`}>
            {done === "copied" ? <Check className="h-4 w-4 text-sage" /> : <ClipboardCopy className="h-4 w-4" />}
            {done === "copied" ? "Copied" : "Copy text"}
          </button>
        )}
        <button type="button" onClick={download} disabled={!!busy} aria-label="Download the card" className={`${pill} border border-border px-3.5 hover:bg-secondary`}>
          {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : done === "saved" ? <Check className="h-4 w-4 text-sage" /> : <Download className="h-4 w-4" />}
          <span className="hidden sm:inline">{done === "saved" ? "Saved" : "Save"}</span>
        </button>
      </div>
      <label className="mx-auto flex min-h-[40px] cursor-pointer items-center justify-center gap-2 text-[13px] text-muted-foreground" style={{ maxWidth: WIDTH }}>
        <input type="checkbox" checked={hideNumber} onChange={(e) => setHideNumber(e.target.checked)} className="h-4 w-4 accent-foreground" />
        Hide my house number, to post on Nextdoor
      </label>

      {/* The sticky bar, phones only, once the card is out of view. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-300 lg:hidden ${
          cardGone ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!cardGone}
      >
        <div className="mx-auto flex max-w-md items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-[13.5px]">
            <span className="font-medium">{card.place}</span>
            <span className="text-muted-foreground"> · {card.verdict.join(" ")}</span>
          </p>
          <button type="button" onClick={share} disabled={!!busy} tabIndex={cardGone ? 0 : -1} className={`${pill} shrink-0 bg-foreground px-4 text-background`}>
            {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share card
          </button>
        </div>
      </div>
    </div>
  );
}
