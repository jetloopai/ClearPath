import { getRentCastApiKey } from '@/lib/providers/config'
import type {
  CanonicalPropertyRecord,
  CanonicalRentalListing,
  CanonicalRentEstimate,
  CanonicalSaleComp,
  CanonicalValueEstimate,
  PropertyProvider,
  ProviderResult,
} from '@/lib/propertyData'

const BASE_URL = 'https://api.rentcast.io/v1'

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pickString(record: JsonObject | null, ...keys: string[]): string | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function pickNumber(record: JsonObject | null, ...keys: string[]): number | null {
  if (!record) return null
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function parseDateMs(record: JsonObject | null, ...keys: string[]): number | null {
  const raw = pickString(record, ...keys)
  if (!raw) return null
  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function cleanAddress(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(', ').replace(/\s+/g, ' ').trim()
}

function buildAddressSearchUrl(address: string | null): string | null {
  if (!address) return null
  return `https://www.google.com/search?q=${encodeURIComponent(`"${address}" rental listing`)}`
}

function trimObject(record: JsonObject | null): JsonObject | null {
  if (!record) return null
  return {
    id: pickString(record, 'id', 'propertyId'),
    formattedAddress: pickString(record, 'formattedAddress', 'address'),
    addressLine1: pickString(record, 'addressLine1', 'streetAddress'),
    city: pickString(record, 'city'),
    state: pickString(record, 'state'),
    zipCode: pickString(record, 'zipCode', 'zip'),
    county: pickString(record, 'county'),
    latitude: pickNumber(record, 'latitude', 'lat'),
    longitude: pickNumber(record, 'longitude', 'lng'),
    bedrooms: pickNumber(record, 'bedrooms'),
    bathrooms: pickNumber(record, 'bathrooms'),
    squareFootage: pickNumber(record, 'squareFootage', 'livingArea', 'livingAreaSquareFeet'),
    yearBuilt: pickNumber(record, 'yearBuilt'),
    propertyType: pickString(record, 'propertyType'),
    price: pickNumber(record, 'price', 'estimate', 'value', 'rent'),
    priceRangeLow: pickNumber(record, 'priceRangeLow'),
    priceRangeHigh: pickNumber(record, 'priceRangeHigh'),
    rentRangeLow: pickNumber(record, 'rentRangeLow'),
    rentRangeHigh: pickNumber(record, 'rentRangeHigh'),
  }
}

async function requestJson(path: string, params: URLSearchParams): Promise<{ ok: boolean; status: number; json: unknown | null; error?: string }> {
  const apiKey = getRentCastApiKey()
  if (!apiKey) {
    return { ok: false, status: 0, json: null, error: 'RENTCAST_API_KEY is not configured' }
  }

  const response = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'X-Api-Key': apiKey,
    },
    next: { revalidate: 43200 },
  }).catch(error => ({
    ok: false,
    status: 0,
    json: async () => null,
    error,
  } as unknown as Response & { error: unknown }))

  if (!response.ok) {
    const thrown = response as Response & { error?: unknown }
    let providerMessage: string | null = null
    try {
      const text = await response.text()
      if (text) {
        const parsed = JSON.parse(text) as JsonObject
        providerMessage = pickString(parsed, 'message', 'error')
      }
    } catch {
      providerMessage = null
    }
    return {
      ok: false,
      status: response.status,
      json: null,
      error: thrown.error instanceof Error ? thrown.error.message : providerMessage ?? `RentCast request failed with ${response.status}`,
    }
  }

  return {
    ok: true,
    status: response.status,
    json: await response.json(),
  }
}

function normalizeSubject(record: JsonObject | null): CanonicalPropertyRecord | null {
  if (!record) return null

  const address = pickString(record, 'formattedAddress', 'address')
    ?? cleanAddress([
      pickString(record, 'addressLine1', 'streetAddress'),
      pickString(record, 'city'),
      [pickString(record, 'state'), pickString(record, 'zipCode', 'zip')].filter(Boolean).join(' '),
    ])

  if (!address) return null

  return {
    address,
    addressLine1: pickString(record, 'addressLine1', 'streetAddress'),
    city: pickString(record, 'city') ?? 'Unknown',
    county: pickString(record, 'county') ?? 'Unknown',
    state: pickString(record, 'state') ?? 'IL',
    zip: pickString(record, 'zipCode', 'zip') ?? '',
    lat: pickNumber(record, 'latitude', 'lat'),
    lng: pickNumber(record, 'longitude', 'lng'),
    sqft: pickNumber(record, 'squareFootage', 'livingArea', 'livingAreaSquareFeet'),
    bedrooms: pickNumber(record, 'bedrooms'),
    bathrooms: pickNumber(record, 'bathrooms'),
    yearBuilt: pickNumber(record, 'yearBuilt'),
    propertyType: pickString(record, 'propertyType') ?? 'single_family',
    providerPropertyId: pickString(record, 'id', 'propertyId'),
  }
}

