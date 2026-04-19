import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const ANALYZER_FROM = 'ClearPath Analyzer <noreply@clearpathanalyzer.com>'
const ASSET_GROUP_FROM = 'ClearPath Asset Group <hello@clearpathassetgroup.com>'
const INTERNAL_TO = 'hello@clearpathassetgroup.com'

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)

const sigLabel = (s: string) =>
  s === 'green' ? '🟢 Strong Deal' : s === 'red' ? '🔴 Weak Deal' : '🟡 Marginal Deal'

// ── Template A: Analyzer deal confirmation ────────────────────────────────────
export async function sendAnalysisEmail(lead: {
  id: string
  email: string
  address?: string
  deal_signal?: string
  deal_arv?: number
  deal_flip_profit?: number
  deal_cash_flow?: number
  is_service_area?: boolean
}) {
  if (!process.env.RESEND_API_KEY) return
  const { email, address, deal_signal, deal_arv, deal_flip_profit, deal_cash_flow, is_service_area } = lead

  const cookCountyBlock = is_service_area
    ? `<tr><td style="padding:20px;background:#1e1b4b;border-radius:12px;margin-top:16px">
        <p style="color:#a5b4fc;font-size:13px;margin:0 0 8px">We operate in Cook County</p>
        <p style="color:#e2e8f0;font-size:13px;margin:0 0 12px">ClearPath Asset Group handles end-to-end execution — rehab, lease-up, and stabilization.</p>
        <a href="https://clearpathassetgroup.com#contact" style="display:inline-block;padding:10px 20px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600">Learn More →</a>
      </td></tr>`
    : ''

  await resend.emails.send({
    from: ANALYZER_FROM,
    to: email,
    subject: `Your deal analysis — ${address ?? 'your property'}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Analyzer</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 4px">Your Analysis Is Ready</h1>
        <p style="font-size:13px;color:#64748b;margin:0 0 24px">${address ?? ''}</p>

        <table width="100%" cellpadding="0" cellspacing="8">
          <tr>
            <td style="padding:16px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;text-align:center">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 4px">ARV</p>
              <p style="font-size:24px;font-weight:700;color:#f1f5f9;margin:0">${deal_arv ? fmt(deal_arv) : '—'}</p>
            </td>
            <td style="width:8px"></td>
            <td style="padding:16px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;text-align:center">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 4px">Flip Profit</p>
              <p style="font-size:24px;font-weight:700;color:#f1f5f9;margin:0">${deal_flip_profit != null ? fmt(deal_flip_profit) : '—'}</p>
            </td>
            <td style="width:8px"></td>
            <td style="padding:16px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;text-align:center">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 4px">Cash Flow</p>
              <p style="font-size:24px;font-weight:700;color:#f1f5f9;margin:0">${deal_cash_flow != null ? fmt(deal_cash_flow) : '—'}/mo</p>
            </td>
          </tr>
          ${deal_signal ? `<tr><td colspan="5" style="padding:12px 16px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;text-align:center">
            <p style="font-size:14px;font-weight:600;color:#f1f5f9;margin:0">${sigLabel(deal_signal)}</p>
          </td></tr>` : ''}
          ${cookCountyBlock}
        </table>

        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">
          ClearPath Analyzer · <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a>
        </p>
      </div>
    `,
  })
}

