// One-time seed: creates the pro@haleo.test contractor account.
// Safe to call multiple times (idempotent).
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

  const email = "pro@haleo.test";
  const password = "BayviewBuild!2026";
  const companyName = "Bayview Build Co";

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
    // Already exists — look it up
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

  // 3. Ensure contractor_account row
  const { data: existingAcct } = await admin
    .from("contractor_accounts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingAcct) {
    await admin.from("contractor_accounts").insert({
      user_id: userId,
      company_name: companyName,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      user_id: userId,
      email,
      password,
      next: "Visit /pro/login and sign in.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
