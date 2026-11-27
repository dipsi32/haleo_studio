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
import BirthCertificate from "@/components/house/BirthCertificate";
import CertificateGate from "@/components/house/CertificateGate";
import { useAuth } from "@/context/AuthContext";


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

  const r = useMemo(
    () => (address ? houseReport({ street, zip, signal: data.signal, parcel: data.parcel, inspections: data.inspections, reader: "owner" }) : null),
    [address, street, zip, data.signal, data.parcel, data.inspections],
  );
  const entries = useMemo(() => (r ? certificateEntries(r.rows) : []), [r]);
  const story = useMemo(() => (r ? houseStory(r.rows.map(fromRow), r.rows.filter((x) => x.state === "expired" || x.state === "open").length) : null), [r]);
  const { user, loading: authLoading } = useAuth();
  const member = !!user && !user.is_anonymous;
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


  return (
    <main className="min-h-screen bg-[#ece6d8] print:bg-white">
      <style>{`@page { size: letter; margin: 0.45in; } @media print { html, body { background: #fff; } }`}</style>

      {/* The controls: on screen only. */}
      <div className="mx-auto max-w-[8.5in] px-4 pb-4 pt-6 print:hidden">
        <Link to={houseUrl(street, zip)} className="inline-flex min-h-[40px] items-center gap-1.5 text-[13.5px] text-foreground/70 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the house
        </Link>
        <h1 className="mt-2 font-display text-[28px] font-light leading-tight">
          Its <span className="italic">Birth Certificate</span>
        </h1>
        <p className="mt-1 max-w-xl text-[14.5px] text-muted-foreground">
          Its whole history from the city's records, on one page to print and frame. Giving it as a closing gift? Add who it's for and who it's from. Both
          are optional.
        </p>
        <div className={`mt-4 grid gap-2 sm:grid-cols-3 ${member ? "" : "hidden"}`}>
          <input value={to} onChange={(e) => setTo(e.target.value)} maxLength={60} placeholder="Presented to (optional)" className="min-h-[44px] rounded-xl border border-border bg-card px-3 text-[14px]" />
          <input value={from} onChange={(e) => setFrom(e.target.value)} maxLength={70} placeholder="From, e.g. Jane Lee, Compass (optional)" className="min-h-[44px] rounded-xl border border-border bg-card px-3 text-[14px]" />
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={90} placeholder="A short note (optional)" className="min-h-[44px] rounded-xl border border-border bg-card px-3 text-[14px]" />
        </div>
        <button
          type="button"
          onClick={print}
          disabled={!ready || !member}
          className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-foreground px-6 text-[15px] font-medium text-background disabled:opacity-50"
        >
          <Printer className="h-4 w-4" /> Print or save as PDF
        </button>
      </div>

      {/* The certificate. */}
      <div className="mx-auto max-w-[8.5in] px-4 pb-16 print:max-w-none print:p-0">
        {!ready || authLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center gap-3 rounded-[22px] bg-[#fdfaf3] text-[15px] text-[#6b6150]">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the city's file…
          </div>
        ) : member ? (
          <BirthCertificate
            print
            street={street}
            zip={zip}
            entries={entries}
            story={story}
            apn={prop?.apn ?? data.parcel?.apn ?? null}
            zoning={prop?.zoning ?? null}
            lot={lot}
            gift={{ to, from, note }}
            qr={qr}
            origin={origin}
          />
        ) : (
          story && (
            <div className="relative">
              <div className="max-h-[720px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
                <BirthCertificate street={street} zip={zip} entries={entries} story={story} locked qr={qr} origin={origin} />
              </div>
              <div className="relative z-10 -mt-48 sm:-mt-56">
                <CertificateGate street={street} story={story} />
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}
