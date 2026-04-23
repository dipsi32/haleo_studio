// Verifies a CSLB license number by scraping the public CSLB lookup page.
// Caches results for 24h. Returns deep-link fallback shape on scrape failure.
//
// CSLB lookup URL: https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=<num>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CSLB_DETAIL = (num: string) =>
  `https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=${encodeURIComponent(num)}`

const CACHE_HOURS = 24

interface ParsedLicense {
  status?: string
  business_name?: string
  classifications?: string[]
  issue_date?: string
  expiration_date?: string
  has_disciplinary_action?: boolean
  disciplinary_notes?: string
  workers_comp_status?: string
  bond_status?: string
}

// CSLB renders license info in a table with predictable label patterns.
// We extract using regex against the HTML — fragile by design (their HTML can change).
const extractAfter = (html: string, label: string, max = 200): string | undefined => {
  const re = new RegExp(`${label}\\s*</[^>]+>\\s*<[^>]+>([^<]{1,${max}})`, 'i')
  const m = html.match(re)
  return m ? m[1].replace(/\s+/g, ' ').trim() : undefined
}

const parseDate = (v?: string) => {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10)
}

const parseCslbHtml = (html: string): ParsedLicense | null => {
  // Quick sanity check the page actually returned license data
  if (!/License\s*Number/i.test(html) && !/LicNum/i.test(html)) return null

  const status = extractAfter(html, 'Primary Status') ?? extractAfter(html, 'License Status')
  const businessName = extractAfter(html, 'Business Information') ?? extractAfter(html, 'Business Name')
  const issueRaw = extractAfter(html, 'Issue Date')
  const expRaw = extractAfter(html, 'Expire Date') ?? extractAfter(html, 'Expiration Date')

  const classMatches = [...html.matchAll(/Class[:\s]*<[^>]+>\s*([A-Z]\d?[\w\-]*)/gi)]
  const classifications = Array.from(new Set(classMatches.map(m => m[1]))).slice(0, 8)

  const hasDiscipline = /disciplinary action/i.test(html) && !/no disciplinary action/i.test(html)
  const wcStatus = extractAfter(html, "Workers' Compensation") ?? extractAfter(html, 'Workers Compensation')
  const bondStatus = extractAfter(html, 'Contractor.{0,5}s Bond') ?? extractAfter(html, 'Bond')

  return {
    status,
    business_name: businessName,
    classifications: classifications.length ? classifications : undefined,
    issue_date: parseDate(issueRaw),
    expiration_date: parseDate(expRaw),
    has_disciplinary_action: hasDiscipline,
    disciplinary_notes: hasDiscipline ? 'See CSLB record for details' : undefined,
    workers_comp_status: wcStatus,
    bond_status: bondStatus,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const url = new URL(req.url)
    const license = String(body.license || url.searchParams.get('license') || '').trim().toUpperCase()
    if (!license) {
      return new Response(JSON.stringify({ ok: false, error: 'license required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Check cache
    const { data: cached } = await supabase
      .from('contractor_license_cache')
      .select('*')
      .eq('license_number', license)
      .maybeSingle()

    if (cached) {
      const ageMs = Date.now() - new Date(cached.last_checked_at).getTime()
      if (ageMs < CACHE_HOURS * 3600 * 1000) {
        return new Response(JSON.stringify({
          ok: true,
          cached: true,
          deep_link: CSLB_DETAIL(license),
          ...cached,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
      }
    }

    // Try scrape
    let parsed: ParsedLicense | null = null
    let scrapeOk = false
    let scrapeErr: string | null = null

    try {
      const resp = await fetch(CSLB_DETAIL(license), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HaleoBot/1.0; +https://haleo.studio/bot)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })
      if (resp.ok) {
        const html = await resp.text()
        parsed = parseCslbHtml(html)
        scrapeOk = !!parsed
      } else {
        scrapeErr = `CSLB returned ${resp.status}`
      }
    } catch (e) {
      scrapeErr = `CSLB unreachable: ${e instanceof Error ? e.message : String(e)}`
    }

    const cacheRow = {
      license_number: license,
      status: parsed?.status ?? null,
      business_name: parsed?.business_name ?? null,
      classifications: parsed?.classifications ?? null,
      issue_date: parsed?.issue_date ?? null,
      expiration_date: parsed?.expiration_date ?? null,
      has_disciplinary_action: parsed?.has_disciplinary_action ?? false,
      disciplinary_notes: parsed?.disciplinary_notes ?? null,
      workers_comp_status: parsed?.workers_comp_status ?? null,
      bond_status: parsed?.bond_status ?? null,
      raw_response: parsed ? (parsed as unknown as Record<string, unknown>) : null,
      scrape_succeeded: scrapeOk,
      last_checked_at: new Date().toISOString(),
    }

    await supabase
      .from('contractor_license_cache')
      .upsert(cacheRow, { onConflict: 'license_number' })

    return new Response(JSON.stringify({
      ok: true,
      cached: false,
      scrape_succeeded: scrapeOk,
      scrape_error: scrapeErr,
      deep_link: CSLB_DETAIL(license),
      ...cacheRow,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
