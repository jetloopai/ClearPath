import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://realty-in-us.p.rapidapi.com'
const HOST = 'realty-in-us.p.rapidapi.com'

async function get(path: string, params: Record<string, string>, key: string) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`
  const res = await fetch(url, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST },
    next: { revalidate: 0 },
  })
  const ct = res.headers.get('content-type') ?? ''
  let body: unknown = null
  try { body = ct.includes('json') ? await res.json() : await res.text() } catch { body = '<empty>' }
  return { path, status: res.status, body }
}

export async function GET(req: NextRequest) {
  const key = process.env.REALTYUS_API_KEY?.trim() || process.env.RAPIDAPI_ZILLOW_KEY?.trim()
  if (!key) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const address = req.nextUrl.searchParams.get('address') ?? '21244 Illinois St, Matteson, IL 60443'

  // Step 1: autocomplete
  const ac = await get('/locations/v2/auto-complete', { input: address }, key)

  // Step 2: pick first suggestion with mpr_id
  const suggestions: unknown[] = (ac.body as Record<string, unknown>)?.autocomplete as unknown[] ?? []
  const suggestion = suggestions
    .map(s => s as Record<string, unknown>)
    .find(s => s?.mpr_id || s?.property_id)

  if (!suggestion) {
    return NextResponse.json({ ac_status: ac.status, suggestions_count: suggestions.length, suggestion_types: suggestions.map((s: unknown) => (s as Record<string,unknown>)?.area_type), no_mpr_id: true })
  }

  const propertyId = String(suggestion.mpr_id ?? suggestion.property_id)

  // Step 3: try v2 detail
  const v2 = await get('/properties/v2/detail', { property_id: propertyId }, key)
  // Step 4: try v3 detail
  const v3 = await get('/properties/v3/detail', { property_id: propertyId }, key)

  return NextResponse.json({ address, propertyId, suggestion, v2, v3 })
}
