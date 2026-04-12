import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { email, address, is_service_area, deal_signal, deal_arv, deal_flip_profit, deal_cash_flow, deal_condition } = body

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const serviceArea = is_service_area ?? false

  const tags: string[] = ['source:analyzer']
  if (serviceArea) tags.push('market:cook_county')
  else tags.push('market:national')
  if (deal_signal === 'green') tags.push('signal:strong')
  else if (deal_signal === 'yellow') tags.push('signal:marginal')
  else if (deal_signal === 'red') tags.push('signal:weak')
  if (deal_arv > 200000) tags.push('arv:high')
  if (deal_flip_profit > 30000) tags.push('flip:strong')
  if (deal_cash_flow > 300) tags.push('rental:strong')

  let qualification_score = 0
  if (serviceArea) qualification_score += 5
  if (deal_signal === 'green') qualification_score += 7
  else if (deal_signal === 'yellow') qualification_score += 3
  if (deal_flip_profit > 30000) qualification_score += 5
  if (deal_cash_flow > 300) qualification_score += 5
  // source is always 'analyzer' here (+0); 'asset_group' would add 3

  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(
      {
        email,
        address,
        is_service_area: serviceArea,
        deal_signal,
        deal_arv,
        deal_flip_profit,
        deal_cash_flow,
        deal_condition,
        source: 'analyzer',
        status: 'new',
        email_sequence: serviceArea ? 'cook_county_flow' : 'national_nurture',
        tags,
        qualification_score,
      },
      { onConflict: 'email', ignoreDuplicates: false }
    )
    .select('id')
    .single()

  if (error) {
    console.error('Lead capture error:', error)
    return NextResponse.json({ error: 'Failed to save lead' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id })
}
