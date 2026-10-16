// Fan-out notifications when a brief is sent to a contractor.
// Channels: in-app (always), push (if subscribed), SMS (stub - logs only).
// Called once per outreach_send. Voice rule: every channel must include
// project type + neighborhood ("Kitchen remodel in Willow Glen").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:hello@haleo.studio";

// Push is optional: without VAPID keys the in-app notification still goes out.
const pushEnabled = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);
if (pushEnabled) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC!, VAPID_PRIVATE!);

function buildHeadline(projectType: string | null, neighborhood: string | null) {
  const proj = projectType?.trim() || "New project";
  const hood = neighborhood?.trim();
  return hood ? `${proj} in ${hood}` : proj;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { outreach_send_id } = await req.json();
    if (!outreach_send_id) {
      return new Response(JSON.stringify({ error: "outreach_send_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Pull send + batch + contractor
    const { data: send, error: sendErr } = await admin
      .from("outreach_sends")
      .select("id, contractor_id, contractor_name, batch_id")
      .eq("id", outreach_send_id)
      .maybeSingle();
    if (sendErr || !send) throw sendErr ?? new Error("send not found");

    const { data: batch } = await admin
      .from("outreach_batches")
      .select("neighborhood, brief_snapshot, homeowner_name")
      .eq("id", send.batch_id)
      .maybeSingle();

    const { data: contractor } = await admin
      .from("contractors")
      .select("id, company, name, notification_phone, phone, notification_preference, first_brief_received_at")
      .eq("id", send.contractor_id)
      .maybeSingle();
    if (!contractor) throw new Error("contractor not found");

    const snap = (batch?.brief_snapshot ?? {}) as Record<string, unknown>;
    const projectType = (snap.projectType as string) ?? (snap.project_type as string) ?? (snap.scope as string) ?? null;
    const neighborhood = batch?.neighborhood ?? null;
    const homeowner = batch?.homeowner_name ?? "A homeowner";

    const headline = buildHeadline(projectType, neighborhood);
    const title = `New brief: ${headline}`;
    const body = `${homeowner} sent you a project brief. Open it in your inbox.`;

    const results = { in_app: false, push: { sent: 0, failed: 0 }, sms: { sent: 0, stubbed: true } };

    // 1. In-app notification
    const { error: notifErr } = await admin.from("contractor_notifications").insert({
      contractor_id: contractor.id,
      outreach_send_id: send.id,
      type: "brief_received",
      title,
      body,
    });
    if (!notifErr) results.in_app = true;

    // 2. Push
    const { data: subs } = await admin
      .from("contractor_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("contractor_id", contractor.id)
      .eq("active", true);

    if (pushEnabled && subs?.length) {
      const payload = JSON.stringify({
        title,
        body: headline,
        url: `/pro/inbox?send=${send.id}`,
        tag: `brief-${send.id}`,
      });
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          results.push.sent++;
        } catch (err) {
          results.push.failed++;
          // Deactivate dead subscriptions
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await admin.from("contractor_push_subscriptions").update({ active: false }).eq("id", sub.id);
          }
          console.error("push failed", sub.endpoint, err);
        }
      }
    }

    // 3. SMS — stub. Real Twilio wiring goes here later.
    const phone = contractor.notification_phone ?? contractor.phone;
    if (phone && contractor.notification_preference !== "email_only") {
      console.log(`[SMS STUB] -> ${phone}: "${headline} — open ${Deno.env.get("PUBLIC_APP_URL") ?? ""}/pro/inbox"`);
      results.sms.sent = 1;
    }

    // Mark first brief received
    if (!contractor.first_brief_received_at) {
      await admin.from("contractors").update({ first_brief_received_at: new Date().toISOString() }).eq("id", contractor.id);
    }

    return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("notify-contractor-brief error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
