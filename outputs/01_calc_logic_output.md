# ClearPath Deal Calculation Logic

**Document:** 01 of 10  
**Phase:** MVP  
**Status:** Complete  
**Generated:** 2026-04-04

---

## Overview

The ClearPath Analyzer accepts a property address or Zillow link and returns five core outputs:

| Output | Description |
|---|---|
| **ARV** | After Repair Value — what the property is worth after improvements |
| **Rehab Estimate** | Estimated cost to repair/renovate based on condition |
| **Rent Estimate** | Estimated monthly rent if held as a rental |
| **Cash Flow** | Monthly net income if purchased as a rental |
| **Flip Profit** | Net profit if purchased, rehabbed, and resold |

---

## Inputs

| Variable | Type | Source | Notes |
|---|---|---|---|
| `address` | string | User input | Street address |
| `zillow_url` | string | User input | Optional alternative to address |
| `property_sqft` | number | API / Zillow | Square footage of property |
| `bedrooms` | number | API / Zillow | Bedroom count |
| `bathrooms` | number | API / Zillow | Bathroom count |
| `year_built` | number | API / Zillow | Used for rehab tier logic |
| `condition` | enum | User select | `cosmetic` / `light` / `medium` / `heavy` / `gut` |
| `purchase_price` | number | User input | What they plan to pay |
| `down_payment_pct` | number | User input | Default: 25% |
| `interest_rate` | number | System default | Default: 7.5% |
| `loan_term_years` | number | System default | Default: 30 |
| `hold_months` | number | User input | Flip hold time, default: 6 months |
| `arv_comps` | array | API | List of recent sold prices in area (optional) |

---

## Processing Logic

---

### 1. ARV (After Repair Value)

**Method A — Comp-Based (preferred):**
```
avg_price_per_sqft = SUM(comp.sold_price) / SUM(comp.sqft)  [from last 6 months, within 0.5 miles]
ARV = avg_price_per_sqft × property_sqft
```

**Method B — Zestimate Adjustment (fallback):**
```
ARV = zillow_zestimate × 1.10
```
> Note: Zestimates reflect current as-is value. A 10% premium approximates post-repair value for light-medium rehabs. Adjust multiplier by condition:
> - Cosmetic: × 1.05
> - Light: × 1.10
> - Medium: × 1.18
> - Heavy: × 1.25
> - Gut: × 1.35

**Constraints:**
- If ARV < $50,000 → flag as low-confidence
- If ARV > $1,000,000 → flag for manual review
- Round to nearest $1,000

---

### 2. Rehab Estimate

**Rehab Tiers (cost per square foot):**

| Condition | Description | Cost/SqFt |
|---|---|---|
| `cosmetic` | Paint, carpet, fixtures | $10 – $20 |
| `light` | Cosmetic + kitchen/bath updates | $20 – $35 |
| `medium` | Light + roof, HVAC, systems | $35 – $55 |
| `heavy` | Structural + full interior | $55 – $85 |
| `gut` | Full demolition and rebuild | $85 – $150 |

**Formula:**
```
rehab_cost_low  = property_sqft × tier_low
rehab_cost_high = property_sqft × tier_high
rehab_estimate  = (rehab_cost_low + rehab_cost_high) / 2
```

**Age Adjustment:**
```
if year_built < 1970:
    rehab_estimate = rehab_estimate × 1.15   // older homes need more work
elif year_built < 1990:
    rehab_estimate = rehab_estimate × 1.07
```

**Output:** Display as a range — e.g., `$42,000 – $66,000` — not a single number.

---

### 3. Rent Estimate

**Method A — Rent Ratio (default):**
```
monthly_rent = ARV × rent_to_value_ratio
```

**Rent-to-Value Ratios by neighborhood tier (Chicago):**

| Market Tier | Monthly Ratio |
|---|---|
| Class A (North Side, Lincoln Park, Wicker Park) | 0.6% – 0.8% |
| Class B (Logan Square, Pilsen, Bridgeport) | 0.8% – 1.0% |
| Class C (South Shore, Englewood, Austin) | 1.0% – 1.3% |

> Default to **0.9%** if market tier is unknown.

**Formula:**
```
monthly_rent = ARV × 0.009   // default
```

**Method B — Bedroom-Based (fallback):**

| Bedrooms | Estimated Monthly Rent (Chicago avg) |
|---|---|
| Studio | $1,100 |
| 1 BR | $1,400 |
| 2 BR | $1,800 |
| 3 BR | $2,200 |
| 4 BR | $2,700 |

---

### 4. Cash Flow (Buy & Hold)

**Step 1 — Loan Calculation:**
```
loan_amount = purchase_price × (1 - down_payment_pct)

monthly_rate = interest_rate / 12
n = loan_term_years × 12

monthly_mortgage = loan_amount × (monthly_rate × (1 + monthly_rate)^n)
                                / ((1 + monthly_rate)^n - 1)
```

**Step 2 — Monthly Expense Breakdown:**

