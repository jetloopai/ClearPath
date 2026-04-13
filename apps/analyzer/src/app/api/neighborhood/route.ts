import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip || !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Invalid ZIP' }, { status: 400 })
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('analyses')
      .select('arv, flip_profit, monthly_cash_flow, deal_signal, created_at')
      .filter('input_address', 'ilike', `%${zip}%`)
      .not('arv', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !data || data.length === 0) {
      return NextResponse.json({ zip, count: 0, hasData: false })
    }

    const count = data.length
    const avgArv = Math.round(data.reduce((s, d) => s + (d.arv ?? 0), 0) / count)
    const avgFlip = Math.round(data.reduce((s, d) => s + (d.flip_profit ?? 0), 0) / count)
    const avgCashFlow = Math.round(data.reduce((s, d) => s + (d.monthly_cash_flow ?? 0), 0) / count)
    const greenCount = data.filter(d => d.deal_signal === 'green').length
    const greenPct = Math.round((greenCount / count) * 100)

    return NextResponse.json({
      zip,
      hasData: true,
      count,
      avgArv,
      avgFlip,
      avgCashFlow,
      greenPct,
    })
  } catch {
    return NextResponse.json({ zip, count: 0, hasData: false })
  }
}
