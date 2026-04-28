// Bridges a contractor submission (outreach_sends row) to the ported
// analyze-proposal function. For PDF source: downloads the PDF from the
// 'proposals' bucket and forwards to analyze-proposal. For haleo_builder
// source: synthesizes a minimal text "proposal" from the structured data
// and forwards. On success, links proposal_analyses.id back to the
// outreach_sends row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { outreach_send_id } = await req.json();
    if (!outreach_send_id) {
      return new Response(JSON.stringify({ error: "outreach_send_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: send, error: sErr } = await admin
      .from("outreach_sends")
      .select("id, batch_id, contractor_id, contractor_name, proposal_pdf_url, proposal_structured, proposal_source")
      .eq("id", outreach_send_id)
      .maybeSingle();
    if (sErr || !send) throw new Error("Outreach send not found");

    const { data: batch } = await admin
      .from("outreach_batches")
      .select("brief_snapshot, homeowner_email, homeowner_name")
      .eq("id", send.batch_id)
      .maybeSingle();

    // Create the pending analysis row up front so the inbox shows "reviewing".
    const analysisId = crypto.randomUUID();
    await admin.from("proposal_analyses").insert({
      id: analysisId,
      session_token: analysisId,
      outreach_send_id: send.id,
      contractor_id: send.contractor_id,
      contractor_name: send.contractor_name,
      brief_id: (batch?.brief_snapshot as any)?.brief_id ?? null,
      status: "pending",
      tier: "paid",
    });
    await admin.from("outreach_sends").update({ proposal_analysis_id: analysisId }).eq("id", send.id);

    // Build payload for analyze-proposal (which expects file_base64 + file_name).
    let fileBase64 = "";
    let fileName = "proposal.pdf";

    if (send.proposal_source === "pdf_upload" && send.proposal_pdf_url) {
      const { data: blob, error: dErr } = await admin.storage.from("proposals").download(send.proposal_pdf_url);
      if (dErr || !blob) throw new Error("Could not read uploaded PDF");
      const buf = new Uint8Array(await blob.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      fileBase64 = btoa(bin);
      fileName = send.proposal_pdf_url.split("/").pop() ?? "proposal.pdf";
    } else if (send.proposal_source === "haleo_builder" && send.proposal_structured) {
      // Render structured proposal as plain text and pass as a "txt" pseudo-file.
      const s: any = send.proposal_structured;
      const lines = (s.line_items ?? [])
        .map((l: any) => `- ${l.trade}: ${l.description} | qty ${l.quantity} @ $${l.unit_price} = $${l.total}`)
        .join("\n");
      const text =
        `Contractor: ${send.contractor_name ?? ""}\n` +
        `Total: $${s.total ?? 0}\n` +
        `Payment terms: ${s.payment_terms ?? ""}\n` +
        `Warranty: ${s.warranty ?? ""}\n` +
        `Permits: ${s.permits_included ?? ""}\n\nLine items:\n${lines}\n\nNotes: ${s.notes ?? ""}\n`;
      fileBase64 = btoa(unescape(encodeURIComponent(text)));
      fileName = "proposal.txt";
    } else {
      throw new Error("Proposal has no source content");
    }

    // Forward to ported analyze-proposal. Best-effort; on failure mark failed.
    const r = await fetch(`${SUPABASE_URL}/functions/v1/analyze-proposal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ file_base64: fileBase64, file_name: fileName }),
    });
    const data = await r.json().catch(() => ({}));

    if (!r.ok || !data?.success) {
      await admin.from("proposal_analyses").update({
        status: "failed",
      }).eq("id", analysisId);
      return new Response(JSON.stringify({ ok: false, error: data?.error ?? "Analysis failed" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist analysis result onto the row.
    await admin.from("proposal_analyses").update({
      status: "complete",
      risk_score: data?.risk_score?.overall ?? null,
      risk_breakdown: data?.risk_score ?? {},
      red_flags: data?.red_flags ?? [],
      pushback_language: (data?.red_flags ?? []).map((f: any) => ({ category: f.category, language: f.whatToDo })),
      extracted_data: data?.extracted ?? {},
      permit_data: data?.permit_intelligence ?? {},
      license_data: data?.license_verification ?? {},
      roadmap: data?.roadmap ?? [],
      next_actions: data?.next_actions ?? [],
      analysis_jsonb: data ?? {},
      total_cost: data?.extracted?.total_cost ?? null,
      verdict: data?.risk_score?.label ?? null,
    }).eq("id", analysisId);

    return new Response(JSON.stringify({ ok: true, proposal_analysis_id: analysisId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
