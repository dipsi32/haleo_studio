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

const projectQueries = (room?: string): string[] => {
  if (!room) return ['kitchen', 'bath', 'addition', 'remodel']
  const r = room.toLowerCase()
  if (r.includes('kitchen')) return ['kitchen']
  if (r.includes('bath')) return ['bath']
  if (r.includes('addition')) return ['addition']
  if (r.includes('full')) return ['remodel', 'addition']
  return ['remodel']
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
    const limit = Number(body.limit || url.searchParams.get('limit') || 500)

    const queries = projectQueries(room)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Pull records for each project keyword and merge
    const allRecords: SJRecord[] = []
    let fetchOk = false
    let fetchError: string | null = null

    for (const q of queries) {
      try {
        const apiUrl = `${SJ_API}?resource_id=${SJ_RESOURCE}&q=${encodeURIComponent(q)}&limit=${Math.ceil(limit / queries.length)}`
        const resp = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (resp.ok) {
          const data = await resp.json()
          if (data.success) {
            allRecords.push(...(data.result?.records ?? []))
            fetchOk = true
          }
        } else if (!fetchError) {
          fetchError = `San Jose API ${resp.status} for "${q}"`
        }
      } catch (e) {
        if (!fetchError) fetchError = `San Jose fetch failed: ${e instanceof Error ? e.message : String(e)}`
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

    let contractorsUpserted = 0
    let permitsUpserted = 0

    for (const c of contractorMap.values()) {
      // Skip contractors with only one job — likely noise; keep ones with real volume
      if (c.records.length < 1) continue

      const lastPermitDate = c.records
        .map(r => parseDate(r.ISSUEDATE))
        .filter(Boolean)
        .sort()
        .reverse()[0]

      // Pick a representative zip (most common)
      const zipCounts = new Map<string, number>()
      let representativeZip: string | null = null
      for (const r of c.records) {
        const { zip: rz } = parseLocation(r.gx_location)
        if (rz) {
          zipCounts.set(rz, (zipCounts.get(rz) ?? 0) + 1)
        }
      }
      let maxZipCount = 0
      for (const [z, n] of zipCounts.entries()) {
        if (n > maxZipCount) { maxZipCount = n; representativeZip = z }
      }

      // Specialty inference from work descriptions
      const allWork = c.records.map(r => `${r.SUBTYPEDESCRIPTION ?? ''} ${r.WORKDESCRIPTION ?? ''}`).join(' ').toLowerCase()
      let specialty: string | null = null
      if (/kitchen/.test(allWork)) specialty = 'Kitchen'
      else if (/bath/.test(allWork)) specialty = 'Bathroom'
      else if (/addition|new construction/.test(allWork)) specialty = 'Additions'
      else if (/remodel|alteration/.test(allWork)) specialty = 'Remodel'
      else if (/electric/.test(allWork)) specialty = 'Electrical'
      else if (/plumb/.test(allWork)) specialty = 'Plumbing'
      else specialty = 'General'

      const contractorRow = {
        license_number: c.companyKey,
        name: c.company, // company-led; person name often blank
        company: c.company,
        specialty,
        city: 'San Jose',
        state: 'CA',
        zip: representativeZip,
        permit_count: c.records.length,
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

      const permitRows = c.records.map(r => {
        const { address, zip: pZip } = parseLocation(r.gx_location)
        const folderNumber = r.FOLDERNUMBER ?? `SJ-${r.FOLDERRSN ?? Math.random().toString(36).slice(2, 8)}`
        const valuation = safeNum(r.PERMITVALUATION)
        const work = `${r.SUBTYPEDESCRIPTION ?? ''} — ${r.WORKDESCRIPTION ?? ''}`.replace(/^—\s*|\s*—\s*$/g, '').trim()
        return {
          contractor_id: contractorId,
          permit_number: folderNumber,
          work_type: r.FOLDERDESC ?? null,
          description: work || null,
          valuation,
          address,
          city: 'San Jose',
          zip: pZip,
          lat: null,
          lng: null,
          issued_date: parseDate(r.ISSUEDATE),
          completed_date: parseDate(r.FINALDATE),
          status: r.Status ?? null,
          source: 'san_jose',
          raw_data: r as unknown as Record<string, unknown>,
        }
      })

      const { error: permErr } = await supabase
        .from('contractor_permits')
        .upsert(permitRows, { onConflict: 'source,permit_number', ignoreDuplicates: false })

      if (!permErr) permitsUpserted += permitRows.length
    }

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
