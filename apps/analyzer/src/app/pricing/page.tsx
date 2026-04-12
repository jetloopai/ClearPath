"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";

const PLANS = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try it out. No commitment.",
    color: "border-white/[0.08]",
    highlight: false,
    features: [
      "3 deal analyses (lifetime)",
      "Full ARV from real comps",
      "Rehab estimate by condition",
      "Rental & BRRRR analysis",
      "AI photo condition assessment",
      "Deal sheet PDF export",
      "Shareable report links",
      "Saved deals dashboard",
    ],
    cta: "Start for free",
    ctaStyle: "bg-white/[0.05] border border-white/[0.1] text-zinc-300 hover:bg-white/[0.1]",
  },
  {
    key: "starter",
    name: "Starter",
    price: "$29.99",
    period: "/month",
    description: "For active investors running deals regularly.",
    color: "border-indigo-500/40 bg-indigo-500/5",
    highlight: false,
    features: [
      "50 analyses/month",
      "Everything in Free",
      "Credits reset monthly",
      "Cancel anytime",
    ],
    cta: "Upgrade to Starter",
    ctaStyle: "bg-indigo-600 hover:bg-indigo-500 text-white",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$99",
    period: "/month",
    description: "For high-volume investors and wholesalers.",
    color: "border-violet-500/40 bg-violet-500/5",
    highlight: true,
    features: [
      "300 analyses/month",
      "Everything in Starter",
      "Run multiple markets at once",
      "Priority for high-volume use",
    ],
    cta: "Upgrade to Pro",
    ctaStyle: "bg-violet-600 hover:bg-violet-500 text-white",
  },
];

const FEATURES = [
  { label: "Deal analyses", free: "3 total", starter: "50 / mo", pro: "300 / mo" },
  { label: "ARV from real comps", free: true, starter: true, pro: true },
  { label: "Rehab estimate", free: true, starter: true, pro: true },
  { label: "Rental & cash flow", free: true, starter: true, pro: true },
  { label: "BRRRR analysis", free: true, starter: true, pro: true },
  { label: "AI photo condition", free: true, starter: true, pro: true },
  { label: "Deal sheet PDF", free: true, starter: true, pro: true },
  { label: "Shareable links", free: true, starter: true, pro: true },
  { label: "Saved dashboard", free: true, starter: true, pro: true },
  { label: "Monthly credit reset", free: "—", starter: true, pro: true },
];

const FAQ = [
  {
    q: "Do I need a credit card to start?",
    a: "No. Sign up with your email and get 3 full analyses at no cost. No card required until you decide to upgrade.",
  },
  {
    q: "When do my monthly credits reset?",
    a: "Credits reset at the start of each billing period — the same date you upgraded. So if you subscribed on the 15th, they reset on the 15th every month.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your dashboard at any time. You keep access to your plan's credits until the end of the billing period.",
  },
  {
    q: "What happens if I run out of analyses mid-month?",
    a: "You'll see an upgrade prompt when you try to run the next analysis. There are no automatic charges or surprise overages — you choose when to upgrade.",
  },
];

function Cell({ val }: { val: boolean | string }) {
  if (val === true) return <span className="text-emerald-400">✓</span>;
  if (val === false || val === "—") return <span className="text-zinc-700">—</span>;
  return <span className="text-zinc-300 text-xs">{val}</span>;
}

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function handleUpgrade(planKey: string) {
    if (planKey === "free") {
      window.location.href = "/analyze";
      return;
    }
    setLoading(planKey);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen pt-28 pb-24 px-6">
      <div className="max-w-5xl mx-auto">

        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 mb-6">
            <span className="text-xs text-indigo-300 font-medium">3 reports on us — no card needed</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif text-foreground mb-4">Simple, transparent pricing.</h1>
          <p className="text-zinc-500 text-lg max-w-xl mx-auto">
            Start analyzing deals for free. Upgrade when you need more.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative glass-panel rounded-3xl p-8 border ${plan.color}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-violet-600 text-white px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="mb-6">
                <div className={`text-xs uppercase tracking-widest mb-2 ${plan.key === "pro" ? "text-violet-400" : plan.key === "starter" ? "text-indigo-400" : "text-zinc-500"}`}>
                  {plan.name}
                </div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-4xl font-serif text-foreground">{plan.price}</span>
                  <span className="text-sm text-zinc-500 mb-1">{plan.period}</span>
                </div>
                <p className="text-xs text-zinc-500">{plan.description}</p>
              </div>
              <ul className="space-y-2.5 mb-8">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">
                    <Check size={12} className={`mt-0.5 shrink-0 ${plan.key === "pro" ? "text-violet-400" : "text-indigo-400"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={loading !== null}
                className={`w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${plan.ctaStyle}`}
              >
                {loading === plan.key ? "Redirecting..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Feature table */}
        <div className="mb-20">
          <div className="text-xs uppercase tracking-widest text-zinc-600 text-center mb-8">Everything compared</div>
          <div className="glass-panel rounded-3xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left p-5 text-zinc-500 font-normal text-xs">Feature</th>
                  <th className="p-5 text-zinc-400 font-medium text-xs text-center">Free</th>
                  <th className="p-5 text-indigo-400 font-medium text-xs text-center">Starter</th>
                  <th className="p-5 text-violet-400 font-medium text-xs text-center">Pro</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((row, i) => (
                  <tr key={row.label} className={i < FEATURES.length - 1 ? "border-b border-white/[0.04]" : ""}>
                    <td className="p-5 text-xs text-zinc-400">{row.label}</td>
                    <td className="p-5 text-center text-sm"><Cell val={row.free} /></td>
                    <td className="p-5 text-center text-sm"><Cell val={row.starter} /></td>
                    <td className="p-5 text-center text-sm"><Cell val={row.pro} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto mb-20">
          <div className="text-xs uppercase tracking-widest text-zinc-600 text-center mb-8">Common questions</div>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <div key={i} className="glass-panel rounded-2xl border border-white/[0.06] overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm text-zinc-200 hover:text-white transition-colors"
                >
                  {item.q}
                  <ChevronDown size={16} className={`shrink-0 text-zinc-500 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-xs text-zinc-400 leading-relaxed border-t border-white/[0.04] pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <p className="text-zinc-500 mb-4">Ready to analyze your first deal?</p>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-foreground text-background font-medium text-sm hover:bg-zinc-200 transition-colors"
          >
            Start for free →
          </Link>
          <p className="text-xs text-zinc-600 mt-3">3 full analyses included. No credit card required.</p>
        </div>

      </div>
    </main>
  );
}