// ── Template B: Asset Group inquiry confirmation ──────────────────────────────
export async function sendAssetGroupInquiryEmail(lead: {
  email: string
  name?: string
  address?: string
}) {
  if (!process.env.RESEND_API_KEY) return
  const { email, name, address } = lead

  await resend.emails.send({
    from: ASSET_GROUP_FROM,
    to: email,
    subject: `Got it${name ? `, ${name}` : ''} — we'll be in touch within 24 hours`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Asset Group</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">We received your inquiry.</h1>

        ${address ? `<p style="font-size:13px;color:#94a3b8;margin:0 0 16px">Property: ${address}</p>` : ''}

        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">
          Our team reviews every inquiry personally. Here's what happens next:
        </p>

        <div style="border-left:2px solid #6366f1;padding-left:16px;margin-bottom:24px">
          <p style="font-size:13px;color:#94a3b8;margin:0 0 10px">1. We review your deal details</p>
          <p style="font-size:13px;color:#94a3b8;margin:0 0 10px">2. We reach out within 24 hours to schedule a strategy call</p>
          <p style="font-size:13px;color:#94a3b8;margin:0">3. On the call, we walk through the numbers and execution plan</p>
        </div>

        <p style="font-size:13px;color:#64748b;margin:0 0 24px">
          In the meantime, if you haven't run a full deal analysis, you can do that free at
          <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a>.
        </p>

        <p style="font-size:11px;color:#475569;margin:0;text-align:center">
          ClearPath Asset Group · <a href="https://clearpathassetgroup.com" style="color:#6366f1">clearpathassetgroup.com</a>
        </p>
      </div>
    `,
  })
}

// ── Template C: Internal alert ────────────────────────────────────────────────
export async function sendInternalAlert(lead: {
  email: string
  name?: string
  phone?: string
  address?: string
  source: string
  qualification_score?: number
  deal_signal?: string
  deal_arv?: number
  deal_flip_profit?: number
  deal_cash_flow?: number
  tags?: string[]
  message?: string
}) {
  if (!process.env.RESEND_API_KEY) return
  const { email, name, phone, address, source, qualification_score, deal_signal, deal_arv, deal_flip_profit, deal_cash_flow, tags, message } = lead
  const isCookCounty = source === 'asset_group' || tags?.includes('market:cook_county')
  const emoji = isCookCounty ? '🔴' : '🟡'

  await resend.emails.send({
    from: ASSET_GROUP_FROM,
    to: INTERNAL_TO,
    subject: `${emoji} New ${source === 'asset_group' ? 'Direct Inquiry' : 'Cook County'} Lead — ${name ?? email}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <h2 style="font-size:18px;font-weight:700;color:#f1f5f9;margin:0 0 20px">${emoji} New Lead</h2>
        <table width="100%" cellpadding="8" cellspacing="0" style="font-size:13px">
          <tr><td style="color:#64748b;width:140px">Name</td><td style="color:#f1f5f9">${name ?? '—'}</td></tr>
          <tr><td style="color:#64748b">Email</td><td><a href="mailto:${email}" style="color:#6366f1">${email}</a></td></tr>
          <tr><td style="color:#64748b">Phone</td><td style="color:#f1f5f9">${phone ?? '—'}</td></tr>
          <tr><td style="color:#64748b">Address</td><td style="color:#f1f5f9">${address ?? '—'}</td></tr>
          <tr><td style="color:#64748b">Source</td><td style="color:#f1f5f9">${source}</td></tr>
          <tr><td style="color:#64748b">Qual. Score</td><td style="color:#f1f5f9">${qualification_score ?? '—'}</td></tr>
          ${deal_signal ? `<tr><td style="color:#64748b">Signal</td><td style="color:#f1f5f9">${sigLabel(deal_signal)}</td></tr>` : ''}
          ${deal_arv ? `<tr><td style="color:#64748b">ARV</td><td style="color:#f1f5f9">${fmt(deal_arv)}</td></tr>` : ''}
          ${deal_flip_profit != null ? `<tr><td style="color:#64748b">Flip Profit</td><td style="color:#f1f5f9">${fmt(deal_flip_profit)}</td></tr>` : ''}
          ${deal_cash_flow != null ? `<tr><td style="color:#64748b">Cash Flow</td><td style="color:#f1f5f9">${fmt(deal_cash_flow)}/mo</td></tr>` : ''}
          ${tags?.length ? `<tr><td style="color:#64748b">Tags</td><td style="color:#94a3b8">${tags.join(', ')}</td></tr>` : ''}
          ${message ? `<tr><td style="color:#64748b;vertical-align:top">Message</td><td style="color:#f1f5f9">${message}</td></tr>` : ''}
        </table>
      </div>
    `,
  })
}

// ── National Nurture: Step 2 — The 70% Rule ──────────────────────────────────
export async function sendNationalNurtureStep2(email: string, address?: string) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: ANALYZER_FROM,
    to: email,
    subject: 'The 70% Rule — how to calculate your max offer',
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Investor Education</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">The 70% Rule — your ceiling on every deal.</h1>
        ${address ? `<p style="font-size:13px;color:#64748b;margin:0 0 16px">Still thinking about ${address}?</p>` : ''}
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 16px">
          Most investors overpay because they anchor to the asking price. The 70% Rule anchors you to the <em>outcome</em>.
        </p>
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:0 0 20px;text-align:center">
          <p style="font-size:13px;color:#64748b;margin:0 0 8px">The Formula</p>
          <p style="font-size:18px;font-weight:700;color:#f1f5f9;margin:0">MAO = (ARV × 70%) − Rehab Costs</p>
        </div>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 12px">
          If a property's ARV is <strong>$250,000</strong> and rehab will run <strong>$30,000</strong>:
        </p>
        <p style="font-size:14px;color:#a5b4fc;line-height:1.7;margin:0 0 20px">
          MAO = ($250,000 × 0.70) − $30,000 = <strong>$145,000</strong>
        </p>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">
          Pay more than that and the deal doesn't work — no matter how motivated the seller is or how good the neighborhood looks. ClearPath calculates this automatically every time you run an analysis.
        </p>
        <a href="https://clearpathanalyzer.com" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Run Another Analysis →</a>
        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">ClearPath Analyzer · <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a></p>
      </div>`,
  })
}

