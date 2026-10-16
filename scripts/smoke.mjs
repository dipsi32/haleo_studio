// Checks that a freshly set-up backend is actually usable. No test data needed.
//   node scripts/smoke.mjs <supabase-url> <publishable-key> [app-url]
// Exits non-zero if anything is wrong, and says what.
const [url, key, appUrl] = process.argv.slice(2);
if (!url || !key) {
  console.error("usage: node scripts/smoke.mjs <supabase-url> <publishable-key> [app-url]");
  process.exit(2);
}
const base = url.replace(/\/$/, "");
const results = [];
const check = async (name, fn) => {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`PASS  ${name}${detail ? `  (${detail})` : ""}`);
  } catch (e) {
    results.push({ name, ok: false });
    console.log(`FAIL  ${name}  ${e instanceof Error ? e.message : e}`);
  }
};
const get = (path, headers = {}) => fetch(base + path, { headers: { apikey: key, Authorization: `Bearer ${key}`, ...headers } });
const must = (cond, msg) => { if (!cond) throw new Error(msg); };

await check("API answers and the key is accepted", async () => {
  // The API root is closed to public keys, so ask a real table instead.
  const r = await get("/rest/v1/waitlist?select=id&limit=1");
  must(r.status !== 401 && r.status !== 403, `status ${r.status}: the key was rejected`);
  must(r.status < 500, `status ${r.status}`);
});

for (const table of ["contractors", "waitlist", "outreach_batches"]) {
  await check(`table ${table} exists`, async () => {
    const r = await get(`/rest/v1/${table}?select=*&limit=1`);
    // 200 with rows, or 200 with [] (RLS may hide rows). 404 means the migration did not run.
    must(r.status !== 404, "missing: run the migrations");
    must(r.status < 500, `status ${r.status}`);
    return `status ${r.status}`;
  });
}

await check("row-level security hides private data from the public key", async () => {
  const r = await get("/rest/v1/contractor_accounts?select=*&limit=1");
  must(r.status !== 404, "table missing");
  const body = r.ok ? await r.json() : [];
  must(Array.isArray(body) && body.length === 0, "contractor_accounts is readable by anonymous visitors");
});

await check("sign-in is configured", async () => {
  const r = await get("/auth/v1/settings");
  must(r.ok, `status ${r.status}`);
  const s = await r.json();
  must(s.external?.email, "email sign-in is off");
  return `google ${s.external?.google ? "on" : "OFF"}`;
});

for (const fn of ["visibility-scan", "notify-contractor-brief", "analyze-proposal"]) {
  await check(`function ${fn} is deployed`, async () => {
    const r = await fetch(`${base}/functions/v1/${fn}`, { method: "OPTIONS", headers: { apikey: key } });
    must(r.status !== 404, "not deployed: run the bootstrap workflow");
    must(r.status < 500, `status ${r.status}`);
  });
}

if (appUrl) {
  await check("the site loads", async () => {
    const r = await fetch(appUrl);
    must(r.ok, `status ${r.status}`);
    must((await r.text()).includes('<div id="root"'), "no app shell in the page");
  });
  await check("a deep link works (single-page fallback)", async () => {
    const r = await fetch(`${appUrl.replace(/\/$/, "")}/pro/login`);
    must(r.ok, `status ${r.status}`);
  });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
