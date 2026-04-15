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

const BASE_URL = 'https://realtor.p.rapidapi.com'
const HOST = 'realtor.p.rapidapi.com'

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
    return {
      ok: false,
      status: res.status,
      json: null,
      error: thrown.error instanceof Error
        ? thrown.error.message
        : `Realty in US request failed with ${res.status}`,
    }
  }

  try {
    return { ok: true, status: res.status, json: await res.json() }
  } catch {
    return { ok: false, status: res.status, json: null, error: 'Realty in US returned non-JSON response' }
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

    // Strip Google Places artifacts that confuse Realtor.com autocomplete:
    // ", USA" suffix and any trailing country token
    const cleanedAddress = address
      .replace(/,?\s*USA\s*$/i, '')
      .replace(/,?\s*United States\s*$/i, '')
      .trim()

    // Step 1: Auto-complete to resolve address → property_id
    const acRes = await get('/locations/auto-complete', { input: cleanedAddress }, key)
    if (!acRes.ok) {
      return acRes.status === 404 ? missing('Address not found') : err(acRes.error ?? 'Auto-complete failed')
    }

    const acData = asRecord(acRes.json)
    const suggestions = asArray(acData?.autocomplete)

    // Prefer suggestions with a property ID (type "address") over city/zip suggestions
    const suggestion =
      suggestions.map(s => asRecord(s)).find(s => s?._type === 'address' && (s?.mpr_id || s?.property_id))
      ?? suggestions.map(s => asRecord(s)).find(s => s?.mpr_id || s?.property_id)
      ?? asRecord(suggestions[0])

    if (!suggestion) return missing(`No property suggestion returned for "${cleanedAddress}" (${suggestions.length} results, none matched)`)

    const propertyId = toStr(suggestion.mpr_id) ?? toStr(suggestion.property_id)

    // Capture whatever location data the autocomplete has (used as fallback)
    const acLat = toNum(suggestion.lat)
    const acLng = toNum(suggestion.lng)
    const acCity = toStr(suggestion.city) ?? 'Unknown'
    const acState = toStr(suggestion.state_code) ?? toStr(suggestion.state) ?? 'Unknown'
    const acCounty = toStr(suggestion.county) ?? ''
    const acZip = toStr(suggestion.postal_code) ?? ''

    if (!propertyId) return missing(`Auto-complete returned ${suggestions.length} suggestions for "${cleanedAddress}" but none had a property_id (types: ${suggestions.map(s => asRecord(s)?._type).join(', ')})`)

    // Step 2: Full property detail
    const detailRes = await get('/properties/v2/detail', { property_id: propertyId }, key)
    if (!detailRes.ok) {
      return detailRes.status === 404 ? missing('Property detail not found') : err(detailRes.error ?? 'Detail lookup failed')
    }

    // Response shape: { properties: [...] } or { properties: {...} }
    const detailData = asRecord(detailRes.json)
    const propsRaw = detailData?.properties
    const prop = asRecord(Array.isArray(propsRaw) ? propsRaw[0] : propsRaw) ?? asRecord(detailData)

    if (!prop) return missing('Property detail response was empty')

    const addr = asRecord(prop.address)
    const buildingSize = asRecord(prop.building_size)

    const sqft = toNum(buildingSize?.size) ?? toNum(prop.sqft) ?? toNum(prop.building_size)
    const beds = toNum(prop.beds)
    const baths = toNum(prop.baths_full) ?? toNum(prop.baths)
    const yearBuilt = toNum(prop.year_built)
    const propType = toStr(prop.prop_type) ?? 'single_family'

    const lat = toNum(addr?.lat) ?? acLat
    const lng = toNum(addr?.lon) ?? toNum(addr?.lng) ?? acLng
    const city = toStr(addr?.city) ?? acCity
    const state = toStr(addr?.state_code) ?? acState
    const county = toStr(addr?.county) ?? acCounty
    const zip = toStr(addr?.postal_code) ?? acZip
    const line1 = toStr(addr?.line)

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
