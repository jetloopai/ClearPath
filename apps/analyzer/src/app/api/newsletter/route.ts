import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendNewsletterWelcome } from '@/lib/email'
import { checkRateLimit, getIp } from '@/lib/rateLimit'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const { email, zip } = await req.json()

  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(
      {
        email,
        address: zip ? `ZIP ${zip}` : undefined,
        source: 'content',
        status: 'nurture',
        email_sequence: 'national_nurture',
        tags: ['source:content', 'newsletter_subscriber'],
      },
      { onConflict: 'email', ignoreDuplicates: true }
    )
    .select('id')
    .single()

  if (error && error.code !== '23505') {
    console.error('Newsletter subscribe error:', error)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }

  sendNewsletterWelcome(email).catch(console.error)

  return NextResponse.json({ ok: true })
}
