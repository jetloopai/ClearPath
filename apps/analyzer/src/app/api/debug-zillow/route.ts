import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address') ?? '12449 South Justine Street, Calumet Park, IL'
  const apiKey = process.env.RAPIDAPI_ZILLOW_KEY

  if (!apiKey) return NextResponse.json({ error: 'RAPIDAPI_ZILLOW_KEY not set' }, { status: 500 })

  const headers = {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'zillow-scraper-api.p.rapidapi.com',
    'Content-Type': 'application/json',
  }

  const results: Record<string, unknown> = { address }

  // Step 1: Autocomplete
  try {
    const acUrl = `https://zillow-scraper-api.p.rapidapi.com/zillow/search/autocomplete?query=${encodeURIComponent(address)}`
    const acRes = await fetch(acUrl, { headers })
    results.autocomplete_status = acRes.status
    const acData = await acRes.json()
    results.autocomplete_raw = acData
    const suggestion = acData?.data?.suggestions?.[0]
    results.suggestion = suggestion ?? null

    if (suggestion) {
      const { latitude: lat, longitude: lng, zpid } = suggestion
      results.lat = lat
      results.lng = lng
      results.zpid = zpid

      // Step 2: Property details
      if (zpid) {
        const detailRes = await fetch(
          `https://zillow-scraper-api.p.rapidapi.com/zillow/property/details?zpid=${zpid}`,
          { headers }
        )
        results.detail_status = detailRes.status
        results.detail_raw = await detailRes.json()
      }

      // Step 3: Nearby comps
      const coordUrl = `https://zillow-scraper-api.p.rapidapi.com/zillow/search/by-coordinates?lat=${lat}&lng=${lng}&radius=1&page=1&home_type=house&listing_type=recently_sold`
      const coordRes = await fetch(coordUrl, { headers })
      results.comps_status = coordRes.status
      const coordData = await coordRes.json()
      results.comps_count = coordData?.data?.listings?.length ?? 0
      results.comps_sample = coordData?.data?.listings?.slice(0, 2) ?? []

      // Step 4: Nearby rentals
      const rentUrl = `https://zillow-scraper-api.p.rapidapi.com/zillow/search/by-coordinates?lat=${lat}&lng=${lng}&radius=1&page=1&home_type=house&listing_type=for_rent`
      const rentRes = await fetch(rentUrl, { headers })
      results.rent_status = rentRes.status
      const rentData = await rentRes.json()
      results.rent_count = rentData?.data?.listings?.length ?? 0
      results.rent_sample = rentData?.data?.listings?.slice(0, 2) ?? []
    }
  } catch (err) {
    results.error = String(err)
  }

  return NextResponse.json(results, { status: 200 })
}