// ── National Nurture: Step 3 — 3 Deal Killers ────────────────────────────────
export async function sendNationalNurtureStep3(email: string) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: ANALYZER_FROM,
    to: email,
    subject: '3 things that silently kill a deal',
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Investor Education</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">3 things that silently kill a deal.</h1>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">These don't show up in the listing. They show up after you close.</p>
        <div style="border-left:2px solid #ef4444;padding-left:16px;margin:0 0 16px">
          <p style="font-size:14px;font-weight:600;color:#f1f5f9;margin:0 0 4px">1. Underestimated rehab scope</p>
          <p style="font-size:13px;color:#94a3b8;margin:0;line-height:1.6">A "cosmetic" flip with hidden foundation issues or outdated electrical can turn a $20k job into a $70k one. Always get a contractor walkthrough before closing, not after.</p>
        </div>
        <div style="border-left:2px solid #f59e0b;padding-left:16px;margin:0 0 16px">
          <p style="font-size:14px;font-weight:600;color:#f1f5f9;margin:0 0 4px">2. Optimistic ARV comps</p>
          <p style="font-size:13px;color:#94a3b8;margin:0;line-height:1.6">Comparing to the best sale in a 1-mile radius instead of the most recent, most similar sales. Your ARV should be defensible — use sold comps within 90 days and ½ mile, similar sqft and condition.</p>
        </div>
        <div style="border-left:2px solid #6366f1;padding-left:16px;margin:0 0 24px">
          <p style="font-size:14px;font-weight:600;color:#f1f5f9;margin:0 0 4px">3. Ignoring holding costs</p>
          <p style="font-size:13px;color:#94a3b8;margin:0;line-height:1.6">Every month you own the property costs money — financing, taxes, insurance, utilities. A 6-month flip that runs 10 months bleeds $8–15k in additional holding costs that weren't in the plan.</p>
        </div>
        <a href="https://clearpathanalyzer.com" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Run a Deal Analysis →</a>
        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">ClearPath Analyzer · <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a></p>
      </div>`,
  })
}

// ── National Nurture: Step 4 — Finding Local Partners ────────────────────────
export async function sendNationalNurtureStep4(email: string) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: ANALYZER_FROM,
    to: email,
    subject: 'How to find reliable boots on the ground',
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Investor Education</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">The biggest risk in out-of-state investing isn't the market.</h1>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">It's not having anyone accountable on the ground.</p>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 16px">Here's how experienced investors build their local team:</p>
        <div style="space-y:12px">
          <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 12px"><strong style="color:#f1f5f9">1. Local REIA meetups</strong> — Real estate investor associations exist in almost every market. One meeting often surfaces a GC, property manager, and wholesaler.</p>
          <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 12px"><strong style="color:#f1f5f9">2. BiggerPockets forums</strong> — Search your target market, find active investors, ask for referrals. The community is surprisingly responsive.</p>
          <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 12px"><strong style="color:#f1f5f9">3. Property management companies</strong> — A good PM already has a vetted contractor list. They're incentivized to keep costs low because their reputation depends on it.</p>
          <p style="font-size:13px;color:#94a3b8;line-height:1.6;margin:0 0 20px"><strong style="color:#f1f5f9">4. Title companies and real estate attorneys</strong> — They close deals daily and know every active investor, wholesaler, and operator in the market.</p>
        </div>
        <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 20px">If you're looking at Cook County, IL — that's our backyard. We handle rehab, lease-up, and stabilization end-to-end.</p>
        <a href="https://clearpathanalyzer.com" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Analyze Another Deal →</a>
        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">ClearPath Analyzer · <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a></p>
      </div>`,
  })
}

