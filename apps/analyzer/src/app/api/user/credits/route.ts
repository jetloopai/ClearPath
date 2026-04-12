import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('plan, credits_remaining, credits_monthly, current_period_end')
    .eq('id', user.id)
    .single()

  if (!profile) {
    // Profile not yet created (race condition on sign-up) — return free defaults
    return NextResponse.json({ plan: 'free', credits_remaining: 3, credits_monthly: 3 })
  }

  return NextResponse.json(profile)
}
