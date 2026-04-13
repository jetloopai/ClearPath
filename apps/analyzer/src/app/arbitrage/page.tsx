"use client";

import React, { useState } from "react";
import Link from "next/link";

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export default function ArbitragePage() {
  const [monthlyRent, setMonthlyRent] = useState("2000");
  const [nightly, setNightly] = useState("120");
  const [occupancy, setOccupancy] = useState("65");
  const [avgStay, setAvgStay] = useState("3");
  const [setupCost, setSetupCost] = useState("5000");
  const [utilities, setUtilities] = useState("200");

  const monthlyRentNum = parseFloat(monthlyRent.replace(/[^0-9]/g, "")) || 0;
  const nightlyNum = parseFloat(nightly.replace(/[^0-9]/g, "")) || 0;
  const occPct = Math.max(10, Math.min(100, parseFloat(occupancy) || 65)) / 100;
  const stay = Math.max(1, parseFloat(avgStay) || 3);
  const setupNum = parseFloat(setupCost.replace(/[^0-9]/g, "")) || 0;
  const utilitiesNum = parseFloat(utilities.replace(/[^0-9]/g, "")) || 0;

  // Revenue
  const grossRevenue = Math.round(nightlyNum * 30 * occPct);
  const platformFee = Math.round(grossRevenue * 0.03);
  const turnovers = Math.max(1, Math.round((30 * occPct) / stay));
  const cleaningCost = turnovers * 100;
  const netRevenue = grossRevenue - platformFee - cleaningCost;

  // Expenses
  const totalExpenses = monthlyRentNum + utilitiesNum;

  // Profit
  const monthlyProfit = netRevenue - totalExpenses;
  const annualProfit = monthlyProfit * 12;
  const paybackMonths = setupNum > 0 && monthlyProfit > 0 ? Math.ceil(setupNum / monthlyProfit) : null;
  const roi = setupNum > 0 ? Math.round((annualProfit / setupNum) * 1000) / 10 : null;

  // Break-even occupancy
  const breakEvenOccupancy = nightlyNum > 0
    ? Math.ceil(((totalExpenses + cleaningCost + platformFee) / (nightlyNum * 30)) * 100)
    : null;

  const signal: "green" | "yellow" | "red" =
    monthlyProfit >= 500 ? "green" : monthlyProfit >= 0 ? "yellow" : "red";

  const signalColors = {
    green: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    yellow: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  const formatNum = (val: string) => {
    const num = val.replace(/[^0-9]/g, "");
    if (!num) return "";
    return Number(num).toLocaleString("en-US");
  };

  return (
    <div className="min-h-screen bg-background pt-28 pb-24 text-foreground">
      <div className="max-w-3xl mx-auto px-6">

        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-4 inline-block">← Back</Link>
          <div className="text-xs uppercase tracking-widest text-indigo-400 mb-3">Airbnb Arbitrage Calculator</div>
          <h1 className="text-3xl md:text-4xl font-light text-zinc-200 mb-3">Is this lease worth subletting?</h1>
          <p className="text-zinc-500 text-sm max-w-lg">
            Rental arbitrage: rent a property long-term and sublet on Airbnb. No ownership required — just a landlord who allows it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Inputs */}
          <div className="space-y-5">
            <div className="glass-panel rounded-2xl p-6 border border-white/[0.05]">
              <div className="text-xs uppercase tracking-widest text-zinc-600 mb-4">Your Costs</div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Monthly Rent to Landlord</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input
                      type="text"
                      value={monthlyRent}
                      onChange={e => setMonthlyRent(formatNum(e.target.value))}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 pl-7 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Utilities / Month</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input
                      type="text"
                      value={utilities}
                      onChange={e => setUtilities(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 pl-7 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">Electric, internet, etc.</div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Setup / Furnishing Cost</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input
                      type="text"
                      value={setupCost}
                      onChange={e => setSetupCost(formatNum(e.target.value))}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 pl-7 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">Furniture, linens, decor — one-time</div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-6 border border-white/[0.05]">
              <div className="text-xs uppercase tracking-widest text-zinc-600 mb-4">STR Assumptions</div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Nightly Rate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input
                      type="text"
                      value={nightly}
                      onChange={e => setNightly(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 pl-7 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Occupancy %</label>
                  <input
                    type="text"
                    value={occupancy}
                    onChange={e => setOccupancy(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                  <div className="text-[10px] text-zinc-600 mt-1">National average: 55–70%</div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Avg Stay (nights)</label>
                  <input
                    type="text"
                    value={avgStay}
                    onChange={e => setAvgStay(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                  <div className="text-[10px] text-zinc-600 mt-1">Drives cleaning turnover count</div>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">

            {/* Signal card */}
            <div className={`glass-panel rounded-2xl p-6 border ${signalColors[signal].split(" ").find(c => c.startsWith("border")) ?? "border-white/[0.05]"}`}>
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Monthly Profit</div>
              <div className={`text-4xl font-serif font-bold mb-2 ${signal === "green" ? "text-emerald-400" : signal === "yellow" ? "text-amber-400" : "text-red-400"}`}>
                {monthlyProfit >= 0 ? "+" : ""}{fmt(monthlyProfit)}
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${signalColors[signal]}`}>
                {signal === "green" ? "Strong Arbitrage" : signal === "yellow" ? "Marginal" : "Negative — renegotiate or pass"}
              </span>
              <div className="mt-4 text-sm text-zinc-500">
                <span className="text-zinc-400 font-medium">{fmt(annualProfit)}</span> annual profit
              </div>
            </div>

            {/* Revenue breakdown */}
            <div className="glass-panel rounded-2xl p-5 border border-white/[0.05] space-y-2.5 text-sm">
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Breakdown</div>
              <div className="flex justify-between"><span className="text-zinc-500">Gross STR revenue</span><span className="text-emerald-400">{fmt(grossRevenue)}/mo</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Platform fee (3%)</span><span className="text-zinc-400">− {fmt(platformFee)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Cleaning ({turnovers} turns × $100)</span><span className="text-zinc-400">− {fmt(cleaningCost)}</span></div>
              <div className="flex justify-between border-t border-white/[0.05] pt-2.5"><span className="text-zinc-300">Net STR income</span><span className="text-zinc-200 font-medium">{fmt(netRevenue)}/mo</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Rent to landlord</span><span className="text-zinc-400">− {fmt(monthlyRentNum)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Utilities</span><span className="text-zinc-400">− {fmt(utilitiesNum)}</span></div>
              <div className={`flex justify-between border-t border-white/[0.05] pt-2.5 font-medium ${signal === "green" ? "text-emerald-400" : signal === "yellow" ? "text-amber-400" : "text-red-400"}`}>
                <span>Monthly profit</span>
                <span>{monthlyProfit >= 0 ? "+" : ""}{fmt(monthlyProfit)}</span>
              </div>
            </div>

            {/* Key metrics */}
            <div className="glass-panel rounded-2xl p-5 border border-white/[0.05]">
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Key Metrics</div>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Break-even occupancy</span>
                  <span className={`font-medium ${breakEvenOccupancy && breakEvenOccupancy <= 100 ? "text-zinc-200" : "text-red-400"}`}>
                    {breakEvenOccupancy !== null ? (breakEvenOccupancy <= 100 ? `${breakEvenOccupancy}%` : "Unachievable at this rate") : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Setup payback</span>
                  <span className="text-zinc-200 font-medium">
                    {paybackMonths !== null ? `${paybackMonths} month${paybackMonths !== 1 ? "s" : ""}` : monthlyProfit <= 0 ? "Never at current rate" : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Annual ROI on setup cost</span>
                  <span className={`font-medium ${(roi ?? 0) >= 50 ? "text-emerald-400" : (roi ?? 0) >= 0 ? "text-amber-400" : "text-red-400"}`}>
                    {roi !== null ? fmtPct(roi) : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Effective nightly margin</span>
                  <span className="text-zinc-300 font-medium">
                    {nightlyNum > 0 ? `${fmt(Math.round(monthlyProfit / (30 * occPct)))}/night` : "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-xs text-zinc-600 leading-relaxed">
              ⚠ Always verify local STR permits, zoning laws, and HOA rules before signing a lease for arbitrage. Some cities restrict or ban STR operations entirely.
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Analyze a Property Deal →
          </Link>
        </div>
      </div>
    </div>
  );
}
