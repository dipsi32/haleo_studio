// One-time seed: creates the mehdi@haleo.test contractor account
// linked to the existing "BAKHTIARY, MEHDI" contractor record.
// Idempotent — safe to call multiple times.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const email = "mehdi@haleo.test";
  const password = "MehdiBuild!2026";
  const companyName = "Bakhtiary Construction";
  const contractorId = "7b9b4660-1cc4-4d53-97df-157899609298";

  // 1. Create or fetch the user
  let userId: string | null = null;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: companyName },
  });

  if (createErr && !String(createErr.message).toLowerCase().includes("already")) {
    return new Response(JSON.stringify({ error: createErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (created?.user) {
    userId = created.user.id;
  } else {
    const { data: list } = await admin.auth.admin.listUsers();
    userId = list?.users.find((u) => u.email === email)?.id ?? null;
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: "Could not resolve user id" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Ensure contractor role
  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "contractor" }, { onConflict: "user_id,role" });

  // 3. Ensure contractor_account row, linked to the real contractor record
  const { data: existingAcct } = await admin
    .from("contractor_accounts")
    .select("id, contractor_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingAcct) {
    await admin.from("contractor_accounts").insert({
      user_id: userId,
      contractor_id: contractorId,
      company_name: companyName,
    });
  } else if (!existingAcct.contractor_id) {
    await admin
      .from("contractor_accounts")
      .update({ contractor_id: contractorId })
      .eq("id", existingAcct.id);
  }

  // 4. Mark the contractor record as claimed
  await admin
    .from("contractors")
    .update({
      claimed: true,
      claimed_at: new Date().toISOString(),
      claim_completed_at: new Date().toISOString(),
    })
    .eq("id", contractorId);

  return new Response(
    JSON.stringify({
      ok: true,
      user_id: userId,
      email,
      password,
      contractor_id: contractorId,
      next: "Visit /pro/login and sign in.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
