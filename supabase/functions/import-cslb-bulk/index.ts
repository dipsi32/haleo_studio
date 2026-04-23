// Layer 2 of Haleo's hybrid CSLB verification — weekly bulk import.
//
// CSLB publishes a weekly full-database CSV on their data-requests page.
// We discover the current file URL by scraping that landing page (Firecrawl
// handles JS / cookies), then stream-download the CSV, parse it, and upsert
// every license into `cslb_licenses` with data_source='bulk_import'.
//
// For any license we currently surface to homeowners (i.e. exists in the
// `contractors` table) we also detect status changes and record them in
// `cslb_status_alerts`.
//
// Triggered by pg_cron Sunday 02:00 America/Los_Angeles, or on-demand POST.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY')

const CSLB_DATA_PAGE = 'https://www.cslb.ca.gov/About_us/Library/Data_Requests/'

// Discover the current weekly bulk file by scraping the data-requests page.
// CSLB names the file something like "CSLB_Master_File.csv" or links to a zip.
// We accept whatever the first .csv or .zip link looks like.
const discoverBulkUrl = async (): Promise<string | null> => {
  if (!FIRECRAWL_API_KEY) return null
  try {
    const resp = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: CSLB_DATA_PAGE,
        formats: ['links', 'markdown'],
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const links: string[] = data.links ?? data.data?.links ?? []
    // Prefer a CSV link mentioning master/license/contractor
    const csv = links.find(l => /\.(csv|zip)$/i.test(l) && /licens|contract|master/i.test(l))
    return csv ?? links.find(l => /\.csv$/i.test(l)) ?? null
  } catch (e) {
    console.warn('discoverBulkUrl error', e)
    return null
  }
}

// Minimal CSV row parser handling quoted fields with commas + escaped quotes.
const parseCsvLine = (line: string): string[] => {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQ = false
      else cur += ch
    } else {
      if (ch === '"') inQ = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

// CSLB column names vary slightly across releases; we lowercase + strip non-alnum
// and use a fuzzy lookup.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const findCol = (headers: string[], ...candidates: string[]): number => {
  const normed = headers.map(norm)
  for (const c of candidates) {
    const idx = normed.indexOf(norm(c))
    if (idx >= 0) return idx
  }
  return -1
}

