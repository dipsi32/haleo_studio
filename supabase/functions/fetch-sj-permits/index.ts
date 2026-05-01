// Fetches building permits from San Jose CKAN datastore API,
// filters to construction/remodel work, aggregates by contractor name,
// upserts contractors + permits into our DB.
//
// CKAN endpoint: https://data.sanjoseca.gov/api/3/action/datastore_search
// Active permits resource: 761b7ae8-3be1-4ad6-923d-c7af6404a904
// Schema: Status, gx_location, ASSESSORS_PARCEL_NUMBER, APPLICANT, OWNERNAME,
//   CONTRACTOR, FOLDERNUMBER, FOLDERDESC, FOLDERNAME, SUBTYPEDESCRIPTION,
//   WORKDESCRIPTION, PERMITAPPROVALS, ISSUEDATE, FINALDATE, DWELLINGUNITS,
//   PERMITVALUATION, SQUAREFOOTAGE, FOLDERRSN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const SJ_RESOURCE = '761b7ae8-3be1-4ad6-923d-c7af6404a904'
const SJ_API = 'https://data.sanjoseca.gov/api/3/action/datastore_search'

// Broadened keyword set so we don't drop legit residential work like
// "Alterations", "Sub-Trades Only", "Repair", etc. The dataset is San Jose
// residential/commercial permits only — being inclusive is safe.
const projectQueries = (room?: string): string[] => {
  const broad = ['kitchen', 'bath', 'addition', 'remodel', 'alteration', 'sub-trades', 'repair', 'single-family']
  if (!room) return broad
  const r = room.toLowerCase()
  // Even when a room is specified, include broad terms so contractor history
  // isn't artificially shrunk to a single keyword match.
  if (r.includes('kitchen')) return ['kitchen', ...broad]
  if (r.includes('bath')) return ['bath', ...broad]
  if (r.includes('addition')) return ['addition', 'alteration', ...broad]
  if (r.includes('full')) return broad
  return broad
}

interface SJRecord {
  _id?: number
  Status?: string
  gx_location?: string
  ASSESSORS_PARCEL_NUMBER?: string | null
  APPLICANT?: string
  OWNERNAME?: string
  CONTRACTOR?: string | null
  FOLDERNUMBER?: string
  FOLDERDESC?: string
  FOLDERNAME?: string
  SUBTYPEDESCRIPTION?: string
  WORKDESCRIPTION?: string
  ISSUEDATE?: string
  FINALDATE?: string | null
  PERMITVALUATION?: string
  SQUAREFOOTAGE?: string
  FOLDERRSN?: string
}

