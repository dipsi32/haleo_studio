// The house card: the home's record on one image, ready to text, post or
// save. What's on screen is exactly what gets shared (the image is taken from
// this card), and every card carries the way back to Haleo: "What's on file
// for your house?" with a link and a QR code to the free lookup.
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { toBlob } from "html-to-image";
import { Check, Download, EyeOff, Loader2, Share2 } from "lucide-react";
import { track } from "@/lib/analytics";
import type { HouseReport, Tone } from "@/lib/houseReport";
import { cardFileName, cardLink, cardLinkLabel, houseCard } from "@/lib/houseCard";

const WIDTH = 340;

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

type Props = { report: HouseReport; street: string; zip: string };

export default function HouseCard({ report, street, zip }: Props) {
  const [hideNumber, setHideNumber] = useState(false);
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [done, setDone] = useState<"shared" | "saved" | null>(null);
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
  const origin = typeof window !== "undefined" ? window.location.origin : "https://haleo.studio";
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

  const flash = (d: "shared" | "saved") => {
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


  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-soft md:p-7">
      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* The card. Inline styles, so the saved image matches the screen exactly. */}
        <div ref={boxRef} className="mx-auto w-full shrink-0" style={{ maxWidth: WIDTH, height: WIDTH * 1.25 * scale }}>
          <div style={{ width: WIDTH, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <div
            ref={cardRef}
            data-testid="house-card"
            style={{
              width: WIDTH,
              height: WIDTH * 1.25,
              background: tint.bg,
              borderRadius: 26,
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
                <span style={{ width: 22, height: 22, borderRadius: 999, background: "#f59e0b", color: "#1c1b19", display: "grid", placeItems: "center", fontFamily: '"Outfit", sans-serif', fontWeight: 600, fontSize: 13 }}>h</span>
                <span style={{ fontFamily: '"Outfit", sans-serif', fontWeight: 500, fontSize: 15, letterSpacing: "-0.01em" }}>Haleo</span>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8a877f" }}>Home record</span>
            </div>

            <div style={{ marginTop: 13 }}>
              <div style={{ fontFamily: '"Outfit", sans-serif', fontSize: 19, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.15 }}>{card.place}</div>
              <div style={{ fontSize: 12, color: "#6f6c64", marginTop: 2 }}>{card.city}</div>
            </div>

            <div style={{ marginTop: 10, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontFamily: '"Outfit", sans-serif', fontSize: 23, fontWeight: 300, lineHeight: 1.08, letterSpacing: "-0.02em" }}>
                {card.verdict[0]} <span style={{ fontStyle: "italic" }}>{card.verdict[1]}</span>
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {card.rows.map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5, lineHeight: 1.3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: TINT[r.tone].dot, flexShrink: 0, transform: "translateY(-1px)" }} />
                  <span style={{ color: "#8a877f", width: 86, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                  <span style={{ fontWeight: 500 }}>{r.value}</span>
                </div>
              ))}
            </div>

            {card.highlight && (
              <div style={{ marginTop: 11, background: "#ffffff", border: "1px solid #ece9e1", borderRadius: 14, padding: "8px 10px", fontSize: 11.5, lineHeight: 1.38, display: "flex", gap: 8 }}>
                <span style={{ width: 16, height: 16, borderRadius: 999, background: TINT[card.highlight.tone].dot, color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                  {TINT[card.highlight.tone].mark}
                </span>
                <span>{card.highlight.text}</span>
              </div>
            )}

            <div style={{ flex: 1 }} />

            <div style={{ marginTop: 10, fontSize: 8.5, color: "#8a877f", lineHeight: 1.35 }}>
              Public records, read {card.checkedOn}: {card.sources}.
            </div>

            <div style={{ marginTop: 8, background: "#1c1b19", color: "#fbfaf6", borderRadius: 16, padding: "10px 10px 10px 13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontFamily: '"Outfit", sans-serif', fontSize: 14, lineHeight: 1.15 }}>
                  What's on file for <span style={{ fontStyle: "italic" }}>your</span> house?
                </div>
                <div style={{ fontSize: 10.5, color: "#f5c46b", marginTop: 3 }}>Look yours up free · {cardLinkLabel(origin)}</div>
              </div>
              <div style={{ width: 46, height: 46, background: "#ffffff", borderRadius: 8, padding: 4, flexShrink: 0, boxSizing: "border-box" }}>
                {qr && <img src={qr} alt="" style={{ width: "100%", height: "100%", display: "block" }} />}
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* What to do with it */}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[22px] leading-snug">
            Your house, <span className="italic">on one card</span>
          </h3>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted-foreground">
            The verdict and the facts, ready to text your partner, send your agent or keep with your records. Whoever gets it can look up
            their own house.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={share}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-[14.5px] font-medium text-background transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : done === "shared" ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {done === "shared" ? "Shared" : "Share the card"}
            </button>
            <button
              type="button"
              onClick={download}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-5 py-2.5 text-[14.5px] font-medium transition-smooth hover:bg-secondary disabled:opacity-60"
            >
              {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : done === "saved" ? <Check className="h-4 w-4 text-sage" /> : <Download className="h-4 w-4" />}
              {done === "saved" ? "Saved" : "Download"}
            </button>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[14px] text-muted-foreground">
            <input type="checkbox" checked={hideNumber} onChange={(e) => setHideNumber(e.target.checked)} className="h-4 w-4 accent-foreground" />
            <EyeOff className="h-4 w-4" /> Hide my house number, for posting on Nextdoor
          </label>
        </div>
      </div>
    </section>
  );
}
