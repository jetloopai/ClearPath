import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { calculateCompsArvDetails, fetchPropertyData, medianRent } from '@/lib/propertyData'
import type { AnalysisResults } from '@/lib/calculations'
import type { ArvRange, CompListing, PropertyData, ProviderTrace } from '@/lib/propertyData'
import { getProviderLabel } from '@/lib/providers/config'

export interface AnalysisBreakdown {
  purchasePrice: number
  rehabMidpoint: number
  holdingCosts: number
  sellingCosts: number
  mortgage: number
  vacancy: number
  mgmt: number
  maintenance: number
  capex: number
  insurance: number
  taxes: number
  downPayment: number
  closingCostsBuy: number
}

export interface AlternativeCondition {
  condition: string
  arv: number
  rehabMidpoint: number
  flipProfit: number
  monthlyCashFlow: number
  flipSignal: 'green' | 'yellow' | 'red'
  rentalSignal: 'green' | 'yellow' | 'red'
}

export interface SubjectDataProvenance {
  source: 'property_api' | 'manual' | 'stub'
  provider: string | null
  detailsStatus: 'complete' | 'missing' | 'stub'
  sqftSource: 'property_api' | 'manual' | 'missing' | 'stub'
  subjectSqft: number | null
  effectiveSqft: number
  label: string
  summary: string
}

type ManualSqftReason = 'missing' | 'unverified' | null

type SqftVerificationIssue = {
  suggestedSqft: number
  warning: string
}

export interface AnalyzeResponse {
  analysisId: string
  results: AnalysisResults
  breakdown: AnalysisBreakdown
  compsUsed: (CompListing & { distanceMiles: number })[]
  alternatives: AlternativeCondition[]
  arvMethod: 'comps_based' | 'provider_avm' | 'rough_estimate'
  arvConfidence: 'high' | 'medium' | 'low'
  arvRange: ArvRange | null
  arvExplainer: string
  arvProvider: string | null
  compsCount: number
  rentSource: 'nearby_listings' | 'provider_estimate' | 'formula' | 'manual'
  rentExplainer: string
  rentProvider: string | null
  nearbyRentCount: number
  nearbyRentPrices: number[]
  nearbyRentListings: { price: number; url: string }[]
  interestRate: number
  dataWarnings: string[]
  providerWarnings: string[]
  providerTrace: ProviderTrace
  subjectData: SubjectDataProvenance
  subjectLat: number | null
  subjectLng: number | null
}

const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.0040, AK: 0.0098, AZ: 0.0051, AR: 0.0060, CA: 0.0071,
  CO: 0.0049, CT: 0.0199, DE: 0.0054, FL: 0.0086, GA: 0.0086,
  HI: 0.0027, ID: 0.0063, IL: 0.0188, IN: 0.0083, IA: 0.0150,
  KS: 0.0130, KY: 0.0080, LA: 0.0052, ME: 0.0130, MD: 0.0109,
  MA: 0.0108, MI: 0.0138, MN: 0.0105, MS: 0.0063, MO: 0.0093,
  MT: 0.0074, NE: 0.0148, NV: 0.0048, NH: 0.0199, NJ: 0.0220,
  NM: 0.0073, NY: 0.0148, NC: 0.0077, ND: 0.0088, OH: 0.0141,
  OK: 0.0086, OR: 0.0087, PA: 0.0142, RI: 0.0151, SC: 0.0052,
  SD: 0.0103, TN: 0.0060, TX: 0.0160, UT: 0.0051, VT: 0.0182,
  VA: 0.0078, WA: 0.0081, WV: 0.0055, WI: 0.0157, WY: 0.0055,
  DC: 0.0055,
}

function getMissingSqftWarnings(property: PropertyData): string[] {
  if (property.isStubData) {
    return ['Property lookup failed, so ClearPath does not have trustworthy subject facts for this address yet.']
  }
  return [`${getProviderLabel(property.subjectProvider)} returned incomplete subject details without square footage, so rehab and ARV cannot be trusted until you enter sqft manually.`]
}

function getManualSqftReason(property: PropertyData, manualSqft: number | null): ManualSqftReason {
  if (!manualSqft) return null
  return property.sqft ? 'unverified' : 'missing'
}

