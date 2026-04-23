// Fetches building permits from San Jose Open Data Socrata API,
// filters to construction/remodel work, aggregates by contractor license,
// upserts contractors + permits into our DB.
//
// Socrata endpoint: https://data.sanjoseca.gov/resource/<dataset>.json
// Building permits dataset id: ygu7-d9hk (Building Permits)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// San Jose Open Data — Building Permits (Socrata SODA API)
const SJ_PERMITS_DATASET = 'ygu7-d9hk'
const SJ_BASE = `https://data.sanjoseca.gov/resource/${SJ_PERMITS_DATASET}.json`

// Project-type → permit work-type keyword mapping
const projectTypeKeywords = (room?: string): string[] => {
  if (!room) return ['remodel', 'addition', 'kitchen', 'bath']
  const r = room.toLowerCase()
  if (r.includes('kitchen')) return ['kitchen', 'remodel']
  if (r.includes('bath')) return ['bath', 'remodel']
  if (r.includes('addition')) return ['addition', 'add', 'new']
  if (r.includes('full')) return ['remodel', 'addition', 'alteration']
  return ['remodel', 'alteration', 'addition']
}

interface SJPermitRow {
  permit_number?: string
  permitnumber?: string
  application_number?: string
  permit_type?: string
  work_description?: string
  description?: string
  valuation?: string
  estimated_cost?: string
  address?: string
  street_address?: string
  zip?: string
  zip_code?: string
  postal_code?: string
  issued_date?: string
  issue_date?: string
  completion_date?: string
  finaled_date?: string
  status?: string
  contractor_name?: string
  contractor_license?: string
  license_number?: string
  contractor_company?: string
  latitude?: string
  longitude?: string
  location_1?: { latitude?: string; longitude?: string }
}

const safeNum = (v?: string) => {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const parseDate = (v?: string) => {
  if (!v) return null
  try {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const zip = body.zip || url.searchParams.get('zip') || '95110'
    const room = body.room || url.searchParams.get('room') || undefined
    const limit = Number(body.limit || url.searchParams.get('limit') || 200)

    const keywords = projectTypeKeywords(room)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Try multiple Socrata field names — different cities use different schemas
    const where = [
      `(${keywords.map(k => `upper(permit_type) like upper('%${k}%') OR upper(work_description) like upper('%${k}%')`).join(' OR ')})`,
    ].join(' AND ')

    const sjUrl = new URL(SJ_BASE)
    sjUrl.searchParams.set('$limit', String(limit))
    sjUrl.searchParams.set('$where', where)
    sjUrl.searchParams.set('$order', 'issued_date DESC')

    let rows: SJPermitRow[] = []
    let fetchOk = false
    let fetchError: string | null = null

    try {
      const resp = await fetch(sjUrl.toString(), {
        headers: { 'Accept': 'application/json' },
      })
      if (resp.ok) {
        rows = await resp.json()
        fetchOk = true
      } else {
        fetchError = `San Jose API ${resp.status}`
      }
    } catch (e) {
      fetchError = `San Jose fetch failed: ${e instanceof Error ? e.message : String(e)}`
    }

    // Fallback — try a simpler query without $where if filtered query fails
    if (!fetchOk) {
      try {
        const simple = new URL(SJ_BASE)
        simple.searchParams.set('$limit', '50')
        simple.searchParams.set('$order', 'issued_date DESC')
        const resp = await fetch(simple.toString())
        if (resp.ok) {
          rows = await resp.json()
          fetchOk = true
        }
      } catch { /* keep error */ }
    }

    if (!fetchOk) {
      return new Response(JSON.stringify({
        ok: false,
        error: fetchError ?? 'San Jose Open Data unreachable',
        contractors_upserted: 0,
        permits_upserted: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Filter to rows in (or near) the requested zip if available
    const zipFiltered = zip
      ? rows.filter(r => {
          const z = r.zip ?? r.zip_code ?? r.postal_code
          return !z || String(z).startsWith(String(zip).slice(0, 3))
        })
      : rows

    // Group by contractor license number
    const contractorMap = new Map<string, {
      license: string
      name: string
      company?: string
      permits: SJPermitRow[]
    }>()

    for (const row of zipFiltered) {
      const license = row.contractor_license || row.license_number
      if (!license) continue
      const key = String(license).trim().toUpperCase()
      if (!key) continue
      const existing = contractorMap.get(key)
      if (existing) {
        existing.permits.push(row)
      } else {
        contractorMap.set(key, {
          license: key,
          name: row.contractor_name ?? row.contractor_company ?? 'Unknown contractor',
          company: row.contractor_company ?? row.contractor_name,
          permits: [row],
        })
      }
    }

    let contractorsUpserted = 0
    let permitsUpserted = 0

    for (const c of contractorMap.values()) {
      // Upsert contractor
      const lastPermitDate = c.permits
        .map(p => parseDate(p.issued_date ?? p.issue_date))
        .filter(Boolean)
        .sort()
        .reverse()[0]

      const firstPermit = c.permits[0]
      const contractorRow = {
        license_number: c.license,
        name: c.name,
        company: c.company ?? null,
        city: 'San Jose',
        state: 'CA',
        zip: firstPermit?.zip ?? firstPermit?.zip_code ?? firstPermit?.postal_code ?? null,
        permit_count: c.permits.length,
        last_permit_date: lastPermitDate ?? null,
      }

      const { data: upserted, error: upErr } = await supabase
        .from('contractors')
        .upsert(contractorRow, { onConflict: 'license_number' })
        .select('id')
        .single()

      if (upErr || !upserted) continue
      contractorsUpserted++

      const contractorId = upserted.id

      const permitRows = c.permits.map(p => {
        const permitNumber = p.permit_number ?? p.permitnumber ?? p.application_number ?? `${c.license}-${Math.random().toString(36).slice(2, 8)}`
        const lat = safeNum(p.latitude) ?? safeNum(p.location_1?.latitude)
        const lng = safeNum(p.longitude) ?? safeNum(p.location_1?.longitude)
        return {
          contractor_id: contractorId,
          permit_number: String(permitNumber),
          work_type: p.permit_type ?? null,
          description: p.work_description ?? p.description ?? null,
          valuation: safeNum(p.valuation ?? p.estimated_cost),
          address: p.address ?? p.street_address ?? null,
          city: 'San Jose',
          zip: p.zip ?? p.zip_code ?? p.postal_code ?? null,
          lat,
          lng,
          issued_date: parseDate(p.issued_date ?? p.issue_date),
          completed_date: parseDate(p.completion_date ?? p.finaled_date),
          status: p.status ?? null,
          source: 'san_jose',
          raw_data: p as unknown as Record<string, unknown>,
        }
      })

      // Upsert permits one batch per contractor
      const { error: permErr } = await supabase
        .from('contractor_permits')
        .upsert(permitRows, { onConflict: 'source,permit_number', ignoreDuplicates: false })

      if (!permErr) permitsUpserted += permitRows.length
    }

    return new Response(JSON.stringify({
      ok: true,
      zip,
      room,
      raw_rows: rows.length,
      filtered_rows: zipFiltered.length,
      contractors_upserted: contractorsUpserted,
      permits_upserted: permitsUpserted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