// ── National Nurture: Step 5 — Monthly Digest ────────────────────────────────
export async function sendNationalNurtureStep5(email: string) {
  if (!process.env.RESEND_API_KEY) return
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  await resend.emails.send({
    from: ANALYZER_FROM,
    to: email,
    subject: `ClearPath Monthly Digest — ${month}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Monthly Digest</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 4px">${month}</h1>
        <p style="font-size:13px;color:#64748b;margin:0 0 24px">Market intelligence from the ClearPath Analyzer network.</p>
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:0 0 16px">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 12px">This Month's Highlights</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0">Our analyzer has processed thousands of deals across hundreds of zip codes. Cook County continues to show strong flip margins on light-to-medium condition properties. Nationally, markets with strong rental demand and below-average ARVs are outperforming on cash flow.</p>
        </div>
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:0 0 20px">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 12px">Analyzer Updates</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0">Short-term rental analysis, scenario comparison, and full deal sheet PDF exports are now live. Run any address to see all exit strategies side by side.</p>
        </div>
        <a href="https://clearpathanalyzer.com" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Run a Deal →</a>
        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">
          ClearPath Analyzer · <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a>
          &nbsp;·&nbsp; <a href="https://clearpathanalyzer.com/unsubscribe" style="color:#475569">Unsubscribe</a>
        </p>
      </div>`,
  })
}

// ── Cook County: Step 2 — Case Study ─────────────────────────────────────────
export async function sendCookCountyStep2(email: string, address?: string) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: ASSET_GROUP_FROM,
    to: email,
    subject: 'How we handled a rehab just like yours',
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Asset Group</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">A Cook County rehab, start to finish.</h1>
        ${address ? `<p style="font-size:13px;color:#64748b;margin:0 0 16px">You analyzed ${address} — here's what a project like that looks like when we execute it.</p>` : ''}
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:0 0 20px">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 12px">Project Overview</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0 0 8px"><strong>Property:</strong> 3bd/1ba medium-condition single family, Cook County</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0 0 8px"><strong>Scope:</strong> Full kitchen remodel, bath update, new flooring, HVAC service, exterior paint</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0 0 8px"><strong>Timeline:</strong> 11 weeks from close to tenant in place</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0"><strong>Result:</strong> Leased at $1,850/mo, 9 days on market, tenant qualified same week</p>
        </div>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">Every week the investor got photo updates, budget tracking, and a single point of contact. No contractor chasing. No surprises.</p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px">That's what we do for every project — and we only take on deals where the numbers work.</p>
        <a href="https://clearpathassetgroup.com#contact" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Talk to Our Team →</a>
        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">ClearPath Asset Group · <a href="https://clearpathassetgroup.com" style="color:#6366f1">clearpathassetgroup.com</a></p>
      </div>`,
  })
}

// ── Cook County: Step 3 — Strategy Call Offer ────────────────────────────────
export async function sendCookCountyStep3(email: string, address?: string) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: ASSET_GROUP_FROM,
    to: email,
    subject: address ? `Quick question about ${address}` : 'Quick question about your Cook County deal',
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Asset Group</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">${address ? `Still thinking about ${address}?` : 'Still thinking about that Cook County deal?'}</h1>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">
          If you're serious about moving on it, a 10-minute strategy call is the fastest way to know if it's worth pursuing — and what execution would look like.
        </p>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 8px">On the call we cover:</p>
        <div style="border-left:2px solid #6366f1;padding-left:16px;margin:0 0 24px">
          <p style="font-size:13px;color:#94a3b8;margin:0 0 8px">→ Whether the deal pencils at the current ask</p>
          <p style="font-size:13px;color:#94a3b8;margin:0 0 8px">→ A rough rehab scope and cost range for the condition</p>
          <p style="font-size:13px;color:#94a3b8;margin:0">→ What exit (flip vs hold) makes more sense given today's market</p>
        </div>
        <a href="https://clearpathassetgroup.com#contact" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Book a 10-Minute Call →</a>
        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">ClearPath Asset Group · <a href="https://clearpathassetgroup.com" style="color:#6366f1">clearpathassetgroup.com</a></p>
      </div>`,
  })
}