function getSqftVerificationIssue(property: PropertyData, effectiveSqft: number, comps: (CompListing & { distanceMiles: number })[] | null): SqftVerificationIssue | null {
  if (property.isStubData || !property.sqft || effectiveSqft <= 0 || !comps || comps.length < 3) return null

  const compSqfts = comps
    .map(comp => comp.living_area_sqft)
    .filter(sqft => Number.isFinite(sqft) && sqft > 0)
    .sort((a, b) => a - b)

  if (compSqfts.length < 3) return null

  const mid = Math.floor(compSqfts.length / 2)
  const medianSqft = compSqfts.length % 2 === 0
    ? (compSqfts[mid - 1] + compSqfts[mid]) / 2
    : compSqfts[mid]
  const lowSqft = compSqfts[Math.floor((compSqfts.length - 1) * 0.25)]
  const highSqft = compSqfts[Math.ceil((compSqfts.length - 1) * 0.75)]
  const absoluteGap = Math.abs(effectiveSqft - medianSqft)
  const tooLargeVsMedian = effectiveSqft >= medianSqft * 1.15 && absoluteGap >= 250
  const tooSmallVsMedian = effectiveSqft <= medianSqft * 0.85 && absoluteGap >= 250
  const outsideCompBand = effectiveSqft < lowSqft * 0.9 || effectiveSqft > highSqft * 1.1

  if (!tooLargeVsMedian && !tooSmallVsMedian && !outsideCompBand) return null

  return {
    suggestedSqft: Math.round(medianSqft),
    warning: `The square footage from ${getProviderLabel(property.subjectProvider)} (${effectiveSqft.toLocaleString()} sq ft) conflicts with nearby comparable homes (median ${Math.round(medianSqft).toLocaleString()} sq ft). ClearPath requires verified square footage before running rehab and ARV so the numbers are not distorted.`,
  }
}

function buildSubjectDataProvenance(property: PropertyData, manualSqft: number | null, effectiveSqft: number, manualSqftReason: ManualSqftReason): SubjectDataProvenance {
  const subjectProvider = property.subjectProvider ? getProviderLabel(property.subjectProvider) : null

  if (property.isStubData) {
    return {
      source: manualSqft ? 'manual' : 'stub',
      provider: subjectProvider,
      detailsStatus: 'stub',
      sqftSource: manualSqft ? 'manual' : 'stub',
      subjectSqft: property.sqft,
      effectiveSqft,
      label: manualSqft ? 'Manual sqft on fallback lookup' : 'Fallback property data',
      summary: manualSqft
        ? `Provider lookup failed, so ClearPath used your manual sqft of ${effectiveSqft.toLocaleString()} sq ft with fallback market data.`
        : 'Provider lookup failed, so ClearPath used fallback subject and market data.',
    }
  }

  if (manualSqft) {
    return {
      source: 'manual',
      provider: subjectProvider,
      detailsStatus: property.subjectDetailsStatus,
      sqftSource: 'manual',
      subjectSqft: property.sqft,
      effectiveSqft,
      label: 'Manual square footage',
      summary: manualSqftReason === 'unverified'
        ? `${subjectProvider ?? 'The provider'} returned square footage that looked unreliable against nearby comps, so ClearPath used your manual sqft of ${effectiveSqft.toLocaleString()} sq ft.`
        : `Subject details from ${subjectProvider ?? 'the provider'} were incomplete, so ClearPath used your manual sqft of ${effectiveSqft.toLocaleString()} sq ft.`,
    }
  }

  return {
    source: 'property_api',
    provider: subjectProvider,
    detailsStatus: property.subjectDetailsStatus,
    sqftSource: property.sqftSource,
    subjectSqft: property.sqft,
    effectiveSqft,
    label: subjectProvider ? `${subjectProvider} property data` : 'Property data provider',
    summary: `Subject facts came from ${subjectProvider ?? 'the provider'}, including ${effectiveSqft.toLocaleString()} sq ft.`,
  }
}

