import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://realty-in-us.p.rapidapi.com'
const HOST = 'realty-in-us.p.rapidapi.com'

async function probe(path: string, params: Record<string, string>, key: string) {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`
  try {
    const res = await fetch(url, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST },
      next: { revalidate: 0 },
    })
    let body: unknown = null
    const ct = res.headers.get('content-type') ?? ''
    try {
      body = ct.includes('json') ? await res.json() : await res.text()
    } catch {
      body = '<unreadable>'
    }
    return { path, status: res.status, ok: res.ok, body }
  } catch (e) {
    return { path, status: 0, ok: false, body: String(e) }
  }
}

export async function GET(req: NextRequest) {
  const key = process.env.REALTYUS_API_KEY?.trim() || process.env.RAPIDAPI_ZILLOW_KEY?.trim()
  if (!key) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const address = req.nextUrl.searchParams.get('address') ?? '123 Main St, Austin, TX'

  const results = await Promise.all([
    probe('/locations/auto-complete', { input: address }, key),
    probe('/locations/v2/auto-complete', { input: address }, key),
    probe('/locations/suggest', { input: address }, key),
    probe('/locations/search', { input: address }, key),
    probe('/location/suggest', { input: address }, key),
    probe('/properties/v2/list-for-sale', { city: 'Austin', state_code: 'TX', limit: '1', offset: '0' }, key),
    probe('/properties/v2/detail', { property_id: '1234567890' }, key),
    probe('/properties/detail', { property_id: '1234567890' }, key),
    probe('/properties/v3/detail', { property_id: '1234567890' }, key),
  ])

  return NextResponse.json({ key_prefix: key.slice(0, 8) + '...', address, results })
}
