import { type ProviderName, providerPolicies, type ProviderSelectionPolicy, getRapidApiZillowKey } from '@/lib/providers/config'
import { RentCastProvider } from '@/lib/providers/rentcast'
import { RealtyInUSProvider } from '@/lib/providers/realtyinus'
import { getCachedRentCast, setCachedRentCast } from '@/lib/providers/rentcastCache'

export interface CompListing {
  address: string
  price: number
  living_area_sqft: number
  bedrooms: number
  latitude: number | null
  longitude: number | null
  date_sold?: number | null
  url?: string | null
}

export interface RentListing {
  price: number
  url: string
  address?: string | null
}

export interface CanonicalPropertyRecord {
  address: string
  addressLine1: string | null
  city: string
  county: string
  state: string
  zip: string
  lat: number | null
  lng: number | null
  sqft: number | null
  bedrooms: number | null
  bathrooms: number | null
  yearBuilt: number | null
  propertyType: string
  providerPropertyId: string | null
}

export interface CanonicalValueEstimate {
  estimate: number
  low: number | null
  high: number | null
  confidence: 'high' | 'medium' | 'low' | null
  confidenceScore: number | null
}

export interface CanonicalRentEstimate {
  estimate: number
  low: number | null
  high: number | null
  confidence: 'high' | 'medium' | 'low' | null
  confidenceScore: number | null
}

export interface CanonicalSaleComp {
  address: string
  price: number
  livingAreaSqft: number
  bedrooms: number | null
  bathrooms: number | null
  latitude: number | null
  longitude: number | null
  dateSold: number | null
  url: string | null
}

export interface CanonicalRentalListing {
  address: string | null
  price: number
  bedrooms: number | null
  bathrooms: number | null
  livingAreaSqft: number | null
  latitude: number | null
  longitude: number | null
  listedDate: number | null
  url: string | null
}

export interface ProviderResult<T> {
  provider: ProviderName
  status: 'success' | 'missing' | 'error'
  data?: T
  error?: string
  raw?: unknown
  trimmedRaw?: unknown
}

