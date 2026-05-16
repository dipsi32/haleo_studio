// Fetches rich inspection-stage data for a specific list of San José permit
// folder numbers. Powers the "Recent jobs at a glance" section on a
// contractor's profile (the 3-Address Strategy a savvy homeowner would do
// manually). Pulls from the three SJ CKAN feeds in parallel:
//   - Active Building Permits
//   - Building Permits Under Inspection (the one with live PERMITAPPROVALS)
//   - Expired Building Permits
//
// Returns per folder: status, trade-approval breakdown (B/E/M/P), owner-builder
// flag (APPLICANT === OWNERNAME), valuation, issued/final dates.
//
// Does NOT touch the trust score. This is a "show your work" section so a
// homeowner can do their own due diligence on past job addresses.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Each feed has a CKAN dataset slug so we can deep-link the user back to the
// exact record they're looking at on the City of San José open data portal.
const FEEDS = [
  { id: '89ccdad9-7309-4826-a5f3-2fcf1fcb20fa', source: 'under_inspection', slug: 'building-permits-under-inspection' },
  { id: '761b7ae8-3be1-4ad6-923d-c7af6404a904', source: 'active', slug: 'active-building-permits' },
  { id: 'df4b8461-0c7a-4d16-b85d-ff7f71c5fed5', source: 'expired', slug: 'expired-building-permits' },
]
const SJ_API = 'https://data.sanjoseca.gov/api/3/action/datastore_search'

interface SJRecord {
  Status?: string
  gx_location?: string
  APPLICANT?: string
  OWNERNAME?: string
  CONTRACTOR?: string | null
  FOLDERNUMBER?: string
  FOLDERDESC?: string
  FOLDERNAME?: string
  SUBTYPEDESCRIPTION?: string
  WORKDESCRIPTION?: string
  PERMITAPPROVALS?: string
  ISSUEDATE?: string
  FINALDATE?: string | null
  PERMITVALUATION?: string
  SQUAREFOOTAGE?: string
}

const parseDate = (v?: string | null) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

const monthsSince = (d?: string | null) => {
  if (!d) return null
  const past = new Date(d).getTime()
  if (Number.isNaN(past)) return null
  return Math.floor((Date.now() - past) / (1000 * 60 * 60 * 24 * 30.44))
}

// Parse "B-Complete, E-Complete, M-In Progress, P-Pending" into trade pills.
// CSV-ish, each token "<TRADE>-<STATUS>". Trade codes: B=Building,
// E=Electrical, M=Mechanical, P=Plumbing, F=Fire, etc.
type TradeStatus = 'complete' | 'in_progress' | 'pending' | 'unknown'
const TRADE_LABELS: Record<string, string> = {
  B: 'Building', E: 'Electrical', M: 'Mechanical', P: 'Plumbing',
  F: 'Fire', G: 'Grading', S: 'Structural',
}
const parseApprovals = (raw?: string): { code: string; label: string; status: TradeStatus; raw: string }[] => {
  if (!raw) return []
  return raw.split(',').map(s => s.trim()).filter(Boolean).map(token => {
    const [codeRaw, ...rest] = token.split('-')
    const code = (codeRaw ?? '').trim().toUpperCase().slice(0, 1)
    const statusText = rest.join('-').trim().toLowerCase()
    let status: TradeStatus = 'unknown'
    if (/complete|final|pass/.test(statusText)) status = 'complete'
    else if (/in.?progress|under|active|started/.test(statusText)) status = 'in_progress'
    else if (/pending|not.?started|none/.test(statusText)) status = 'pending'
    return {
      code,
      label: TRADE_LABELS[code] ?? code,
      status,
      raw: rest.join('-').trim() || 'Unknown',
    }
  })
}

// Owner-builder = applicant is the same person as the property owner.
// Normalize aggressively because SJ stores "JONES RUSSELL M AND THERESA C   "
// with trailing spaces and mixed punctuation.
const isOwnerBuilder = (applicant?: string, owner?: string): boolean => {
  if (!applicant || !owner) return false
  const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  const a = norm(applicant), o = norm(owner)
  if (!a || !o) return false
  // Exact or substring match (owner often includes "TRUSTEE" suffix etc.)
  return a === o || a.includes(o) || o.includes(a)
}

