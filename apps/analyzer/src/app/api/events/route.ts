import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const ALLOWED_EVENTS = new Set([
  'analysis_started', 'analysis_complete', 'page_view',
  'share_clicked', 'upgrade_clicked', 'report_downloaded',
])

export async function POST(req: NextRequest) {
  try {
    const { event, properties, ts } = await req.json()
    if (!event || !ALLOWED_EVENTS.has(event)) return NextResponse.json({ ok: true })

    await supabaseAdmin.from('analytics_events').insert({
      event_name: event,
      properties: properties ?? {},
      occurred_at: ts ? new Date(ts).toISOString() : new Date().toISOString(),
    })
  } catch {
    // Never let analytics errors surface to the client
  }
  return NextResponse.json({ ok: true })
}
