// A house's birth certificate: its whole public history on one page, made to
// print and frame. Realtors give it at closing ("Presented to … by …"); buyers
// keep it. Every line is the City of San José's record, dated, with the way
// back to Haleo printed at the foot (link and QR).
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { track } from "@/lib/analytics";
import { houseAddress, houseUrl, isSanJoseZip, looksLikeStreet } from "@/lib/houseLookup";
import { useHomeData } from "@/lib/useHomeData";
import { houseReport } from "@/lib/houseReport";
import { certificateEntries, fromRow, houseStory } from "@/lib/houseStory";

const MAX_LINES = 26;
const titleCase = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default function HouseCertificate() {
  const [params] = useSearchParams();
  const street = params.get("street") ?? "";
  const zip = params.get("zip") ?? "";
  const ok = looksLikeStreet(street) && isSanJoseZip(zip);
  const address = useMemo(() => (ok ? houseAddress(street, zip) : undefined), [ok, street, zip]);
  const data = useHomeData(address);
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [note, setNote] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "https://haleo.studio";
  const today = useMemo(() => new Date(), []);

  const r = useMemo(
    () => (address ? houseReport({ street, zip, signal: data.signal, parcel: data.parcel, inspections: data.inspections, reader: "owner" }) : null),
    [address, street, zip, data.signal, data.parcel, data.inspections],
  );
  const entries = useMemo(() => (r ? certificateEntries(r.rows) : []), [r]);
  const story = useMemo(() => (r ? houseStory(r.rows.map(fromRow)) : null), [r]);
  const ready = !!address && (data.settled || (data.parcel && data.cityDone));
  const prop = data.city?.property ?? null;
  const lot = prop?.facts.find((f) => /lot size/i.test(f.label))?.value ?? null;

  useEffect(() => {
    QRCode.toDataURL(`${origin}/house?ref=certificate`, { margin: 0, width: 200, color: { dark: "#2a2620", light: "#fdfaf3" } })
      .then(setQr)
      .catch(() => undefined);
  }, [origin]);

  const print = () => {
    track("house_certificate_printed", { has_to: !!to.trim(), has_from: !!from.trim(), permits: entries.length });
    window.print();
  };

  if (!ok)
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="font-display text-[26px] font-light">Look up a San José address first.</p>
        <Link to="/house" className="mt-4 inline-block text-accent underline-offset-4 hover:underline">
          Look up a house
        </Link>
      </main>
    );

  const shown = entries.slice(-MAX_LINES);
  const hidden = entries.length - shown.length;

  return (
    <main className="min-h-screen bg-[#ece6d8] print:bg-white">
      <style>{`@page { size: letter; margin: 0.45in; } @media print { html, body { background: #fff; } }`}</style>

      {/* The controls: on screen only. */}
      <div className="mx-auto max-w-[8.5in] px-4 pb-4 pt-6 print:hidden">
        <Link to={houseUrl(street, zip)} className="inline-flex min-h-[40px] items-center gap-1.5 text-[13.5px] text-foreground/70 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the house
        </Link>
        <h1 className="mt-2 font-display text-[28px] font-light leading-tight">
          A birth certificate <span className="italic">for the house</span>
        </h1>
        <p className="mt-1 max-w-xl text-[14.5px] text-muted-foreground">
          Its whole history from the city's records, on one page to print and frame. Giving it as a closing gift? Add who it's for and who it's from. Both
          are optional.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <input value={to} onChange={(e) => setTo(e.target.value)} maxLength={60} placeholder="Presented to (optional)" className="min-h-[44px] rounded-xl border border-border bg-card px-3 text-[14px]" />
          <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={70} placeholder="From, e.g. Jane Lee, Compass (optional)" className="min-h-[44px] rounded-xl border border-border bg-card px-3 text-[14px]" />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={90} placeholder="A short note (optional)" className="min-h-[44px] rounded-xl border border-border bg-card px-3 text-[14px]" />
        </div>
        <button
          type="button"
          onClick={print}
          disabled={!ready}
          className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background disabled:opacity-50"
        >
          <Printer className="h-4 w-4" /> Print or save as PDF
        </button>
      </div>

      {/* The certificate. */}
      <div className="mx-auto max-w-[8.5in] px-4 pb-16 print:max-w-none print:p-0">
        <article
          className="relative bg-[#fdfaf3] text-[#2a2620] shadow-lift print:shadow-none"
          style={{ fontFamily: "Figtree, system-ui, sans-serif", aspectRatio: "8.5 / 11", minHeight: "auto" }}
        >
          <div className="absolute inset-[14px] border border-[#b79a63] print:inset-[6px]" />
          <div className="absolute inset-[20px] border-[3px] border-double border-[#b79a63] print:inset-[12px]" />

          {!ready ? (
            <div className="flex h-full min-h-[60vh] items-center justify-center gap-3 text-[15px] text-[#6b6150]">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the city's file…
            </div>
          ) : (
            <div className="relative flex h-full flex-col px-[7%] pb-[5%] pt-[6%]">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-[#8a7445]">City of San José · Public record</p>
              <h2 className="mt-3 text-center font-display text-[clamp(26px,5vw,44px)] font-light leading-none">
                Birth Certificate <span className="italic">of a House</span>
              </h2>
              <div className="mx-auto mt-3 h-px w-24 bg-[#b79a63]" />
              <p className="mt-4 text-center text-[12.5px] text-[#6b6150]">This certifies the life on record of</p>
              <p className="mt-1 text-center font-display text-[clamp(22px,4vw,34px)] font-light">{titleCase(street)}</p>
              <p className="text-center text-[13px] text-[#6b6150]">San José, California {zip}</p>

              <dl className="mx-auto mt-5 grid w-full max-w-[560px] grid-cols-2 gap-x-6 gap-y-2 text-center text-[12px] sm:grid-cols-4">
                {[
                  ["On the books since", story?.since ? String(story.since) : "—"],
                  ["Permits on file", String(entries.length)],
                  ["Signed off", String(entries.filter((e) => e.done).length)],
                  ["Parcel", prop?.apn ?? data.parcel?.apn ?? "—"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-[#8a7445]">{k}</dt>
                    <dd className="mt-0.5 font-display text-[18px] font-light">{v}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-6 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a7445]">Its story</h3>
              {entries.length ? (
                <ol
                  className={`mx-auto mt-3 w-full max-w-[600px] ${shown.length > 14 ? "columns-2 gap-8 text-[11.5px]" : shown.length > 9 ? "text-[13px]" : "text-[14.5px]"} leading-snug`}
                >
                  {hidden > 0 && <li className="mb-1 break-inside-avoid italic text-[#6b6150]">{hidden} earlier permit{hidden === 1 ? "" : "s"} on file</li>}
                  {shown.map((e, i) => (
                    <li key={i} className={`${shown.length > 14 ? "mb-1.5" : "mb-2.5"} flex break-inside-avoid gap-2.5`}>
                      <span className="w-9 shrink-0 font-semibold tabular-nums">{e.year ?? "—"}</span>
                      <span className="min-w-0">
                        {e.what}
                        <span className={`ml-1 ${e.done ? "text-[#5f7a52]" : "text-[#9a5a3a]"}`}>· {e.status}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-center text-[12.5px] italic text-[#6b6150]">No permits in the city's online file. Older work often predates online records.</p>
              )}

              {story && story.moments.filter((m) => m.done).length > 1 && (
                <p className="mx-auto mt-4 max-w-[560px] text-center font-display text-[15px] italic leading-relaxed text-[#4a4336]">
                  {story.moments
                    .filter((m) => m.done)
                    .map((m) => m.line)
                    .join(" · ")}
                </p>
              )}
              {(prop?.zoning || lot) && (
                <p className="mt-4 text-center text-[11.5px] text-[#6b6150]">
                  {[prop?.zoning ? `Zoned ${prop.zoning}` : null, lot ? `Lot ${lot}` : null].filter(Boolean).join(" · ")}
                </p>
              )}

              <div className="mt-auto">
                {(to.trim() || from.trim() || note.trim()) && (
                  <div className="mx-auto mb-4 max-w-[520px] text-center">
                    {to.trim() && <p className="font-display text-[17px] italic">Presented to {to.trim()}</p>}
                    {note.trim() && <p className="mt-1 text-[12.5px] text-[#4a4336]">“{note.trim()}”</p>}
                    {from.trim() && (
                      <p className="mt-1 text-[12px] text-[#6b6150]">
                        with care from {from.trim()} · {longDate(today)}
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-end justify-between gap-4 border-t border-[#d9c9a3] pt-3">
                  <p className="max-w-[70%] text-[9.5px] leading-relaxed text-[#6b6150]">
                    Read from the City of San José's permit records on {longDate(today)}. A record of permits filed with the city, not an inspection of the
                    home. Work done without a permit doesn't appear here.
                  </p>
                  <div className="flex items-center gap-2 text-right">
                    <div>
                      <p className="font-display text-[13px]">Look up any San José home</p>
                      <p className="text-[9.5px] text-[#6b6150]">{origin.replace(/^https?:\/\//, "")}/house · Haleo</p>
                    </div>
                    {qr && <img src={qr} alt="" width={46} height={46} />}
                  </div>
                </div>
              </div>
            </div>
          )}
        </article>
      </div>
    </main>
  );
}
