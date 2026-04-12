'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, TrendingUp } from 'lucide-react'
import { useSupabaseBrowser } from '@/lib/supabase-browser'

interface UpgradeModalProps {
  currentPlan: string
  onClose: () => void
}

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$29.99',
    period: '/month',
    reports: '50 reports/month',
    icon: Zap,
    color: 'indigo',
    features: ['50 deal analyses/month', 'Auto-pull comps + rent data', 'ARV, flip profit & cash flow', 'Export & share reports'],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$99',
    period: '/month',
    reports: '300 reports/month',
    icon: TrendingUp,
    color: 'violet',
    highlight: true,
    features: ['300 deal analyses/month', 'Everything in Starter', 'Priority for high-volume investors', 'Run multiple markets at once'],
  },
]

export function UpgradeModal({ currentPlan, onClose }: UpgradeModalProps) {
  const supabase = useSupabaseBrowser()
  const [loading, setLoading] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])

  const visiblePlans = currentPlan === 'starter'
    ? PLANS.filter(p => p.key === 'pro')
    : PLANS

  async function handleUpgrade(planKey: string) {
    setLoading(planKey)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setLoading(null)
    }
  }

  const headline = currentPlan === 'free'
    ? "You've used all 3 free reports"
    : `You've used all your ${currentPlan === 'starter' ? '50' : '300'} reports this month`

  const subtext = currentPlan === 'free'
    ? 'Upgrade to keep analyzing deals and finding your next investment.'
    : 'Upgrade to Pro for 300 reports/month.'

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      >
        <motion.div
          className="relative w-full max-w-lg bg-zinc-900 border border-white/[0.08] rounded-3xl p-8 shadow-2xl"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>

          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
              <TrendingUp size={22} className="text-indigo-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">{headline}</h2>
            <p className="text-sm text-zinc-400">{subtext}</p>
          </div>

          <div className={`grid gap-4 ${visiblePlans.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {visiblePlans.map((plan) => {
              const Icon = plan.icon
              return (
                <div
                  key={plan.key}
                  className={`relative rounded-2xl p-5 border ${
                    plan.highlight
                      ? 'border-violet-500/40 bg-violet-500/10'
                      : 'border-white/[0.08] bg-white/[0.03]'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-600 text-white px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={16} className={plan.highlight ? 'text-violet-400' : 'text-indigo-400'} />
                    <span className="text-sm font-semibold text-white">{plan.name}</span>
                  </div>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-white">{plan.price}</span>
                    <span className="text-sm text-zinc-500">{plan.period}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">{plan.reports}</p>
                  <ul className="space-y-1.5 mb-5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">
                        <span className={`mt-0.5 ${plan.highlight ? 'text-violet-400' : 'text-indigo-400'}`}>✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(plan.key)}
                    disabled={loading !== null}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      plan.highlight
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    } disabled:opacity-50`}
                  >
                    {loading === plan.key ? 'Redirecting...' : `Upgrade to ${plan.name}`}
                  </button>
                </div>
              )
            })}
          </div>

          <p className="text-center text-xs text-zinc-600 mt-5">
            Cancel anytime · Secure checkout via Stripe
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
