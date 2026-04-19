import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  sendNationalNurtureStep2, sendNationalNurtureStep3, sendNationalNurtureStep4, sendNationalNurtureStep5,
  sendCookCountyStep2, sendCookCountyStep3, sendCookCountyStep4,
  sendAssetGroupStep2,
} from '@/lib/email'

// Intervals (ms) between steps per sequence
const NEXT: Record<string, Record<number, number | null>> = {
  national_nurture: {
    2: 3 * 86400000,   // step 2 done → +3d until step 3
    3: 5 * 86400000,   // step 3 done → +5d until step 4
    4: 20 * 86400000,  // step 4 done → +20d until step 5
    5: null,           // done
  },
  cook_county_flow: {
    2: 2 * 86400000,   // +2d
    3: 4 * 86400000,   // +4d
    4: null,           // done
  },
  asset_group_inquiry: {
    2: null,           // done after step 2
  },
}

async function sendDrip(lead: { id: string; email: string; address?: string; name?: string; email_sequence: string; sequence_step: number }) {
  const { email, address, name, email_sequence, sequence_step } = lead

  if (email_sequence === 'national_nurture') {
    if (sequence_step === 2) await sendNationalNurtureStep2(email, address)
    else if (sequence_step === 3) await sendNationalNurtureStep3(email)
    else if (sequence_step === 4) await sendNationalNurtureStep4(email)
    else if (sequence_step === 5) await sendNationalNurtureStep5(email)
  } else if (email_sequence === 'cook_county_flow') {
    if (sequence_step === 2) await sendCookCountyStep2(email, address)
    else if (sequence_step === 3) await sendCookCountyStep3(email, address)
    else if (sequence_step === 4) await sendCookCountyStep4(email)
  } else if (email_sequence === 'asset_group_inquiry') {
    if (sequence_step === 2) await sendAssetGroupStep2(email, name, address)
  }
}

export async function POST(req: NextRequest) {
  // Verify cron secret
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, email, address, name, email_sequence, sequence_step')
    .lte('next_email_at', now)
    .eq('sequence_paused', false)
    .not('email_sequence', 'is', null)
    .not('next_email_at', 'is', null)
    .limit(100)

  if (error) {
    console.error('Drip cron query error:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  let sent = 0
  let errors = 0

  for (const lead of leads ?? []) {
    try {
      await sendDrip(lead)

      const seq = lead.email_sequence as string
      const step = lead.sequence_step as number
      const nextInterval = NEXT[seq]?.[step] ?? null
      const nextEmailAt = nextInterval ? new Date(Date.now() + nextInterval).toISOString() : null

      await supabaseAdmin
        .from('leads')
        .update({
          sequence_step: step + 1,
          next_email_at: nextEmailAt,
        })
        .eq('id', lead.id)

      await supabaseAdmin.from('lead_activity').insert({
        lead_id: lead.id,
        type: 'email_sent',
        notes: `Drip step ${step} — ${seq}`,
        created_by: 'cron',
      })

      sent++
    } catch (err) {
      console.error(`Drip send failed for lead ${lead.id}:`, err)
      errors++
    }
  }

  return NextResponse.json({ sent, errors, total: leads?.length ?? 0 })
}

// Also allow GET so Vercel cron can call it (Vercel crons use GET)
export async function GET(req: NextRequest) {
  return POST(req)
}