function normalizeValueEstimate(record: JsonObject | null): CanonicalValueEstimate | null {
  if (!record) return null
  const estimate = pickNumber(record, 'price', 'estimate', 'value')
  if (!estimate) return null
  const confidenceScore = pickNumber(record, 'confidenceScore', 'confidence')

  return {
    estimate: Math.round(estimate),
    low: pickNumber(record, 'priceRangeLow', 'priceLow', 'low'),
    high: pickNumber(record, 'priceRangeHigh', 'priceHigh', 'high'),
    confidence: confidenceScore != null ? (confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.55 ? 'medium' : 'low') : null,
    confidenceScore,
  }
}

function normalizeRentEstimate(record: JsonObject | null): CanonicalRentEstimate | null {
  if (!record) return null
  const estimate = pickNumber(record, 'rent', 'estimate', 'price')
  if (!estimate) return null
  const confidenceScore = pickNumber(record, 'confidenceScore', 'confidence')

  return {
    estimate: Math.round(estimate),
    low: pickNumber(record, 'rentRangeLow', 'rentLow', 'low'),
    high: pickNumber(record, 'rentRangeHigh', 'rentHigh', 'high'),
    confidence: confidenceScore != null ? (confidenceScore >= 0.8 ? 'high' : confidenceScore >= 0.55 ? 'medium' : 'low') : null,
    confidenceScore,
  }
}

function normalizeSaleComp(record: JsonObject | null): CanonicalSaleComp | null {
  if (!record) return null
  const address = pickString(record, 'formattedAddress', 'address')
    ?? cleanAddress([
      pickString(record, 'addressLine1', 'streetAddress'),
      pickString(record, 'city'),
      [pickString(record, 'state'), pickString(record, 'zipCode', 'zip')].filter(Boolean).join(' '),
    ])
  // Reject active/pending listings — only want closed sales
  const status = pickString(record, 'status', 'listingStatus')
  const ACTIVE_STATUSES = ['active', 'for sale', 'pending', 'contingent', 'coming soon']
  if (status && ACTIVE_STATUSES.includes(status.toLowerCase())) return null

  // Prioritize actual sale price over listing/asking price
  const price = pickNumber(record, 'lastSalePrice', 'salePrice', 'price')
  const livingAreaSqft = pickNumber(record, 'squareFootage', 'livingArea', 'livingAreaSquareFeet')
  if (!address || !price || !livingAreaSqft) return null

  // Use sold date; fall back to listedDate/lastSeenDate only when no explicit sold date exists
  // (RentCast's AVM comps use listedDate for their sold date field in many cases)
  const dateSold = parseDateMs(record, 'lastSaleDate', 'soldDate', 'saleDate', 'listedDate', 'lastSeenDate')

  return {
    address,
    price: Math.round(price),
    livingAreaSqft: Math.round(livingAreaSqft),
    bedrooms: pickNumber(record, 'bedrooms'),
    bathrooms: pickNumber(record, 'bathrooms'),
    latitude: pickNumber(record, 'latitude', 'lat'),
    longitude: pickNumber(record, 'longitude', 'lng'),
    dateSold,
    url: pickString(record, 'url', 'listingUrl'),
  }
}

function normalizeRentalListing(record: JsonObject | null): CanonicalRentalListing | null {
  if (!record) return null
  const price = pickNumber(record, 'price', 'rent')
  if (!price || price <= 0) return null
  const fallbackAddress = cleanAddress([
    pickString(record, 'addressLine1', 'streetAddress'),
    pickString(record, 'city'),
    [pickString(record, 'state'), pickString(record, 'zipCode', 'zip')].filter(Boolean).join(' '),
  ])
  const address = (pickString(record, 'formattedAddress', 'address') ?? fallbackAddress) || null

  return {
    address,
    price: Math.round(price),
    bedrooms: pickNumber(record, 'bedrooms'),
    bathrooms: pickNumber(record, 'bathrooms'),
    livingAreaSqft: pickNumber(record, 'squareFootage', 'livingArea', 'livingAreaSquareFeet'),
    latitude: pickNumber(record, 'latitude', 'lat'),
    longitude: pickNumber(record, 'longitude', 'lng'),
    listedDate: parseDateMs(record, 'listedDate', 'datePosted'),
    url: pickString(record, 'url', 'listingUrl') ?? buildAddressSearchUrl(address),
  }
}

