import { supabaseAdmin } from '@/lib/supabase-server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type SharedComp = {
  address?: string
  price?: number
  distanceMiles?: number
}

type SharedProvenance = {
  arvExplainer?: string
  rentSource?: 'manual' | 'nearby_listings' | 'formula'
  rentExplainer?: string
  subjectData?: {
    label?: string
    summary?: string
  }
}

type SharedInputs = {
  provenance?: SharedProvenance
}

const fmt = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)

const SIGNAL_STYLES: Record<string, { pill: string; dot: string; label: string }> = {
  green: { pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400', label: 'Strong Deal' },
  yellow: { pill: 'bg-amber-500/10 border-amber-500/20 text-amber-400', dot: 'bg-amber-400', label: 'Marginal Deal' },
  red: { pill: 'bg-red-500/10 border-red-500/20 text-red-400', dot: 'bg-red-400', label: 'Weak Deal' },
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const { data } = await supabaseAdmin
    .from('analyses')
    .select('input_address, arv, flip_profit')
    .eq('id', params.id)
    .single()

  if (!data) return { title: 'ClearPath Deal Analysis' }

  return {
    title: `${data.input_address} - ClearPath Deal Analysis`,
    description: `ARV ${fmt(data.arv)} · Flip profit ${fmt(data.flip_profit)}`,
  }
}

export default async function SharePage({ params }: { params: { id: string } }) {
  const { data: deal } = await supabaseAdmin
    .from('analyses')
    .select(`
      id, input_address, input_condition, input_purchase_price,
      arv, rehab_estimate, rehab_low, rehab_high,
      flip_profit, monthly_cash_flow, mao,
      deal_signal, deal_signal_flip, deal_signal_rental,
      arv_method, comps_used, results, inputs, created_at
    `)
    .eq('id', params.id)
    .single()

  if (!deal) notFound()

  const signal = deal.deal_signal ?? 'yellow'
  const flipSignal = deal.deal_signal_flip ?? 'yellow'
  const rentalSignal = deal.deal_signal_rental ?? 'yellow'
  const signalStyle = SIGNAL_STYLES[signal] ?? SIGNAL_STYLES.yellow
  const conditionLabel = (deal.input_condition as string).charAt(0).toUpperCase() + (deal.input_condition as string).slice(1)
  const comps = (deal.comps_used ?? []) as SharedComp[]
  const inputs = ((deal.inputs ?? {}) as SharedInputs)
  const provenance = inputs.provenance ?? {}
  const subjectData = provenance.subjectData
  const cashFlow: number = deal.monthly_cash_flow ?? 0
  const date = new Date(deal.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="min-h-screen bg-background text-foreground pt-28 pb-24 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <Link href="/" className="font-serif text-xl tracking-wide text-foreground mb-6 inline-block">
            ClearPath<span className="text-indigo-400">.</span>
          </Link>
          <div className="text-xs uppercase tracking-widest text-zinc-600 mb-3 mt-6">Shared Deal Analysis</div>
          <h1 className="text-2xl md:text-3xl font-light text-zinc-200 mb-2">{deal.input_address}</h1>
          <p className="text-xs text-zinc-600">
            {conditionLabel} condition · {deal.arv_method === 'comps_based' ? `ARV from ${comps.length} comps` : 'ARV shown as rough estimate'} · {date}
          </p>

          <div className={`inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full border text-sm font-medium ${signalStyle.pill}`}>
            <span className={`w-2 h-2 rounded-full ${signalStyle.dot}`} />
            {signalStyle.label}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: 'After Repair Value', value: fmt(deal.arv), color: 'text-foreground' },
            { label: 'Rehab Estimate', value: `${fmt(deal.rehab_low)} - ${fmt(deal.rehab_high)}`, color: 'text-foreground' },
            {
              label: 'Flip Profit',
              value: `${deal.flip_profit >= 0 ? '+' : ''}${fmt(deal.flip_profit)}`,
              color: flipSignal === 'green' ? 'text-emerald-400' : flipSignal === 'red' ? 'text-red-400' : 'text-amber-400',
            },
            {
              label: 'Monthly Cash Flow',
              value: `${cashFlow >= 0 ? '+' : ''}${fmt(cashFlow)}/mo`,
              color: rentalSignal === 'green' ? 'text-emerald-400' : rentalSignal === 'red' ? 'text-red-400' : 'text-amber-400',
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-panel rounded-2xl p-5 border border-white/[0.06]">
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">{label}</div>
              <div className={`text-xl font-serif font-medium ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="glass-panel rounded-2xl p-5 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">ARV Source</div>
            <div className="text-sm text-zinc-200">{deal.arv_method === 'comps_based' ? 'Comps-based' : 'Rough estimate'}</div>
            <p className="text-xs text-zinc-500 mt-2">{provenance.arvExplainer ?? 'ARV provenance unavailable.'}</p>
          </div>
          <div className="glass-panel rounded-2xl p-5 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Rent Source</div>
            <div className="text-sm text-zinc-200">
              {provenance.rentSource === 'manual' ? 'Manual override' : provenance.rentSource === 'nearby_listings' ? 'Nearby listings' : 'Formula estimate'}
            </div>
            <p className="text-xs text-zinc-500 mt-2">{provenance.rentExplainer ?? 'Rent provenance unavailable.'}</p>
          </div>
          <div className="glass-panel rounded-2xl p-5 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Subject Facts</div>
            <div className="text-sm text-zinc-200">{subjectData?.label ?? 'Property details'}</div>
            <p className="text-xs text-zinc-500 mt-2">{subjectData?.summary ?? 'Subject-data provenance unavailable.'}</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-white/[0.06] mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Max Allowable Offer (70% Rule)</div>
              <div className={`text-2xl font-serif font-medium ${deal.input_purchase_price <= deal.mao ? 'text-emerald-400' : 'text-red-400'}`}>
                {fmt(deal.mao)}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-500">
              {deal.input_purchase_price <= deal.mao
                ? <span className="text-emerald-400">{fmt(deal.mao - deal.input_purchase_price)} under MAO</span>
                : <span className="text-red-400">{fmt(deal.input_purchase_price - deal.mao)} over MAO</span>}
              <div className="text-zinc-600 mt-0.5">Listed at {fmt(deal.input_purchase_price)}</div>
            </div>
          </div>
        </div>

        {comps.length > 0 && (
          <div className="glass-panel rounded-2xl p-5 border border-white/[0.06] mb-8">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Comparable Sales Used</div>
            <div className="space-y-2">
              {comps.slice(0, 5).map((comp, index: number) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 truncate mr-4">{comp.address}</span>
                  <div className="flex gap-3 shrink-0 text-zinc-500">
                    <span>{fmt(comp.price ?? 0)}</span>
                    <span className="text-zinc-700">{comp.distanceMiles !== undefined ? `${comp.distanceMiles.toFixed(2)} mi` : 'n/a'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center">
          <p className="text-xs text-zinc-600 mb-4">Want to analyze your own deal?</p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium hover:bg-indigo-500/20 transition-colors"
          >
            Analyze a Deal →
          </Link>
          <p className="text-[11px] text-zinc-700 mt-6">
            Generated by ClearPath · Estimates for educational purposes only
          </p>
        </div>
      </div>
    </div>
  )
}