// ── Cook County: Step 4 — Market Update ──────────────────────────────────────
export async function sendCookCountyStep4(email: string) {
  if (!process.env.RESEND_API_KEY) return
  const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  await resend.emails.send({
    from: ASSET_GROUP_FROM,
    to: email,
    subject: `Cook County market update — ${month}`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">Cook County Market Intel</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">${month} — What we're seeing on the ground.</h1>
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:0 0 16px">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 12px">Rehab Costs</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0">Labor rates in Cook County have stabilized after the post-pandemic surge. Medium condition rehabs are running $35–55/sqft depending on scope. Light cosmetic work is still competitive at $15–25/sqft with the right contractor relationships.</p>
        </div>
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:0 0 16px">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 12px">Rental Market</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0">3bd single families are leasing quickly in south and southwest suburbs — 7–14 day average time-to-lease for well-presented properties priced at market. Demand from Section 8 and working families remains strong.</p>
        </div>
        <div style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:20px;margin:0 0 20px">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0 0 12px">Deal Flow</p>
          <p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0">Inventory is moving. Off-market and wholesaler inventory in the $80–140k range continues to offer the best margins for investors who can execute quickly.</p>
        </div>
        <a href="https://clearpathassetgroup.com#contact" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Talk to Our Team →</a>
        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">ClearPath Asset Group · <a href="https://clearpathassetgroup.com" style="color:#6366f1">clearpathassetgroup.com</a></p>
      </div>`,
  })
}

// ── Asset Group Inquiry: Step 2 — Follow-up ──────────────────────────────────
export async function sendAssetGroupStep2(email: string, name?: string, address?: string) {
  if (!process.env.RESEND_API_KEY) return
  await resend.emails.send({
    from: ASSET_GROUP_FROM,
    to: email,
    subject: address ? `Still interested in discussing ${address}?` : 'Following up on your inquiry',
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Asset Group</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">Hey${name ? ` ${name}` : ''} — just checking in.</h1>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">
          We reached out but haven't heard back. No pressure — deals take time and we get it.
        </p>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">
          ${address ? `If you're still evaluating ${address}, we're happy to do a quick 10-minute call to walk through the numbers and tell you exactly what execution would look like.` : "If you're still evaluating the deal, we're happy to do a quick 10-minute call to walk through the numbers."}
        </p>
        <p style="font-size:13px;color:#64748b;margin:0 0 20px">
          Or just reply to this email — we'll get back to you same day.
        </p>
        <a href="https://clearpathassetgroup.com#contact" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">Get in Touch →</a>
        <p style="font-size:11px;color:#475569;margin:24px 0 0;text-align:center">ClearPath Asset Group · <a href="https://clearpathassetgroup.com" style="color:#6366f1">clearpathassetgroup.com</a></p>
      </div>`,
  })
}

// ── Template D: Newsletter welcome ────────────────────────────────────────────
export async function sendNewsletterWelcome(email: string) {
  if (!process.env.RESEND_API_KEY) return

  await resend.emails.send({
    from: ANALYZER_FROM,
    to: email,
    subject: "You're on the ClearPath Investor List",
    html: `
      <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
        <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Investor List</p>
        <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">You're in.</h1>
        <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">
          We send weekly market intelligence: top deal markets, zip-level trends, and deal breakdowns from active Cook County projects.
        </p>
        <p style="font-size:13px;color:#64748b;margin:0 0 24px">
          You can run a free deal analysis anytime at
          <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a>.
        </p>
        <p style="font-size:11px;color:#475569;margin:0;text-align:center">
          ClearPath Analyzer · <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a>
        </p>
      </div>
    `,
  })
}