function success<T>(data: T | null, raw: unknown, trimmedRaw: unknown): ProviderResult<T> {
  if (!data) {
    return { provider: 'rentcast', status: 'missing', raw, trimmedRaw }
  }
  return { provider: 'rentcast', status: 'success', data, raw, trimmedRaw }
}

function failure<T>(status: 'missing' | 'error', error: string): ProviderResult<T> {
  return { provider: 'rentcast', status, error }
}

export class RentCastProvider implements PropertyProvider {
  readonly name = 'rentcast' as const
  private readonly _cache = new Map<string, Awaited<ReturnType<typeof requestJson>>>()

  private async cachedRequestJson(path: string, params: URLSearchParams): Promise<Awaited<ReturnType<typeof requestJson>>> {
    const key = `${path}?${params.toString()}`
    if (this._cache.has(key)) return this._cache.get(key)!
    const result = await requestJson(path, params)
    this._cache.set(key, result)
    return result
  }

  /** Populate the in-request cache from a previously stored DB response, preventing a live API call. */
  injectCache(path: string, address: string, raw: unknown): void {
    const key = `${path}?${new URLSearchParams({ address }).toString()}`
    this._cache.set(key, { ok: true, status: 200, json: raw })
  }

  /** Reconstruct a subject result from a cached raw response without making an API call. */
  lookupSubjectFromCache(raw: unknown): ProviderResult<CanonicalPropertyRecord> {
    const first = asObject(asArray(raw)[0])
    return success(normalizeSubject(first), raw, trimObject(first))
  }

  async lookupSubject(address: string): Promise<ProviderResult<CanonicalPropertyRecord>> {
    const response = await requestJson('/properties', new URLSearchParams({ address }))
    if (!response.ok) return failure(response.status === 404 ? 'missing' : 'error', response.error ?? 'RentCast subject lookup failed')

    const first = asObject(asArray(response.json)[0])
    return success(normalizeSubject(first), response.json, trimObject(first))
  }

  async getValueEstimate(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalValueEstimate>> {
    const response = await this.cachedRequestJson('/avm/value', new URLSearchParams({ address: subject.address }))
    if (!response.ok) return failure(response.status === 404 ? 'missing' : 'error', response.error ?? 'RentCast value estimate failed')
    const record = asObject(response.json)
    return success(normalizeValueEstimate(record), response.json, trimObject(record))
  }

  async getRentEstimate(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalRentEstimate>> {
    const response = await this.cachedRequestJson('/avm/rent/long-term', new URLSearchParams({ address: subject.address }))
    if (!response.ok) return failure(response.status === 404 ? 'missing' : 'error', response.error ?? 'RentCast rent estimate failed')
    const record = asObject(response.json)
    return success(normalizeRentEstimate(record), response.json, trimObject(record))
  }

  async getSaleComparables(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalSaleComp[]>> {
    const response = await this.cachedRequestJson('/avm/value', new URLSearchParams({ address: subject.address }))
    if (!response.ok) return failure(response.status === 404 ? 'missing' : 'error', response.error ?? 'RentCast value comparables failed')
    const record = asObject(response.json)
    const comps = asArray(record?.comparables).map(item => normalizeSaleComp(asObject(item))).filter(Boolean) as CanonicalSaleComp[]
    return success(comps, response.json, comps.slice(0, 8).map(comp => ({ ...comp })))
  }

  async getRentalListings(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalRentalListing[]>> {
    const response = await this.cachedRequestJson('/avm/rent/long-term', new URLSearchParams({ address: subject.address }))
    if (!response.ok) return failure(response.status === 404 ? 'missing' : 'error', response.error ?? 'RentCast rental comparables failed')
    const record = asObject(response.json)
    const rentals = asArray(record?.comparables).map(item => normalizeRentalListing(asObject(item))).filter(Boolean) as CanonicalRentalListing[]
    return success(rentals, response.json, rentals.slice(0, 8).map(rental => ({ ...rental })))
  }
}
