// Layer 1 of Haleo's hybrid CSLB verification.
//
// Flow per request:
//   1. Cache check  → cslb_licenses row with last_verified_at < 24h → return.
//   2. Bulk import  → cslb_licenses row from bulk_import (any age) → return,
//                     but kick off a background Firecrawl refresh.
//   3. Firecrawl    → render the CSLB license-detail page (handles ASP.NET
//                     ViewState / cookies / JS), then ask Claude to extract
//                     a clean JSON record. Up to 2 attempts.
//   4. Fallback     → record `data_source = 'fallback'` and return a deep link.
//
// Always returns the canonical row shape so the client can render the same
// CslbSignals component regardless of which layer answered.
import { aiFetch } from "../_shared/ai.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY')

const CACHE_HOURS = 24
const FIRECRAWL_MAX_ATTEMPTS = 2

const CSLB_DETAIL = (num: string) =>
  `https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=${encodeURIComponent(num)}`

interface CslbRecord {
  license_number: string
  business_name: string | null
  licensee_name: string | null
  license_status: string | null
  classifications: string[] | null
  issue_date: string | null
  expiration_date: string | null
  bond_status: string | null
  bond_amount: number | null
  workers_comp_status: string | null
  has_disciplinary_action: boolean
  disciplinary_notes: string | null
  data_source: 'firecrawl' | 'bulk_import' | 'fallback'
  raw_data: Record<string, unknown> | null
  last_verified_at: string | null
  deep_link: string
}

const toResponse = (row: CslbRecord, extra: Record<string, unknown> = {}, status = 200) =>
  new Response(JSON.stringify({ ok: true, ...extra, ...row }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

const toFallbackRow = (license: string): CslbRecord => ({
  license_number: license,
  business_name: null,
  licensee_name: null,
  license_status: null,
  classifications: null,
  issue_date: null,
  expiration_date: null,
  bond_status: null,
  bond_amount: null,
  workers_comp_status: null,
  has_disciplinary_action: false,
  disciplinary_notes: null,
  data_source: 'fallback',
  raw_data: null,
  last_verified_at: null,
  deep_link: CSLB_DETAIL(license),
})

const rowFromDb = (row: Record<string, unknown>): CslbRecord => ({
  license_number: row.license_number as string,
  business_name: (row.business_name as string) ?? null,
  licensee_name: (row.licensee_name as string) ?? null,
  license_status: (row.license_status as string) ?? null,
  classifications: (row.classifications as string[]) ?? null,
  issue_date: (row.issue_date as string) ?? null,
  expiration_date: (row.expiration_date as string) ?? null,
  bond_status: (row.bond_status as string) ?? null,
  bond_amount: (row.bond_amount as number) ?? null,
  workers_comp_status: (row.workers_comp_status as string) ?? null,
  has_disciplinary_action: Boolean(row.has_disciplinary_action),
  disciplinary_notes: (row.disciplinary_notes as string) ?? null,
  data_source: ((row.data_source as string) ?? 'fallback') as CslbRecord['data_source'],
  raw_data: (row.raw_data as Record<string, unknown>) ?? null,
  last_verified_at: (row.last_verified_at as string) ?? null,
  deep_link: CSLB_DETAIL(row.license_number as string),
})

// ─── Firecrawl scrape ─────────────────────────────────────────────────────────
const firecrawlScrape = async (license: string): Promise<{ markdown: string | null; html: string | null; error?: string }> => {
  if (!FIRECRAWL_API_KEY) return { markdown: null, html: null, error: 'FIRECRAWL_API_KEY missing' }
  try {
    const resp = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: CSLB_DETAIL(license),
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 1500,
      }),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return { markdown: null, html: null, error: `Firecrawl ${resp.status}: ${text.slice(0, 200)}` }
    }
    const data = await resp.json()
    // v2 puts content at the top level; older shapes nest under `data`.
    const markdown = data.markdown ?? data.data?.markdown ?? null
    const html = data.html ?? data.data?.html ?? null
    if (!markdown && !html) return { markdown: null, html: null, error: 'Firecrawl returned no content' }
    return { markdown, html }
  } catch (e) {
    return { markdown: null, html: null, error: e instanceof Error ? e.message : String(e) }
  }
}

