export interface CompListing {
  address: string
  price: number
  living_area_sqft: number
  bedrooms: number
  latitude: number | null
  longitude: number | null
  date_sold?: number | null // Unix timestamp in ms
}

export interface RentListing {
  price: number
  url: string  // full Zillow listing URL
}

export interface PropertyData {
  sqft: number
  bedrooms: number
  bathrooms: number
  yearBuilt: number
  propertyType: string
  city: string
  county: string
  state: string
  zip: string
  zestimate: number | null
  lat: number | null
  lng: number | null
  comps: CompListing[]
  nearbyRents: number[]        // prices only — used for median calculation
  nearbyRentListings: RentListing[]  // price + URL for display
}

const STUB: PropertyData = {
  sqft: 1400,
  bedrooms: 3,
  bathrooms: 2,
  yearBuilt: 1965,
  propertyType: 'single_family',
  city: 'Unknown',
  county: 'Unknown',
  state: 'IL',
  zip: '',
  zestimate: null,
  lat: 41.666,
  lng: -87.666,
  comps: [
    { address: '12450 S Justine St, Calumet Park', price: 185000, living_area_sqft: 1400, bedrooms: 3, latitude: 41.667, longitude: -87.665, date_sold: Date.now() - 30 * 24 * 60 * 60 * 1000 }, // ~1 mo ago
    { address: '12440 S Justine St, Calumet Park', price: 190000, living_area_sqft: 1450, bedrooms: 3, latitude: 41.668, longitude: -87.664, date_sold: Date.now() - 90 * 24 * 60 * 60 * 1000 }, // ~3 mo ago
    { address: '12400 S Ashland Ave, Calumet Park', price: 175000, living_area_sqft: 1300, bedrooms: 3, latitude: 41.665, longitude: -87.667, date_sold: Date.now() - 150 * 24 * 60 * 60 * 1000 }, // ~5 mo ago
    { address: '12500 S Laflin St, Calumet Park', price: 200000, living_area_sqft: 1500, bedrooms: 4, latitude: 41.664, longitude: -87.662, date_sold: Date.now() - 45 * 24 * 60 * 60 * 1000 }, // ~1.5 mo ago
    { address: '12350 S Marshfield Ave', price: 180000, living_area_sqft: 1350, bedrooms: 3, latitude: 41.669, longitude: -87.668, date_sold: Date.now() - 210 * 24 * 60 * 60 * 1000 }, // ~7 mo ago (SHOULD DROP)
    { address: '12410 S Paulina St, Calumet Park', price: 192000, living_area_sqft: 1420, bedrooms: 3, latitude: 41.665, longitude: -87.665, date_sold: Date.now() - 60 * 24 * 60 * 60 * 1000 } // ~2 mo ago
  ],
  nearbyRents: [1800, 1950, 1750],
  nearbyRentListings: [
    { price: 1800, url: 'https://www.zillow.com/homes/for_rent/Calumet-Park-IL/' },
    { price: 1950, url: 'https://www.zillow.com/homes/for_rent/Calumet-Park-IL/' },
    { price: 1750, url: 'https://www.zillow.com/homes/for_rent/Calumet-Park-IL/' },
  ],
}

