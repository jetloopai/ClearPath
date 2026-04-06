import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { fetchPropertyData, calculateCompsARV, haversineKm, medianRent } from '@/lib/propertyData'
import type { AnalysisResults } from '@/lib/calculations'
import type { CompListing } from '@/lib/propertyData'

export interface AnalysisBreakdown {
  // Flip cost stack
  purchasePrice: number
  rehabMidpoint: number
  holdingCosts: number
  sellingCosts: number
  // Rental P&L line items
  mortgage: number
  vacancy: number
  mgmt: number
  maintenance: number
  capex: number
  insurance: number
  taxes: number
  // Cash-in summary
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

export interface AnalyzeResponse {
  analysisId: string
  results: AnalysisResults
  breakdown: AnalysisBreakdown
  compsUsed: (CompListing & { distanceMiles: number })[]
  alternatives: AlternativeCondition[]
  arvMethod: 'comps_based' | 'price_multiplier'
  compsCount: number
  rentSource: 'zillow_nearby' | 'formula'
  nearbyRentCount: number
  nearbyRentPrices: number[]
  nearbyRentListings: { price: number; url: string }[]
  interestRate: number
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    address, price, condition, county,
    units: unitsRaw,
    downPaymentPct, holdMonths,
    // User overrides from advanced section
    interestRateOverride,   // e.g. 0.085 for 8.5%
    rentOverride,           // monthly dollar amount, or null for auto
    insuranceOverride,      // monthly dollar amount, or null for auto
  } = body
  const units: number = Math.max(1, Math.min(4, Number(unitsRaw) || 1))

  if (!address || !price || !condition) {
    return NextResponse.json({ error: 'address, price, and condition are required' }, { status: 400 })
  }

  // Pull constants from system_defaults
  const { data: defaults } = await supabaseAdmin.from('system_defaults').select('key, value')
  const cfg: Record<string, number> = {}
  for (const row of defaults ?? []) cfg[row.key] = Number(row.value)

  const loanTermYears    = cfg.loan_term_years          ?? 30
  const vacancyRate      = cfg.vacancy_rate             ?? 0.08
  const mgmtRate         = cfg.mgmt_rate                ?? 0.10
  const maintenanceRate  = cfg.maintenance_rate         ?? 0.06
  const capexRate        = cfg.capex_rate               ?? 0.05
  const closingBuyPct    = cfg.closing_cost_buy_pct     ?? 0.02
  const closingSellPct   = cfg.closing_cost_sell_pct    ?? 0.08
  const holdCostPct      = cfg.holding_cost_monthly_pct ?? 0.01
  const maoMultiplier    = cfg.mao_arv_multiplier       ?? 0.70
  const rentRatio        = cfg.default_rent_ratio       ?? 0.009
  const downPct          = downPaymentPct ?? cfg.down_payment_pct ?? 0.25
  const hold             = holdMonths     ?? cfg.hold_months      ?? 6

  // User overrides take priority; fall back to system_defaults
  const interestRate     = interestRateOverride ?? cfg.interest_rate ?? 0.075
  const insuranceMonthly = insuranceOverride    ?? cfg.insurance_monthly ?? 100

  const rehabRanges: Record<string, [number, number]> = {
    cosmetic: [cfg.rehab_cosmetic_low ?? 10,  cfg.rehab_cosmetic_high ?? 20],
    light:    [cfg.rehab_light_low    ?? 20,  cfg.rehab_light_high    ?? 35],
    medium:   [cfg.rehab_medium_low   ?? 35,  cfg.rehab_medium_high   ?? 55],
    heavy:    [cfg.rehab_heavy_low    ?? 55,  cfg.rehab_heavy_high    ?? 85],
    gut:      [cfg.rehab_gut_low      ?? 85,  cfg.rehab_gut_high      ?? 150],
  }
  const arvMultipliers: Record<string, number> = {
    cosmetic: 1.20, light: 1.30, medium: 1.45, heavy: 1.60, gut: 1.80,
  }
  const compsUplift: Record<string, number> = {
    cosmetic: 1.05, light: 1.08, medium: 1.12, heavy: 1.18, gut: 1.25,
  }
  const signalCashFlowGreen = cfg.signal_cashflow_green ?? 300
  const signalCashFlowRed   = cfg.signal_cashflow_red   ?? 0
  const signalFlipGreen     = cfg.signal_flip_green     ?? 30000
  const signalFlipRed       = cfg.signal_flip_red       ?? 10000

  // ── Fetch property + comps + rental data ────────────────────────────────────
  const property = await fetchPropertyData(address)
  const sqft = property.sqft

  // ── Cook County tax rate (higher than national average) ──────────────────────
  const isCookCounty = county ? county === 'Cook County' : property.county === 'Cook'
  const propertyTaxRate = isCookCounty
    ? (cfg.cook_county_tax_rate ?? 0.022)
    : (cfg.property_tax_rate ?? 0.015)