// ─── Claude extraction (tool-calling for structured JSON) ────────────────
const extractWithAi = async (license: string, rendered: string): Promise<Partial<CslbRecord> | null> => {
  if (!ANTHROPIC_API_KEY) return null
  // Trim long pages — CSLB detail page is small but be safe
  const content = rendered.length > 18000 ? rendered.slice(0, 18000) : rendered

  const tool = {
    type: 'function',
    function: {
      name: 'extract_cslb_license',
      description: 'Extract structured CSLB license details from a rendered license-detail page.',
      parameters: {
        type: 'object',
        properties: {
          license_status: {
            type: ['string', 'null'],
            description: 'Plain English status: Active, Suspended, Expired, Inactive, or null if unknown.',
          },
          business_name: { type: ['string', 'null'] },
          licensee_name: { type: ['string', 'null'] },
          classifications: {
            type: 'array',
            items: { type: 'string' },
            description: 'CSLB class codes exactly as shown (e.g. "B", "C-10", "C-36").',
          },
          issue_date: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD if present.' },
          expiration_date: { type: ['string', 'null'], description: 'ISO date YYYY-MM-DD if present.' },
          bond_status: {
            type: ['string', 'null'],
            description: 'Plain English: Active, Cancelled, Exempt, or null. Include bond company if shown.',
          },
          bond_amount: { type: ['number', 'null'], description: 'Bond amount in USD if shown.' },
          workers_comp_status: {
            type: ['string', 'null'],
            description: 'Plain English: Active, Exempt, Expired, or null.',
          },
          has_disciplinary_action: {
            type: 'boolean',
            description: 'True if the page lists ANY citation, complaint, suspension, revocation, or disciplinary action.',
          },
          disciplinary_notes: { type: ['string', 'null'], description: 'Brief plain-English summary of any actions.' },
        },
        required: [
          'license_status', 'business_name', 'licensee_name', 'classifications',
          'issue_date', 'expiration_date', 'bond_status', 'bond_amount',
          'workers_comp_status', 'has_disciplinary_action', 'disciplinary_notes',
        ],
        additionalProperties: false,
      },
    },
  }

  try {
    const resp = await aiFetch({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ANTHROPIC_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'fast',
        messages: [
          {
            role: 'system',
            content:
              'You extract California CSLB contractor license details from rendered license-detail pages. ' +
              'Be conservative: if a field is not clearly present, return null. ' +
              'Only mark has_disciplinary_action=true when the page explicitly references a citation, complaint, ' +
              'suspension, revocation, or other action — never on phrases like "no disciplinary action".',
          },
          {
            role: 'user',
            content: `License number: ${license}\n\nRendered page:\n${content}`,
          },
        ],
        tools: [tool],
        tool_choice: { type: 'function', function: { name: 'extract_cslb_license' } },
      }),
    })
    if (!resp.ok) {
      console.warn('Claude extract failed', resp.status, await resp.text().catch(() => ''))
      return null
    }
    const data = await resp.json()
    const call = data?.choices?.[0]?.message?.tool_calls?.[0]
    if (!call?.function?.arguments) return null
    const parsed = JSON.parse(call.function.arguments)
    return {
      license_status: parsed.license_status ?? null,
      business_name: parsed.business_name ?? null,
      licensee_name: parsed.licensee_name ?? null,
      classifications: Array.isArray(parsed.classifications) ? parsed.classifications.filter(Boolean) : null,
      issue_date: parsed.issue_date ?? null,
      expiration_date: parsed.expiration_date ?? null,
      bond_status: parsed.bond_status ?? null,
      bond_amount: typeof parsed.bond_amount === 'number' ? parsed.bond_amount : null,
      workers_comp_status: parsed.workers_comp_status ?? null,
      has_disciplinary_action: Boolean(parsed.has_disciplinary_action),
      disciplinary_notes: parsed.disciplinary_notes ?? null,
    }
  } catch (e) {
    console.warn('Claude extract error', e)
    return null
  }
}

