import { NextRequest, NextResponse } from 'next/server'

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

const signal = (s: string, label: string) => {
  const icon = s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : '🔴'
  return `${icon} ${label}`
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

// ── Shared CSS ────────────────────────────────────────────────────────────────
const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    margin: 0;
    size: Letter;
    /* Suppress browser-injected URL, date, and page number */
    @top-left { content: none; }
    @top-center { content: none; }
    @top-right { content: none; }
    @bottom-left { content: none; }
    @bottom-center { content: none; }
    @bottom-right { content: none; }
  }

  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.6;
    color: #1a1a2e;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Page-break rules ── */
  h2        { page-break-after: avoid; }
  table     { page-break-inside: avoid; }
  tr        { page-break-inside: avoid; }
  .no-break { page-break-inside: avoid; }

  /* Prevent blank trailing page */
  body > *:last-child { margin-bottom: 0 !important; page-break-after: avoid; }

  .header {
    background: #1a1a2e;
    color: white;
    padding: 24px 36px;
    margin-bottom: 24px;
    page-break-after: avoid;
  }

  .header .brand {
    font-size: 9px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #818cf8;
    margin-bottom: 5px;
  }

  .header h1 {
    font-size: 18px;
    font-weight: 700;
    color: #f1f5f9;
    margin-bottom: 4px;
  }

  .header .meta {
    font-size: 9.5px;
    color: #94a3b8;
  }

  body { padding: 0 36px 24px; }

  h2 {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #6366f1;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 5px;
    margin: 20px 0 10px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;
  }

  th {
    text-align: left;
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
    padding: 5px 10px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }

  td {
    padding: 6px 10px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: top;
  }

  td:last-child { text-align: right; font-weight: 600; color: #1e293b; }
  th:last-child { text-align: right; }

  .green  { color: #059669; }
  .red    { color: #dc2626; }
  .amber  { color: #d97706; }

  .highlight-row td { background: #f0f9ff; font-weight: 600; }

  .footer {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 8.5px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
    page-break-inside: avoid;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    page-break-inside: avoid;
  }

  .summary-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px 14px;
    margin-bottom: 18px;
    page-break-inside: avoid;
  }

  .summary-box .val {
    font-size: 20px;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.2;
  }

  .summary-box .lbl {
    font-size: 8.5px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #94a3b8;
    margin-bottom: 3px;
  }

  .note { font-size: 8.5px; color: #94a3b8; margin-top: 5px; font-style: italic; }
`

// ── DEAL SHEET (compact, section-toggleable) ──────────────────────────────────
function buildDealSheet(body: Record<string, unknown>): string {
  const { address, price, condition, results, breakdown, customRehab, arvMethod, compsCount, brrrr, sections } = body as {
    address: string
    price: number
    condition: string
    results: Record<string, number & string>
    breakdown: Record<string, number>
    customRehab: number
    arvMethod: string
    compsCount: number
    brrrr: Record<string, number & string>
    sections: { flip: boolean; buyhold: boolean; brrrr: boolean; mao: boolean }
  }

  const sec = sections ?? { flip: true, buyhold: true, brrrr: true, mao: true }
  const rehab = customRehab ?? results.rehabEstimate
  const flipProfit = Math.round(results.arv - price - rehab - (breakdown?.sellingCosts ?? results.arv * 0.08) - (breakdown?.holdingCosts ?? price * 0.06))
  const mao = Math.round(results.arv * 0.7 - rehab)
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const condLabel = condition.charAt(0).toUpperCase() + condition.slice(1)
  const arvNote = arvMethod === 'comps_based' ? `Comps-based (${compsCount} nearby sales)` : 'Estimated from purchase price'

  const brrrrSig = brrrr?.brrrrSignal as string ?? 'red'
  const brrrrColor = brrrrSig === 'green' ? '#059669' : brrrrSig === 'yellow' ? '#d97706' : '#dc2626'

  return `<style>${BASE_CSS}
    .hero { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:18px; }
    .hero .box { text-align:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px 8px; }
    .hero .box .v { font-size:18px; font-weight:700; color:#1e293b; }
    .hero .box .l { font-size:8px; text-transform:uppercase; letter-spacing:0.12em; color:#94a3b8; margin-top:3px; }
    .brrrr-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:8px 0 12px; }
    .brrrr-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; padding:10px 8px; text-align:center; }
    .brrrr-box.warn { background:#fffbeb; border-color:#fde68a; }
    .brrrr-box.bad { background:#fff1f2; border-color:#fecdd3; }
    .brrrr-box .bv { font-size:15px; font-weight:700; color:#1e293b; }
    .brrrr-box .bl { font-size:8px; text-transform:uppercase; letter-spacing:0.1em; color:#94a3b8; margin-top:2px; }
  </style>

<div class="header">
  <div class="brand">ClearPath Analyzer &nbsp;·&nbsp; Deal Sheet</div>
  <h1>${address}</h1>
  <div class="meta">${today} &nbsp;·&nbsp; ${condLabel} Condition &nbsp;·&nbsp; ${arvNote}</div>
</div>

<div class="hero">
  <div class="box"><div class="v">${fmt(results.arv)}</div><div class="l">After Repair Value</div></div>
  <div class="box"><div class="v ${flipProfit >= 30000 ? 'green' : flipProfit < 10000 ? 'red' : 'amber'}">${flipProfit >= 0 ? '+' : ''}${fmt(flipProfit)}</div><div class="l">Flip Profit</div></div>
  <div class="box"><div class="v ${results.monthlyCashFlow >= 300 ? 'green' : results.monthlyCashFlow < 0 ? 'red' : 'amber'}">${results.monthlyCashFlow >= 0 ? '+' : ''}${fmt(results.monthlyCashFlow)}/mo</div><div class="l">Cash Flow</div></div>
</div>

${sec.mao ? `
<div class="two-col no-break">
  <div>
    <h2>Deal Parameters</h2>
    <table>
      <tr><td>Purchase Price</td><td>${fmt(price)}</td></tr>
      <tr><td>Rehab Estimate</td><td>${fmt(rehab)}</td></tr>
      <tr><td>ARV</td><td>${fmt(results.arv)}</td></tr>
      <tr class="highlight-row"><td><strong>Max Allowable Offer</strong></td><td class="${price <= mao ? 'green' : 'red'}"><strong>${fmt(mao)}</strong></td></tr>
    </table>
    <div class="note">${price <= mao ? `Deal is ${fmt(mao - price)} under MAO ✓` : `Deal is ${fmt(price - mao)} over MAO — negotiate down`}</div>
  </div>` : '<div>'}

  <div>
${sec.flip ? `    <h2>Flip Analysis</h2>
    <table>
      <tr><td>Net Profit</td><td class="${flipProfit >= 30000 ? 'green' : flipProfit < 10000 ? 'red' : 'amber'}">${fmt(flipProfit)}</td></tr>
      <tr><td>Flip ROI</td><td>${Math.round((flipProfit / (price + rehab)) * 1000) / 10}%</td></tr>
      <tr><td>Signal</td><td>${signal(results.flipSignal as string, flipProfit >= 30000 ? 'Strong Flip' : flipProfit >= 10000 ? 'Marginal Flip' : 'Weak Flip')}</td></tr>
    </table>` : ''}

${sec.buyhold ? `    <h2>Buy &amp; Hold</h2>
    <table>
      <tr><td>Rent Estimate</td><td>${fmt(results.rentEstimate)}/mo</td></tr>
      <tr><td>Cash Flow</td><td class="${results.monthlyCashFlow >= 300 ? 'green' : results.monthlyCashFlow < 0 ? 'red' : 'amber'}">${results.monthlyCashFlow >= 0 ? '+' : ''}${fmt(results.monthlyCashFlow)}/mo</td></tr>
      <tr><td>Cash-on-Cash</td><td>${results.cashOnCash}%</td></tr>
      <tr><td>Signal</td><td>${signal(results.rentalSignal as string, results.rentalSignal === 'green' ? 'Strong Rental' : results.rentalSignal === 'yellow' ? 'Marginal Rental' : 'Weak Rental')}</td></tr>
    </table>` : ''}
  </div>
</div>

${sec.brrrr && brrrr ? `
<h2>BRRRR Refinance Analysis</h2>
<div class="brrrr-grid">
  <div class="brrrr-box ${brrrrSig === 'yellow' ? 'warn' : brrrrSig === 'red' ? 'bad' : ''}">
    <div class="bv">${fmt(brrrr.refiLoan)}</div>
    <div class="bl">Refi Loan (${Math.round(brrrr.refiLTV * 100)}% LTV)</div>
  </div>
  <div class="brrrr-box ${brrrrSig === 'yellow' ? 'warn' : brrrrSig === 'red' ? 'bad' : ''}">
    <div class="bv" style="color:${brrrrColor}">${brrrr.cashLeftInDeal <= 0 ? `−${fmt(Math.abs(brrrr.cashLeftInDeal))}` : fmt(brrrr.cashLeftInDeal)}</div>
    <div class="bl">${brrrr.cashLeftInDeal <= 0 ? 'Cash Pulled Out' : 'Cash Left In Deal'}</div>
  </div>
  <div class="brrrr-box ${brrrr.postRefiCashFlow >= 200 ? '' : brrrr.postRefiCashFlow >= 0 ? 'warn' : 'bad'}">
    <div class="bv ${brrrr.postRefiCashFlow >= 200 ? 'green' : brrrr.postRefiCashFlow >= 0 ? 'amber' : 'red'}">${brrrr.postRefiCashFlow >= 0 ? '+' : ''}${fmt(brrrr.postRefiCashFlow)}/mo</div>
    <div class="bl">Post-Refi Cash Flow</div>
  </div>
</div>
<table>
  <tr><td>All-In Cost</td><td>${fmt(brrrr.allInCost)}</td></tr>
  <tr><td>Refi Mortgage</td><td>− ${fmt(brrrr.refiMortgage)}/mo</td></tr>
  <tr><td>DSCR</td><td class="${brrrr.dscr >= 1.25 ? 'green' : brrrr.dscr >= 1.0 ? 'amber' : 'red'}">${Number(brrrr.dscr).toFixed(2)} ${brrrr.dscr >= 1.25 ? '✓ Lender Ready' : brrrr.dscr >= 1.0 ? '⚠ Borderline' : '✗ Negative Coverage'}</td></tr>
  <tr class="highlight-row"><td><strong>${brrrr.cashLeftInDeal <= 0 ? '✓ Full BRRRR — All cash recycled' : `${Math.round((1 - brrrr.cashLeftInDeal / brrrr.allInCost) * 100)}% of capital recovered`}</strong></td><td class="${brrrrSig === 'green' ? 'green' : brrrrSig === 'yellow' ? 'amber' : 'red'}"><strong>${brrrrSig === 'green' ? 'Perfect BRRRR' : brrrrSig === 'yellow' ? 'Strong BRRRR' : 'Partial BRRRR'}</strong></td></tr>
</table>` : ''}

<div class="footer">
  <span>Generated by ClearPath Analyzer &nbsp;·&nbsp; clearpathassetgroup.com</span>
  <span>Estimates are for educational purposes only. Not financial advice.</span>
</div>`
}

// ── FULL REPORT markdown ──────────────────────────────────────────────────────
function buildFullReport(body: Record<string, unknown>): string {
  const { address, price, condition, results, breakdown, compsUsed, alternatives, customRehab, arvMethod, compsCount } = body as {
    address: string
    price: number
    condition: string
    results: Record<string, unknown>
    breakdown: Record<string, number>
    compsUsed: Array<Record<string, unknown>>
    alternatives: Array<Record<string, unknown>>
    customRehab: number
    arvMethod: string
    compsCount: number
  }

  const r = results as Record<string, number & string>
  const rehab = customRehab ?? r.rehabEstimate
  const flipProfit = Math.round(r.arv - price - rehab - (breakdown?.sellingCosts ?? r.arv * 0.08) - (breakdown?.holdingCosts ?? price * 0.06))
  const mao = Math.round(r.arv * 0.7 - rehab)
  const flipROI = Math.round((flipProfit / (price + rehab)) * 1000) / 10
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const condLabel = condition.charAt(0).toUpperCase() + condition.slice(1)
  const arvNote = arvMethod === 'comps_based' ? `Comps-based ARV (${compsCount} nearby sales)` : 'Estimated from purchase price'

  const flipLabel = flipProfit >= 30000 ? 'Strong Flip' : flipProfit >= 10000 ? 'Marginal Flip' : 'Weak Flip'
  const rentalLabel = r.rentalSignal === 'green' ? 'Strong Rental' : r.rentalSignal === 'yellow' ? 'Marginal Rental' : 'Weak Rental'

  const compsSection = compsUsed && compsUsed.length > 0 ? `
<h2>Comparable Sales Used for ARV</h2>
<table>
  <tr><th>Distance</th><th>Price</th><th>SqFt</th><th>Beds</th><th>$/SqFt</th></tr>
  ${compsUsed.map((c: Record<string, unknown>) => {
    const ppsf = (c.living_area_sqft as number) > 0 ? Math.round((c.price as number) / (c.living_area_sqft as number)) : 0
    return `<tr>
      <td>${((c.distanceMiles as number) ?? 0).toFixed(2)} mi</td>
      <td>${fmt(c.price as number)}</td>
      <td>${(c.living_area_sqft as number).toLocaleString()}</td>
      <td>${c.bedrooms}</td>
      <td>$${ppsf}</td>
    </tr>`
  }).join('')}
</table>
<div class="note">ARV = subject sqft × median $/sqft × ${condLabel} condition uplift</div>` : ''

  const altSection = alternatives && alternatives.length > 0 ? `
<h2>Scenario Analysis — All Conditions</h2>
<table>
  <tr><th>Condition</th><th>ARV</th><th>Rehab</th><th>Flip Profit</th><th>Cash Flow</th><th>Signals</th></tr>
  ${alternatives.map((a: Record<string, unknown>) => {
    const selected = a.condition === condition
    return `<tr${selected ? ' class="highlight-row"' : ''}>
      <td>${String(a.condition).charAt(0).toUpperCase() + String(a.condition).slice(1)}${selected ? ' ★' : ''}</td>
      <td>${fmt(a.arv as number)}</td>
      <td>${fmt(a.rehabMidpoint as number)}</td>
      <td class="${(a.flipSignal as string) === 'green' ? 'green' : (a.flipSignal as string) === 'red' ? 'red' : 'amber'}">${(a.flipProfit as number) >= 0 ? '+' : ''}${fmt(a.flipProfit as number)}</td>
      <td class="${(a.rentalSignal as string) === 'green' ? 'green' : (a.rentalSignal as string) === 'red' ? 'red' : 'amber'}">${(a.monthlyCashFlow as number) >= 0 ? '+' : ''}${fmt(a.monthlyCashFlow as number)}/mo</td>
      <td>${signal(a.flipSignal as string, '')} ${signal(a.rentalSignal as string, '')}</td>
    </tr>`
  }).join('')}
</table>` : ''

  return `<style>${BASE_CSS}</style>

<div class="header">
  <div class="brand">ClearPath Analyzer &nbsp;·&nbsp; Full Deal Report</div>
  <h1>${address}</h1>
  <div class="meta">${today} &nbsp;·&nbsp; ${condLabel} Condition &nbsp;·&nbsp; ${arvNote}</div>
</div>

<div class="two-col">
  <div class="summary-box">
    <div class="lbl">After Repair Value</div>
    <div class="val">${fmt(r.arv)}</div>
  </div>
  <div class="summary-box">
    <div class="lbl">Max Allowable Offer (MAO)</div>
    <div class="val ${price <= mao ? 'green' : 'red'}">${fmt(mao)}</div>
  </div>
</div>

<h2>Property & Deal Parameters</h2>
<table>
  <tr><td>Purchase Price</td><td>${fmt(price)}</td></tr>
  <tr><td>Property Condition</td><td>${condLabel}</td></tr>
  <tr><td>Rehab Estimate</td><td>${fmt(rehab)}${customRehab && customRehab !== r.rehabEstimate ? ` <span style="font-size:9px;color:#d97706">(custom — AI estimate: ${fmt(r.rehabEstimate)})</span>` : ''}</td></tr>
  <tr><td>AI Rehab Range</td><td>${fmt(r.rehabLow)} – ${fmt(r.rehabHigh)}</td></tr>
  <tr><td>ARV Method</td><td>${arvNote}</td></tr>
  <tr class="highlight-row"><td><strong>Maximum Allowable Offer</strong></td><td class="${price <= mao ? 'green' : 'red'}"><strong>${fmt(mao)}</strong></td></tr>
</table>
<div class="note">MAO = ARV × 70% − Rehab. ${price <= mao ? `This deal is ${fmt(mao - price)} under MAO.` : `This deal is ${fmt(price - mao)} over MAO — negotiate down.`}</div>

<div class="two-col">
  <div>
    <h2>Flip Analysis</h2>
    <table>
      <tr><td>ARV</td><td>${fmt(r.arv)}</td></tr>
      <tr><td>Purchase Price</td><td>− ${fmt(price)}</td></tr>
      <tr><td>Rehab</td><td>− ${fmt(rehab)}</td></tr>
      <tr><td>Holding Costs</td><td>− ${fmt(breakdown?.holdingCosts ?? 0)}</td></tr>
      <tr><td>Selling Costs</td><td>− ${fmt(breakdown?.sellingCosts ?? 0)}</td></tr>
      <tr class="highlight-row"><td><strong>Net Flip Profit</strong></td><td class="${flipProfit >= 30000 ? 'green' : flipProfit < 10000 ? 'red' : 'amber'}"><strong>${fmt(flipProfit)}</strong></td></tr>
      <tr><td>Flip ROI</td><td>${flipROI}%</td></tr>
      <tr><td>Signal</td><td>${signal(r.flipSignal, flipLabel)}</td></tr>
    </table>
  </div>
  <div>
    <h2>Buy & Hold Analysis</h2>
    <table>
      <tr><td>Rent Estimate</td><td>${fmt(r.rentEstimate)}/mo</td></tr>
      <tr><td>Mortgage</td><td>− ${fmt(breakdown?.mortgage ?? 0)}/mo</td></tr>
      <tr><td>Vacancy (8%)</td><td>− ${fmt(breakdown?.vacancy ?? 0)}/mo</td></tr>
      <tr><td>Mgmt (10%)</td><td>− ${fmt(breakdown?.mgmt ?? 0)}/mo</td></tr>
      <tr><td>Maintenance (6%)</td><td>− ${fmt(breakdown?.maintenance ?? 0)}/mo</td></tr>
      <tr><td>CapEx (5%)</td><td>− ${fmt(breakdown?.capex ?? 0)}/mo</td></tr>
      <tr><td>Insurance</td><td>− ${fmt(breakdown?.insurance ?? 0)}/mo</td></tr>
      <tr><td>Property Taxes</td><td>− ${fmt(breakdown?.taxes ?? 0)}/mo</td></tr>
      <tr class="highlight-row"><td><strong>Monthly Cash Flow</strong></td><td class="${r.monthlyCashFlow >= 300 ? 'green' : r.monthlyCashFlow < 0 ? 'red' : 'amber'}"><strong>${r.monthlyCashFlow >= 0 ? '+' : ''}${fmt(r.monthlyCashFlow)}/mo</strong></td></tr>
      <tr><td>Cash-on-Cash Return</td><td>${r.cashOnCash}%</td></tr>
      <tr><td>Signal</td><td>${signal(r.rentalSignal, rentalLabel)}</td></tr>
    </table>

    <h2>Total Cash Required</h2>
    <table>
      <tr><td>Down Payment</td><td>${fmt(breakdown?.downPayment ?? 0)}</td></tr>
      <tr><td>Closing Costs</td><td>${fmt(breakdown?.closingCostsBuy ?? 0)}</td></tr>
      <tr><td>Rehab</td><td>${fmt(rehab)}</td></tr>
      <tr class="highlight-row"><td><strong>Total Cash-In</strong></td><td><strong>${fmt((breakdown?.downPayment ?? 0) + (breakdown?.closingCostsBuy ?? 0) + rehab)}</strong></td></tr>
    </table>
  </div>
</div>

${compsSection}

${altSection}

${(() => {
  const b = (body as Record<string, unknown>).brrrr as Record<string, number> | undefined
  if (!b) return ''
  const bSig = (b.brrrrSignal ?? 'red') as unknown as string
  const bColor = bSig === 'green' ? '#059669' : bSig === 'yellow' ? '#d97706' : '#dc2626'
  const allIn = (b.allInCost ?? 0) as number
  const cashLeft = (b.cashLeftInDeal ?? 0) as number
  const pct = allIn > 0 ? Math.round((1 - cashLeft / allIn) * 100) : 0
  return `
<h2>BRRRR Refinance Analysis</h2>
<div class="two-col no-break">
  <div>
    <table>
      <tr><td>All-In Cost</td><td>${fmt(allIn)}</td></tr>
      <tr><td>Refi LTV</td><td>${Math.round((b.refiLTV ?? 0.75) * 100)}%</td></tr>
      <tr><td>Refi Loan Amount</td><td>${fmt(b.refiLoan ?? 0)}</td></tr>
      <tr><td>Refi Mortgage</td><td>− ${fmt(b.refiMortgage ?? 0)}/mo</td></tr>
      <tr class="highlight-row"><td><strong>Cash ${cashLeft <= 0 ? 'Pulled Out' : 'Left in Deal'}</strong></td><td style="color:${bColor}"><strong>${cashLeft <= 0 ? `−${fmt(Math.abs(cashLeft))}` : fmt(cashLeft)}</strong></td></tr>
    </table>
    <div class="note">${cashLeft <= 0 ? '✓ Full BRRRR — all invested capital recovered' : `${pct}% of capital recovered at refi`}</div>
  </div>
  <div>
    <table>
      <tr><td>Post-Refi Cash Flow</td><td class="${(b.postRefiCashFlow ?? 0) >= 200 ? 'green' : (b.postRefiCashFlow ?? 0) >= 0 ? 'amber' : 'red'}">${(b.postRefiCashFlow ?? 0) >= 0 ? '+' : ''}${fmt(b.postRefiCashFlow ?? 0)}/mo</td></tr>
      <tr><td>Post-Refi CoC</td><td>${cashLeft <= 0 ? '∞ (full recycle)' : `${b.postRefiCoC ?? 0}%`}</td></tr>
      <tr><td>DSCR</td><td class="${(b.dscr ?? 0) >= 1.25 ? 'green' : (b.dscr ?? 0) >= 1.0 ? 'amber' : 'red'}">${Number(b.dscr ?? 0).toFixed(2)} — ${(b.dscr ?? 0) >= 1.25 ? 'Lender Ready' : (b.dscr ?? 0) >= 1.0 ? 'Borderline' : 'Negative Coverage'}</td></tr>
      <tr class="highlight-row"><td><strong>BRRRR Signal</strong></td><td style="color:${bColor}"><strong>${bSig === 'green' ? '✓ Perfect BRRRR' : bSig === 'yellow' ? '⚡ Strong BRRRR' : '⚠ Partial BRRRR'}</strong></td></tr>
    </table>
  </div>
</div>`
})()}

<div class="footer">
  <span>Generated by ClearPath Analyzer &nbsp;·&nbsp; clearpathassetgroup.com</span>
  <span>Estimates for educational purposes only. Not financial advice.</span>
</div>`
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    address,
    reportType = 'deal_sheet',
    mode = 'preview',
  } = body as { address: string; reportType: 'deal_sheet' | 'full_report'; mode: 'preview' | 'print' }

  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const innerHtml = reportType === 'full_report' ? buildFullReport(body) : buildDealSheet(body)

  const title = `${reportType === 'full_report' ? 'ClearPath Full Report' : 'ClearPath Deal Sheet'} — ${address}`
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${innerHtml}${
    mode === 'print' ? `<style>
  #print-tip { background:#1a1a2e; color:#94a3b8; font-family:Arial,sans-serif; font-size:11px; padding:10px 16px; text-align:center; }
  #print-tip strong { color:#f1f5f9; }
  @media print { #print-tip { display:none !important; } }
</style>
<div id="print-tip">In the print dialog → <strong>More settings</strong> → uncheck <strong>Headers and footers</strong> for a clean PDF.</div>
<script>
window.onload = function() {
  setTimeout(function() { window.print(); }, 400);
};
<\/script>` : ''
  }</body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