  // ── ARV ──────────────────────────────────────────────────────────────────────
  const compsArv = calculateCompsARV(
    property.comps, property.lat, property.lng,
    sqft, property.bedrooms, compsUplift[condition]
  )
  const arv = compsArv ?? Math.round(price * arvMultipliers[condition])
  const arvMethod = compsArv ? 'comps_based' : 'price_multiplier'

  // ── Rehab ─────────────────────────────────────────────────────────────────────
  const [lowRate, highRate] = rehabRanges[condition]
  const rehabLowBase  = Math.round(sqft * lowRate)
  const rehabHighBase = Math.round(sqft * highRate)
  let rehabBase = Math.round((rehabLowBase + rehabHighBase) / 2)
  if (property.yearBuilt < 1970)      rehabBase = Math.round(rehabBase * 1.15)
  else if (property.yearBuilt < 1990) rehabBase = Math.round(rehabBase * 1.07)
  // Scale rehab for multi-unit: each additional unit adds ~65% of base cost
  const rehabEstimate = Math.round(rehabBase * (1 + (units - 1) * 0.65))
  const rehabLow  = Math.round(rehabLowBase  * (1 + (units - 1) * 0.65))
  const rehabHigh = Math.round(rehabHighBase * (1 + (units - 1) * 0.65))

  // ── Rent estimate — actual nearby listings take priority ───────────────────
  // For multi-unit: per-unit rent × number of units
  const zillowRent = medianRent(property.nearbyRents)
  const rentPerUnit = rentOverride
    ? Math.round(rentOverride)
    : zillowRent ?? Math.round(arv * rentRatio)
  const rentEstimate = rentPerUnit * units
  const rentSource: 'zillow_nearby' | 'formula' = rentOverride
    ? 'zillow_nearby'   // user override — we call it "known" but label isn't visible in UI
    : zillowRent ? 'zillow_nearby' : 'formula'

  // ── Mortgage + Expenses ───────────────────────────────────────────────────────
  const loanAmount   = price * (1 - downPct)
  const monthlyRate  = interestRate / 12
  const numPayments  = loanTermYears * 12
  const mortgage     = Math.round(
    loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  )
  const vacancy     = Math.round(rentEstimate * vacancyRate)
  const mgmt        = Math.round(rentEstimate * mgmtRate)
  const maintenance = Math.round(rentEstimate * maintenanceRate)
  const capex       = Math.round(rentEstimate * capexRate)
  const taxes       = Math.round((arv * propertyTaxRate) / 12)
  const scaledInsurance = Math.round(insuranceMonthly * units)
  const totalExpenses = vacancy + mgmt + maintenance + capex + scaledInsurance + taxes
  const monthlyCashFlow = Math.round(rentEstimate - mortgage - totalExpenses)
  const totalCashIn     = price * downPct + price * closingBuyPct + rehabEstimate
  const cashOnCash      = Math.round((monthlyCashFlow * 12 / totalCashIn) * 1000) / 10

  // ── Flip ──────────────────────────────────────────────────────────────────────
  const sellingCosts = arv * closingSellPct
  const holdingCosts = price * holdCostPct * hold
  const flipProfit   = Math.round(arv - price - rehabEstimate - sellingCosts - holdingCosts)
  const flipROI      = Math.round((flipProfit / (price + rehabEstimate)) * 1000) / 10
  const mao          = Math.round(arv * maoMultiplier - rehabEstimate)

  // ── Signals ───────────────────────────────────────────────────────────────────
  let rentalSignal: 'green' | 'yellow' | 'red' = 'yellow'
  if (monthlyCashFlow >= signalCashFlowGreen) rentalSignal = 'green'
  else if (monthlyCashFlow < signalCashFlowRed) rentalSignal = 'red'

  let flipSignal: 'green' | 'yellow' | 'red' = 'yellow'
  if (flipProfit >= signalFlipGreen) flipSignal = 'green'
  else if (flipProfit < signalFlipRed) flipSignal = 'red'

  const signal: 'green' | 'yellow' | 'red' =
    rentalSignal === 'green' && flipSignal === 'green' ? 'green'
    : rentalSignal === 'red' || flipSignal === 'red' ? 'red' : 'yellow'

  const results: AnalysisResults = {
    arv, rehabLow, rehabHigh, rehabEstimate, rentEstimate,
    rentPerUnit, units,
    monthlyCashFlow, cashOnCash, flipProfit, flipROI, mao,
    signal, rentalSignal, flipSignal, isCookCounty,
  }

  // ── Breakdown (line items for UI) ─────────────────────────────────────────────
  const breakdown: AnalysisBreakdown = {
    purchasePrice:   price,
    rehabMidpoint:   rehabEstimate,
    holdingCosts:    Math.round(holdingCosts),
    sellingCosts:    Math.round(sellingCosts),
    mortgage,
    vacancy,
    mgmt,
    maintenance,
    capex,
    insurance:       insuranceMonthly,
    taxes,
    downPayment:     Math.round(price * downPct),
    closingCostsBuy: Math.round(price * closingBuyPct),
  }