export interface PropertyProvider {
  readonly name: ProviderName
  lookupSubject(address: string): Promise<ProviderResult<CanonicalPropertyRecord>>
  getValueEstimate(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalValueEstimate>>
  getRentEstimate(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalRentEstimate>>
  getSaleComparables(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalSaleComp[]>>
  getRentalListings(subject: CanonicalPropertyRecord): Promise<ProviderResult<CanonicalRentalListing[]>>
}

export interface ProviderTraceDomain {
  selectedProvider: ProviderName | null
  requestedProvider: ProviderName
  attemptedProviders: ProviderName[]
  status: 'success' | 'missing' | 'error' | 'fallback'
  reason: string | null
}

export interface ProviderTrace {
  subjectFacts: ProviderTraceDomain
  value: ProviderTraceDomain
  rent: ProviderTraceDomain
  comps: ProviderTraceDomain
}

export interface CanonicalPropertyData {
  address: string
  subject: CanonicalPropertyRecord | null
  valueEstimate: CanonicalValueEstimate | null
  rentEstimate: CanonicalRentEstimate | null
  saleComparables: CanonicalSaleComp[]
  rentalListings: CanonicalRentalListing[]
  selectedProviders: {
    subjectProvider: ProviderName | null
    valueProvider: ProviderName | null
    rentProvider: ProviderName | null
    compsProvider: ProviderName | null
  }
  rawProviders: Record<string, unknown>
  providerTrace: ProviderTrace
  providerWarnings: string[]
  isStubData: boolean
}

export interface PropertyData {
  sqft: number | null
  bedrooms: number
  bathrooms: number
  yearBuilt: number
  propertyType: string
  city: string
  county: string
  state: string
  zip: string
  zestimate: number | null
  valueEstimate: number | null
  valueEstimateRange: ArvRange | null
  valueEstimateConfidence: 'high' | 'medium' | 'low' | null
  providerPropertyId: string | null
  lat: number | null
  lng: number | null
  comps: CompListing[]
  nearbyRents: number[]
  nearbyRentListings: RentListing[]
  rentEstimate: number | null
  rentEstimateRange: ArvRange | null
  rentEstimateConfidence: 'high' | 'medium' | 'low' | null
  isStubData: boolean
  subjectDetailsStatus: 'complete' | 'missing' | 'stub'
  sqftSource: 'property_api' | 'missing' | 'stub'
  subjectProvider: ProviderName | null
  valueProvider: ProviderName | null
  rentProvider: ProviderName | null
  compsProvider: ProviderName | null
  providerTrace: ProviderTrace
  providerWarnings: string[]
  rawProviders: Record<string, unknown>
}

export interface ArvRange {
  low: number
  high: number
}

export interface CompsArvDetails {
  arv: number
  filteredComps: (CompListing & { distanceMiles: number })[]
  confidence: 'high' | 'medium' | 'low'
  range: ArvRange
  explainer: string
  radiusMiles: number
  maxAgeMonths: 6 | 12
}

const STUB_BASE = {
  sqft: null,
  bedrooms: 3,
  bathrooms: 2,
  yearBuilt: 1965,
  propertyType: 'single_family',
  city: 'Unknown',
  county: 'Unknown',
  state: 'IL',
  zip: '',
  lat: 41.666,
  lng: -87.666,
}

function makeStubTrace(reason: string): ProviderTrace {
  return {
    subjectFacts: { selectedProvider: 'stub', requestedProvider: providerPolicies.subjectFacts, attemptedProviders: ['stub'], status: 'fallback', reason },
    value: { selectedProvider: 'stub', requestedProvider: providerPolicies.value, attemptedProviders: ['stub'], status: 'fallback', reason },
    rent: { selectedProvider: 'stub', requestedProvider: providerPolicies.rent, attemptedProviders: ['stub'], status: 'fallback', reason },
    comps: { selectedProvider: 'stub', requestedProvider: providerPolicies.comps, attemptedProviders: ['stub'], status: 'fallback', reason },
  }
}

const STUB: PropertyData = {
  ...STUB_BASE,
  zestimate: null,
  valueEstimate: null,
  valueEstimateRange: null,
  valueEstimateConfidence: null,
  providerPropertyId: null,
  comps: [
    { address: '12450 S Justine St, Calumet Park', price: 185000, living_area_sqft: 1400, bedrooms: 3, latitude: 41.667, longitude: -87.665, date_sold: 1772323200000 },
    { address: '12440 S Justine St, Calumet Park', price: 190000, living_area_sqft: 1450, bedrooms: 3, latitude: 41.668, longitude: -87.664, date_sold: 1768435200000 },
    { address: '12400 S Ashland Ave, Calumet Park', price: 175000, living_area_sqft: 1300, bedrooms: 3, latitude: 41.665, longitude: -87.667, date_sold: 1766188800000 },
    { address: '12500 S Laflin St, Calumet Park', price: 200000, living_area_sqft: 1500, bedrooms: 4, latitude: 41.664, longitude: -87.662, date_sold: 1763164800000 },
  ],
  nearbyRents: [1800, 1950, 1750],
  nearbyRentListings: [
    { price: 1800, url: 'https://www.example.com/rent/1' },
    { price: 1950, url: 'https://www.example.com/rent/2' },
    { price: 1750, url: 'https://www.example.com/rent/3' },
  ],
  rentEstimate: 1800,
  rentEstimateRange: { low: 1750, high: 1950 },
  rentEstimateConfidence: 'low',
  isStubData: true,
  subjectDetailsStatus: 'stub',
  sqftSource: 'stub',
  subjectProvider: 'stub',
  valueProvider: 'stub',
  rentProvider: 'stub',
  compsProvider: 'stub',
  providerTrace: makeStubTrace('Using fallback stub data'),
  providerWarnings: ['Provider lookup failed, so ClearPath used fallback stub data.'],
  rawProviders: {},
}

function cookCountyFromAddress(address: string): string {
  const normalized = address.toLowerCase()
  const isCook =
    normalized.includes('chicago') ||
    normalized.includes('cook') ||
    normalized.includes('tinley') ||
    normalized.includes('oak forest') ||
    normalized.includes('bolingbrook') ||
    normalized.includes('calumet') ||
    normalized.includes('harvey') ||
    normalized.includes('cicero') ||
    normalized.includes('berwyn') ||
    normalized.includes('evanston')
  return isCook ? 'Cook' : 'Unknown'
}

function normalizeComp(comp: CanonicalSaleComp): CompListing {
  return {
    address: comp.address,
    price: comp.price,
    living_area_sqft: comp.livingAreaSqft,
    bedrooms: comp.bedrooms ?? 0,
    latitude: comp.latitude,
    longitude: comp.longitude,
    date_sold: comp.dateSold ?? null,
    url: comp.url ?? null,
  }
}

function toProviderTraceDomain(
  requestedProvider: ProviderName,
  attemptedProviders: ProviderName[],
  selectedProvider: ProviderName | null,
  status: ProviderTraceDomain['status'],
  reason: string | null
): ProviderTraceDomain {
  return { requestedProvider, attemptedProviders, selectedProvider, status, reason }
}

export function selectProviderResults<T>(results: Array<ProviderResult<T>>, preferredProvider: ProviderName): ProviderResult<T> | null {
  return results.find(result => result.provider === preferredProvider && result.status === 'success' && result.data)
    ?? results.find(result => result.status === 'success' && result.data)
    ?? null
}

export function buildProviderWarnings(trace: ProviderTrace): string[] {
  return (Object.entries(trace) as Array<[keyof ProviderTrace, ProviderTraceDomain]>)
    .flatMap(([domain, details]) => {
      if (!details.reason) return []
      if (details.status === 'error') return [`${domain} provider lookup failed: ${details.reason}`]
      if (details.status === 'missing' || details.status === 'fallback') return [`${domain} used fallback logic: ${details.reason}`]
      return []
    })
}

function buildCanonicalStub(address: string): CanonicalPropertyData {
  const subjectCounty = cookCountyFromAddress(address)
  return {
    address,
    subject: {
      address,
      addressLine1: null,
      city: subjectCounty === 'Cook' ? 'Chicago' : 'Unknown',
      county: subjectCounty,
      state: 'IL',
      zip: '',
      lat: STUB.lat,
      lng: STUB.lng,
      sqft: null,
      bedrooms: STUB.bedrooms,
      bathrooms: STUB.bathrooms,
      yearBuilt: STUB.yearBuilt,
      propertyType: STUB.propertyType,
      providerPropertyId: null,
    },
    valueEstimate: null,
    rentEstimate: STUB.rentEstimate ? { estimate: STUB.rentEstimate, low: 1750, high: 1950, confidence: 'low', confidenceScore: null } : null,
    saleComparables: STUB.comps.map(comp => ({
      address: comp.address,
      price: comp.price,
      livingAreaSqft: comp.living_area_sqft,
      bedrooms: comp.bedrooms,
      bathrooms: null,
      latitude: comp.latitude,
      longitude: comp.longitude,
      dateSold: comp.date_sold ?? null,
      url: null,
    })),
    rentalListings: STUB.nearbyRentListings.map(listing => ({
      address: null,
      price: listing.price,
      bedrooms: null,
      bathrooms: null,
      livingAreaSqft: null,
      latitude: null,
      longitude: null,
      listedDate: null,
      url: listing.url,
    })),
    selectedProviders: {
      subjectProvider: 'stub',
      valueProvider: 'stub',
      rentProvider: 'stub',
      compsProvider: 'stub',
    },
    rawProviders: {},
    providerTrace: makeStubTrace('Using fallback stub data'),
    providerWarnings: ['Provider lookup failed, so ClearPath used fallback stub data.'],
    isStubData: true,
  }
}

export async function getCanonicalPropertyData(address: string, policy: ProviderSelectionPolicy = providerPolicies): Promise<CanonicalPropertyData> {
  const rentCast = new RentCastProvider()

  // Check DB cache for RentCast value/rent (still used regardless of subject provider)
  const cached = await getCachedRentCast(address)

  // ── Subject facts: try Realty in US first (MLS-sourced), fall back to RentCast ──
  let subjectResult: Awaited<ReturnType<typeof rentCast.lookupSubject>>
  let subjectProviderName: ProviderName

  const hasRapidApiKey = Boolean(getRapidApiZillowKey())

  if (hasRapidApiKey) {
    try {
      const realtyInUS = new RealtyInUSProvider()
      const realtyResult = await realtyInUS.lookupSubject(address)
      if (realtyResult.status === 'success' && realtyResult.data) {
        subjectResult = realtyResult
        subjectProviderName = 'realtyinus'
      } else {
        // Realty in US missed — fall back to RentCast
        subjectResult = cached.subject
          ? rentCast.lookupSubjectFromCache(cached.subject)
          : await rentCast.lookupSubject(address)
        subjectProviderName = 'rentcast'
      }
    } catch {
      // Unexpected error from Realty in US — fall back to RentCast silently
      subjectResult = cached.subject
        ? rentCast.lookupSubjectFromCache(cached.subject)
        : await rentCast.lookupSubject(address)
      subjectProviderName = 'rentcast'
    }
  } else {
    subjectResult = cached.subject
      ? rentCast.lookupSubjectFromCache(cached.subject)
      : await rentCast.lookupSubject(address)
    subjectProviderName = 'rentcast'
  }

  if (!subjectResult.data) {
    const reason = subjectResult.error ?? 'Subject lookup failed'
    const stubTrace: ProviderTrace = {
      subjectFacts: toProviderTraceDomain(policy.subjectFacts, [subjectProviderName, 'rentcast'], null, subjectResult.status === 'error' ? 'error' : 'missing', reason),
      value: toProviderTraceDomain(policy.value, ['rentcast'], null, 'fallback', 'Subject lookup failed before value estimate'),
      rent: toProviderTraceDomain(policy.rent, ['rentcast'], null, 'fallback', 'Subject lookup failed before rent estimate'),
      comps: toProviderTraceDomain(policy.comps, ['rentcast'], null, 'fallback', 'Subject lookup failed before comparable lookup'),
    }
    const stub = buildCanonicalStub(address)
    return {
      ...stub,
      providerTrace: stubTrace,
      providerWarnings: buildProviderWarnings(stubTrace),
      rawProviders: {
        [subjectProviderName]: { subject: subjectResult.trimmedRaw ?? null, error: reason },
      },
    }
  }

  // ── Value / rent / comps: always from RentCast ──
  // Inject cached responses so RentCast skips those API calls
  if (cached.value) rentCast.injectCache('/avm/value', address, cached.value)
  if (cached.rent)  rentCast.injectCache('/avm/rent/long-term', address, cached.rent)

  // Use a subject record that preserves the original address string so RentCast
  // cache keys stay consistent regardless of which provider resolved the address
  const rentCastSubject = { ...subjectResult.data, address }

  const [valueResult, rentResult, compsResult, rentalResult] = await Promise.all([
    rentCast.getValueEstimate(rentCastSubject),
    rentCast.getRentEstimate(rentCastSubject),
    rentCast.getSaleComparables(rentCastSubject),
    rentCast.getRentalListings(rentCastSubject),
  ])

  // Persist fresh RentCast responses to DB cache
  const cacheUpdates: Parameters<typeof setCachedRentCast>[1] = {}
  if (!cached.subject && subjectProviderName === 'rentcast') cacheUpdates.subject = subjectResult.raw ?? null
  if (!cached.value) cacheUpdates.value = valueResult.raw ?? null
  if (!cached.rent)  cacheUpdates.rent  = rentResult.raw  ?? null
  if (Object.keys(cacheUpdates).length > 0) {
    void setCachedRentCast(address, cacheUpdates)
  }

  const trace: ProviderTrace = {
    subjectFacts: toProviderTraceDomain(
      policy.subjectFacts,
      [subjectProviderName],
      subjectResult.data ? subjectProviderName : null,
      subjectResult.data?.sqft ? 'success' : 'missing',
      subjectResult.data?.sqft ? null : `${subjectProviderName === 'realtyinus' ? 'Realtor.com' : 'RentCast'} record did not include square footage`,
    ),
    value: toProviderTraceDomain(policy.value, [valueResult.provider], valueResult.data ? valueResult.provider : null, valueResult.status, valueResult.data ? null : (valueResult.error ?? 'Provider AVM unavailable')),
    rent: toProviderTraceDomain(policy.rent, [rentResult.provider], rentResult.data ? rentResult.provider : null, rentResult.status, rentResult.data ? null : (rentResult.error ?? 'Provider rent estimate unavailable')),
    comps: toProviderTraceDomain(policy.comps, [compsResult.provider], compsResult.data && compsResult.data.length > 0 ? compsResult.provider : null, compsResult.data && compsResult.data.length > 0 ? 'success' : compsResult.status, compsResult.data && compsResult.data.length > 0 ? null : (compsResult.error ?? 'Provider comparables unavailable')),
  }

  return {
    address,
    subject: subjectResult.data,
    valueEstimate: valueResult.data ?? null,
    rentEstimate: rentResult.data ?? null,
    saleComparables: compsResult.data ?? [],
    rentalListings: rentalResult.data ?? [],
    selectedProviders: {
      subjectProvider: subjectProviderName,
      valueProvider: valueResult.data ? valueResult.provider : null,
      rentProvider: rentResult.data ? rentResult.provider : null,
      compsProvider: compsResult.data && compsResult.data.length > 0 ? compsResult.provider : null,
    },
    rawProviders: {
      [subjectProviderName]: { subject: subjectResult.trimmedRaw ?? null },
      rentcast: {
        value: valueResult.trimmedRaw ?? null,
        rent: rentResult.trimmedRaw ?? null,
        comps: compsResult.trimmedRaw ?? null,
        rentals: rentalResult.trimmedRaw ?? null,
      },
    },
    providerTrace: trace,
    providerWarnings: buildProviderWarnings(trace),
    isStubData: false,
  }
}

export function toLegacyPropertyData(canonical: CanonicalPropertyData): PropertyData {
  if (!canonical.subject) return cookCountyStub(canonical.address)

  const subject = canonical.subject
  return {
    sqft: subject.sqft,
    bedrooms: subject.bedrooms ?? STUB.bedrooms,
    bathrooms: subject.bathrooms ?? STUB.bathrooms,
    yearBuilt: subject.yearBuilt ?? STUB.yearBuilt,
    propertyType: subject.propertyType || STUB.propertyType,
    city: subject.city || STUB.city,
    county: subject.county || cookCountyFromAddress(canonical.address),
    state: subject.state || STUB.state,
    zip: subject.zip || '',
    zestimate: canonical.valueEstimate?.estimate ?? null,
    valueEstimate: canonical.valueEstimate?.estimate ?? null,
    valueEstimateRange: canonical.valueEstimate ? { low: canonical.valueEstimate.low ?? canonical.valueEstimate.estimate, high: canonical.valueEstimate.high ?? canonical.valueEstimate.estimate } : null,
    valueEstimateConfidence: canonical.valueEstimate?.confidence ?? null,
    providerPropertyId: subject.providerPropertyId,
    lat: subject.lat,
    lng: subject.lng,
    comps: canonical.saleComparables.map(normalizeComp),
    nearbyRents: canonical.rentalListings.map(listing => listing.price),
    nearbyRentListings: canonical.rentalListings.filter(listing => Boolean(listing.url)).map(listing => ({
      price: listing.price,
      url: listing.url!,
      address: listing.address,
    })),
    rentEstimate: canonical.rentEstimate?.estimate ?? null,
    rentEstimateRange: canonical.rentEstimate ? { low: canonical.rentEstimate.low ?? canonical.rentEstimate.estimate, high: canonical.rentEstimate.high ?? canonical.rentEstimate.estimate } : null,
    rentEstimateConfidence: canonical.rentEstimate?.confidence ?? null,
    isStubData: canonical.isStubData,
    subjectDetailsStatus: canonical.isStubData ? 'stub' : subject.sqft ? 'complete' : 'missing',
    sqftSource: canonical.isStubData ? 'stub' : subject.sqft ? 'property_api' : 'missing',
    subjectProvider: canonical.selectedProviders.subjectProvider,
    valueProvider: canonical.selectedProviders.valueProvider,
    rentProvider: canonical.selectedProviders.rentProvider,
    compsProvider: canonical.selectedProviders.compsProvider,
    providerTrace: canonical.providerTrace,
    providerWarnings: canonical.providerWarnings,
    rawProviders: canonical.rawProviders,
  }
}

export async function fetchPropertyData(address: string): Promise<PropertyData> {
  const canonical = await getCanonicalPropertyData(address)
  return toLegacyPropertyData(canonical)
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const radiusKm = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function calculateCompsARV(
  comps: CompListing[],
  subjectLat: number | null,
  subjectLng: number | null,
  subjectSqft: number,
  subjectBeds: number | null | undefined,
  conditionUplift: number
): number | null {
  return calculateCompsArvDetails(comps, subjectLat, subjectLng, subjectSqft, subjectBeds, conditionUplift)?.arv ?? null
}

export function calculateCompsArvDetails(
  comps: CompListing[],
  subjectLat: number | null,
  subjectLng: number | null,
  subjectSqft: number,
  subjectBeds: number | null | undefined,
  conditionUplift: number
): CompsArvDetails | null {
  if (!subjectLat || !subjectLng || subjectSqft <= 0 || comps.length === 0) return null

  const MAX_AGE_6MO = 180 * 24 * 60 * 60 * 1000
  const MAX_AGE_1YR = 365 * 24 * 60 * 60 * 1000
  const KM_PER_MILE = 1.60934
  const now = Date.now()
  const safeBeds = subjectBeds ?? 3

  function filterComps(radiusMiles: number, maxAgeMs: number): CompListing[] {
    return comps.filter(comp => {
      if (!comp.date_sold) return false  // no sold date = not a closed sale
      if (now - comp.date_sold > maxAgeMs) return false
      if (!comp.latitude || !comp.longitude) return false
      if (comp.living_area_sqft <= 0 || comp.price <= 0) return false
      if (Math.abs((comp.bedrooms ?? safeBeds) - safeBeds) > 1) return false
      return haversineKm(subjectLat!, subjectLng!, comp.latitude, comp.longitude) <= radiusMiles * KM_PER_MILE
    })
  }

  let filtered = filterComps(0.5, MAX_AGE_6MO)
  let radiusMiles: 0.5 | 1 = 0.5
  let maxAgeMonths: 6 | 12 = 6
  if (filtered.length < 3) {
    filtered = filterComps(1, MAX_AGE_6MO)
    radiusMiles = 1
  }
  if (filtered.length < 3) {
    filtered = filterComps(1, MAX_AGE_1YR)
    maxAgeMonths = 12
  }
  if (filtered.length < 2) return null

  const sorted = filtered.slice().sort((a, b) => (a.price / a.living_area_sqft) - (b.price / b.living_area_sqft))
  filtered = sorted.length >= 5 ? sorted.slice(Math.floor(sorted.length * 0.1), Math.ceil(sorted.length * 0.9)) : sorted

  // Outlier guard: drop comps whose $/sqft is more than 40% away from the group median.
  // This catches stray comps from very different sub-markets (e.g. a $65/sqft Robbins sale
  // showing up in a $150/sqft Blue Island analysis) without cutting valid border comps.
  if (filtered.length >= 3) {
    const ppsfAll = filtered.map(c => c.price / c.living_area_sqft).sort((a, b) => a - b)
    const mid = Math.floor(ppsfAll.length / 2)
    const groupMedian = ppsfAll.length % 2 === 0 ? (ppsfAll[mid - 1] + ppsfAll[mid]) / 2 : ppsfAll[mid]
    const tightened = filtered.filter(c => {
      const p = c.price / c.living_area_sqft
      return p >= groupMedian * 0.6 && p <= groupMedian * 1.4
    })
    if (tightened.length >= 2) filtered = tightened
  }

  const ppsf = filtered.map(comp => comp.price / comp.living_area_sqft).sort((a, b) => a - b)
  const mid = Math.floor(ppsf.length / 2)
  const medianPricePerSqft = ppsf.length % 2 === 0 ? (ppsf[mid - 1] + ppsf[mid]) / 2 : ppsf[mid]
  const lowPpsf = ppsf[Math.floor((ppsf.length - 1) * 0.25)]
  const highPpsf = ppsf[Math.ceil((ppsf.length - 1) * 0.75)]
  const avg = ppsf.reduce((sum, value) => sum + value, 0) / ppsf.length
  const variance = ppsf.reduce((sum, value) => sum + (value - avg) ** 2, 0) / ppsf.length
  const cv = avg > 0 ? Math.sqrt(variance) / avg : 1
  const confidence: CompsArvDetails['confidence'] = filtered.length >= 4 && radiusMiles === 0.5 && maxAgeMonths === 6 && cv <= 0.12 ? 'high' : filtered.length >= 3 && cv <= 0.2 ? 'medium' : 'low'

  return {
    arv: Math.round(subjectSqft * medianPricePerSqft * conditionUplift),
    filteredComps: filtered.map(comp => ({ ...comp, distanceMiles: haversineKm(subjectLat, subjectLng, comp.latitude!, comp.longitude!) / KM_PER_MILE })).sort((a, b) => a.distanceMiles - b.distanceMiles),
    confidence,
    range: { low: Math.round(subjectSqft * lowPpsf * conditionUplift), high: Math.round(subjectSqft * highPpsf * conditionUplift) },
    explainer: `${filtered.length} sale${filtered.length === 1 ? '' : 's'} within ${radiusMiles.toFixed(1)} mi, ${safeBeds}bd`,
    radiusMiles,
    maxAgeMonths,
  }
}

export function medianRent(nearbyRents: number[]): number | null {
  if (!nearbyRents.length) return null
  const sorted = nearbyRents.slice().sort((a, b) => a - b)
  const middleIndex = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[middleIndex - 1] + sorted[middleIndex]) / 2) : sorted[middleIndex]
}

function cookCountyStub(address: string): PropertyData {
  const county = cookCountyFromAddress(address)
  return {
    ...STUB,
    city: county === 'Cook' ? 'Chicago' : 'Unknown',
    county,
  }
}