| Expense | Rate | Notes |
|---|---|---|
| Vacancy | 8% of rent | Assumes ~1 month/year vacant |
| Property Management | 10% of rent | If using a PM company |
| Maintenance | 6% of rent | Ongoing repairs |
| CapEx Reserve | 5% of rent | Future big-ticket items |
| Insurance | $100/mo | Flat estimate (adjust by property) |
| Property Taxes | Varies | Pull from listing data or use 1.5% of ARV/12 |

```
effective_rent       = monthly_rent × (1 - 0.08)   // after vacancy
property_mgmt        = monthly_rent × 0.10
maintenance          = monthly_rent × 0.06
capex                = monthly_rent × 0.05
insurance            = 100
property_taxes       = (ARV × 0.015) / 12

total_expenses = property_mgmt + maintenance + capex + insurance + property_taxes
net_operating_income = effective_rent - total_expenses
monthly_cash_flow    = net_operating_income - monthly_mortgage
```

**Step 3 — Annual Metrics:**
```
annual_cash_flow       = monthly_cash_flow × 12
cash_on_cash_return    = annual_cash_flow / (purchase_price × down_payment_pct) × 100
```

**Thresholds (display signals):**

| Result | Signal |
|---|---|
| Cash flow > $300/mo | 🟢 Strong deal |
| Cash flow $0–$300/mo | 🟡 Marginal deal |
| Cash flow < $0/mo | 🔴 Negative cash flow |

---

### 5. Flip Profit

**Step 1 — Cost Stack:**
```
purchase_price      = user input
rehab_cost          = rehab_estimate (midpoint)
closing_costs_buy   = purchase_price × 0.02      // title, inspection, etc.
closing_costs_sell  = ARV × 0.08                 // 6% agent + 2% closing
holding_costs       = (purchase_price + rehab_cost) × 0.01 × hold_months
                      // ~1% per month (taxes, insurance, utilities, loan interest)
```

**Step 2 — Profit Calculation:**
```
total_costs  = purchase_price + rehab_cost + closing_costs_buy
               + closing_costs_sell + holding_costs
flip_profit  = ARV - total_costs
ROI          = (flip_profit / total_costs) × 100
```

**MAO (Maximum Allowable Offer):**
```
MAO = (ARV × 0.70) - rehab_cost
```
> The 70% Rule — used to ensure a minimum profit margin is preserved.

**Thresholds:**

| Result | Signal |
|---|---|
| Profit > $30,000 | 🟢 Strong flip |
| Profit $10,000–$30,000 | 🟡 Thin margins |
| Profit < $10,000 or negative | 🔴 Don't do it |

---

## Outputs

| Field | Format | Example |
|---|---|---|
| ARV | `$XXX,XXX` | $185,000 |
| Rehab Estimate | `$XX,XXX – $XX,XXX` | $28,000 – $44,000 |
| Rent Estimate | `$X,XXX/mo` | $1,665/mo |
| Monthly Cash Flow | `+$XXX/mo` or `-$XXX/mo` | +$247/mo |
| Cash-on-Cash Return | `X.X%` | 6.2% |
| Flip Profit | `$XX,XXX` | $34,200 |
| MAO | `$XXX,XXX` | $154,500 |
| Deal Signal | Emoji + label | 🟢 Strong flip |

---

## Flow

```
User Input (address + condition + purchase price)
        ↓
Property Data Pull (Zillow API or manual)
        ↓
ARV Calculation
        ↓
Rehab Estimate
        ↓
Rent Estimate
        ↓
Cash Flow Calculation  ──→  Output: Monthly CF, CoC Return
        ↓
Flip Profit Calculation ──→  Output: Net Profit, MAO
        ↓
Deal Signal (Green / Yellow / Red)
        ↓
Display Results + Email Capture CTA
        ↓
If Chicago deal → Asset Group CTA
```

---

## Edge Cases & Error Handling

| Scenario | Handling |
|---|---|
| No comps available | Fall back to Zestimate method |
| ARV < purchase price | Flag: "Purchase price exceeds ARV — deal at risk" |
| Negative cash flow | Show result in red, display breakeven rent |
| flip_profit < 0 | Show loss, display MAO to show right entry price |
| Missing sq footage | Prompt user to enter manually |
| Non-Chicago address | Suppress Asset Group CTA |

---

## Constants (System Defaults — Adjustable)

```js
const DEFAULTS = {
  down_payment_pct: 0.25,
  interest_rate: 0.075,
  loan_term_years: 30,
  hold_months: 6,
  vacancy_rate: 0.08,
  mgmt_rate: 0.10,
  maintenance_rate: 0.06,
  capex_rate: 0.05,
  insurance_monthly: 100,
  property_tax_annual_rate: 0.015,
  closing_cost_buy_pct: 0.02,
  closing_cost_sell_pct: 0.08,
  holding_cost_monthly_pct: 0.01,
  mao_arv_multiplier: 0.70,
  default_rent_ratio: 0.009,
  zestimate_adjustment: {
    cosmetic: 1.05,
    light: 1.10,
    medium: 1.18,
    heavy: 1.25,
    gut: 1.35
  }
}
```

---

*Next Document → `02_architecture.md` — System Architecture*