export async function fetchPropertyData(address: string): Promise<PropertyData> {
  const apiKey = process.env.RAPIDAPI_ZILLOW_KEY
  if (!apiKey) {
    console.error('RAPIDAPI_ZILLOW_KEY not set — using stub data')
    return cookCountyStub(address)
  }

  const headers = {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'zillow-scraper-api.p.rapidapi.com',
    'Content-Type': 'application/json',
  }

  try {
    // ── Step 1: Autocomplete → get exact coordinates for the address ──────────
    const acUrl = new URL('https://zillow-scraper-api.p.rapidapi.com/zillow/search/autocomplete')
    acUrl.searchParams.set('query', address)

    const acRes = await fetch(acUrl.toString(), { headers, next: { revalidate: 0 } })
    if (!acRes.ok) {
      console.error(`Autocomplete API error: ${acRes.status}`)
      return cookCountyStub(address)
    }

    const acData = await acRes.json()
    const suggestion = acData?.data?.suggestions?.[0]

    if (!suggestion) {
      console.error('Autocomplete returned no suggestions for:', address)
      return cookCountyStub(address)
    }

    const lat: number = suggestion.latitude
    const lng: number = suggestion.longitude
    const zpid: string | undefined = suggestion.zpid ? String(suggestion.zpid) : undefined
    const city: string = suggestion.city ?? cookCountyFromAddress(address) === 'Cook' ? 'Chicago' : 'Unknown'
    const state: string = suggestion.state ?? 'IL'
    const county: string = suggestion.county ?? cookCountyFromAddress(address)

    // ── Step 2, 3 & 4: Fetch comps, rentals, and subject property details ──────
    const coordUrl = new URL('https://zillow-scraper-api.p.rapidapi.com/zillow/search/by-coordinates')
    coordUrl.searchParams.set('lat', String(lat))
    coordUrl.searchParams.set('lng', String(lng))
    coordUrl.searchParams.set('radius', '1')
    coordUrl.searchParams.set('page', '1')
    coordUrl.searchParams.set('home_type', 'house')
    coordUrl.searchParams.set('listing_type', 'recently_sold')

    const rentUrl = new URL('https://zillow-scraper-api.p.rapidapi.com/zillow/search/by-coordinates')
    rentUrl.searchParams.set('lat', String(lat))
    rentUrl.searchParams.set('lng', String(lng))
    rentUrl.searchParams.set('radius', '1')
    rentUrl.searchParams.set('page', '1')
    rentUrl.searchParams.set('home_type', 'house')
    rentUrl.searchParams.set('listing_type', 'for_rent')

    const detailUrl = zpid
      ? new URL(`https://zillow-scraper-api.p.rapidapi.com/zillow/property/details?zpid=${zpid}`)
      : null

    const [coordRes, rentRes, detailRes] = await Promise.all([
      fetch(coordUrl.toString(), { headers, next: { revalidate: 0 } }),
      fetch(rentUrl.toString(), { headers, next: { revalidate: 0 } }),
      detailUrl ? fetch(detailUrl.toString(), { headers, next: { revalidate: 0 } }) : Promise.resolve(null),
    ])

    // ── Parse subject property details ────────────────────────────────────────
    let sqft = STUB.sqft
    let bedrooms = STUB.bedrooms
    let bathrooms = STUB.bathrooms
    let yearBuilt = STUB.yearBuilt
    let propertyType = STUB.propertyType
    let zip = STUB.zip
    let zestimate: number | null = null

    if (detailRes?.ok) {
      const detail = await detailRes.json()
      const d = detail?.data ?? detail  // handle both wrapped and unwrapped responses
      if (d?.living_area_sqft)  sqft         = Number(d.living_area_sqft)
      if (d?.bedrooms)          bedrooms     = Number(d.bedrooms)
      if (d?.bathrooms)         bathrooms    = Number(d.bathrooms)
      if (d?.year_built)        yearBuilt    = Number(d.year_built)
      if (d?.home_type)         propertyType = String(d.home_type)
      if (d?.zip_code)          zip          = String(d.zip_code)
      if (d?.zestimate)         zestimate    = Number(d.zestimate)
      console.log(`[propertyData] Subject detail fetched: ${sqft} sqft, ${bedrooms}bd/${bathrooms}ba, built ${yearBuilt}`)
    } else if (detailRes) {
      console.warn(`Property detail API returned ${detailRes.status} — using stub property values`)
    }

    // ── Parse sale comps ──────────────────────────────────────────────────────
    let comps: CompListing[] = []
    if (coordRes.ok) {
      const coordData = await coordRes.json()
      const listings: Record<string, unknown>[] = coordData?.data?.listings ?? []
      comps = listings
        .filter(l => l.living_area_sqft && l.price && l.bedrooms)
        .map(l => ({
          address:
            (l.street_address as string)
              ? `${l.street_address}${l.city ? ', ' + l.city : ''}${l.state_code ? ' ' + l.state_code : ''}`
              : (l.address as string) ?? 'Unknown',
          price:            l.price as number,
          living_area_sqft: l.living_area_sqft as number,
          bedrooms:         l.bedrooms as number,
          latitude:         (l.latitude as number) ?? null,
          longitude:        (l.longitude as number) ?? null,
          date_sold:        l.dateSold ? new Date(l.dateSold as string).getTime() : 
                            l.timeOnZillow ? new Date(l.timeOnZillow as string).getTime() : null,
        }))
    } else {
      console.error(`Coordinates API error: ${coordRes.status}`)
    }

    // ── Parse rental listings ─────────────────────────────────────────────────
    let nearbyRents: number[] = []
    let nearbyRentListings: RentListing[] = []
    if (rentRes.ok) {
      const rentData = await rentRes.json()
      const rentListings: Record<string, unknown>[] = rentData?.data?.listings ?? []
      const valid = rentListings.filter(l => {
        const p = l.price as number
        return p > 0 && p < 10000   // sanity range for monthly rent
      })
      nearbyRents = valid.map(l => l.price as number)
      nearbyRentListings = valid.map(l => {
        const zpid = l.zpid as string | number | undefined
        const detailUrl = l.detailUrl as string | undefined
        const url = detailUrl
          ? (detailUrl.startsWith('http') ? detailUrl : `https://www.zillow.com${detailUrl}`)
          : zpid
          ? `https://www.zillow.com/homedetails/${zpid}_zpid/`
          : 'https://www.zillow.com/homes/for_rent/'
        return { price: l.price as number, url }
      })
    } else {
      console.warn(`Rental listings API returned ${rentRes.status} — rent will use formula fallback`)
    }

    return {
      sqft,
      bedrooms,
      bathrooms,
      yearBuilt,
      propertyType,
      city,
      county: county || cookCountyFromAddress(address),
      state,
      zip,
      zestimate,
      lat,
      lng,
      comps,
      nearbyRents,
      nearbyRentListings,
    }
  } catch (err) {
    console.error('Property data fetch failed:', err)
    return cookCountyStub(address)
  }
}

