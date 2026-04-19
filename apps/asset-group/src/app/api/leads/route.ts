import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getIp } from '@/lib/rateLimit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Dynamic import keeps resend out of edge bundle; asset-group has no edge runtime
async function sendEmails(lead: { id: string; email: string; name?: string; phone?: string; address?: string; message?: string; qualification_score: number; tags: string[] }) {
  // Import from the analyzer app isn't possible across apps — inline the resend calls here
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  if (!process.env.RESEND_API_KEY) return

  const FROM = 'ClearPath Asset Group <hello@clearpathassetgroup.com>'
  const INTERNAL = 'hello@clearpathassetgroup.com'
  const { email, name, phone, address, message, qualification_score, tags } = lead

  await Promise.allSettled([
    // Confirmation to lead
    resend.emails.send({
      from: FROM,
      to: email,
      subject: `Got it${name ? `, ${name}` : ''} — we'll be in touch within 24 hours`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#050505;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
          <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6366f1;margin-bottom:8px">ClearPath Asset Group</p>
          <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:0 0 16px">We received your inquiry.</h1>
          ${address ? `<p style="font-size:13px;color:#94a3b8;margin:0 0 16px">Property: ${address}</p>` : ''}
          <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0 0 20px">Our team reviews every inquiry personally. Here's what happens next:</p>
          <div style="border-left:2px solid #6366f1;padding-left:16px;margin-bottom:24px">
            <p style="font-size:13px;color:#94a3b8;margin:0 0 10px">1. We review your deal details</p>
            <p style="font-size:13px;color:#94a3b8;margin:0 0 10px">2. We reach out within 24 hours to schedule a strategy call</p>
            <p style="font-size:13px;color:#94a3b8;margin:0">3. On the call, we walk through the numbers and execution plan</p>
          </div>
          <p style="font-size:13px;color:#64748b;margin:0 0 24px">
            Haven't run a deal analysis yet? It's free at
            <a href="https://clearpathanalyzer.com" style="color:#6366f1">clearpathanalyzer.com</a>.
          </p>
          <p style="font-size:11px;color:#475569;margin:0;text-align:center">
            ClearPath Asset Group · <a href="https://clearpathassetgroup.com" style="color:#6366f1">clearpathassetgroup.com</a>
          </p>
        </div>
      `,
    }),
    // Internal alert
    resend.emails.send({
      from: FROM,
      to: INTERNAL,
      subject: `🔴 New Direct Inquiry — ${name ?? email}`,
      html: `
        <div style="font-family:Arial,sans-serif;background:#0f172a;color:#e2e8f0;max-width:560px;margin:0 auto;padding:32px">
          <h2 style="font-size:18px;font-weight:700;color:#f1f5f9;margin:0 0 20px">🔴 New Direct Lead</h2>
          <table width="100%" cellpadding="8" cellspacing="0" style="font-size:13px">
            <tr><td style="color:#64748b;width:140px">Name</td><td style="color:#f1f5f9">${name ?? '—'}</td></tr>
            <tr><td style="color:#64748b">Email</td><td><a href="mailto:${email}" style="color:#6366f1">${email}</a></td></tr>
            <tr><td style="color:#64748b">Phone</td><td style="color:#f1f5f9">${phone ?? '—'}</td></tr>
            <tr><td style="color:#64748b">Address</td><td style="color:#f1f5f9">${address ?? '—'}</td></tr>
            <tr><td style="color:#64748b">Qual. Score</td><td style="color:#f1f5f9">${qualification_score}</td></tr>
            <tr><td style="color:#64748b">Tags</td><td style="color:#94a3b8">${tags.join(', ')}</td></tr>
            ${message ? `<tr><td style="color:#64748b;vertical-align:top">Message</td><td style="color:#f1f5f9">${message}</td></tr>` : ''}
          </table>
        </div>
      `,
    }),
  ])
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const body = await req.json()
  const { name, email, phone, address, message } = body

  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (!name || String(name).trim().length < 2) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 })
  }

  const tags = ['source:asset_group', 'intent:direct_inquiry', 'market:cook_county']
  const qualification_score = 8 // direct inquiry = high intent baseline

  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(
      {
        name: String(name).trim().slice(0, 200),
        email,
        phone: phone ? String(phone).trim().slice(0, 30) : undefined,
        address: address ? String(address).trim().slice(0, 500) : undefined,
        notes: message ? String(message).trim().slice(0, 2000) : undefined,
        source: 'asset_group',
        is_service_area: true,
        status: 'new',
        email_sequence: 'cook_county_flow',
        tags,
        qualification_score,
      },
      { onConflict: 'email', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) {
    console.error('Asset Group lead capture error:', error)
    return NextResponse.json({ error: 'Failed to save inquiry' }, { status: 500 })
  }

  // Fire-and-forget
  sendEmails({ id: data.id, email, name, phone, address, message, qualification_score, tags }).catch(console.error)

  supabaseAdmin.from('lead_activity').insert({
    lead_id: data.id,
    type: 'email_sent',
    notes: 'Template B — asset group inquiry confirmation + internal alert',
    created_by: 'system',
  }).then().catch(console.error)

  return NextResponse.json({ ok: true })
}
