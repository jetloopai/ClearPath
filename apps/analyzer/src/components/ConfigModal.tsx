"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { X, ChevronDown } from "lucide-react";
import gsap from "gsap";
import { trackEvent } from "@/lib/analytics";

const conditions = [
  { value: "cosmetic", label: "Cosmetic", desc: "Paint & carpet" },
  { value: "light", label: "Light", desc: "Kitchen & bath" },
  { value: "medium", label: "Medium", desc: "+ systems" },
  { value: "heavy", label: "Heavy", desc: "Structural" },
  { value: "gut", label: "Gut", desc: "Full rebuild" },
] as const;

interface ConfigModalProps {
  address: string;
  county?: string;
  onClose: () => void;
}

export function ConfigModal({ address, county, onClose }: ConfigModalProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [editAddress, setEditAddress] = useState(address);
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<string>("medium");
  const [units, setUnits] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [downPayment, setDownPayment] = useState("25");
  const [holdTime, setHoldTime] = useState("6");
  const [interestRate, setInterestRate] = useState("7.5");
  const [rentOverride, setRentOverride] = useState("");
  const [insurance, setInsurance] = useState("100");

  useEffect(() => {
    if (cardRef.current) {
      gsap.from(cardRef.current, { y: 30, duration: 0.5, ease: "expo.out" });
    }
  }, []);

  const formatPrice = (val: string) => {
    const num = val.replace(/[^0-9]/g, "");
    if (!num) return "";
    return Number(num).toLocaleString("en-US");
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = Number(price.replace(/[^0-9]/g, ""));
    if (!editAddress.trim() || !numPrice) return;

    setLoading(true);
    setError("");
    trackEvent('analysis_started', { address: editAddress, condition, price: numPrice });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: editAddress,
          price: numPrice,
          condition,
          units,
          county,
          downPaymentPct: Number(downPayment) / 100,
          holdMonths: Number(holdTime),
          interestRateOverride: Number(interestRate) / 100,
          rentOverride: rentOverride ? Number(rentOverride.replace(/[^0-9]/g, "")) || null : null,
          insuranceOverride: Number(insurance) || null,
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");

      const data = await res.json();
      sessionStorage.setItem("clearpath_analysis", JSON.stringify({
        address: editAddress,
        price: numPrice,
        condition,
        units,
        analysisId: data.analysisId,
        results: data.results,
        breakdown: data.breakdown,
        compsUsed: data.compsUsed,
        alternatives: data.alternatives,
        arvMethod: data.arvMethod,
        compsCount: data.compsCount,
        rentSource: data.rentSource,
        nearbyRentCount: data.nearbyRentCount,
        nearbyRentPrices: data.nearbyRentPrices,
        nearbyRentListings: data.nearbyRentListings,
        interestRate: data.interestRate,
      }));

      router.push("/results");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />

        {/* Modal Card */}
        <div ref={cardRef} className="relative z-10 w-full max-w-lg glass-panel rounded-[2rem] p-10">
          {/* Close */}
          <button onClick={onClose} className="absolute top-6 right-6 text-zinc-300 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-2xl font-serif text-white mb-8">Configure Deal Details</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Address */}
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-300 mb-2 block">Property Address</label>
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl py-3 px-5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/40 transition-colors"
              />
            </div>

            {/* Purchase Price */}
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-300 mb-2 block">Purchase Price</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-300">$</span>
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(formatPrice(e.target.value))}
                  placeholder="0"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl py-3 pl-9 pr-5 text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/40 transition-colors"
                />
              </div>
            </div>

            {/* Condition */}
            <div>
              <label className="text-xs uppercase tracking-widest text-zinc-300 mb-3 block">Property Condition</label>
              <div className="grid grid-cols-5 gap-2">
                {conditions.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCondition(c.value)}
                    className={`rounded-2xl py-3 px-2 text-center border transition-all duration-200 ${
                      condition === c.value
                        ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                        : "border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="text-xs font-medium">{c.label}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>



            {/* Advanced Options */}
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-300 transition-colors"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              {showAdvanced ? "Hide Advanced" : "Show Advanced"}
            </button>

            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="grid grid-cols-2 gap-4"
              >
                <div className="col-span-2">
                  <label className="text-xs text-zinc-300 mb-1 block">Property Units</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnits(u)}
                        className={`rounded-xl py-2 px-2 text-center border transition-all duration-200 ${
                          units === u
                            ? "border-indigo-500/60 bg-indigo-500/10 text-white"
                            : "border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:border-white/[0.12]"
                        }`}
                      >
                        <div className="text-sm font-medium">{u} {u === 1 ? 'Unit' : 'Units'}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-300 mb-1 block">Down Payment %</label>
                  <input
                    type="text"
                    value={downPayment}
                    onChange={(e) => setDownPayment(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 mb-1 block">Hold Time (Months)</label>
                  <input
                    type="text"
                    value={holdTime}
                    onChange={(e) => setHoldTime(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 mb-1 block">Interest Rate %</label>
                  <input
                    type="text"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-300 mb-1 block">Insurance $/mo</label>
                  <input
                    type="text"
                    value={insurance}
                    onChange={(e) => setInsurance(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-zinc-300 mb-1 block">
                    Rent Override $/mo
                    <span className="ml-1 text-zinc-500">(blank = use Zillow nearby rentals)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 text-sm">$</span>
                    <input
                      type="text"
                      value={rentOverride}
                      onChange={(e) => setRentOverride(e.target.value)}
                      placeholder="auto"
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 pl-8 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                <span className="text-red-400 text-lg leading-none mt-0.5">!</span>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-full bg-foreground text-background font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-60"
            >
              {loading ? "Analyzing..." : "Run Analysis →"}
            </button>
          </form>
        </div>
    </motion.div>
  );
}