  // ── Comps used (nearest 6 with coordinates) ───────────────────────────────────
  const KM_PER_MILE = 1.60934
  const MAX_AGE_6MO = 180 * 24 * 60 * 60 * 1000
  const MAX_AGE_1YR = 365 * 24 * 60 * 60 * 1000
  const now = Date.now()
  let validPropertyComps = property.comps.filter(comp => !comp.date_sold || (now - comp.date_sold) <= MAX_AGE_6MO)
  if (validPropertyComps.length < 3) {
    validPropertyComps = property.comps.filter(comp => !comp.date_sold || (now - comp.date_sold) <= MAX_AGE_1YR)
  }

  const compsUsed = property.lat && property.lng
    ? validPropertyComps
        .filter(c => c.latitude && c.longitude)
        .map(c => ({
          ...c,
          distanceMiles: haversineKm(property.lat!, property.lng!, c.latitude!, c.longitude!) / KM_PER_MILE,
        }))
        .sort((a, b) => a.distanceMiles - b.distanceMiles)
        .slice(0, 6)
    : []

  // ── Alternatives for each condition ───────────────────────────────────────────
  const conditionKeys = ['cosmetic', 'light', 'medium', 'heavy', 'gut'] as const
  const alternatives: AlternativeCondition[] = conditionKeys.map(cond => {
    const cAlt = calculateCompsARV(
      property.comps, property.lat, property.lng,
      sqft, property.bedrooms, compsUplift[cond]
    )
    const cArv = cAlt ?? Math.round(price * arvMultipliers[cond])

    const [lr, hr] = rehabRanges[cond]
    let cRehabBase = Math.round((sqft * lr + sqft * hr) / 2)
    if (property.yearBuilt < 1970)      cRehabBase = Math.round(cRehabBase * 1.15)
    else if (property.yearBuilt < 1990) cRehabBase = Math.round(cRehabBase * 1.07)
    const cRehab = Math.round(cRehabBase * (1 + (units - 1) * 0.65))

    const cTaxRate = isCookCounty ? (cfg.cook_county_tax_rate ?? 0.022) : (cfg.property_tax_rate ?? 0.015)
    const cFlipProfit = Math.round(
      cArv - price - cRehab - cArv * closingSellPct - price * holdCostPct * hold
    )
    const cRentPerUnit = rentOverride
      ? Math.round(rentOverride)
      : zillowRent ?? Math.round(cArv * rentRatio)
    const cRent = cRentPerUnit * units
    const cCashFlow = Math.round(
      cRent - mortgage
      - Math.round(cRent * vacancyRate)
      - Math.round(cRent * mgmtRate)
      - Math.round(cRent * maintenanceRate)
      - Math.round(cRent * capexRate)
      - Math.round(insuranceMonthly * units)
      - Math.round((cArv * cTaxRate) / 12)
    )

    return {
      condition: cond,
      arv: cArv,
      rehabMidpoint: cRehab,
      flipProfit: cFlipProfit,
      monthlyCashFlow: cCashFlow,
      flipSignal:   cFlipProfit >= signalFlipGreen ? 'green' : cFlipProfit < signalFlipRed ? 'red' : 'yellow',
      rentalSignal: cCashFlow >= signalCashFlowGreen ? 'green' : cCashFlow < signalCashFlowRed ? 'red' : 'yellow',
    }
  })

  // ── Save to Supabase ──────────────────────────────────────────────────────────
  const { data: analysis, error } = await supabaseAdmin
    .from('analyses')
    .insert({
      input_address: address, input_condition: condition, input_purchase_price: price,
      input_down_pct: downPct, input_hold_months: hold, input_interest_rate: interestRate,
      inputs: { address, price, condition, downPaymentPct: downPct, holdMonths: hold,
                interestRate, rentOverride, insuranceOverride, units,
                property: { ...property, comps: property.comps.length, nearbyRents: property.nearbyRents.length } },
      arv, rehab_low: rehabLow, rehab_high: rehabHigh, rehab_estimate: rehabEstimate,
      rent_estimate: rentEstimate, monthly_mortgage: mortgage, monthly_cash_flow: monthlyCashFlow,
      cash_on_cash_return: cashOnCash, flip_profit: flipProfit, mao,
      results, deal_signal_rental: rentalSignal, deal_signal_flip: flipSignal,
      deal_signal: signal, is_service_area: isCookCounty, arv_method: arvMethod,
    })
    .select('id').single()

  if (error) {
    console.error('Analysis insert error:', error)
    return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 })
  }

  const response: AnalyzeResponse = {
    analysisId: analysis.id,
    results,
    breakdown,
    compsUsed,
    alternatives,
    arvMethod,
    compsCount: property.comps.length,
    rentSource,
    nearbyRentCount: property.nearbyRents.length,
    nearbyRentPrices: property.nearbyRents,
    nearbyRentListings: property.nearbyRentListings,
    interestRate,
  }

  return NextResponse.json(response)
}
