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

  // Check if lead already exists
  const { data: existing } = await supabaseAdmin
    .from('leads')
    .select('id, tags, email_sequence')
    .eq('email', email)
    .single()

  if (existing) {
    // Lead exists — just add newsletter_subscriber tag without overwriting their flow
    const currentTags: string[] = existing.tags ?? []
    if (!currentTags.includes('newsletter_subscriber')) {
      await supabaseAdmin
        .from('leads')
        .update({ tags: [...currentTags, 'newsletter_subscriber'] })
        .eq('id', existing.id)
    }
  } else {
    // New lead — insert as newsletter subscriber with national nurture flow
    const { error } = await supabaseAdmin.from('leads').insert({
      email,
      address: zip ? `ZIP ${zip}` : undefined,
      source: 'content',
      status: 'nurture',
      email_sequence: 'national_nurture',
      tags: ['source:content', 'newsletter_subscriber'],
    })
    if (error) {
      console.error('Newsletter subscribe error:', error)
      return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
  }

  sendNewsletterWelcome(email).catch(console.error)

  return NextResponse.json({ ok: true })
}
