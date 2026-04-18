import { getRapidApiZillowKey } from '@/lib/providers/config'
import type {
  CanonicalPropertyRecord,
  CanonicalRentalListing,
  CanonicalRentEstimate,
  CanonicalSaleComp,
  CanonicalValueEstimate,
  PropertyProvider,
  ProviderResult,
} from '@/lib/propertyData'

const BASE_URL = 'https://realty-in-us.p.rapidapi.com'
const HOST = 'realty-in-us.p.rapidapi.com'

type JsonRecord = Record<string, unknown>

function asRecord(v: unknown): JsonRecord | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonRecord) : null
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n) && n !== 0) return n
  }
  return null
}

function toStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

async function get(
  path: string,
  params: Record<string, string>,
  key: string,
): Promise<{ ok: boolean; status: number; json: unknown | null; error?: string }> {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params).toString()}`
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': key,
      'x-rapidapi-host': HOST,
    },
    next: { revalidate: 0 },
  }).catch(e => ({ ok: false, status: 0, json: async () => null, error: e } as unknown as Response & { error: unknown }))

  if (!res.ok) {
    const thrown = res as Response & { error?: unknown }
    if (thrown.error instanceof Error) {
      return { ok: false, status: res.status, json: null, error: thrown.error.message }
    }
    let body = ''
    try { body = await (res as Response).text() } catch { /* ignore */ }
    return {
      ok: false,
      status: res.status,
      json: null,
      error: `Realty in US ${res.status}${body ? `: ${body.slice(0, 300)}` : ''}`,
    }
  }

  try {
    return { ok: true, status: res.status, json: await res.json() }
  } catch {
    let body = ''
    try { body = await (res as Response).text() } catch { /* ignore */ }
    return { ok: false, status: res.status, json: null, error: `Realty in US non-JSON (${res.status}): ${body.slice(0, 400)}` }
  }
}

function missing(error: string): ProviderResult<CanonicalPropertyRecord> {
  return { provider: 'realtyinus', status: 'missing', error }
}

function err(error: string): ProviderResult<CanonicalPropertyRecord> {
  return { provider: 'realtyinus', status: 'error', error }
}

export class RealtyInUSProvider implements PropertyProvider {
  readonly name = 'realtyinus' as const

  async lookupSubject(address: string): Promise<ProviderResult<CanonicalPropertyRecord>> {
    const key = getRapidApiZillowKey()
    if (!key) return err('RAPIDAPI_ZILLOW_KEY not configured')

    // Step 1: Auto-complete to resolve address → property_id
    // Helper: pick best address-type suggestion with an mpr_id
    const pickSuggestion = (list: unknown[]) =>
      list.map(s => asRecord(s)).find(s => s?.area_type === 'address' && (s?.mpr_id || s?.property_id))
      ?? list.map(s => asRecord(s)).find(s => s?.mpr_id || s?.property_id)

    let acRes = await get('/locations/v2/auto-complete', { input: address }, key)
    if (!acRes.ok) {
      return acRes.status === 404 ? missing('Address not found') : err(acRes.error ?? 'Auto-complete failed')
    }

    let suggestions = asArray(asRecord(acRes.json)?.autocomplete)
    let suggestion = pickSuggestion(suggestions)

    // Retry without zip code — often produces a property-level match when the full address doesn't
    if (!suggestion) {
      const withoutZip = address.replace(/,?\s*\d{5}(-\d{4})?\s*$/, '').trim()
      if (withoutZip !== address) {
        const acRes2 = await get('/locations/v2/auto-complete', { input: withoutZip }, key)
        if (acRes2.ok) {
          const suggestions2 = asArray(asRecord(acRes2.json)?.autocomplete)
          suggestion = pickSuggestion(suggestions2)
          if (suggestion) suggestions = suggestions2
        }
      }
    }

    if (!suggestion) return missing(`Auto-complete returned no property-level result for "${address}" (types: ${suggestions.map(s => asRecord(s)?.area_type).join(', ')})`)

    const propertyId = toStr(suggestion.mpr_id) ?? toStr(suggestion.property_id)

    // Capture whatever location data the autocomplete has (used as fallback)
    const centroid = asRecord(suggestion.centroid)
    const acLat = toNum(centroid?.lat) ?? toNum(suggestion.lat)
    const acLng = toNum(centroid?.lon) ?? toNum(centroid?.lng) ?? toNum(suggestion.lng)
    const acCity = toStr(suggestion.city) ?? 'Unknown'
    const acState = toStr(suggestion.state_code) ?? toStr(suggestion.state) ?? 'Unknown'
    const acCounty = toStr(suggestion.county) ?? ''
    const acZip = toStr(suggestion.postal_code) ?? ''

    if (!propertyId) return missing(`Auto-complete returned ${suggestions.length} suggestions for "${address}" but none had a property_id (types: ${suggestions.map(s => asRecord(s)?.area_type).join(', ')})`)

    // Step 2: Full property detail — try v2 first, fall back to v3 if v2 returns empty (204)
    let detailRes = await get('/properties/v2/detail', { property_id: propertyId }, key)
    if (!detailRes.ok && detailRes.status === 204) {
      detailRes = await get('/properties/v3/detail', { property_id: propertyId }, key)
    }
    if (!detailRes.ok) {
      return detailRes.status === 404 ? missing('Property detail not found') : err(detailRes.error ?? 'Detail lookup failed')
    }

    // v3 response: { data: { home: { description, location, property_history, ... } } }
    // v2 response: { properties: [...] } or { properties: {...} }
    const detailData = asRecord(detailRes.json)
    const isV3 = Boolean(asRecord(asRecord(detailData?.data)?.home))

    let sqft: number | null
    let beds: number | null
    let baths: number | null
    let yearBuilt: number | null
    let propType: string
    let lat: number | null
    let lng: number | null
    let city: string
    let state: string
    let county: string
    let zip: string
    let line1: string | null

    if (isV3) {
      const home = asRecord(asRecord(detailData?.data)?.home)
      if (!home) return missing('Property detail response was empty')

      const desc = asRecord(home.description)
      const loc = asRecord(home.location)
      const addr = asRecord(loc?.address)
      const coord = asRecord(addr?.coordinate)

      beds = toNum(desc?.beds)
      baths = toNum(desc?.baths)
      yearBuilt = toNum(desc?.year_built)
      propType = toStr(desc?.type) ?? toStr(desc?.sub_type) ?? 'single_family'

      // sqft from current description; fall back to most recent non-null value in property_history
      sqft = toNum(desc?.sqft)
      if (!sqft) {
        for (const entry of asArray(home.property_history)) {
          const histSqft = toNum(asRecord(asRecord(asRecord(entry)?.listing)?.description)?.sqft)
          if (histSqft) { sqft = histSqft; break }
        }
      }

      lat = toNum(coord?.lat) ?? acLat
      lng = toNum(coord?.lon) ?? acLng
      city = toStr(addr?.city) ?? acCity
      state = toStr(addr?.state_code) ?? acState
      county = acCounty // v3 only exposes fips_code, not county name
      zip = toStr(addr?.postal_code) ?? acZip
      line1 = toStr(addr?.line)
    } else {
      const propsRaw = detailData?.properties
      const prop = asRecord(Array.isArray(propsRaw) ? propsRaw[0] : propsRaw) ?? asRecord(detailData)
      if (!prop) return missing('Property detail response was empty')

      const addr = asRecord(prop.address)
      const buildingSize = asRecord(prop.building_size)

      sqft = toNum(buildingSize?.size) ?? toNum(prop.sqft)
      beds = toNum(prop.beds)
      baths = toNum(prop.baths_full) ?? toNum(prop.baths)
      yearBuilt = toNum(prop.year_built)
      propType = toStr(prop.prop_type) ?? 'single_family'

      lat = toNum(addr?.lat) ?? acLat
      lng = toNum(addr?.lon) ?? toNum(addr?.lng) ?? acLng
      city = toStr(addr?.city) ?? acCity
      state = toStr(addr?.state_code) ?? acState
      county = toStr(addr?.county) ?? acCounty
      zip = toStr(addr?.postal_code) ?? acZip
      line1 = toStr(addr?.line)
    }

    const trimmed = { propertyId, beds, baths, sqft, yearBuilt, propType, city, state, county, zip, lat, lng }

    return {
      provider: 'realtyinus',
      status: 'success',
      data: {
        address,           // preserve original input address for cache key consistency
        addressLine1: line1,
        city,
        county,
        state,
        zip,
        lat,
        lng,
        sqft,
        bedrooms: beds,
        bathrooms: baths,
        yearBuilt,
        propertyType: propType,
        providerPropertyId: propertyId,
      },
      raw: detailRes.json,
      trimmedRaw: trimmed,
    }
  }

  // RealtyInUS is used for subject facts only — other domains handled by RentCast
  async getValueEstimate(_subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalValueEstimate>> {
    return { provider: 'realtyinus', status: 'missing', error: 'Value estimate not provided by Realty in US' }
  }

  async getRentEstimate(_subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalRentEstimate>> {
    return { provider: 'realtyinus', status: 'missing', error: 'Rent estimate not provided by Realty in US' }
  }

  async getSaleComparables(_subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalSaleComp[]>> {
    return { provider: 'realtyinus', status: 'missing', error: 'Sale comps not provided by Realty in US' }
  }

  async getRentalListings(_subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalRentalListing[]>> {
    return { provider: 'realtyinus', status: 'missing', error: 'Rental listings not provided by Realty in US' }
  }
}
