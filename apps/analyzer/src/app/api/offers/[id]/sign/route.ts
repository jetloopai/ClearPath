import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIp } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = getIp(req)
  const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 5 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  const body = await req.json()
  const { signatureDataUrl, signerName, agreed } = body as {
    signatureDataUrl?: string
    signerName?: string
    agreed?: boolean
  }

  if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/png;base64,')) {
    return NextResponse.json({ error: 'A drawn signature is required' }, { status: 400 })
  }
  if (!signerName?.trim()) {
    return NextResponse.json({ error: 'Signer name is required' }, { status: 400 })
  }
  if (!agreed) {
    return NextResponse.json({ error: 'You must agree to the terms to sign' }, { status: 400 })
  }

  const { data: offer, error: fetchError } = await supabaseAdmin
    .from('offers')
    .select('id, status, expires_at')
    .eq('id', params.id)
    .single()

  if (fetchError || !offer) {
    return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
  }
  if (offer.status === 'signed') {
    return NextResponse.json({ error: 'This offer has already been signed' }, { status: 409 })
  }
  if (offer.status !== 'pending' || new Date(offer.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This offer has expired' }, { status: 410 })
  }

  const { error: updateError } = await supabaseAdmin
    .from('offers')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signer_name: signerName.trim(),
      signature_data: signatureDataUrl,
      signer_ip: ip,
      agreed_to_terms: true,
    })
    .eq('id', params.id)
    .eq('status', 'pending') // guards against a signing race between two concurrent submits

  if (updateError) {
    console.error('Offer sign update error:', updateError)
    return NextResponse.json({ error: 'Failed to record signature' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
