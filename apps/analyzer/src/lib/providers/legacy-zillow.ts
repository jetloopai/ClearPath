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

type JsonRecord = Record<string, unknown>

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function toDateMs(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function failure<T>(status: 'missing' | 'error', error: string): ProviderResult<T> {
  return { provider: 'legacy', status, error }
}

function success<T>(data: T | null, raw: unknown, trimmedRaw: unknown): ProviderResult<T> {
  if (!data) return { provider: 'legacy', status: 'missing', raw, trimmedRaw }
  return { provider: 'legacy', status: 'success', data, raw, trimmedRaw }
}

async function requestJson(url: string, headers: HeadersInit): Promise<{ ok: boolean; status: number; json: unknown | null; error?: string }> {
  const response = await fetch(url, { headers, next: { revalidate: 0 } }).catch(error => ({
    ok: false,
    status: 0,
    json: async () => null,
    error,
  } as unknown as Response & { error: unknown }))

  if (!response.ok) {
    const thrown = response as Response & { error?: unknown }
    return {
      ok: false,
      status: response.status,
      json: null,
      error: thrown.error instanceof Error ? thrown.error.message : `Legacy Zillow request failed with ${response.status}`,
    }
  }

  return {
    ok: true,
    status: response.status,
    json: await response.json(),
  }
}

export class LegacyZillowProvider implements PropertyProvider {
  readonly name = 'legacy' as const

  async lookupSubject(address: string): Promise<ProviderResult<CanonicalPropertyRecord>> {
    const apiKey = getRapidApiZillowKey()
    if (!apiKey) return failure('error', 'RAPIDAPI_ZILLOW_KEY is not configured')

    const headers = {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'zillow-scraper-api.p.rapidapi.com',
      'Content-Type': 'application/json',
    }

    const acUrl = `https://zillow-scraper-api.p.rapidapi.com/zillow/search/autocomplete?query=${encodeURIComponent(address)}`
    const acRes = await requestJson(acUrl, headers)
    if (!acRes.ok) return failure(acRes.status === 404 ? 'missing' : 'error', acRes.error ?? 'Legacy subject autocomplete failed')

    const acPayload = asRecord(acRes.json)
    const acData = asRecord(acPayload?.data)
    const suggestionRecord = asRecord(asArray(acData?.suggestions)[0])
    if (!suggestionRecord) return failure('missing', 'Legacy subject autocomplete returned no suggestion')

    const lat = toNumber(suggestionRecord.latitude)
    const lng = toNumber(suggestionRecord.longitude)
    const zpid = toStringValue(suggestionRecord.zpid)
    const city = toStringValue(suggestionRecord.city) ?? 'Unknown'
    const state = toStringValue(suggestionRecord.state) ?? 'IL'
    const county = toStringValue(suggestionRecord.county) ?? 'Unknown'

    let sqft: number | null = null
    let bedrooms: number | null = null
    let bathrooms: number | null = null
    let yearBuilt: number | null = null
    let propertyType = 'single_family'
    let zip = ''
    let zestimate: number | null = null

    if (zpid) {
      const detailUrl = `https://zillow-scraper-api.p.rapidapi.com/zillow/property/details?zpid=${encodeURIComponent(zpid)}`
      const detailRes = await requestJson(detailUrl, headers)
      if (detailRes.ok) {
        const detail = asRecord(detailRes.json)
        const data = asRecord(detail?.data) ?? detail
        sqft = toNumber(data?.living_area_sqft)
        bedrooms = toNumber(data?.bedrooms)
        bathrooms = toNumber(data?.bathrooms)
        yearBuilt = toNumber(data?.year_built)
        propertyType = toStringValue(data?.home_type) ?? propertyType
        zip = toStringValue(data?.zip_code) ?? zip
        zestimate = toNumber(data?.zestimate)
      }
    }

    return success({
      address,
      addressLine1: toStringValue(suggestionRecord.streetAddress) ?? null,
      city,
      county,
      state,
      zip,
      lat,
      lng,
      sqft,
      bedrooms,
      bathrooms,
      yearBuilt,
      propertyType,
      providerPropertyId: zpid,
    }, acRes.json, {
      city,
      county,
      state,
      zip,
      lat,
      lng,
      sqft,
      bedrooms,
      bathrooms,
      yearBuilt,
      propertyType,
      zestimate,
      providerPropertyId: zpid,
    })
  }

  async getValueEstimate(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalValueEstimate>> {
    const apiKey = getRapidApiZillowKey()
    if (!apiKey || !subject.providerPropertyId) return failure('missing', 'Legacy value estimate unavailable without property id')

    const headers = {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'zillow-scraper-api.p.rapidapi.com',
      'Content-Type': 'application/json',
    }

    const detailUrl = `https://zillow-scraper-api.p.rapidapi.com/zillow/property/details?zpid=${encodeURIComponent(subject.providerPropertyId)}`
    const detailRes = await requestJson(detailUrl, headers)
    if (!detailRes.ok) return failure(detailRes.status === 404 ? 'missing' : 'error', detailRes.error ?? 'Legacy value estimate lookup failed')

    const detail = asRecord(detailRes.json)
    const data = asRecord(detail?.data) ?? detail
    const estimate = toNumber(data?.zestimate)
    return success(estimate ? { estimate: Math.round(estimate), low: null, high: null, confidence: null, confidenceScore: null } : null, detailRes.json, { zestimate: estimate })
  }

  async getRentEstimate(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalRentEstimate>> {
    return failure('missing', 'Legacy provider does not expose direct rent estimate')
  }

  async getSaleComparables(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalSaleComp[]>> {
    const apiKey = getRapidApiZillowKey()
    if (!apiKey || subject.lat == null || subject.lng == null) return failure('missing', 'Legacy sale comparables unavailable without coordinates')

    const headers = {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'zillow-scraper-api.p.rapidapi.com',
      'Content-Type': 'application/json',
    }

    const url = `https://zillow-scraper-api.p.rapidapi.com/zillow/search/by-coordinates?lat=${subject.lat}&lng=${subject.lng}&radius=1&page=1&home_type=house&listing_type=recently_sold`
    const response = await requestJson(url, headers)
    if (!response.ok) return failure(response.status === 404 ? 'missing' : 'error', response.error ?? 'Legacy sale comparables lookup failed')

    const listings = asArray(asRecord(response.json)?.data && asRecord(asRecord(response.json)?.data)?.listings)
    const comps = listings.map(item => {
      const listing = asRecord(item)
      if (!listing) return null
      const livingAreaSqft = toNumber(listing.living_area_sqft)
      const price = toNumber(listing.price)
      if (!livingAreaSqft || !price) return null
      const address = toStringValue(listing.street_address)
        ? `${toStringValue(listing.street_address)}${toStringValue(listing.city) ? `, ${toStringValue(listing.city)}` : ''}${toStringValue(listing.state_code) ? ` ${toStringValue(listing.state_code)}` : ''}`
        : toStringValue(listing.address)
      if (!address) return null
      return {
        address,
        price: Math.round(price),
        livingAreaSqft: Math.round(livingAreaSqft),
        bedrooms: toNumber(listing.bedrooms),
        bathrooms: null,
        latitude: toNumber(listing.latitude),
        longitude: toNumber(listing.longitude),
        dateSold: toDateMs(listing.dateSold) ?? toDateMs(listing.timeOnZillow),
        url: null,
      }
    }).filter(Boolean) as CanonicalSaleComp[]

    return success(comps, response.json, comps.slice(0, 8))
  }

  async getRentalListings(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalRentalListing[]>> {
    const apiKey = getRapidApiZillowKey()
    if (!apiKey || subject.lat == null || subject.lng == null) return failure('missing', 'Legacy rental listings unavailable without coordinates')

    const headers = {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': 'zillow-scraper-api.p.rapidapi.com',
      'Content-Type': 'application/json',
    }

    const url = `https://zillow-scraper-api.p.rapidapi.com/zillow/search/by-coordinates?lat=${subject.lat}&lng=${subject.lng}&radius=1&page=1&home_type=house&listing_type=for_rent`
    const response = await requestJson(url, headers)
    if (!response.ok) return failure(response.status === 404 ? 'missing' : 'error', response.error ?? 'Legacy rental listings lookup failed')

    const listings = asArray(asRecord(response.json)?.data && asRecord(asRecord(response.json)?.data)?.listings)
    const rentals = listings.map(item => {
      const listing = asRecord(item)
      if (!listing) return null
      const price = toNumber(listing.price)
      if (!price || price <= 0 || price >= 10000) return null
      const detailUrl = toStringValue(listing.detailUrl)
      const zpid = toStringValue(listing.zpid)
      return {
        address: toStringValue(listing.address),
        price: Math.round(price),
        bedrooms: toNumber(listing.bedrooms),
        bathrooms: null,
        livingAreaSqft: toNumber(listing.living_area_sqft),
        latitude: toNumber(listing.latitude),
        longitude: toNumber(listing.longitude),
        listedDate: null,
        url: detailUrl ? (detailUrl.startsWith('http') ? detailUrl : `https://www.zillow.com${detailUrl}`) : zpid ? `https://www.zillow.com/homedetails/${zpid}_zpid/` : null,
      }
    }).filter(Boolean) as CanonicalRentalListing[]

    return success(rentals, response.json, rentals.slice(0, 8))
  }
}