// Build links the user can actually open:
//   - openDataUrl: stable, address-accurate, deep-linked to the row on the SJ
//     open-data portal. Always works.
//   - accelaSearchUrl: a Google search scoped to the city's Accela portal so
//     they can jump to the human-friendly permit detail (including final
//     inspection status, which open data doesn't publish). We don't link
//     Accela's CapDetail.aspx directly because it requires a session and
//     returns 404 when hit cold.
const openDataUrl = (slug: string, folder: string) =>
  `https://data.sanjoseca.gov/dataset/${slug}?filters%5BFOLDERNUMBER%5D=${encodeURIComponent(folder)}`
const accelaSearchUrl = (folder: string) =>
  `https://www.google.com/search?q=site%3Aaca-prod.accela.com+%22${encodeURIComponent(folder)}%22`

const fetchFeedByFolder = async (resourceId: string, folder: string): Promise<SJRecord | null> => {
  // CKAN datastore_search supports filters JSON. FOLDERNUMBER is the unique key.
  const url = new URL(SJ_API)
  url.searchParams.set('resource_id', resourceId)
  url.searchParams.set('filters', JSON.stringify({ FOLDERNUMBER: folder }))
  url.searchParams.set('limit', '1')
  const res = await fetch(url.toString())
  if (!res.ok) return null
  const json = await res.json()
  return json?.result?.records?.[0] ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { contractor_id, permit_numbers, limit = 3 } = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Resolve which folder numbers to look up
    let folders: string[] = []
    if (Array.isArray(permit_numbers) && permit_numbers.length > 0) {
      folders = permit_numbers.slice(0, limit)
    } else if (contractor_id) {
      const { data } = await supabase
        .from('contractor_permits')
        .select('permit_number,issued_date')
        .eq('contractor_id', contractor_id)
        .not('address', 'is', null)
        .order('issued_date', { ascending: false })
        .limit(limit)
      folders = (data ?? []).map(r => r.permit_number).filter(Boolean)
    }

    if (folders.length === 0) {
      return new Response(JSON.stringify({ ok: true, results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // For each folder, race across the 3 feeds — first hit wins. Under
    // Inspection has the freshest PERMITAPPROVALS so we check it first.
    const results = await Promise.all(folders.map(async (folder) => {
      let record: SJRecord | null = null
      let source = 'none'
      for (const feed of FEEDS) {
        const hit = await fetchFeedByFolder(feed.id, folder)
        if (hit) { record = hit; source = feed.source; break }
      }
      // Resolve the matched feed (defaults to active for the "not found" url)
      const matchedFeed = FEEDS.find(f => f.source === source) ?? FEEDS[1];
      if (!record) {
        return {
          folder_number: folder,
          found: false,
          open_data_url: openDataUrl(matchedFeed.slug, folder),
          accela_search_url: accelaSearchUrl(folder),
        };
      }
      const approvals = parseApprovals(record.PERMITAPPROVALS)
      const issued = parseDate(record.ISSUEDATE)
      const final = parseDate(record.FINALDATE)
      const months = monthsSince(issued)
      // Derive a homeowner-readable lifecycle status
      let lifecycle: 'closed' | 'in_inspection' | 'stalled' | 'expired_open' | 'unknown' = 'unknown'
      if (final) lifecycle = 'closed'
      else if (source === 'expired') lifecycle = 'expired_open'
      else if (months != null && months > 18) lifecycle = 'stalled'
      else lifecycle = 'in_inspection'

      return {
        folder_number: folder,
        found: true,
        source,
        open_data_url: openDataUrl(matchedFeed.slug, folder),
        accela_search_url: accelaSearchUrl(folder),
        address: record.gx_location ?? null,
        work_type: record.FOLDERDESC ?? null,
        work_name: record.FOLDERNAME ?? null,
        description: record.WORKDESCRIPTION ?? null,
        subtype: record.SUBTYPEDESCRIPTION ?? null,
        valuation: record.PERMITVALUATION ? Number(record.PERMITVALUATION) : null,
        sqft: record.SQUAREFOOTAGE ? Number(record.SQUAREFOOTAGE) : null,
        issued_date: issued,
        final_date: final,
        months_since_issued: months,
        sj_status: record.Status ?? null,
        lifecycle,
        owner_builder: isOwnerBuilder(record.APPLICANT, record.OWNERNAME),
        applicant: record.APPLICANT?.trim() ?? null,
        owner: record.OWNERNAME?.trim() ?? null,
        approvals,
      }
    }))

    return new Response(JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 })
  }
})