async function upsertPropertyRecord(address: string, property: PropertyData, isServiceArea: boolean): Promise<string | null> {
  const payload = {
    address,
    city: property.city,
    county: property.county,
    state: property.state,
    zip: property.zip,
    lat: property.lat,
    lng: property.lng,
    sqft: property.sqft,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    year_built: property.yearBuilt,
    property_type: property.propertyType,
    zestimate: property.valueEstimate ?? property.zestimate,
    is_service_area: isServiceArea,
    source_subject: property.subjectProvider,
    source_value: property.valueProvider,
    source_rent: property.rentProvider,
    source_comps: property.compsProvider,
    source_updated_at: new Date().toISOString(),
    data: {
      rawProviders: property.rawProviders,
      providerTrace: property.providerTrace,
      providerWarnings: property.providerWarnings,
      valueEstimateRange: property.valueEstimateRange,
      rentEstimateRange: property.rentEstimateRange,
      rentEstimate: property.rentEstimate,
      nearbyRentCount: property.nearbyRents.length,
      compsCount: property.comps.length,
      providerPropertyId: property.providerPropertyId,
    },
  }

  const { data: existing } = await supabaseAdmin
    .from('properties')
    .select('id')
    .eq('address', address)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from('properties')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (error) {
      console.error('Property update error:', error)
      return null
    }

    return data.id
  }

  const { data, error } = await supabaseAdmin
    .from('properties')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    console.error('Property insert error:', error)
    return null
  }

  return data.id
}

async function insertAnalysisWithCompatibility(payload: Record<string, unknown>) {
  let query = supabaseAdmin.from('analyses').insert(payload).select('id').single()
  let result = await query

  if (!result.error) return result

  const message = `${result.error.message ?? ''} ${result.error.details ?? ''}`.toLowerCase()
  if (!message.includes('provider_trace')) return result

  const retryPayload = { ...payload }
  delete retryPayload.provider_trace
  result = await supabaseAdmin.from('analyses').insert(retryPayload).select('id').single()
  return result
}