const parseDateLoose = (v: string | undefined): string | null => {
  if (!v) return null
  const trimmed = v.trim()
  if (!trimmed) return null
  const d = new Date(trimmed)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

interface ParsedRow {
  license_number: string
  business_name: string | null
  licensee_name: string | null
  license_status: string | null
  classifications: string[] | null
  issue_date: string | null
  expiration_date: string | null
  bond_status: string | null
  workers_comp_status: string | null
}

const buildParser = (header: string[]) => {
  const idx = {
    lic: findCol(header, 'license_no', 'licenseno', 'license number', 'lic_no'),
    business: findCol(header, 'business_name', 'businessname', 'business'),
    name: findCol(header, 'first_name', 'firstname', 'licensee_name', 'owner_name'),
    last: findCol(header, 'last_name', 'lastname'),
    status: findCol(header, 'primary_status', 'license_status', 'status'),
    classif: findCol(header, 'classifications', 'classification', 'classes'),
    issued: findCol(header, 'issue_date', 'issued_date'),
    expire: findCol(header, 'expire_date', 'expiration_date', 'expr_date'),
    bond: findCol(header, 'cb_status', 'contractor_bond_status', 'bond_status'),
    wc: findCol(header, 'wc_status', 'workers_comp', 'workerscomp_status'),
  }
  return (cols: string[]): ParsedRow | null => {
    const license = (cols[idx.lic] ?? '').trim().toUpperCase()
    if (!license) return null
    const first = idx.name >= 0 ? (cols[idx.name] ?? '').trim() : ''
    const last = idx.last >= 0 ? (cols[idx.last] ?? '').trim() : ''
    const licensee = [first, last].filter(Boolean).join(' ') || null
    const classRaw = idx.classif >= 0 ? (cols[idx.classif] ?? '').trim() : ''
    const classifications = classRaw
      ? classRaw.split(/[\s,;|]+/).map(s => s.trim()).filter(Boolean)
      : null
    return {
      license_number: license,
      business_name: idx.business >= 0 ? ((cols[idx.business] ?? '').trim() || null) : null,
      licensee_name: licensee,
      license_status: idx.status >= 0 ? ((cols[idx.status] ?? '').trim() || null) : null,
      classifications,
      issue_date: parseDateLoose(idx.issued >= 0 ? cols[idx.issued] : undefined),
      expiration_date: parseDateLoose(idx.expire >= 0 ? cols[idx.expire] : undefined),
      bond_status: idx.bond >= 0 ? ((cols[idx.bond] ?? '').trim() || null) : null,
      workers_comp_status: idx.wc >= 0 ? ((cols[idx.wc] ?? '').trim() || null) : null,
    }
  }
}

// Stream the CSV line-by-line and upsert in batches of 500.
const streamImport = async (
  url: string,
  supabase: ReturnType<typeof createClient>,
  runId: string,
  licensesWeShow: Set<string>,
  previousStatuses: Map<string, string | null>,
  rowLimit: number,
): Promise<{ seen: number; inserted: number; updated: number; statusChanges: number }> => {
  const resp = await fetch(url)
  if (!resp.ok || !resp.body) throw new Error(`bulk fetch ${resp.status}`)
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let header: string[] | null = null
  let parser: ((cols: string[]) => ParsedRow | null) | null = null
  let seen = 0
  let inserted = 0
  let updated = 0
  let statusChanges = 0
  let batch: ParsedRow[] = []
  const alerts: { license_number: string; previous_status: string | null; new_status: string | null }[] = []

  const flush = async () => {
    if (batch.length === 0) return
    const { error } = await supabase
      .from('cslb_licenses')
      .upsert(
        batch.map(r => ({
          license_number: r.license_number,
          business_name: r.business_name,
          licensee_name: r.licensee_name,
          license_status: r.license_status,
          classifications: r.classifications,
          issue_date: r.issue_date,
          expiration_date: r.expiration_date,
          bond_status: r.bond_status,
          workers_comp_status: r.workers_comp_status,
          data_source: 'bulk_import',
          last_verified_at: new Date().toISOString(),
        })),
        { onConflict: 'license_number' },
      )
    if (error) throw error
    inserted += batch.length // we don't distinguish insert vs update in upsert; tracked together
    batch = []
  }

  while (true) {
    const { done, value } = await reader.read()
    if (value) buf += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).replace(/\r$/, '')
      buf = buf.slice(nl + 1)
      if (!line) continue
      const cols = parseCsvLine(line)
      if (!header) {
        header = cols
        parser = buildParser(header)
        continue
      }
      const row = parser!(cols)
      if (!row) continue
      seen++
      // Status-change detection for surfaced contractors only
      if (licensesWeShow.has(row.license_number)) {
        const prev = previousStatuses.get(row.license_number) ?? null
        const wasActive = (prev ?? '').toLowerCase().includes('active')
        const isActive = (row.license_status ?? '').toLowerCase().includes('active')
        if (prev && wasActive && !isActive && (row.license_status ?? '') !== prev) {
          alerts.push({ license_number: row.license_number, previous_status: prev, new_status: row.license_status })
          statusChanges++
        }
        updated++
      }
      batch.push(row)
      if (batch.length >= 500) await flush()
      if (rowLimit > 0 && seen >= rowLimit) {
        await flush()
        if (alerts.length) await supabase.from('cslb_status_alerts').insert(alerts.map(a => ({ ...a, detected_via: 'bulk_import' })))
        await supabase.from('cslb_import_runs').update({ records_seen: seen, records_inserted: inserted, records_updated: updated, status_changes: statusChanges }).eq('id', runId)
        return { seen, inserted, updated, statusChanges }
      }
    }
    if (done) break
  }
  await flush()
  if (alerts.length) {
    await supabase.from('cslb_status_alerts').insert(alerts.map(a => ({ ...a, detected_via: 'bulk_import' })))
  }
  return { seen, inserted, updated, statusChanges }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
  const url = new URL(req.url)
  const overrideUrl = String(body.url ?? url.searchParams.get('url') ?? '').trim() || null
  // Cap rows for safety; full CSLB file is ~500k rows. Default 0 = no cap.
  const rowLimit = Number(body.limit ?? url.searchParams.get('limit') ?? 0) | 0

  // Open a run row up front so partial failures are still visible.
  const { data: run, error: runErr } = await supabase
    .from('cslb_import_runs')
    .insert({ status: 'running', source_url: overrideUrl })
    .select('id')
    .single()
  if (runErr || !run) {
    return new Response(JSON.stringify({ ok: false, error: runErr?.message ?? 'cannot start run' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }

  const work = (async () => {
    try {
      const sourceUrl = overrideUrl ?? (await discoverBulkUrl())
      if (!sourceUrl) throw new Error('Could not discover CSLB bulk file URL')
      await supabase.from('cslb_import_runs').update({ source_url: sourceUrl }).eq('id', run.id)

      // Snapshot the licenses we currently surface + their last known status.
      const { data: shown } = await supabase
        .from('contractors')
        .select('license_number')
      const licensesWeShow = new Set<string>(((shown ?? []) as Array<{ license_number: string }>).map(r => r.license_number?.toUpperCase()).filter(Boolean))
      let previousStatuses = new Map<string, string | null>()
      if (licensesWeShow.size > 0) {
        const { data: prevRows } = await supabase
          .from('cslb_licenses')
          .select('license_number, license_status')
          .in('license_number', [...licensesWeShow])
        previousStatuses = new Map(((prevRows ?? []) as Array<{ license_number: string; license_status: string | null }>).map(r => [r.license_number, r.license_status]))
      }

      const result = await streamImport(sourceUrl, supabase, run.id, licensesWeShow, previousStatuses, rowLimit)
      await supabase
        .from('cslb_import_runs')
        .update({
          status: 'succeeded',
          records_seen: result.seen,
          records_inserted: result.inserted,
          records_updated: result.updated,
          status_changes: result.statusChanges,
          finished_at: new Date().toISOString(),
        })
        .eq('id', run.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('bulk import error', msg)
      await supabase
        .from('cslb_import_runs')
        .update({ status: 'failed', errors: msg, finished_at: new Date().toISOString() })
        .eq('id', run.id)
    }
  })()

  // Long-running: hand off to EdgeRuntime so we can return immediately to cron.
  try {
    // @ts-expect-error EdgeRuntime is a Supabase global
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(work)
    else await work
  } catch {
    await work
  }

  return new Response(JSON.stringify({ ok: true, run_id: run.id }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 202,
  })
})
