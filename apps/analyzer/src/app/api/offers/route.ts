import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getIp } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendSignatureRequestEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const ip = getIp(req)
  const { allowed } = checkRateLimit(ip, { windowMs: 60_000, max: 10 })
  if (!allowed) return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 })

  const body = await req.json()
  const {
    analysisId, address, buyerName, buyerRepresentativeName, sellerName, offerPrice, earnestMoney, closingDays,
    inspectionDays, expirationDays, arv, rehabEstimate, mao, sellerEmail,
  } = body as {
    analysisId?: string
    address: string
    buyerName: string
    buyerRepresentativeName?: string
    sellerName?: string
    offerPrice: number
    earnestMoney: number
    closingDays: number
    inspectionDays: number
    expirationDays: number
    arv?: number
    rehabEstimate?: number
    mao?: number
    sellerEmail?: string
  }

  if (!address || !buyerName?.trim() || !offerPrice || offerPrice <= 0) {
    return NextResponse.json({ error: 'address, buyerName, and offerPrice are required' }, { status: 400 })
  }

  const closing = closingDays && closingDays > 0 ? Math.round(closingDays) : 21
  const inspection = inspectionDays && inspectionDays > 0 ? Math.round(inspectionDays) : 5
  const expiration = expirationDays && expirationDays > 0 ? Math.round(expirationDays) : 3
  const earnest = earnestMoney && earnestMoney > 0 ? Math.round(earnestMoney) : 1000
  const expiresAt = new Date(Date.now() + expiration * 24 * 60 * 60 * 1000).toISOString()

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  let userId: string | null = null
  if (token) {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    userId = user?.id ?? null
  }

  const { data: offer, error } = await supabaseAdmin
    .from('offers')
    .insert({
      analysis_id: analysisId ?? null,
      user_id: userId,
      address,
      buyer_name: buyerName.trim(),
      buyer_representative_name: buyerRepresentativeName?.trim() || null,
      seller_name: sellerName?.trim() || null,
      offer_price: Math.round(offerPrice),
      earnest_money: earnest,
      closing_days: closing,
      inspection_days: inspection,
      expiration_days: expiration,
      arv: arv ?? null,
      rehab_estimate: rehabEstimate ?? null,
      mao: mao ?? null,
      seller_email: sellerEmail?.trim() || null,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !offer) {
    console.error('Offer insert error:', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }

  const origin = req.headers.get('origin') ?? new URL(req.url).origin
  const signingUrl = `${origin}/sign/${offer.id}`

  if (sellerEmail?.trim()) {
    try {
      await sendSignatureRequestEmail(sellerEmail.trim(), signingUrl, address, Math.round(offerPrice))
    } catch (err) {
      console.error('Signature request email failed:', err)
      // Non-fatal — the offer still exists and the buyer can share the link manually.
    }
  }

  return NextResponse.json({ offerId: offer.id, signingUrl })
}
