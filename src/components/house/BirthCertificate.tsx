// The house's Birth Certificate: its whole public life on one page. One
// component for every place it appears: the lookup (tappable, each line opens
// its detail), behind the sign-up (the story blurred), and the printable page.
// Every line is the City of San José's record; the persona is labelled ours.
import { ChevronRight, Lock } from "lucide-react";
import type { CertificateEntry, HouseStory } from "@/lib/houseStory";

const titleCase = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
const longDate = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const MAX_LINES = 26;
const LOCKED_LINES = 2;

export type Gift = { to?: string; from?: string; note?: string };

type Props = {
  street: string;
  zip: string;
  entries: CertificateEntry[];
  story: HouseStory | null;
  apn?: string | null;
  zoning?: string | null;
  lot?: string | null;
  gift?: Gift;
  /** Signed out: the story is blurred after its first lines. */
  locked?: boolean;
  /** The printable page: letter-shaped, nothing tappable. */
  print?: boolean;
  qr?: string | null;
  origin?: string;
  onEntry?: (row: number) => void;
  onFacts?: () => void;
  onLot?: () => void;
  onStory?: () => void;
};

export default function BirthCertificate({ street, zip, entries, story, apn, zoning, lot, gift, locked, print, qr, origin, onEntry, onFacts, onLot, onStory }: Props) {
  const shown = entries.slice(-MAX_LINES);
  const hidden = entries.length - shown.length;
  const done = entries.filter((e) => e.done).length;
  const milestones = (story?.moments ?? []).filter((m) => m.done);
  const today = new Date();
  const tap = !print && !locked;
  const site = (origin ?? "https://haleo.studio").replace(/^https?:\/\//, "");

  const Facts = (
    <dl className="mx-auto mt-5 grid w-full max-w-[560px] grid-cols-2 gap-x-6 gap-y-3 text-center text-[12px] sm:grid-cols-4">
      {[
        ["Years on record", story?.since ? String(new Date().getFullYear() - story.since) : "—"],
        ["Permits on file", String(entries.length)],
        ["Signed off", locked ? "•" : String(done)],
        ["Parcel", locked ? "•••" : apn ?? "—"],
      ].map(([k, v]) => (
        <div key={k}>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-[#8a7445]">{k}</dt>
          <dd className="mt-0.5 font-display text-[20px] font-light">{v}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <article
      className={`relative bg-[#fdfaf3] text-[#2a2620] ${print ? "shadow-lift print:shadow-none" : "rounded-[22px] shadow-soft"}`}
      style={{ fontFamily: "Figtree, system-ui, sans-serif", ...(print ? { aspectRatio: "8.5 / 11" } : {}) }}
    >
      <div className={`pointer-events-none absolute border border-[#b79a63] ${print ? "inset-[14px] print:inset-[6px]" : "inset-[10px] rounded-[16px]"}`} />
      <div className={`pointer-events-none absolute border-[3px] border-double border-[#b79a63] ${print ? "inset-[20px] print:inset-[12px]" : "inset-[15px] rounded-[13px]"}`} />

      <div className={`relative flex h-full flex-col ${print ? "px-[7%] pb-[5%] pt-[6%]" : "px-6 pb-7 pt-9 sm:px-10"}`}>
        <p className="text-center text-[10.5px] font-semibold uppercase tracking-[0.3em] text-[#8a7445]">City of San José · Public record</p>
        <h2 className="mt-2.5 text-center font-display text-[clamp(30px,6vw,46px)] font-light italic leading-none">Birth Certificate</h2>
        <div className="mx-auto mt-3 h-px w-20 bg-[#b79a63]" />
        <p className="mt-4 text-center text-[12.5px] text-[#6b6150]">This certifies that</p>
        <p className="mt-1 text-center font-display text-[clamp(24px,4.4vw,36px)] font-light leading-tight">{titleCase(street)}</p>
        <p className="text-center text-[13px] text-[#6b6150]">San José, California {zip}</p>
        {story?.since && (
          <p className="mt-2 text-center text-[14px]">
            came onto the city's books in <span className="font-display text-[17px]">{story.since}</span>
          </p>
        )}
        {story && !locked && (
          <p className="mt-1.5 text-center text-[13px] text-[#4a4336]">
            and is known around here as{" "}
            <span className="whitespace-nowrap">
              <span className="font-display text-[15px] italic">{story.persona.name.replace(/^The /, "the ")}</span>
              <span className="ml-1 align-middle text-[9.5px] uppercase tracking-wider text-[#8a7445]">(our read)</span>
            </span>
          </p>
        )}

        {onFacts && tap ? (
          <button type="button" onClick={onFacts} className="rounded-2xl transition-smooth hover:bg-[#f4ecda]" aria-label="See every permit">
            {Facts}
          </button>
        ) : (
          Facts
        )}

        <h3 className="mt-6 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8a7445]">Its story</h3>
        {entries.length ? (
          <div className="relative">
            <ol
              className={`mx-auto mt-3 w-full max-w-[600px] ${
                print && shown.length > 14 ? "columns-2 gap-8 text-[11.5px]" : shown.length > 9 ? "text-[13px]" : "text-[14.5px]"
              } leading-snug`}
            >
              {hidden > 0 && <li className="mb-1 break-inside-avoid italic text-[#6b6150]">{hidden} earlier permit{hidden === 1 ? "" : "s"} on file</li>}
              {shown.map((e, i) => {
                const blurred = locked && i >= LOCKED_LINES;
                const body = (
                  <>
                    <span className="w-10 shrink-0 font-semibold tabular-nums">{e.year ?? "—"}</span>
                    <span className="min-w-0 flex-1">
                      {e.what}
                      <span className={`ml-1 ${e.done ? "text-[#5f7a52]" : "text-[#9a5a3a]"}`}>· {e.status}</span>
                    </span>
                    {tap && onEntry && <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b79a63] opacity-60 transition-opacity group-hover:opacity-100" />}
                  </>
                );
                return (
                  <li key={`${e.row}-${i}`} className={`break-inside-avoid ${blurred ? "pointer-events-none select-none blur-[5px]" : ""}`} aria-hidden={blurred || undefined}>
                    {tap && onEntry ? (
                      <button type="button" onClick={() => onEntry(e.row)} className="group -mx-2 flex w-[calc(100%+16px)] gap-2.5 rounded-lg px-2 py-1.5 text-left transition-smooth hover:bg-[#f4ecda]">
                        {body}
                      </button>
                    ) : (
                      <div className={`flex gap-2.5 ${print && shown.length > 14 ? "mb-1.5" : "mb-2"}`}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
            {locked && shown.length > LOCKED_LINES && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2a2620] px-3 py-1 text-[11px] font-medium text-[#fdfaf3]">
                  <Lock className="h-3 w-3" /> {shown.length - LOCKED_LINES} more chapters
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-2 text-center text-[12.5px] italic text-[#6b6150]">No permits in the city's online file. Older work often predates online records.</p>
        )}

        {!locked && milestones.length > 1 &&
          (onStory && tap ? (
            <button type="button" onClick={onStory} className="mx-auto mt-4 block max-w-[560px] rounded-xl px-3 py-1 text-center font-display text-[15px] italic leading-relaxed text-[#4a4336] transition-smooth hover:bg-[#f4ecda]">
              {milestones.map((m) => m.line).join(" · ")}
            </button>
          ) : (
            <p className="mx-auto mt-4 max-w-[560px] text-center font-display text-[15px] italic leading-relaxed text-[#4a4336]">{milestones.map((m) => m.line).join(" · ")}</p>
          ))}

        {!locked && (zoning || lot) &&
          (onLot && tap ? (
            <button type="button" onClick={onLot} className="mx-auto mt-3 block rounded-full px-3 py-1 text-[12px] text-[#6b6150] underline decoration-[#d9c9a3] underline-offset-4 hover:text-[#2a2620]">
              {[zoning ? `Zoned ${zoning}` : null, lot ? `Lot ${lot}` : null].filter(Boolean).join(" · ")}
            </button>
          ) : (
            <p className="mt-3 text-center text-[11.5px] text-[#6b6150]">{[zoning ? `Zoned ${zoning}` : null, lot ? `Lot ${lot}` : null].filter(Boolean).join(" · ")}</p>
          ))}

        <div className={print ? "mt-auto" : "mt-7"}>
          {(gift?.to?.trim() || gift?.from?.trim() || gift?.note?.trim()) && (
            <div className="mx-auto mb-4 max-w-[520px] text-center">
              {gift?.to?.trim() && <p className="font-display text-[17px] italic">Presented to {gift.to.trim()}</p>}
              {gift?.note?.trim() && <p className="mt-1 text-[12.5px] text-[#4a4336]">“{gift.note.trim()}”</p>}
              {gift?.from?.trim() && (
                <p className="mt-1 text-[12px] text-[#6b6150]">
                  with care from {gift.from.trim()} · {longDate(today)}
                </p>
              )}
            </div>
          )}
          <div className="flex items-end justify-between gap-4 border-t border-[#d9c9a3] pt-3">
            <p className="max-w-[68%] text-[9.5px] leading-relaxed text-[#6b6150]">
              Read from the City of San José's permit records on {longDate(today)}. A record of permits filed with the city, not an inspection of the home.
              Work done without a permit doesn't appear here.
            </p>
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="font-display text-[13px]">Look up any San José home</p>
                <p className="text-[9.5px] text-[#6b6150]">{site}/house · Haleo</p>
              </div>
              {qr && <img src={qr} alt="" width={44} height={44} />}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