export async function POST(req: NextRequest) {
  // ── Auth + credit check (before any expensive work) ──────────────────────
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'sign_in_required', message: 'Sign in to run an analysis.' }, { status: 401 })
  }
  const { data: { user: authUser } } = await supabaseAdmin.auth.getUser(token)
  if (!authUser) {
    return NextResponse.json({ error: 'sign_in_required', message: 'Sign in to run an analysis.' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan, credits_remaining')
    .eq('id', authUser.id)
    .single()

  const creditsRemaining = profile?.credits_remaining ?? 0
  const currentPlan = profile?.plan ?? 'free'

  if (creditsRemaining <= 0) {
    return NextResponse.json({
      error: 'upgrade_required',
      plan: currentPlan,
      message: currentPlan === 'free'
        ? 'You have used all 3 free reports. Upgrade to keep analyzing deals.'
        : `You have used all your ${currentPlan === 'starter' ? '50' : '300'} reports this month. Upgrade to continue.`,
    }, { status: 402 })
  }
  // ─────────────────────────────────────────────────────────────────────────

  const body = await req.json()
  const { address, price, condition, county, units: unitsRaw, downPaymentPct, holdMonths, interestRateOverride, rentOverride, insuranceOverride, manualSqft: manualSqftRaw } = body

  const numericPrice = Number(price)
  const units: number = Math.max(1, Math.min(4, Number(unitsRaw) || 1))
  const manualSqft = Number(manualSqftRaw)
  const normalizedManualSqft = Number.isFinite(manualSqft) && manualSqft > 0 ? Math.round(manualSqft) : null

  if (!address || !numericPrice || !condition) {
    return NextResponse.json({ error: 'address, price, and condition are required' }, { status: 400 })
  }

  const { data: defaults } = await supabaseAdmin.from('system_defaults').select('key, value')
  const cfg: Record<string, number> = {}
  for (const row of defaults ?? []) cfg[row.key] = Number(row.value)

  const loanTermYears = cfg.loan_term_years ?? 30
  const vacancyRate = cfg.vacancy_rate ?? 0.08
  const mgmtRate = cfg.mgmt_rate ?? 0.10
  const maintenanceRate = cfg.maintenance_rate ?? 0.06
  const capexRate = cfg.capex_rate ?? 0.05
  const closingBuyPct = cfg.closing_cost_buy_pct ?? 0.02
  const closingSellPct = cfg.closing_cost_sell_pct ?? 0.08
  const holdCostPct = cfg.holding_cost_monthly_pct ?? 0.01
  const maoMultiplier = cfg.mao_arv_multiplier ?? 0.70
  const rentRatio = cfg.default_rent_ratio ?? 0.009
  const downPct = downPaymentPct ?? cfg.down_payment_pct ?? 0.25
  const hold = holdMonths ?? cfg.hold_months ?? 6
  const interestRate = interestRateOverride ?? cfg.interest_rate ?? 0.075

  const rehabRanges: Record<string, [number, number]> = {
    cosmetic: [cfg.rehab_cosmetic_low ?? 10, cfg.rehab_cosmetic_high ?? 20],
    light: [cfg.rehab_light_low ?? 20, cfg.rehab_light_high ?? 35],
    medium: [cfg.rehab_medium_low ?? 35, cfg.rehab_medium_high ?? 55],
    heavy: [cfg.rehab_heavy_low ?? 55, cfg.rehab_heavy_high ?? 85],
    gut: [cfg.rehab_gut_low ?? 85, cfg.rehab_gut_high ?? 150],
  }
  const arvMultipliers: Record<string, number> = { cosmetic: 1.2, light: 1.3, medium: 1.45, heavy: 1.6, gut: 1.8 }
  const compsUplift: Record<string, number> = { cosmetic: 1.05, light: 1.08, medium: 1.12, heavy: 1.18, gut: 1.25 }
  const signalCashFlowGreen = cfg.signal_cashflow_green ?? 300
  const signalCashFlowRed = cfg.signal_cashflow_red ?? 0
  const signalFlipGreen = cfg.signal_flip_green ?? 30000
  const signalFlipRed = cfg.signal_flip_red ?? 10000

  const property = await fetchPropertyData(address)

  if (property.isStubData) {
    const providerReason = property.providerWarnings[0] ?? 'RentCast could not return subject data for this address.'
    return NextResponse.json({
      error: 'provider_lookup_failed',
      message: providerReason,
      dataWarnings: property.providerWarnings,
      providerWarnings: property.providerWarnings,
      providerTrace: property.providerTrace,
    }, { status: 502 })
  }

  if (!property.sqft && !normalizedManualSqft) {
    return NextResponse.json({
      error: 'manual_sqft_required',
      needsManualSqft: true,
      dataWarnings: getMissingSqftWarnings(property),
      subjectData: {
        detailsStatus: property.subjectDetailsStatus,
        sqftSource: property.sqftSource,
        isStubData: property.isStubData,
        provider: property.subjectProvider,
      },
    }, { status: 422 })
  }

  const effectiveSqft = normalizedManualSqft ?? property.sqft!
  const manualSqftReason = getManualSqftReason(property, normalizedManualSqft)
  const isCookCounty = county ? county === 'Cook County' : property.county === 'Cook'
  const propertyTaxRate = isCookCounty ? (cfg.cook_county_tax_rate ?? 0.022) : STATE_TAX_RATES[property.state?.toUpperCase()] ?? (cfg.property_tax_rate ?? 0.015)

  const compsDetails = calculateCompsArvDetails(property.comps, property.lat, property.lng, effectiveSqft, property.bedrooms, compsUplift[condition])
  const sqftVerificationIssue = !normalizedManualSqft
    ? getSqftVerificationIssue(property, effectiveSqft, compsDetails?.filteredComps ?? null)
    : null
  if (sqftVerificationIssue) {
    return NextResponse.json({
      error: 'manual_sqft_required',
      needsManualSqft: true,
      suggestedSqft: sqftVerificationIssue.suggestedSqft,
      dataWarnings: [sqftVerificationIssue.warning],
      subjectData: {
        detailsStatus: property.subjectDetailsStatus,
        sqftSource: property.sqftSource,
        isStubData: property.isStubData,
        provider: property.subjectProvider,
        suggestedSqft: sqftVerificationIssue.suggestedSqft,
      },
    }, { status: 422 })
  }
  const subjectData = buildSubjectDataProvenance(property, normalizedManualSqft, effectiveSqft, manualSqftReason)

  const providerAvm = property.valueEstimate ? Math.round(property.valueEstimate * compsUplift[condition]) : null
  const roughArvEstimate = Math.round(numericPrice * arvMultipliers[condition])
  const arv = compsDetails?.arv ?? providerAvm ?? roughArvEstimate
  const arvMethod: AnalyzeResponse['arvMethod'] = compsDetails ? 'comps_based' : providerAvm ? 'provider_avm' : 'rough_estimate'
  const arvConfidence: AnalyzeResponse['arvConfidence'] = compsDetails?.confidence ?? property.valueEstimateConfidence ?? 'low'
  const arvRange = compsDetails?.range ?? (property.valueEstimateRange ? {
    low: Math.round(property.valueEstimateRange.low * compsUplift[condition]),
    high: Math.round(property.valueEstimateRange.high * compsUplift[condition]),
  } : null)
  const compsUsed = compsDetails?.filteredComps.slice(0, 6) ?? []
  const arvProvider = compsDetails ? getProviderLabel(property.compsProvider) : providerAvm ? getProviderLabel(property.valueProvider) : null
  const arvExplainer = compsDetails
    ? `${compsDetails.explainer} from ${getProviderLabel(property.compsProvider)} comparables.`
    : providerAvm
    ? `${getProviderLabel(property.valueProvider)} AVM was used because no sold comps met the current filters.`
    : 'No provider comps or AVM were available, so ClearPath used a rough purchase-price multiplier estimate.'

  let insuranceMonthly = insuranceOverride ?? 0
  if (!insuranceMonthly) insuranceMonthly = Math.max(75, Math.round((arv * 0.005) / 12))

  const METRO_REHAB_MULT: Record<string, number> = {
    'san francisco': 1.75, 'san jose': 1.65, 'new york': 1.65, 'manhattan': 1.65, 'brooklyn': 1.6, boston: 1.55, seattle: 1.5, washington: 1.45, honolulu: 1.6,
    'los angeles': 1.4, 'san diego': 1.35, portland: 1.3, denver: 1.25, miami: 1.25, austin: 1.2, minneapolis: 1.15, chicago: 1.15, nashville: 1.15, dallas: 1.1, houston: 1.1, phoenix: 1.1, atlanta: 1.08, charlotte: 1.08, raleigh: 1.08,
    detroit: 0.88, cleveland: 0.88, buffalo: 0.9, memphis: 0.87, 'st. louis': 0.9, 'kansas city': 0.92, indianapolis: 0.92, columbus: 0.93, louisville: 0.92, 'oklahoma city': 0.9, jacksonville: 0.93, 'san antonio': 0.93,
  }
  const metroMult = Object.entries(METRO_REHAB_MULT).find(([k]) => property.city.toLowerCase().includes(k))?.[1] ?? 1
  const [lowRate, highRate] = rehabRanges[condition]
  const rehabLowBase = Math.round(effectiveSqft * lowRate * metroMult)
  const rehabHighBase = Math.round(effectiveSqft * highRate * metroMult)
  let rehabBase = Math.round((rehabLowBase + rehabHighBase) / 2)
  if (property.yearBuilt < 1970) rehabBase = Math.round(rehabBase * 1.15)
  else if (property.yearBuilt < 1990) rehabBase = Math.round(rehabBase * 1.07)
  const rehabEstimate = Math.round(rehabBase * (1 + (units - 1) * 0.65))
  const rehabLow = Math.round(rehabLowBase * (1 + (units - 1) * 0.65))
  const rehabHigh = Math.round(rehabHighBase * (1 + (units - 1) * 0.65))

  const nearbyListingRent = medianRent(property.nearbyRents)
  const providerRent = property.rentEstimate
  const rentPerUnit = rentOverride ? Math.round(rentOverride) : nearbyListingRent ?? providerRent ?? Math.round(arv * rentRatio)
  const rentEstimate = rentPerUnit * units
  const rentSource: AnalyzeResponse['rentSource'] = rentOverride ? 'manual' : nearbyListingRent ? 'nearby_listings' : providerRent ? 'provider_estimate' : 'formula'
  const rentProvider = rentSource === 'provider_estimate' || rentSource === 'nearby_listings' ? getProviderLabel(property.rentProvider) : null
  const rentExplainer = rentSource === 'manual'
    ? `Rent uses your manual override of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(rentPerUnit)} per unit.`
    : rentSource === 'nearby_listings'
    ? `${property.nearbyRents.length} nearby rental listing${property.nearbyRents.length === 1 ? '' : 's'} from ${rentProvider ?? 'the provider'} informed the rent estimate.`
    : rentSource === 'provider_estimate'
    ? `${rentProvider ?? 'The provider'} rent estimate was used because there were no nearby rental listings.`
    : 'No provider rental data was available, so rent uses a formula estimate based on ARV.'

  const loanAmount = numericPrice * (1 - downPct)
  const monthlyRate = interestRate / 12
  const numPayments = loanTermYears * 12
  const mortgage = Math.round(loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1))
  const vacancy = Math.round(rentEstimate * vacancyRate)
  const mgmt = Math.round(rentEstimate * mgmtRate)
  const maintenance = Math.round(rentEstimate * maintenanceRate)
  const capex = Math.round(rentEstimate * capexRate)
  const taxes = Math.round((arv * propertyTaxRate) / 12)
  const scaledInsurance = Math.round(insuranceMonthly * units)
  const monthlyCashFlow = Math.round(rentEstimate - mortgage - vacancy - mgmt - maintenance - capex - scaledInsurance - taxes)
  const totalCashIn = numericPrice * downPct + numericPrice * closingBuyPct + rehabEstimate
  const cashOnCash = Math.round((monthlyCashFlow * 12 / totalCashIn) * 1000) / 10
  const sellingCosts = arv * closingSellPct
  const holdingCosts = numericPrice * holdCostPct * hold
  const flipProfit = Math.round(arv - numericPrice - rehabEstimate - sellingCosts - holdingCosts)
  const flipROI = Math.round((flipProfit / (numericPrice + rehabEstimate)) * 1000) / 10
  const mao = Math.round(arv * maoMultiplier - rehabEstimate)

  const rentalSignal: 'green' | 'yellow' | 'red' = monthlyCashFlow >= signalCashFlowGreen ? 'green' : monthlyCashFlow < signalCashFlowRed ? 'red' : 'yellow'
  const flipSignal: 'green' | 'yellow' | 'red' = flipProfit >= signalFlipGreen ? 'green' : flipProfit < signalFlipRed ? 'red' : 'yellow'
  const signal: 'green' | 'yellow' | 'red' = rentalSignal === 'green' && flipSignal === 'green' ? 'green' : rentalSignal === 'red' || flipSignal === 'red' ? 'red' : 'yellow'

  const results: AnalysisResults = { arv, rehabLow, rehabHigh, rehabEstimate, rentEstimate, rentPerUnit, units, monthlyCashFlow, cashOnCash, flipProfit, flipROI, mao, signal, rentalSignal, flipSignal, isCookCounty }
  const breakdown: AnalysisBreakdown = {
    purchasePrice: numericPrice,
    rehabMidpoint: rehabEstimate,
    holdingCosts: Math.round(holdingCosts),
    sellingCosts: Math.round(sellingCosts),
    mortgage,
    vacancy,
    mgmt,
    maintenance,
    capex,
    insurance: insuranceMonthly,
    taxes,
    downPayment: Math.round(numericPrice * downPct),
    closingCostsBuy: Math.round(numericPrice * closingBuyPct),
  }

  const conditionKeys = ['cosmetic', 'light', 'medium', 'heavy', 'gut'] as const
  const alternatives: AlternativeCondition[] = conditionKeys.map(cond => {
    const altCompsDetails = calculateCompsArvDetails(property.comps, property.lat, property.lng, effectiveSqft, property.bedrooms, compsUplift[cond])
    const altProviderAvm = property.valueEstimate ? Math.round(property.valueEstimate * compsUplift[cond]) : null
    const altArv = altCompsDetails?.arv ?? altProviderAvm ?? Math.round(numericPrice * arvMultipliers[cond])
    const [altLowRate, altHighRate] = rehabRanges[cond]
    let altRehabBase = Math.round((effectiveSqft * altLowRate + effectiveSqft * altHighRate) / 2)
    if (property.yearBuilt < 1970) altRehabBase = Math.round(altRehabBase * 1.15)
    else if (property.yearBuilt < 1990) altRehabBase = Math.round(altRehabBase * 1.07)
    const altRehab = Math.round(altRehabBase * (1 + (units - 1) * 0.65))
    const altRentPerUnit = rentOverride ? Math.round(rentOverride) : nearbyListingRent ?? providerRent ?? Math.round(altArv * rentRatio)
    const altRent = altRentPerUnit * units
    const altFlipProfit = Math.round(altArv - numericPrice - altRehab - altArv * closingSellPct - numericPrice * holdCostPct * hold)
    const altCashFlow = Math.round(altRent - mortgage - Math.round(altRent * vacancyRate) - Math.round(altRent * mgmtRate) - Math.round(altRent * maintenanceRate) - Math.round(altRent * capexRate) - Math.round(insuranceMonthly * units) - Math.round((altArv * propertyTaxRate) / 12))
    return {
      condition: cond,
      arv: altArv,
      rehabMidpoint: altRehab,
      flipProfit: altFlipProfit,
      monthlyCashFlow: altCashFlow,
      flipSignal: altFlipProfit >= signalFlipGreen ? 'green' : altFlipProfit < signalFlipRed ? 'red' : 'yellow',
      rentalSignal: altCashFlow >= signalCashFlowGreen ? 'green' : altCashFlow < signalCashFlowRed ? 'red' : 'yellow',
    }
  })

  const userId = authUser.id

  const dataWarnings = [...property.providerWarnings]
  if (normalizedManualSqft) dataWarnings.push(
    manualSqftReason === 'unverified'
      ? `Square footage was entered manually (${effectiveSqft.toLocaleString()} sq ft) because the provider sqft looked unreliable against nearby comps.`
      : `Square footage was entered manually (${effectiveSqft.toLocaleString()} sq ft) because subject details were incomplete.`
  )
  if (arvMethod === 'rough_estimate') dataWarnings.push('ARV is a rough estimate because provider comps and AVM were unavailable. Treat flip profit and MAO as directional only.')
  if (rentSource === 'formula') dataWarnings.push('Rent is formula-based because no provider rent data was available. Verify local rents before underwriting.')

  const propertyId = await upsertPropertyRecord(address, property, isCookCounty)

  const analysisPayload = {
    address,
    price: numericPrice,
    condition,
    downPaymentPct: downPct,
    holdMonths: hold,
    interestRate,
    rentOverride,
    insuranceOverride,
    units,
    manualSqft: normalizedManualSqft,
    property: {
      sqft: property.sqft,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      yearBuilt: property.yearBuilt,
      propertyType: property.propertyType,
      city: property.city,
      county: property.county,
      state: property.state,
      zip: property.zip,
      isStubData: property.isStubData,
      subjectDetailsStatus: property.subjectDetailsStatus,
      sqftSource: property.sqftSource,
      providerPropertyId: property.providerPropertyId,
      compsCount: property.comps.length,
      nearbyRentCount: property.nearbyRents.length,
    },
    provenance: {
      subjectData,
      arvMethod,
      arvConfidence,
      arvRange,
      arvProvider,
      arvExplainer,
      rentSource,
      rentProvider,
      rentExplainer,
      providerTrace: property.providerTrace,
      providerWarnings: property.providerWarnings,
      dataWarnings,
    },
    rawProviders: property.rawProviders,
  }

  const { data: analysis, error } = await insertAnalysisWithCompatibility({
    property_id: propertyId,
    input_address: address,
    input_condition: condition,
    input_purchase_price: numericPrice,
    input_down_pct: downPct,
    input_hold_months: hold,
    input_interest_rate: interestRate,
    inputs: analysisPayload,
    arv,
    rehab_low: rehabLow,
    rehab_high: rehabHigh,
    rehab_estimate: rehabEstimate,
    rent_estimate: rentEstimate,
    monthly_mortgage: mortgage,
    monthly_cash_flow: monthlyCashFlow,
    cash_on_cash_return: cashOnCash,
    flip_profit: flipProfit,
    mao,
    results,
    deal_signal_rental: rentalSignal,
    deal_signal_flip: flipSignal,
    deal_signal: signal,
    is_service_area: isCookCounty,
    arv_method: arvMethod,
    rent_method: rentSource,
    comps_used: compsUsed,
    provider_trace: property.providerTrace,
    user_id: userId,
  })

  if (error) {
    console.error('Analysis insert error:', error)
    return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
  }

  // Decrement credits after successful analysis
  void supabaseAdmin
    .from('user_profiles')
    .update({ credits_remaining: Math.max(0, creditsRemaining - 1), updated_at: new Date().toISOString() })
    .eq('id', userId)

  const response: AnalyzeResponse = {
    analysisId: analysis.id,
    results,
    breakdown,
    compsUsed,
    alternatives,
    arvMethod,
    arvConfidence,
    arvRange,
    arvExplainer,
    arvProvider,
    compsCount: compsUsed.length,
    rentSource,
    rentExplainer,
    rentProvider,
    nearbyRentCount: property.nearbyRents.length,
    nearbyRentPrices: property.nearbyRents,
    nearbyRentListings: property.nearbyRentListings,
    interestRate,
    dataWarnings,
    providerWarnings: property.providerWarnings,
    providerTrace: property.providerTrace,
    subjectData,
    subjectLat: property.lat ?? null,
    subjectLng: property.lng ?? null,
  }

  return NextResponse.json(response)
}
