import { supabaseAdmin } from '@/lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OfferSignForm } from '@/components/OfferSignForm'
import { DownloadSignedOfferButton } from '@/components/DownloadSignedOfferButton'

export const dynamic = 'force-dynamic'
// Belt-and-suspenders: `dynamic = 'force-dynamic'` alone was observed NOT
// preventing a stale on-disk fetch cache from serving a pre-sign snapshot of
// this page after the offer had actually been signed (verified against the DB
// directly). Signature status must always be read live — a seller could
// otherwise see a stale "not yet signed" state, or the page could let someone
// attempt to sign an already-signed offer.
export const fetchCache = 'force-no-store'
export const revalidate = 0

const fmt = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

const fmtDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { data } = await supabaseAdmin.from('offers').select('address, offer_price').eq('id', params.id).single()
  if (!data) return { title: 'ClearPath Purchase Offer' }
  return { title: `Purchase Offer — ${data.address}`, description: `${fmt(data.offer_price)} cash offer` }
}

export default async function SignOfferPage({ params }: { params: { id: string } }) {
  const { data: offer } = await supabaseAdmin
    .from('offers')
    .select(`
      id, address, buyer_name, offer_price, earnest_money, closing_days, inspection_days,
      expiration_days, arv, rehab_estimate, mao, seller_email, status, expires_at,
      signed_at, signer_name, signature_data, created_at
    `)
    .eq('id', params.id)
    .single()

  if (!offer) notFound()

  const isSigned = offer.status === 'signed'
  const isExpired = !isSigned && new Date(offer.expires_at) < new Date()
  const closingDate = new Date(new Date(offer.created_at).getTime() + offer.closing_days * 24 * 60 * 60 * 1000)

  const reportPayload = {
    address: offer.address,
    buyerName: offer.buyer_name,
    offerPrice: offer.offer_price,
    earnestMoney: offer.earnest_money,
    closingDays: offer.closing_days,
    inspectionDays: offer.inspection_days,
    expirationDays: offer.expiration_days,
    results: { arv: offer.arv ?? offer.mao, rehabEstimate: offer.rehab_estimate ?? 0 },
    customRehab: offer.rehab_estimate ?? 0,
    createdAt: offer.created_at,
    signatureDataUrl: offer.signature_data,
    signerName: offer.signer_name,
    signedAt: offer.signed_at,
  }
  const addressSlug = offer.address.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50)

  return (
    <div className="min-h-screen bg-background text-foreground pt-28 pb-24 px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <Link href="/" className="font-serif text-xl tracking-wide text-foreground mb-6 inline-block">
            ClearPath<span className="text-indigo-400">.</span>
          </Link>
          <div className="text-xs uppercase tracking-widest text-zinc-600 mb-3 mt-6">Purchase Offer</div>
          <h1 className="text-2xl md:text-3xl font-light text-zinc-200 mb-2">{offer.address}</h1>
          <p className="text-xs text-zinc-600">From {offer.buyer_name}</p>
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-white/[0.06] mb-6">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Offer Price</div>
          <div className="text-3xl font-serif font-medium text-foreground mb-5">{fmt(offer.offer_price)}</div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Earnest Money</span><span className="text-zinc-300">{fmt(offer.earnest_money)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Terms</span><span className="text-zinc-300">Cash — no financing contingency</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Condition</span><span className="text-zinc-300">As-is</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Inspection Period</span><span className="text-zinc-300">{offer.inspection_days} days from acceptance</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Target Closing</span><span className="text-zinc-300">{fmtDate(closingDate)}</span></div>
          </div>
        </div>

        {isSigned ? (
          <div className="glass-panel rounded-2xl p-6 border border-emerald-500/20 bg-emerald-500/5 text-center">
            <div className="text-emerald-400 text-sm font-medium mb-1">✓ Signed</div>
            <p className="text-zinc-400 text-sm mb-5">
              Signed by {offer.signer_name} on {fmtDate(offer.signed_at!)}
            </p>
            <DownloadSignedOfferButton reportPayload={reportPayload} addressSlug={addressSlug} />
          </div>
        ) : isExpired ? (
          <div className="glass-panel rounded-2xl p-6 border border-white/[0.06] text-center">
            <div className="text-zinc-400 text-sm font-medium mb-1">This offer has expired</div>
            <p className="text-zinc-500 text-sm">Contact the buyer directly if you'd like to discuss a new offer.</p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl p-6 border border-white/[0.06]">
            <p className="text-xs text-zinc-500 mb-5">
              This offer is submitted for your consideration and does not constitute a binding contract until a
              formal purchase and sale agreement is signed by both parties. Offer expires {fmtDate(offer.expires_at)}.
            </p>
            <OfferSignForm offerId={offer.id} />
          </div>
        )}

        <p className="text-[11px] text-zinc-700 mt-8 text-center">
          Generated by ClearPath Analyzer · Not a binding contract until countersigned
        </p>
      </div>
    </div>
  )
}
