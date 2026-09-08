import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIp } from '@/lib/rateLimit'

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

const signal = (s: string, label: string) => {
  const cls = s === 'green' ? 'badge-green' : s === 'yellow' ? 'badge-amber' : 'badge-red'
  return `<span class="badge ${cls}">${esc(label)}</span>`
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

// Editorial headline + body for the narrative block — a plain-text "diagnosis"
// moment instead of another data table, mirroring the deal-signal narrative logic
// already used client-side in ResultsView.
function buildNarrative(
  condLabel: string, price: number, flipProfit: number, cashFlow: number, mao: number,
  flipSignal: string, rentalSignal: string
): { headline: string; body: string } {
  if (flipSignal === 'green' && rentalSignal === 'green') {
    return {
      headline: 'Works both ways.',
      body: `This ${condLabel}-condition property pencils as a flip and a hold. At ${fmt(price)}, that's ${fmt(flipProfit)} gross flip profit or ${fmt(cashFlow)}/mo if you keep it. Dual-exit flexibility is rare — max offer to protect both is ${fmt(mao)}.`,
    }
  }
  if (flipSignal === 'green') {
    return {
      headline: 'Strong flip, thin rental.',
      body: `At ${fmt(price)}, this projects ${fmt(flipProfit)} in gross flip profit. Rental cash flow is tighter at ${fmt(cashFlow)}/mo, so the flip is the play here. Max offer: ${fmt(mao)}.`,
    }
  }
  if (rentalSignal === 'green') {
    return {
      headline: 'Built for buy-and-hold.',
      body: `At ${fmt(price)} this clears ${fmt(cashFlow)}/mo after all expenses. Flip margin is thin at ${fmt(flipProfit)}, so plan to hold. Max offer: ${fmt(mao)}.`,
    }
  }
  if (flipSignal === 'red' && rentalSignal === 'red') {
    return {
      headline: 'Tight on both exits.',
      body: `At ${fmt(price)}, flip profit is ${fmt(flipProfit)} and cash flow is ${fmt(cashFlow)}/mo. You'd need to negotiate down to ${fmt(mao)} to make either exit work.`,
    }
  }
  return {
    headline: 'Marginal on both exits.',
    body: `At ${fmt(price)}, this ${condLabel}-condition deal has thin returns either way — ${fmt(flipProfit)} flip profit, ${fmt(cashFlow)}/mo cash flow. Moving the price to ${fmt(mao)} improves the math materially.`,
  }
}

// Escape HTML special characters to prevent XSS in report templates
const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

// ── Shared CSS ────────────────────────────────────────────────────────────────
// PandaDoc-style proposal look: full sans-serif (no serif display face), rounded
// shadowed cards instead of hairline tables, a bold cover-page hero, and a
// prominent colored "total" bar — not a law-firm/appraisal letterhead.
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
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    line-height: 1.6;
    color: #1e2333;
    background: #faf7f0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-feature-settings: 'tnum' 1, 'cv11' 1;
  }

  /* Display face for headlines/narrative only — data tables stay on Inter for
     proper tabular numerals. */
  .display { font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; }

  /* ── Page-break rules ── */
  h2        { page-break-after: avoid; }
  table     { page-break-inside: avoid; }
  tr        { page-break-inside: avoid; }
  .no-break { page-break-inside: avoid; }

  /* Prevent blank trailing page */
  body > *:last-child { margin-bottom: 0 !important; page-break-after: avoid; }

  /* ── Cover hero: dark, oversized type, decorative shapes, labeled meta strip ──
     Ink + accent are ClearPath's own tokens (brand-950 / brand-600 / signal-green),
     not the reference's navy+lime. */
  .header {
    position: relative;
    overflow: hidden;
    background: #1e1b4b;
    color: white;
    padding: 34px 40px 0;
    margin-bottom: 28px;
    page-break-after: avoid;
  }

  .header .deco-circle {
    position: absolute;
    top: -70px; right: -60px;
    width: 210px; height: 210px;
    border-radius: 50%;
    background: #4f46e5;
    opacity: 0.9;
  }

  .header .deco-ring {
    position: absolute;
    bottom: -90px; right: 40px;
    width: 150px; height: 150px;
    border-radius: 50%;
    border: 22px solid #6ee7b7;
    opacity: 0.85;
  }

  .header .brandrow {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 30px;
  }

  .header .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: #ffffff;
  }

  .header .brand .mark {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    background: #6ee7b7;
    display: inline-block;
  }

  .header .doctype {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #1e1b4b;
    background: #6ee7b7;
    border-radius: 100px;
    padding: 5px 13px;
  }

  .header .eyebrow {
    position: relative;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #6ee7b7;
    margin-bottom: 12px;
  }

  .header h1 {
    position: relative;
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 36px;
    font-weight: 800;
    color: #ffffff;
    margin-bottom: 22px;
    letter-spacing: -0.02em;
    line-height: 1.06;
    max-width: 76%;
  }

  .header .metastrip {
    position: relative;
    display: flex;
    gap: 36px;
    padding: 18px 0 22px;
    border-top: 1px solid rgba(255, 255, 255, 0.14);
  }

  .header .metastrip .col .lbl {
    font-size: 8.5px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #a5acc9;
    margin-bottom: 4px;
  }

  .header .metastrip .col .val {
    font-size: 11.5px;
    font-weight: 700;
    color: #ffffff;
  }

  body { padding: 0 32px 32px; }

  h2 {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 19px;
    font-weight: 800;
    letter-spacing: -0.015em;
    color: #1e2333;
    padding-left: 13px;
    border-left: 4px solid #6366f1;
    margin: 32px 0 14px;
  }

  /* ── Editorial narrative block: big headline + paragraph, no card — the
     "diagnosis" moment, not another data table ── */
  .narrative-eyebrow {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #4338ca;
    margin-bottom: 8px;
  }

  .narrative-headline {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 25px;
    font-weight: 800;
    letter-spacing: -0.015em;
    line-height: 1.18;
    color: #1e2333;
    margin-bottom: 10px;
    max-width: 85%;
  }

  .narrative-body {
    font-size: 12.5px;
    color: #5b5f70;
    line-height: 1.65;
    max-width: 92%;
  }

  /* ── Dark "investment" band for the number the whole document builds to ── */
  .mao-band {
    background: #1e1b4b;
    color: #ffffff;
    border-radius: 16px;
    padding: 26px 28px;
    margin: 22px 0;
    page-break-inside: avoid;
  }

  .mao-band .lbl {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #a5acc9;
    margin-bottom: 8px;
  }

  .mao-band .val {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 38px;
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .mao-band .bar {
    width: 44px;
    height: 4px;
    border-radius: 2px;
    background: #6366f1;
    margin: 14px 0 12px;
  }

  .mao-band .sub {
    font-size: 11px;
    color: #c7cbe8;
  }

  .mao-band .sub.green { color: #6ee7b7; }
  .mao-band .sub.red   { color: #fca5a5; }

  /* ── Scenario cards: a 3-up row where the selected condition is highlighted
     solid, the others stay plain — not another dense table ── */
  .scenario-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin: 10px 0 6px;
  }

  .scenario-card {
    background: #ffffff;
    border: 1px solid #e7e9f5;
    border-radius: 14px;
    padding: 15px 15px 16px;
    box-shadow: 0 1px 2px rgba(30, 27, 75, 0.04), 0 4px 14px rgba(30, 27, 75, 0.05);
  }

  .scenario-card.selected {
    background: #1e1b4b;
    border-color: #1e1b4b;
  }

  .scenario-card .cond {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #8b8fa3;
    margin-bottom: 8px;
  }

  .scenario-card.selected .cond { color: #a5acc9; }

  .scenario-card .arv {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 17px;
    font-weight: 800;
    color: #1e2333;
    margin-bottom: 10px;
  }

  .scenario-card.selected .arv { color: #ffffff; }

  .scenario-card .row {
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    color: #6b7280;
    padding: 4px 0;
  }

  .scenario-card.selected .row { color: #c7cbe8; }

  .scenario-card .row b { color: #1e2333; font-weight: 700; }
  .scenario-card.selected .row b { color: #ffffff; }

  /* ── Hairline row-list: sequential items without a card/shadow wrapper ── */
  .row-list { margin: 10px 0 6px; }

  .row-list .r {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 12px 2px;
    border-bottom: 1px solid #e9e4d8;
    font-size: 11.5px;
  }

  .row-list .r:last-child { border-bottom: none; }

  .row-list .r .k { color: #6b7280; }
  .row-list .r .v { font-weight: 700; color: #1e2333; font-variant-numeric: tabular-nums; }

  .row-list .r.total {
    font-weight: 800;
    padding-top: 14px;
    margin-top: 4px;
    border-top: 1.5px solid #1e2333;
    border-bottom: none;
  }

  .row-list .r.total .k { color: #1e2333; }
  .row-list .r.total .v { font-size: 13.5px; }

  /* ── Card-table: rounded, shadowed container instead of hairline HTML table ── */
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin-bottom: 6px;
    background: #ffffff;
    border: 1px solid #e7e9f5;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(30, 27, 75, 0.04), 0 4px 14px rgba(30, 27, 75, 0.05);
  }

  th {
    text-align: left;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #8b8fa3;
    padding: 10px 16px;
    background: #f7f8fc;
    border-bottom: 1px solid #eef0f7;
  }

  td {
    padding: 11px 16px;
    color: #374151;
    vertical-align: top;
    font-variant-numeric: tabular-nums;
    font-size: 11.5px;
  }

  tbody tr:not(:last-child) td { border-bottom: 1px solid #f1f2f9; }
  tbody tr:nth-child(even) td { background: #fafafe; }

  td:last-child { text-align: right; font-weight: 700; color: #1e2333; }
  th:last-child { text-align: right; }

  .green  { color: #059669; }
  .red    { color: #dc2626; }
  .amber  { color: #d97706; }

  /* Outrank td:last-child's own color rule so signal coloring actually shows on the
     right-aligned numeric cells it's applied to. */
  td.green, td:last-child.green { color: #059669; }
  td.red,   td:last-child.red   { color: #dc2626; }
  td.amber, td:last-child.amber { color: #d97706; }

  /* Proposal-style "total" bar — bold, full-width, colored, not just a tinted row */
  .highlight-row td {
    background: #eef0fe !important;
    font-weight: 800;
    font-size: 13px;
    padding-top: 13px;
    padding-bottom: 13px;
  }
  .highlight-row td:first-child { color: #312e81; }

  /* ── Status badges (replace emoji signal dots) ── */
  .badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    padding: 4px 11px;
    border-radius: 100px;
    white-space: nowrap;
  }
  .badge-green { background: #1e1b4b; color: #6ee7b7; border: 1px solid #1e1b4b; }
  .badge-amber { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
  .badge-red   { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

  .footer {
    margin-top: 30px;
    padding: 18px 4px 4px;
    border-top: 1px solid #e2e4f0;
    font-size: 9px;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: space-between;
    page-break-inside: avoid;
  }

  .footer .footer-brand {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 700;
    color: #6b7280;
  }

  .footer .footer-brand .mark {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: linear-gradient(135deg, #818cf8, #4338ca);
    display: inline-block;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    page-break-inside: avoid;
  }

  /* ── Stat cards ── */
  .summary-box {
    background: #ffffff;
    border: 1px solid #e7e9f5;
    border-radius: 14px;
    padding: 18px 20px;
    margin-bottom: 16px;
    box-shadow: 0 1px 2px rgba(30, 27, 75, 0.04), 0 4px 14px rgba(30, 27, 75, 0.05);
    page-break-inside: avoid;
  }

  .summary-box .val {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #1e2333;
    line-height: 1.15;
  }

  .summary-box .val.green { color: #059669; }
  .summary-box .val.red   { color: #dc2626; }
  .summary-box .val.amber { color: #d97706; }

  .summary-box .lbl {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    color: #9ca0b3;
    margin-bottom: 6px;
  }

  .note { font-size: 9.5px; color: #9ca0b3; margin-top: 7px; }
`

// Shared cover-hero markup for all report types — keeps branding consistent.
function buildLetterhead(docType: string, address: string, columns: { label: string; value: string }[]): string {
  const metastrip = columns.filter(c => c.value).map(c =>
    `<div class="col"><div class="lbl">${esc(c.label)}</div><div class="val">${esc(c.value)}</div></div>`
  ).join('')
  return `<div class="header">
  <div class="deco-circle"></div>
  <div class="deco-ring"></div>
  <div class="brandrow">
    <div class="brand"><span class="mark"></span>ClearPath Analyzer</div>
    <div class="doctype">${esc(docType)}</div>
  </div>
  <div class="eyebrow">Prepared for</div>
  <h1>${esc(address)}</h1>
  <div class="metastrip">${metastrip}</div>
</div>`
}

const FOOTER_HTML = `<div class="footer">
  <span class="footer-brand"><span class="mark"></span>Generated by ClearPath Analyzer &nbsp;·&nbsp; clearpathassetgroup.com</span>
  <span>Estimates are for educational purposes only. Not financial advice.</span>
</div>`

// ── DEAL SHEET (compact, section-toggleable) ──────────────────────────────────
function buildDealSheet(body: Record<string, unknown>): string {
  const { address, price, condition, results, breakdown, customRehab, arvMethod, compsCount, brrrr, str, compsUsed, alternatives, sections } = body as {
    address: string
    price: number
    condition: string
    results: Record<string, number & string>
    breakdown: Record<string, number>
    customRehab: number
    arvMethod: string
    compsCount: number
    brrrr: Record<string, number & string>
    str: Record<string, number & string> | undefined
    compsUsed: Array<Record<string, unknown>> | undefined
    alternatives: Array<Record<string, unknown>> | undefined
    sections: { flip: boolean; buyhold: boolean; brrrr: boolean; mao: boolean; comps: boolean; scenarios: boolean; cashRequired: boolean; str: boolean }
  }

  const sec = sections ?? { flip: true, buyhold: true, brrrr: true, mao: true, comps: true, scenarios: true, cashRequired: true, str: true }
  const rehab = customRehab ?? results.rehabEstimate
  const flipProfit = Math.round(results.arv - price - rehab - (breakdown?.sellingCosts ?? results.arv * 0.08) - (breakdown?.holdingCosts ?? price * 0.06))
  const mao = Math.round(results.arv * 0.7 - rehab)
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const condLabel = esc(condition.charAt(0).toUpperCase() + condition.slice(1))
  const arvNote = arvMethod === 'comps_based' ? `Comps-based (${compsCount} nearby sales)` : 'Estimated from purchase price'

  const brrrrSig = brrrr?.brrrrSignal as string ?? 'red'
  const brrrrColor = brrrrSig === 'green' ? '#059669' : brrrrSig === 'yellow' ? '#d97706' : '#dc2626'

  return `<style>${BASE_CSS}
    .hero { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px; }
    .hero .box { text-align:center; background:#ffffff; border:1px solid #e7e9f5; border-radius:14px; padding:16px 10px; box-shadow: 0 1px 2px rgba(30,27,75,0.04), 0 4px 14px rgba(30,27,75,0.05); }
    .hero .box .v { font-family:'Inter', sans-serif; font-size:20px; font-weight:800; letter-spacing:-0.01em; color:#1e2333; }
    .hero .box .v.green { color:#059669; }
    .hero .box .v.red   { color:#dc2626; }
    .hero .box .v.amber { color:#d97706; }
    .hero .box .l { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.09em; color:#9ca0b3; margin-top:5px; }
    .brrrr-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:8px 0 12px; }
    .brrrr-box { background:#ffffff; border:1px solid #e7e9f5; border-radius:12px; padding:13px 10px; text-align:center; box-shadow: 0 1px 2px rgba(30,27,75,0.04), 0 4px 14px rgba(30,27,75,0.05); }
    .brrrr-box.warn { background:#fffdf7; border-color:#fde68a; }
    .brrrr-box.bad { background:#fffbfb; border-color:#fecdd3; }
    .brrrr-box .bv { font-size:16px; font-weight:800; color:#1e2333; }
    .brrrr-box .bl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#9ca0b3; margin-top:4px; }
  </style>

${buildLetterhead('Deal Sheet', address, [
  { label: 'Prepared', value: today },
  { label: 'Condition', value: `${condLabel}` },
  { label: 'ARV basis', value: arvNote },
])}

<div class="hero">
  <div class="box"><div class="v">${fmt(results.arv)}</div><div class="l">After Repair Value</div></div>
  <div class="box"><div class="v ${flipProfit >= 30000 ? 'green' : flipProfit < 10000 ? 'red' : 'amber'}">${flipProfit >= 0 ? '+' : ''}${fmt(flipProfit)}</div><div class="l">Flip Profit</div></div>
  <div class="box"><div class="v ${results.monthlyCashFlow >= 300 ? 'green' : results.monthlyCashFlow < 0 ? 'red' : 'amber'}">${results.monthlyCashFlow >= 0 ? '+' : ''}${fmt(results.monthlyCashFlow)}/mo</div><div class="l">Cash Flow</div></div>
</div>

${(() => {
  const n = buildNarrative(condLabel, price, flipProfit, results.monthlyCashFlow, mao, results.flipSignal as string, results.rentalSignal as string)
  return `<div class="no-break">
  <div class="narrative-eyebrow">The Read</div>
  <div class="narrative-headline">${esc(n.headline)}</div>
  <div class="narrative-body">${esc(n.body)}</div>
</div>`
})()}

${sec.mao ? `
<div class="two-col no-break">
  <div>
    <h2>Deal Parameters</h2>
    <div class="row-list">
      <div class="r"><span class="k">Purchase Price</span><span class="v">${fmt(price)}</span></div>
      <div class="r"><span class="k">Rehab Estimate</span><span class="v">${fmt(rehab)}</span></div>
      <div class="r total"><span class="k">After Repair Value</span><span class="v">${fmt(results.arv)}</span></div>
    </div>
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

${sec.mao ? `
<div class="mao-band no-break">
  <div class="lbl">Max Allowable Offer &middot; 70% Rule</div>
  <div class="val">${fmt(mao)}</div>
  <div class="bar"></div>
  <div class="sub ${price <= mao ? 'green' : 'red'}">${price <= mao ? `${fmt(mao - price)} under MAO — room to negotiate` : `${fmt(price - mao)} over MAO — negotiate down to hit the 70% rule`}</div>
</div>` : ''}

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

${sec.cashRequired ? `
<h2>Total Cash Required</h2>
<div class="row-list no-break">
  <div class="r"><span class="k">Down Payment</span><span class="v">${fmt(breakdown?.downPayment ?? 0)}</span></div>
  <div class="r"><span class="k">Closing Costs</span><span class="v">${fmt(breakdown?.closingCostsBuy ?? 0)}</span></div>
  <div class="r"><span class="k">Rehab</span><span class="v">${fmt(rehab)}</span></div>
  <div class="r total"><span class="k">Total Cash-In</span><span class="v">${fmt((breakdown?.downPayment ?? 0) + (breakdown?.closingCostsBuy ?? 0) + rehab)}</span></div>
</div>` : ''}

${sec.comps && compsUsed && compsUsed.length > 0 ? `
<h2>Comparable Sales (ARV Basis)</h2>
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
<div class="note">ARV = subject sqft × median $/sqft × ${condLabel} condition uplift</div>` : ''}

${sec.scenarios && alternatives && alternatives.length > 0 ? `
<h2>Scenario Analysis — All Conditions</h2>
<div class="scenario-cards no-break">
  ${alternatives.map((a: Record<string, unknown>) => {
    const selected = a.condition === condition
    const condName = esc(String(a.condition).charAt(0).toUpperCase() + String(a.condition).slice(1))
    return `<div class="scenario-card${selected ? ' selected' : ''}">
      <div class="cond">${condName}${selected ? ' · Selected' : ''}</div>
      <div class="arv">${fmt(a.arv as number)}</div>
      <div class="row"><span>Rehab</span><b>${fmt(a.rehabMidpoint as number)}</b></div>
      <div class="row"><span>Flip profit</span><b>${(a.flipProfit as number) >= 0 ? '+' : ''}${fmt(a.flipProfit as number)}</b></div>
      <div class="row"><span>Cash flow</span><b>${(a.monthlyCashFlow as number) >= 0 ? '+' : ''}${fmt(a.monthlyCashFlow as number)}/mo</b></div>
    </div>`
  }).join('')}
</div>` : ''}

${sec.str && str ? (() => {
  const strSig = str.cashFlowSignal as string ?? 'red'
  const strColor = strSig === 'green' ? '#059669' : strSig === 'yellow' ? '#d97706' : '#dc2626'
  const vsLtrAmt = str.vsLtr as number ?? 0
  return `
<h2>Short-Term Rental (Airbnb / STR)</h2>
<div class="two-col no-break">
  <div>
    <table>
      <tr><td>Nightly Rate</td><td>${fmt(str.nightlyRate as number)}/night</td></tr>
      <tr><td>Occupancy</td><td>${Math.round((str.occupancy as number) * 100)}%</td></tr>
      <tr><td>Avg Stay</td><td>${str.avgStay} nights</td></tr>
      <tr><td>Gross Monthly</td><td>${fmt(str.grossMonthly as number)}</td></tr>
      <tr><td>Platform Fee (3%)</td><td>− ${fmt(str.platformFee as number)}</td></tr>
      <tr><td>Cleaning (${str.turnovers}× $100)</td><td>− ${fmt(str.cleaningCost as number)}</td></tr>
      <tr class="highlight-row"><td><strong>Net STR Income</strong></td><td><strong>${fmt(str.netIncome as number)}/mo</strong></td></tr>
    </table>
  </div>
  <div>
    <table>
      <tr><td>Mortgage</td><td>− ${fmt(breakdown?.mortgage ?? 0)}/mo</td></tr>
      <tr><td>Insurance</td><td>− ${fmt(breakdown?.insurance ?? 0)}/mo</td></tr>
      <tr><td>Property Taxes</td><td>− ${fmt(breakdown?.taxes ?? 0)}/mo</td></tr>
      <tr class="highlight-row"><td><strong>STR Cash Flow</strong></td><td style="color:${strColor}"><strong>${(str.cashFlow as number) >= 0 ? '+' : ''}${fmt(str.cashFlow as number)}/mo</strong></td></tr>
      <tr><td>vs. Long-Term Rental</td><td class="${vsLtrAmt >= 0 ? 'green' : 'red'}">${vsLtrAmt >= 0 ? '+' : ''}${fmt(vsLtrAmt)}/mo</td></tr>
      <tr><td>Annual Net Income</td><td>${fmt(str.annualNet as number)}</td></tr>
    </table>
  </div>
</div>`
})() : ''}

${FOOTER_HTML}`
}

// ── OFFER LETTER (LOI) ─────────────────────────────────────────────────────────
function buildOfferLetter(body: Record<string, unknown>): string {
  const {
    address, results, customRehab,
    buyerName, offerPrice, earnestMoney, closingDays, expirationDays, inspectionDays,
  } = body as {
    address: string
    results: Record<string, number & string>
    customRehab: number
    buyerName: string
    offerPrice: number
    earnestMoney: number
    closingDays: number
    expirationDays: number
    inspectionDays: number
  }

  const rehab = customRehab ?? results.rehabEstimate
  const mao = Math.round(results.arv * 0.7 - rehab)
  const price = offerPrice && offerPrice > 0 ? Math.round(offerPrice) : mao
  const earnest = earnestMoney && earnestMoney > 0 ? Math.round(earnestMoney) : 1000
  const closing = closingDays && closingDays > 0 ? Math.round(closingDays) : 21
  const inspection = inspectionDays && inspectionDays > 0 ? Math.round(inspectionDays) : 5
  const expiration = expirationDays && expirationDays > 0 ? Math.round(expirationDays) : 3
  const buyer = (buyerName ?? '').trim() || 'Buyer'

  const today = new Date()
  const todayLabel = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const expiresDate = new Date(today.getTime() + expiration * 24 * 60 * 60 * 1000)
  const expiresLabel = expiresDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const closingDate = new Date(today.getTime() + closing * 24 * 60 * 60 * 1000)
  const closingLabel = closingDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return `<style>${BASE_CSS}
    .letter-body { padding-top: 4px; }
    .letter-body > p { margin-bottom: 14px; background: #ffffff; border: 1px solid #e7e9f5; border-radius: 14px; padding: 16px 18px; box-shadow: 0 1px 2px rgba(30,27,75,0.04), 0 4px 14px rgba(30,27,75,0.05); }
    .letter-dateline { font-size: 10.5px; font-weight: 600; color: #8b8fa3; text-align: right; margin-bottom: 16px; }
    .letter-re {
      font-size: 11px; font-weight: 600; margin-bottom: 18px; padding: 13px 18px;
      background: #eef0fe; border-radius: 12px; color: #312e81;
    }
    .letter-re .label { font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-size: 8.5px; color: #4338ca; margin-right: 8px; }
    .terms-table { margin: 16px 0; }
    .terms-table tr.price-row td {
      background: #eef0fe !important; font-weight: 800; font-size: 13px;
      padding-top: 14px; padding-bottom: 14px;
    }
    .terms-table tr.price-row td:first-child { color: #312e81; }
    .terms-table tr.price-row td:last-child { color: #4338ca; font-family: 'Inter', sans-serif; font-size: 17px; letter-spacing: -0.01em; }
    .closing { margin-top: 22px; }
    .closing > p { background: none; border: none; padding: 0; box-shadow: none; }
    .sign-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px; }
    .sign-box {
      background: #ffffff; border: 1.5px dashed #c7cbe8; border-radius: 12px;
      padding: 14px 16px 16px;
    }
    .sign-box .sign-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca0b3; margin-bottom: 22px; }
    .sign-line { border-top:1px solid #cbd0e0; padding-top:7px; font-size:9px; color:#6b7280; }
    .sign-line .who { display: block; font-weight: 700; color: #1e2333; font-size: 10px; margin-bottom: 1px; }
  </style>

${buildLetterhead('Purchase Offer / Letter of Intent', address, [
  { label: 'Offer expires', value: expiresLabel },
  { label: 'Inspection', value: `${inspection} days` },
  { label: 'Terms', value: 'Cash, as-is' },
])}

<div class="letter-body">
<div class="letter-dateline">${esc(todayLabel)}</div>

<div class="letter-re"><span class="label">Re</span>Purchase Offer for ${esc(address)}</div>

<p>To the Owner of Record of the property located at <strong>${esc(address)}</strong> (the "Property"):</p>

<p>${esc(buyer)} ("Buyer") is pleased to submit the following offer to purchase the Property on an as-is, cash basis, subject to the terms below.</p>

<table class="terms-table">
  <tr class="price-row"><td>Purchase Price</td><td>${fmt(price)}</td></tr>
  <tr><td>Earnest Money Deposit</td><td>${fmt(earnest)}, due within 3 business days of acceptance</td></tr>
  <tr><td>Purchase Terms</td><td>Cash — no financing contingency</td></tr>
  <tr><td>Property Condition</td><td>As-is; Buyer to make no repair requests of Seller</td></tr>
  <tr><td>Inspection Period</td><td>${inspection} calendar days from acceptance</td></tr>
  <tr><td>Target Closing Date</td><td>On or before ${esc(closingLabel)} (${closing} days from acceptance)</td></tr>
  <tr><td>Closing Costs</td><td>Buyer and Seller to each pay their customary closing costs</td></tr>
  <tr><td>Offer Expires</td><td>${esc(expiresLabel)}, unless accepted or extended in writing</td></tr>
</table>

<p>This offer is submitted for the Seller's consideration and does not constitute a binding contract until a formal purchase and sale agreement is signed by both parties. Buyer is prepared to provide proof of funds upon request and to move promptly to a signed agreement.</p>

<p>If these terms are acceptable, please sign below or contact Buyer directly to discuss. Buyer looks forward to the opportunity to work with you.</p>

<div class="closing no-break">
<p style="margin-bottom: 18px;">Sincerely,</p>

<div class="sign-grid">
  <div class="sign-box">
    <div class="sign-label">Buyer signature</div>
    <div class="sign-line"><span class="who">${esc(buyer)}</span>Buyer &nbsp;&nbsp;·&nbsp;&nbsp; Date</div>
  </div>
  <div class="sign-box">
    <div class="sign-label">Seller signature</div>
    <div class="sign-line"><span class="who">&nbsp;</span>Seller / Owner of Record &nbsp;&nbsp;·&nbsp;&nbsp; Date</div>
  </div>
</div>
</div>
</div>

<div class="footer">
  <span class="footer-brand"><span class="mark"></span>Generated by ClearPath Analyzer &nbsp;·&nbsp; clearpathassetgroup.com</span>
  <span>This is not a binding contract. Consult a real estate attorney before executing a purchase agreement.</span>
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
  const condLabel = esc(condition.charAt(0).toUpperCase() + condition.slice(1))
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
<div class="scenario-cards no-break">
  ${alternatives.map((a: Record<string, unknown>) => {
    const selected = a.condition === condition
    const condName = esc(String(a.condition).charAt(0).toUpperCase() + String(a.condition).slice(1))
    return `<div class="scenario-card${selected ? ' selected' : ''}">
      <div class="cond">${condName}${selected ? ' · Selected' : ''}</div>
      <div class="arv">${fmt(a.arv as number)}</div>
      <div class="row"><span>Rehab</span><b>${fmt(a.rehabMidpoint as number)}</b></div>
      <div class="row"><span>Flip profit</span><b>${(a.flipProfit as number) >= 0 ? '+' : ''}${fmt(a.flipProfit as number)}</b></div>
      <div class="row"><span>Cash flow</span><b>${(a.monthlyCashFlow as number) >= 0 ? '+' : ''}${fmt(a.monthlyCashFlow as number)}/mo</b></div>
    </div>`
  }).join('')}
</div>` : ''

  return `<style>${BASE_CSS}</style>

${buildLetterhead('Full Deal Report', address, [
  { label: 'Prepared', value: today },
  { label: 'Condition', value: `${condLabel}` },
  { label: 'ARV basis', value: arvNote },
])}

<div class="summary-box">
  <div class="lbl">After Repair Value</div>
  <div class="val">${fmt(r.arv)}</div>
</div>

${(() => {
  const n = buildNarrative(condLabel, price, flipProfit, r.monthlyCashFlow, mao, r.flipSignal as string, r.rentalSignal as string)
  return `<div class="no-break">
  <div class="narrative-eyebrow">The Read</div>
  <div class="narrative-headline">${esc(n.headline)}</div>
  <div class="narrative-body">${esc(n.body)}</div>
</div>`
})()}

<h2>Property & Deal Parameters</h2>
<div class="row-list">
  <div class="r"><span class="k">Purchase Price</span><span class="v">${fmt(price)}</span></div>
  <div class="r"><span class="k">Property Condition</span><span class="v">${condLabel}</span></div>
  <div class="r"><span class="k">Rehab Estimate</span><span class="v">${fmt(rehab)}${customRehab && customRehab !== r.rehabEstimate ? ` <span style="font-size:9px;font-weight:600;color:#d97706">(AI est. ${fmt(r.rehabEstimate)})</span>` : ''}</span></div>
  <div class="r"><span class="k">AI Rehab Range</span><span class="v">${fmt(r.rehabLow)} – ${fmt(r.rehabHigh)}</span></div>
  <div class="r"><span class="k">ARV Method</span><span class="v">${arvNote}</span></div>
</div>

<div class="mao-band no-break">
  <div class="lbl">Maximum Allowable Offer &middot; 70% Rule</div>
  <div class="val">${fmt(mao)}</div>
  <div class="bar"></div>
  <div class="sub ${price <= mao ? 'green' : 'red'}">${price <= mao ? `This deal is ${fmt(mao - price)} under MAO.` : `This deal is ${fmt(price - mao)} over MAO — negotiate down.`}</div>
</div>

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
    <div class="row-list">
      <div class="r"><span class="k">Down Payment</span><span class="v">${fmt(breakdown?.downPayment ?? 0)}</span></div>
      <div class="r"><span class="k">Closing Costs</span><span class="v">${fmt(breakdown?.closingCostsBuy ?? 0)}</span></div>
      <div class="r"><span class="k">Rehab</span><span class="v">${fmt(rehab)}</span></div>
      <div class="r total"><span class="k">Total Cash-In</span><span class="v">${fmt((breakdown?.downPayment ?? 0) + (breakdown?.closingCostsBuy ?? 0) + rehab)}</span></div>
    </div>
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

${FOOTER_HTML}`
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 10 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  const body = await req.json()
  const {
    address,
    reportType = 'deal_sheet',
    mode = 'preview',
  } = body as { address: string; reportType: 'deal_sheet' | 'full_report' | 'offer_letter'; mode: 'preview' | 'print' }

  if (!address) return NextResponse.json({ error: 'address required' }, { status: 400 })

  const innerHtml = reportType === 'full_report' ? buildFullReport(body)
    : reportType === 'offer_letter' ? buildOfferLetter(body)
    : buildDealSheet(body)
  const reportLabel = reportType === 'full_report' ? 'ClearPath Full Report'
    : reportType === 'offer_letter' ? 'ClearPath Offer Letter'
    : 'ClearPath Deal Sheet'
  const title = `${reportLabel} — ${esc(address)}`
  // Real fonts (loaded by headless Chrome at PDF-render time, or the browser tab in preview
  // mode) so the exported document matches the app's own Playfair/Inter brand typography
  // instead of falling back to system fonts.
  const fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet">'
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${fontLink}</head><body>${innerHtml}</body></html>`

  // Preview mode: return HTML for in-browser view
  if (mode === 'preview') {
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // PDF mode: render with headless Chrome → true vector PDF
  try {
    let browser
    const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME

    if (isVercel) {
      const chromium = (await import('@sparticuz/chromium-min')).default
      const puppeteer = (await import('puppeteer-core')).default
      browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(
          'https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.tar'
        ),
        headless: true,
      })
    } else {
      const puppeteer = (await import('puppeteer')).default
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    }

    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 })
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })
    await browser.close()

    const fileSlug = address.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)
    const filename = reportType === 'full_report'
      ? `ClearPath-Full-Report-${fileSlug}.pdf`
      : reportType === 'offer_letter'
      ? `ClearPath-Offer-Letter-${fileSlug}.pdf`
      : `ClearPath-Deal-Sheet-${fileSlug}.pdf`

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    // Fallback: return HTML if Puppeteer fails
    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
}