// ─── Status-change detection ─────────────────────────────────────────────────
const recordStatusChange = async (
  supabase: any,
  license: string,
  previous: string | null,
  next: string | null,
  via: 'firecrawl' | 'bulk_import',
) => {
  const norm = (s: string | null) => (s ?? '').trim().toLowerCase()
  if (!previous || norm(previous) === norm(next)) return
  // Only alert on degradations or movement away from "active"
  const wasActive = norm(previous).includes('active') || norm(previous).includes('current')
  const isActive = norm(next).includes('active') || norm(next).includes('current')
  if (!wasActive || isActive) return
  // Find any contractor we surface for this license number
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id')
    .eq('license_number', license)
    .maybeSingle()
  await supabase.from('cslb_status_alerts').insert({
    license_number: license,
    contractor_id: contractor?.id ?? null,
    previous_status: previous,
    new_status: next,
    detected_via: via,
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const url = new URL(req.url)
    const license = String(body.license || url.searchParams.get('license') || '').trim().toUpperCase()
    const force = Boolean(body.force ?? url.searchParams.get('force'))
    if (!license) {
      return new Response(JSON.stringify({ ok: false, error: 'license required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Cache check + bulk fallback in one query
    const { data: existing } = await supabase
      .from('cslb_licenses')
      .select('*')
      .eq('license_number', license)
      .maybeSingle()

    const previousStatus = (existing?.license_status as string) ?? null

    if (!force && existing && existing.last_verified_at) {
      const ageMs = Date.now() - new Date(existing.last_verified_at as string).getTime()
      if (existing.data_source === 'firecrawl' && ageMs < CACHE_HOURS * 3600 * 1000) {
        return toResponse(rowFromDb(existing), { source: 'cache' })
      }
    }

    // 2. If we have bulk-import data, return it immediately and refresh in background
    if (!force && existing && existing.data_source === 'bulk_import') {
      // Best-effort background refresh — fire-and-forget
      const refresh = (async () => {
        try {
          for (let i = 0; i < FIRECRAWL_MAX_ATTEMPTS; i++) {
            const { markdown, html } = await firecrawlScrape(license)
            const rendered = markdown ?? html
            if (!rendered) continue
            const fields = await extractWithAi(license, rendered)
            if (!fields) continue
            await supabase
              .from('cslb_licenses')
              .upsert({
                license_number: license,
                ...fields,
                data_source: 'firecrawl',
                raw_data: { rendered_excerpt: rendered.slice(0, 4000) },
                last_verified_at: new Date().toISOString(),
              })
            await recordStatusChange(supabase, license, previousStatus, fields.license_status ?? null, 'firecrawl')
            return
          }
        } catch (e) {
          console.warn('background refresh failed', license, e)
        }
      })()
      // EdgeRuntime is provided by Supabase
      try {
        // @ts-expect-error EdgeRuntime is a Supabase global
        if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(refresh)
      } catch { /* ignore */ }
      return toResponse(rowFromDb(existing), { source: 'bulk_import' })
    }

    // 3. Firecrawl with up to 2 attempts
    let lastError: string | undefined
    for (let attempt = 1; attempt <= FIRECRAWL_MAX_ATTEMPTS; attempt++) {
      const scrape = await firecrawlScrape(license)
      if (scrape.error) {
        lastError = scrape.error
        continue
      }
      const rendered = scrape.markdown ?? scrape.html
      if (!rendered) {
        lastError = 'Empty rendering'
        continue
      }
      const fields = await extractWithAi(license, rendered)
      if (!fields) {
        lastError = 'AI extraction failed'
        continue
      }
      const verified_at = new Date().toISOString()
      const upsert = {
        license_number: license,
        ...fields,
        data_source: 'firecrawl' as const,
        raw_data: { rendered_excerpt: rendered.slice(0, 4000) },
        last_verified_at: verified_at,
      }
      await supabase.from('cslb_licenses').upsert(upsert)
      await recordStatusChange(supabase, license, previousStatus, fields.license_status ?? null, 'firecrawl')
      return toResponse(
        { ...toFallbackRow(license), ...upsert, deep_link: CSLB_DETAIL(license) } as CslbRecord,
        { source: 'firecrawl', attempts: attempt },
      )
    }

    // 4. Fallback — never invent data
    if (existing) {
      // We have stale data; return it but flag low confidence
      return toResponse(rowFromDb(existing), { source: 'stale', firecrawl_error: lastError })
    }
    // Persist a fallback row so the UI can show "unverified" with a deep link
    await supabase.from('cslb_licenses').upsert({
      license_number: license,
      data_source: 'fallback',
      last_verified_at: null,
    })
    return toResponse(toFallbackRow(license), { source: 'fallback', firecrawl_error: lastError })
  } catch (e) {
    console.error('verify-cslb-license error', e)
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
