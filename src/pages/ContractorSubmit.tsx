import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, FileUp, Send, Hammer, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import SiteHeader from "@/components/SiteHeader";

// Minimal contractor proposal submission page.
// Two paths: PDF upload OR a lightweight Haleo "structured" proposal.
// On submit: writes proposal data to outreach_sends, fires analyze-proposal.

type SendRow = {
  id: string;
  contractor_name: string | null;
  contractor_email: string | null;
  batch_id: string;
  status: string;
  proposal_submitted_at: string | null;
};

type Batch = {
  id: string;
  homeowner_name: string | null;
  neighborhood: string | null;
  brief_snapshot: any;
};

type LineItem = { trade: string; description: string; quantity: string; unit_price: string; total: string };

const blankLine = (): LineItem => ({ trade: "", description: "", quantity: "1", unit_price: "", total: "" });

export default function ContractorSubmit() {
  const { outreachSendId } = useParams<{ outreachSendId: string }>();
  const navigate = useNavigate();

  const [send, setSend] = useState<SendRow | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [mode, setMode] = useState<"pdf" | "builder">("pdf");

  // PDF path
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Builder path
  const [proposalTotal, setProposalTotal] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [warranty, setWarranty] = useState("");
  const [permits, setPermits] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([blankLine()]);

  useEffect(() => {
    if (!outreachSendId) return;
    (async () => {
      const { data: sendData, error: sErr } = await supabase
        .from("outreach_sends")
        .select("id, contractor_name, contractor_email, batch_id, status, proposal_submitted_at")
        .eq("id", outreachSendId)
        .maybeSingle();
      if (sErr || !sendData) {
        toast({ title: "Submission link not found", description: "Ask the homeowner to resend it.", variant: "destructive" });
        setLoading(false);
        return;
      }
      setSend(sendData as SendRow);

      const { data: batchData } = await supabase
        .from("outreach_batches")
        .select("id, homeowner_name, neighborhood, brief_snapshot")
        .eq("id", sendData.batch_id)
        .maybeSingle();
      if (batchData) setBatch(batchData as Batch);
      setLoading(false);
    })();
  }, [outreachSendId]);

  const addLine = () => setLines((l) => [...l, blankLine()]);
  const updateLine = (i: number, field: keyof LineItem, value: string) =>
    setLines((l) => l.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  const removeLine = (i: number) => setLines((l) => l.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!send || !outreachSendId) return;

    if (mode === "pdf" && !pdfFile) {
      toast({ title: "Add your proposal PDF first", variant: "destructive" });
      return;
    }
    if (mode === "builder" && (!proposalTotal || lines.length === 0)) {
      toast({ title: "Add a total and at least one line item", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      let pdfUrl: string | null = null;
      let structured: any = null;

      if (mode === "pdf" && pdfFile) {
        const ext = pdfFile.name.split(".").pop() || "pdf";
        const path = `${outreachSendId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("proposals").upload(path, pdfFile, {
          contentType: pdfFile.type || "application/pdf",
          upsert: false,
        });
        if (upErr) throw upErr;
        pdfUrl = path;
      } else {
        structured = {
          total: Number(proposalTotal) || 0,
          payment_terms: paymentTerms,
          warranty,
          permits_included: permits,
          notes,
          line_items: lines.map((l) => ({
            trade: l.trade,
            description: l.description,
            quantity: Number(l.quantity) || 1,
            unit_price: Number(l.unit_price) || 0,
            total: Number(l.total) || (Number(l.quantity) || 1) * (Number(l.unit_price) || 0),
          })),
        };
      }

      const { error: updErr } = await supabase
        .from("outreach_sends")
        .update({
          proposal_submitted_at: new Date().toISOString(),
          proposal_pdf_url: pdfUrl,
          proposal_structured: structured,
          proposal_source: mode === "pdf" ? "pdf_upload" : "haleo_builder",
          status: "proposal_submitted",
        })
        .eq("id", outreachSendId);
      if (updErr) throw updErr;

      // Fire analysis (best-effort; the homeowner inbox will reflect status)
      supabase.functions
        .invoke("analyze-proposal-intake", {
          body: { outreach_send_id: outreachSendId },
        })
        .catch((e) => console.warn("analyze-proposal-intake invoke failed (non-blocking)", e));

      toast({ title: "On the record", description: "The homeowner's Advocate is reading it now." });
      navigate(`/contractor/submit/${outreachSendId}?done=1`, { replace: true });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Couldn't submit", description: e.message ?? "Try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-warm">
        <SiteHeader />
        <main className="container max-w-2xl py-24 text-center text-muted-foreground">Loading…</main>
      </div>
    );
  }

  if (!send) {
    return (
      <div className="min-h-screen bg-gradient-warm">
        <SiteHeader />
        <main className="container max-w-2xl py-24 text-center">
          <p className="font-display text-2xl">This submission link isn't valid.</p>
          <p className="mt-2 text-sm text-muted-foreground">Ask the homeowner to resend it from their Haleo project.</p>
        </main>
      </div>
    );
  }

  const alreadySubmitted = !!send.proposal_submitted_at;

  return (
    <div className="min-h-screen bg-gradient-warm">
      <SiteHeader />
      <main className="container max-w-3xl py-12">
        <button onClick={() => navigate(-1)} className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Proposal submission</p>
          <h1 className="mt-3 font-display text-4xl font-light leading-tight">
            {batch?.homeowner_name ? `${batch.homeowner_name.split(" ")[0]} is waiting on your bid.` : "Send your bid through Haleo."}
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Whatever you submit becomes part of the homeowner's permanent record for this project. Be specific — vague lines get flagged automatically.
          </p>
          {batch?.neighborhood && (
            <p className="mt-2 text-xs text-muted-foreground">{batch.neighborhood} · addressed to {send.contractor_name ?? "your team"}</p>
          )}
        </motion.div>

        {/* Brief recap — so the contractor isn't bidding blind */}
        {batch?.brief_snapshot && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">The brief you're bidding on</p>
            <p className="mt-3 font-display text-lg leading-snug">
              {batch.brief_snapshot?.title || batch.brief_snapshot?.room || "Renovation project"}
            </p>
            {batch.brief_snapshot?.scope && (
              <p className="mt-2 text-sm text-foreground/80">{batch.brief_snapshot.scope}</p>
            )}
            {batch.brief_snapshot?.budget && (
              <p className="mt-2 text-xs text-muted-foreground">
                Homeowner budget signal: <span className="text-foreground">{batch.brief_snapshot.budget}</span>
              </p>
            )}
          </div>
        )}

        {alreadySubmitted ? (
          <div className="mt-10 rounded-2xl border border-sage/40 bg-sage-soft p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-sage" />
            <p className="mt-3 font-display text-xl">Your proposal is on the record.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The homeowner's Advocate is reading it now. You'll hear back once they've reviewed it.
            </p>
          </div>
        ) : (
          <>
            {/* Mode toggle */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("pdf")}
                className={`rounded-2xl border p-5 text-left transition-all ${
                  mode === "pdf" ? "border-accent bg-accent-soft shadow-warm" : "border-border bg-card hover:border-accent/40"
                }`}
              >
                <FileUp className="h-5 w-5 text-accent" />
                <p className="mt-3 font-display text-base font-medium">Upload your PDF</p>
                <p className="mt-1 text-xs text-muted-foreground">Send the proposal you'd send anyway.</p>
              </button>
              <button
                onClick={() => setMode("builder")}
                className={`rounded-2xl border p-5 text-left transition-all ${
                  mode === "builder" ? "border-accent bg-accent-soft shadow-warm" : "border-border bg-card hover:border-accent/40"
                }`}
              >
                <Hammer className="h-5 w-5 text-accent" />
                <p className="mt-3 font-display text-base font-medium">Itemize it here</p>
                <p className="mt-1 text-xs text-muted-foreground">Line-by-line. Fewer flags, faster sign-off.</p>
              </button>
            </div>

            {mode === "pdf" ? (
              <div className="mt-6 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                <input
                  id="pdf"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
                <label htmlFor="pdf" className="cursor-pointer">
                  <FileUp className="mx-auto h-8 w-8 text-accent" />
                  <p className="mt-3 font-display text-lg">{pdfFile ? pdfFile.name : "Choose your proposal PDF"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Up to 20MB · PDF only</p>
                </label>
              </div>
            ) : (
              <div className="mt-6 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="total">Total proposal amount</Label>
                    <Input id="total" type="number" placeholder="e.g. 78500" value={proposalTotal} onChange={(e) => setProposalTotal(e.target.value)} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="permits">Permits included?</Label>
                    <Input id="permits" placeholder="e.g. Yes — building + electrical" value={permits} onChange={(e) => setPermits(e.target.value)} className="mt-1.5" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="payment">Payment schedule</Label>
                  <Textarea id="payment" rows={2} placeholder="e.g. 10% deposit, 30% rough-in, 30% drywall, 30% final" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="warranty">Warranty</Label>
                  <Textarea id="warranty" rows={2} placeholder="e.g. 1 year workmanship; manufacturer warranty on materials" value={warranty} onChange={(e) => setWarranty(e.target.value)} className="mt-1.5" />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label>Line items</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addLine} className="rounded-full">
                      + Add line
                    </Button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {lines.map((line, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-border/60 bg-background p-2">
                        <Input className="col-span-2" placeholder="Trade" value={line.trade} onChange={(e) => updateLine(i, "trade", e.target.value)} />
                        <Input className="col-span-5" placeholder="Description" value={line.description} onChange={(e) => updateLine(i, "description", e.target.value)} />
                        <Input className="col-span-1" placeholder="Qty" value={line.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} />
                        <Input className="col-span-2" placeholder="Unit $" value={line.unit_price} onChange={(e) => updateLine(i, "unit_price", e.target.value)} />
                        <Input className="col-span-2" placeholder="Total $" value={line.total} onChange={(e) => updateLine(i, "total", e.target.value)} />
                        {lines.length > 1 && (
                          <button type="button" onClick={() => removeLine(i)} className="col-span-12 text-right text-[11px] text-muted-foreground hover:text-destructive">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes for the homeowner (optional)</Label>
                  <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5" />
                </div>
              </div>
            )}

            <div className="mt-8 flex items-center justify-end gap-3">
              <Button onClick={handleSubmit} disabled={submitting} className="rounded-full">
                <Send className="h-4 w-4" /> {submitting ? "Sending…" : "Submit proposal to homeowner"}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
