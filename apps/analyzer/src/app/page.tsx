"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { PlacesAutocomplete } from "@/components/maps/PlacesAutocomplete";
import { Search, BookOpen, Share2, LayoutDashboard, Camera, TrendingUp, BarChart2 } from "lucide-react";

const ConfigModal = dynamic(() => import("@/components/ConfigModal").then(m => m.ConfigModal), { ssr: false });

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

export default function Home() {
  const [address, setAddress] = useState("");
  const [county, setCounty] = useState("");
  const [showModal, setShowModal] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addr = params.get("address");
    if (addr) {
      setAddress(addr);
      setShowModal(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setShowModal(true);
  };

  const handleAddressSelect = (selectedAddress: string, selectedCounty: string) => {
    setAddress(selectedAddress);
    setCounty(selectedCounty);
  };

  return (
    <>
      <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6 pt-32">
        {/* Background orb */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-indigo-950/20 rounded-full blur-[180px]" />
          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#050505] to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center">

          {/* Trust pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-indigo-300 font-medium">5,000+ deals analyzed across the US</span>
          </div>

          {/* Headline */}
          <h1 className="mb-6">
            <span className="block text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-sans font-extralight tracking-tight text-zinc-500">
              Analyze the
            </span>
            <span className="block text-4xl sm:text-6xl md:text-8xl lg:text-[10rem] font-serif font-bold italic text-foreground leading-none mt-2">
              Deal.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-500 font-light max-w-xl mx-auto mb-6">
            ARV, rehab, rent, and flip profit — on any US property, instantly.
          </p>

          {/* Hero Input */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-3">
            <div className="relative flex items-center rounded-full bg-white/[0.04] border border-white/[0.08] focus-within:border-indigo-500/40 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-300">
              <Search className="absolute left-6 w-5 h-5 text-zinc-600" />
              <PlacesAutocomplete
                onSelect={handleAddressSelect}
                placeholder="Enter property address..."
                className="w-full bg-transparent pl-14 pr-6 sm:pr-40 py-4 sm:py-5 text-base sm:text-lg text-foreground placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                type="submit"
                className="hidden sm:block absolute right-3 px-6 py-2.5 text-base font-medium text-indigo-400 hover:text-indigo-300 transition-colors rounded-full hover:bg-white/[0.04]"
              >
                Analyze Deal →
              </button>
            </div>
            {/* Mobile submit button */}
            <button
              type="submit"
              className="sm:hidden w-full py-4 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-sm font-medium text-indigo-300 hover:bg-indigo-500/30 transition-colors"
            >
              Analyze Deal →
            </button>
          </form>

          <p className="text-sm text-zinc-500 mt-3">
            3 reports on us. <span className="text-zinc-400">No card needed.</span>
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6 mb-10">
            {[
              { icon: "✦", label: "AI photo condition assessment" },
              { icon: "◎", label: "Real comp-based ARV" },
              { icon: "⌗", label: "Flip, rental & BRRRR analysis" },
            ].map(({ icon, label }) => (
              <div key={label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/[0.07] bg-white/[0.02]">
                <span className="text-indigo-400 text-xs">{icon}</span>
                <span className="text-xs text-zinc-500">{label}</span>
              </div>
            ))}
          </div>

          {/* Stats strip */}
          <div className="flex items-center justify-center gap-4 md:gap-10 mt-10">
            {[
              { value: "5,000+", label: "Deals Analyzed" },
              { value: "$1.8B", label: "Property Value Assessed" },
              { value: "50 States", label: "Coverage" },
            ].map(({ value, label }, i, arr) => (
              <React.Fragment key={label}>
                <div className="text-center">
                  <div className="text-xl md:text-2xl font-serif text-zinc-200">{value}</div>
                  <div className="text-[11px] text-zinc-600 uppercase tracking-widest mt-0.5">{label}</div>
                </div>
                {i < arr.length - 1 && <div className="w-px h-8 bg-white/[0.06]" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 w-full max-w-xl mx-auto mt-16 text-center px-6">
          <blockquote className="text-zinc-400 text-base italic leading-relaxed">
            "Finally a tool that actually runs real comps. Closed two deals this quarter using ClearPath numbers."
          </blockquote>
          <p className="text-xs text-zinc-600 mt-3">— Real estate investor, Chicago IL</p>
        </div>

        {/* Sample output preview */}
        <div className="relative z-10 w-full max-w-lg mx-auto mt-20 mb-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-xs uppercase tracking-widest text-zinc-600">Sample output</div>
            <div className="text-[11px] text-zinc-700 italic">Partial preview only — full report has 10+ sections</div>
          </div>
          <div className="relative glass-panel rounded-[2rem] p-8 border border-white/[0.06] overflow-hidden">
            {/* Address header */}
            <div className="mb-5">
              <div className="text-xs text-zinc-600 uppercase tracking-widest mb-1">Deal Analysis</div>
              <div className="text-zinc-300 font-medium">1234 W Chicago Ave, Chicago, IL</div>
              <div className="text-xs text-zinc-600 mt-0.5">Medium condition · ARV from 5 nearby comps</div>
            </div>

            {/* Signal badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Strong Flip · Positive Cash Flow</span>
            </div>

            {/* Key numbers */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "After Repair Value", value: fmt(215000), color: "text-foreground" },
                { label: "Rehab Estimate", value: "$28K – $42K", color: "text-foreground" },
                { label: "Flip Profit", value: "+$38,000", color: "text-emerald-400" },
                { label: "Monthly Cash Flow", value: "+$310/mo", color: "text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/[0.02] rounded-2xl p-4 border border-white/[0.04]">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">{label}</div>
                  <div className={`text-lg font-serif font-medium ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* Fade overlay */}
            <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none rounded-b-[2rem]" />
          </div>
          <p className="text-center text-[11px] text-zinc-700 mt-2">
            Full report includes ARV comps, rental P&L, BRRRR analysis, flip waterfall, MAO, and more.
          </p>
        </div>

        {/* Everything Included */}
        <div className="relative z-10 w-full max-w-3xl mx-auto mt-16 mb-4">
          <div className="text-xs uppercase tracking-widest text-zinc-600 text-center mb-6">Everything included</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: BookOpen, title: "Deal Sheets", desc: "Download a 1-page PDF deal sheet for lenders and partners." },
              { icon: Share2, title: "Share Any Analysis", desc: "Send a link — anyone can view your full report, no login needed." },
              { icon: LayoutDashboard, title: "Saved Deals", desc: "Every analysis auto-saves to your personal dashboard." },
              { icon: Camera, title: "AI Photo Assessment", desc: "Upload photos for an instant condition grade and scope of work." },
              { icon: TrendingUp, title: "BRRRR & Rental Analysis", desc: "Full rental P&L, BRRRR projections, and cash-on-cash return." },
              { icon: BarChart2, title: "Market Insights", desc: "See avg ARV and deal quality trends by ZIP across the US." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-panel rounded-2xl p-5 border border-white/[0.06]">
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 mb-3">
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-sm font-medium text-zinc-200 mb-1">{title}</div>
                <p className="text-xs text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing preview */}
        <div className="relative z-10 w-full max-w-3xl mx-auto mt-20 mb-4 text-center">
          <div className="text-xs uppercase tracking-widest text-zinc-600 mb-2">Simple pricing</div>
          <h2 className="text-2xl font-serif text-foreground mb-8">Start free. Upgrade when you&apos;re ready.</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="glass-panel rounded-2xl p-6 border border-white/[0.06]">
              <div className="text-xs uppercase tracking-widest text-zinc-600 mb-3">Free</div>
              <div className="text-3xl font-serif text-foreground mb-1">$0</div>
              <div className="text-xs text-zinc-500 mb-5">forever</div>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex gap-2"><span className="text-indigo-400">✓</span>3 deal analyses</li>
                <li className="flex gap-2"><span className="text-indigo-400">✓</span>Full ARV + rehab + rental</li>
                <li className="flex gap-2"><span className="text-indigo-400">✓</span>Dashboard &amp; PDF export</li>
                <li className="flex gap-2"><span className="text-indigo-400">✓</span>No credit card needed</li>
              </ul>
            </div>
            <div className="glass-panel rounded-2xl p-6 border border-indigo-500/30 bg-indigo-500/5">
              <div className="text-xs uppercase tracking-widest text-indigo-400 mb-3">Starter</div>
              <div className="text-3xl font-serif text-foreground mb-1">$29.99</div>
              <div className="text-xs text-zinc-500 mb-5">/month</div>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex gap-2"><span className="text-indigo-400">✓</span>50 analyses/month</li>
                <li className="flex gap-2"><span className="text-indigo-400">✓</span>Everything in Free</li>
                <li className="flex gap-2"><span className="text-indigo-400">✓</span>Share reports</li>
                <li className="flex gap-2"><span className="text-indigo-400">✓</span>Cancel anytime</li>
              </ul>
            </div>
            <div className="glass-panel rounded-2xl p-6 border border-violet-500/30 bg-violet-500/5">
              <div className="text-xs uppercase tracking-widest text-violet-400 mb-3">Pro</div>
              <div className="text-3xl font-serif text-foreground mb-1">$99</div>
              <div className="text-xs text-zinc-500 mb-5">/month</div>
              <ul className="space-y-2 text-xs text-zinc-400">
                <li className="flex gap-2"><span className="text-violet-400">✓</span>300 analyses/month</li>
                <li className="flex gap-2"><span className="text-violet-400">✓</span>Everything in Starter</li>
                <li className="flex gap-2"><span className="text-violet-400">✓</span>High-volume investors</li>
                <li className="flex gap-2"><span className="text-violet-400">✓</span>Multiple markets</li>
              </ul>
            </div>
          </div>
          <a href="/pricing" className="inline-block mt-6 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            See full pricing →
          </a>
        </div>

        {/* How It Works */}
        <div className="relative z-10 w-full max-w-3xl mx-auto mt-16 mb-16">
          <div className="text-xs uppercase tracking-widest text-zinc-600 text-center mb-6">How it works</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { step: "01", title: "Enter Address", desc: "Type any US property address to get started." },
              { step: "02", title: "Review Numbers", desc: "Get ARV, rehab, rent, and profit estimates." },
              { step: "03", title: "Make Offers", desc: "Use your MAO to negotiate with confidence." },
            ].map((item) => (
              <div key={item.step} className="glass-panel rounded-[2rem] p-6">
                <div className="text-3xl font-serif text-indigo-500/30 mb-3">{item.step}</div>
                <h3 className="text-sm font-medium text-foreground mb-1">{item.title}</h3>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-600 text-center mt-6">Data powered by millions of local comps.</p>
        </div>
      </main>

      <AnimatePresence>
        {showModal && (
          <ConfigModal
            address={address}
            county={county}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