const safeNum = (v?: string | null) => {
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const parseDate = (v?: string | null) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

// gx_location format: "1234 SOMETHING ST  , SAN JOSE CA 95110-1234"
const parseLocation = (loc?: string): { address: string | null; zip: string | null } => {
  if (!loc) return { address: null, zip: null }
  const trimmed = loc.trim()
  if (!trimmed || trimmed === ',') return { address: null, zip: null }
  const parts = trimmed.split(',').map(p => p.trim())
  const address = parts[0] && parts[0] !== '' ? parts[0].replace(/\s+/g, ' ') : null
  const last = parts[parts.length - 1] ?? ''
  const zipMatch = last.match(/(\d{5})(?:-\d{4})?/)
  return { address, zip: zipMatch ? zipMatch[1] : null }
}

// Contractor strings look like "K&E KITCHEN & BATH, INC.   " or
// "ELEV8 DESIGN & BUILD  ANGELICA NGUYEN" — first chunk before double-space is company.
const parseContractor = (raw?: string | null): { name: string; company: string } | null => {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Skip pseudo-records
  if (/^APPLICANT\/CONTRACTOR/i.test(trimmed)) return null
  if (/^OWNER[\s/]/i.test(trimmed)) return null
  const parts = trimmed.split(/\s{2,}/).map(p => p.trim()).filter(Boolean)
  const company = parts[0]
  const personName = parts[1] ?? company
  return { name: personName, company }
}

// Slugify company name for use as a stable license_number key when no real
// license is in the dataset. CSLB deep-link will be a name search.
const companyKey = (company: string) => {
  return 'SJ-' + company
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const zip = body.zip || url.searchParams.get('zip') || '95110'
    const room = body.room || url.searchParams.get('room') || undefined
    const contractor = body.contractor || url.searchParams.get('contractor') || undefined
    const limit = Number(body.limit || url.searchParams.get('limit') || 500)

    // If a contractor name is provided, search by name only — this catches
    // every permit they pulled regardless of work-type keyword.
    const queries = contractor ? [contractor] : projectQueries(room)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Pull records for each query in parallel
    const perQuery = Math.ceil(limit / queries.length)
    let fetchError: string | null = null

    const results = await Promise.allSettled(queries.map(async (q) => {
      const apiUrl = `${SJ_API}?resource_id=${SJ_RESOURCE}&q=${encodeURIComponent(q)}&limit=${perQuery}`
      const resp = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!resp.ok) throw new Error(`San Jose API ${resp.status} for "${q}"`)
      const data = await resp.json()
      if (!data.success) throw new Error(`San Jose API !success for "${q}"`)
      return (data.result?.records ?? []) as SJRecord[]
    }))

    const allRecords: SJRecord[] = []
    let fetchOk = false
    for (const r of results) {
      if (r.status === 'fulfilled') {
        allRecords.push(...r.value)
        fetchOk = true
      } else if (!fetchError) {
        fetchError = r.reason instanceof Error ? r.reason.message : String(r.reason)
      }
    }

    if (!fetchOk) {
      return new Response(JSON.stringify({
        ok: false,
        error: fetchError ?? 'San Jose Open Data unreachable',
        contractors_upserted: 0,
        permits_upserted: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
    }

    // Filter to records with a contractor
    const withContractor = allRecords.filter(r => parseContractor(r.CONTRACTOR))

    // Optional zip filter — match leading 3 digits to broaden the area
    const zipPrefix = String(zip).slice(0, 3)
    const zipFiltered = zip
      ? withContractor.filter(r => {
          const { zip: rz } = parseLocation(r.gx_location)
          return !rz || rz.startsWith(zipPrefix)
        })
      : withContractor

    // Group by contractor company
    const contractorMap = new Map<string, {
      companyKey: string
      name: string
      company: string
      records: SJRecord[]
    }>()

    for (const r of zipFiltered) {
      const c = parseContractor(r.CONTRACTOR)
      if (!c) continue
      const key = companyKey(c.company)
      const existing = contractorMap.get(key)
      if (existing) {
        existing.records.push(r)
      } else {
        contractorMap.set(key, {
          companyKey: key,
          name: c.name,
          company: c.company,
          records: [r],
        })
      }
    }

    // Build all contractor rows in one shot
    const contractorRows: Array<Record<string, unknown>> = []
    const recordsByKey = new Map<string, SJRecord[]>()

    for (const c of contractorMap.values()) {
      if (c.records.length < 1) continue
      const lastPermitDate = c.records.map(r => parseDate(r.ISSUEDATE)).filter(Boolean).sort().reverse()[0]
      const zipCounts = new Map<string, number>()
      for (const r of c.records) {
        const { zip: rz } = parseLocation(r.gx_location)
        if (rz) zipCounts.set(rz, (zipCounts.get(rz) ?? 0) + 1)
      }
      let representativeZip: string | null = null
      let maxZipCount = 0
      for (const [z, n] of zipCounts.entries()) {
        if (n > maxZipCount) { maxZipCount = n; representativeZip = z }
      }
      const allWork = c.records.map(r => `${r.SUBTYPEDESCRIPTION ?? ''} ${r.WORKDESCRIPTION ?? ''}`).join(' ').toLowerCase()
      let specialty = 'General'
      if (/kitchen/.test(allWork)) specialty = 'Kitchen'
      else if (/bath/.test(allWork)) specialty = 'Bathroom'
      else if (/addition|new construction/.test(allWork)) specialty = 'Additions'
      else if (/remodel|alteration/.test(allWork)) specialty = 'Remodel'
      else if (/electric/.test(allWork)) specialty = 'Electrical'
      else if (/plumb/.test(allWork)) specialty = 'Plumbing'

      contractorRows.push({
        license_number: c.companyKey,
        name: c.company,
        company: c.company,
        specialty,
        city: 'San Jose',
        state: 'CA',
        zip: representativeZip,
        permit_count: c.records.length,
        last_permit_date: lastPermitDate ?? null,
      })
      recordsByKey.set(c.companyKey, c.records)
    }

    // Batch upsert contractors
    const { data: upsertedContractors, error: cErr } = await supabase
      .from('contractors')
      .upsert(contractorRows, { onConflict: 'license_number' })
      .select('id, license_number')

    if (cErr) throw new Error(`Contractor upsert failed: ${cErr.message}`)

    const idByKey = new Map<string, string>()
    for (const c of upsertedContractors ?? []) {
      idByKey.set(c.license_number, c.id)
    }

    // Build all permit rows
    const permitRows: Array<Record<string, unknown>> = []
    for (const [key, records] of recordsByKey.entries()) {
      const contractorId = idByKey.get(key)
      if (!contractorId) continue
      for (const r of records) {
        const { address, zip: pZip } = parseLocation(r.gx_location)
        const folderNumber = r.FOLDERNUMBER ?? `SJ-${r.FOLDERRSN ?? Math.random().toString(36).slice(2, 8)}`
        const work = `${r.SUBTYPEDESCRIPTION ?? ''} — ${r.WORKDESCRIPTION ?? ''}`.replace(/^—\s*|\s*—\s*$/g, '').trim()
        permitRows.push({
          contractor_id: contractorId,
          permit_number: folderNumber,
          work_type: r.FOLDERDESC ?? null,
          description: work || null,
          valuation: safeNum(r.PERMITVALUATION),
          address,
          city: 'San Jose',
          zip: pZip,
          issued_date: parseDate(r.ISSUEDATE),
          completed_date: parseDate(r.FINALDATE),
          status: r.Status ?? null,
          source: 'san_jose',
        })
      }
    }

    // Chunked upsert (avoid huge payloads)
    let permitsUpserted = 0
    const CHUNK = 500
    for (let i = 0; i < permitRows.length; i += CHUNK) {
      const chunk = permitRows.slice(i, i + CHUNK)
      const { error: pErr } = await supabase
        .from('contractor_permits')
        .upsert(chunk, { onConflict: 'source,permit_number' })
      if (!pErr) permitsUpserted += chunk.length
    }

    const contractorsUpserted = upsertedContractors?.length ?? 0

    return new Response(JSON.stringify({
      ok: true,
      zip,
      room,
      raw_rows: allRecords.length,
      with_contractor: withContractor.length,
      filtered_rows: zipFiltered.length,
      contractors_upserted: contractorsUpserted,
      permits_upserted: permitsUpserted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