// ── Haversine distance (km) ───────────────────────────────────────────────────
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Comps-based ARV ───────────────────────────────────────────────────────────
export function calculateCompsARV(
  comps: CompListing[],
  subjectLat: number | null,
  subjectLng: number | null,
  subjectSqft: number,
  subjectBeds: number | null | undefined,
  conditionUplift: number
): number | null {
  if (!subjectLat || !subjectLng || comps.length === 0) return null
  
  const MAX_AGE_6MO = 180 * 24 * 60 * 60 * 1000
  const MAX_AGE_1YR = 365 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const safeBeds = subjectBeds ?? 3
  const KM_PER_MILE = 1.60934

  function filterComps(radiusMiles: number, maxAgeMs: number): CompListing[] {
    return comps.filter(c => {
      // Age check
      if (c.date_sold && (now - c.date_sold) > maxAgeMs) return false

      if (!c.latitude || !c.longitude) return false
      // Null-safe bedroom filter — if comp has no bed data, treat as matching
      const compBeds = c.bedrooms ?? safeBeds
      if (Math.abs(compBeds - safeBeds) > 1) return false
      if (c.living_area_sqft <= 0 || c.price <= 0) return false
      const distKm = haversineKm(subjectLat!, subjectLng!, c.latitude, c.longitude)
      return distKm <= radiusMiles * KM_PER_MILE
    })
  }

  // Build cascade
  let filtered = filterComps(0.5, MAX_AGE_6MO)
  if (filtered.length < 3) filtered = filterComps(1.0, MAX_AGE_6MO)
  if (filtered.length < 3) filtered = filterComps(1.0, MAX_AGE_1YR) // Last resort! 
  if (filtered.length < 2) return null

  // ── Outlier filter: trim bottom 10% and top 10% by $/sqft ─────────────────
  const sorted = filtered.slice().sort(
    (a, b) => (a.price / a.living_area_sqft) - (b.price / b.living_area_sqft)
  )
  if (sorted.length >= 5) {
    const lo = Math.floor(sorted.length * 0.10)
    const hi = Math.ceil(sorted.length * 0.90)
    const trimmed = sorted.slice(lo, hi)
    if (trimmed.length >= 2) filtered = trimmed
  }

  // ── Median price/sqft ────────────────────────────────────────────────────
  const pricesPerSqft = filtered
    .map(c => c.price / c.living_area_sqft)
    .sort((a, b) => a - b)

  const mid = Math.floor(pricesPerSqft.length / 2)
  const medianPricePerSqft =
    pricesPerSqft.length % 2 === 0
      ? (pricesPerSqft[mid - 1] + pricesPerSqft[mid]) / 2
      : pricesPerSqft[mid]

  return Math.round(subjectSqft * medianPricePerSqft * conditionUplift)
}

// ── Median rent from nearby rental listings ───────────────────────────────────
export function medianRent(nearbyRents: number[]): number | null {
  if (!nearbyRents || nearbyRents.length === 0) return null
  const sorted = nearbyRents.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function cookCountyFromAddress(address: string): string {
  const addr = address.toLowerCase()
  const isCook =
    addr.includes('chicago') || addr.includes('cook') ||
    addr.includes('tinley') || addr.includes('oak forest') ||
    addr.includes('bolingbrook') || addr.includes('calumet') ||
    addr.includes('harvey') || addr.includes('cicero') ||
    addr.includes('berwyn') || addr.includes('evanston')
  return isCook ? 'Cook' : 'Unknown'
}

function cookCountyStub(address: string): PropertyData {
  const county = cookCountyFromAddress(address)
  return {
    ...STUB,
    city:   county === 'Cook' ? 'Chicago' : 'Unknown',
    county,
  }
}
