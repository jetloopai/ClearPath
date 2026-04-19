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
