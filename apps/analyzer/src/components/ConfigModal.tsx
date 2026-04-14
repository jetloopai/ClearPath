"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { X, ChevronDown, Sparkles, ChevronRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/lib/supabase-browser";
import type { ImageAnalysisResult } from "@/lib/imageAnalysis";
import { UpgradeModal } from "@/components/UpgradeModal";
import { AuthModal } from "@/components/AuthModal";

const ImageUploadZone = dynamic(() => import("@/components/ImageUploadZone").then(m => m.ImageUploadZone), { ssr: false });

type ManualSqftResponse = {
  needsManualSqft?: boolean;
  suggestedSqft?: number;
  dataWarnings?: string[];
  providerWarnings?: string[];
  message?: string;
  error?: string;
};

const conditions = [
  { value: "cosmetic", label: "Cosmetic", desc: "Paint & carpet" },
  { value: "light", label: "Light", desc: "Kitchen & bath" },
  { value: "medium", label: "Medium", desc: "+ systems" },
  { value: "heavy", label: "Heavy", desc: "Structural" },
  { value: "gut", label: "Gut", desc: "Full rebuild" },
] as const;

const confidenceColor: Record<string, string> = {
  high: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  medium: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  low: "text-zinc-400 border-white/[0.08] bg-white/[0.03]",
};

interface ConfigModalProps {
  address: string;
  county?: string;
  onClose: () => void;
}

export function ConfigModal({ address, county, onClose }: ConfigModalProps) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editAddress, setEditAddress] = useState(address);
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState<string>("medium");
  const [aiConditionOverridden, setAiConditionOverridden] = useState(false);
  const [units, setUnits] = useState(1);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [downPayment, setDownPayment] = useState("25");
  const [holdTime, setHoldTime] = useState("6");
  const [interestRate, setInterestRate] = useState("7.5");
  const [rentOverride, setRentOverride] = useState("");
  const [insurance, setInsurance] = useState("100");
  const [manualSqft, setManualSqft] = useState("");
  const [showManualSqft, setShowManualSqft] = useState(false);
  const [bedsOverride, setBedsOverride] = useState("");
  const [bathsOverride, setBathsOverride] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState("free");
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  // Image analysis state
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [analyzingImages, setAnalyzingImages] = useState(false);
  const [showScopePreview, setShowScopePreview] = useState(false);

  useEffect(() => {
    // Pre-fill from dashboard "Re-analyze" button
    const raw = sessionStorage.getItem("clearpath_reanalyze");
    if (raw) {
      try {
        const saved = JSON.parse(raw) as { address?: string; price?: string; condition?: string };
        if (saved.address) setEditAddress(saved.address);
        if (saved.price) setPrice(Number(saved.price.replace(/[^0-9]/g, "")).toLocaleString("en-US"));
        if (saved.condition) setCondition(saved.condition);
      } catch { /* ignore */ }
      sessionStorage.removeItem("clearpath_reanalyze");
    }
  }, []);

  const runImageAnalysis = useCallback(async (images: string[]) => {
    if (images.length === 0) { setImageAnalysis(null); return; }
    setAnalyzingImages(true);
    try {
      const res = await fetch("/api/analyze-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const result: ImageAnalysisResult = await res.json();
      setImageAnalysis(result);
      if (!aiConditionOverridden) {
        setCondition(result.condition);
      }
    } catch {
      // silently fail — user can still set condition manually
    } finally {
      setAnalyzingImages(false);
    }
  }, [aiConditionOverridden]);

  const handleImagesChange = (images: string[]) => {
    setUploadedImages(images);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (images.length === 0) { setImageAnalysis(null); return; }
    debounceRef.current = setTimeout(() => runImageAnalysis(images), 800);
  };

  const formatPrice = (val: string) => {
    const num = val.replace(/[^0-9]/g, "");
    if (!num) return "";
    return Number(num).toLocaleString("en-US");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = Number(price.replace(/[^0-9]/g, ""));
    if (!editAddress.trim() || !numPrice) return;

    setLoading(true);
    setError("");
    trackEvent('analysis_started', { address: editAddress, condition, price: numPrice });

    const { data: { session } } = await supabase.auth.getSession();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { "Authorization": `Bearer ${session.access_token}` }),
        },
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
          manualSqft: manualSqft ? Number(manualSqft.replace(/[^0-9]/g, "")) || null : null,
          bedsOverride: bedsOverride ? Number(bedsOverride) || null : null,
          bathsOverride: bathsOverride ? Number(bathsOverride) || null : null,
        }),
      });

      if (!res.ok) {
        let payload: ManualSqftResponse & { plan?: string } | null = null;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }

        if (res.status === 401) {
          setShowAuthPrompt(true);
          setLoading(false);
          return;
        }

        if (res.status === 402) {
          setUpgradePlan(payload?.plan ?? "free");
          setShowUpgrade(true);
          setLoading(false);
          return;
        }

        if (res.status === 403) {
          setError(payload?.message ?? 'Please verify your email before running an analysis.');
          setLoading(false);
          return;
        }

        if (res.status === 422 && payload?.needsManualSqft) {
          setShowManualSqft(true);
          setShowAdvanced(true);
          if (payload?.suggestedSqft) {
            setManualSqft(String(payload.suggestedSqft));
          }
          setError(
            payload?.dataWarnings?.[0] ??
            "We could not verify the property's square footage. Enter sqft manually to continue."
          );
          setLoading(false);
          return;
        }

        const apiError =
          payload?.message ??
          payload?.providerWarnings?.[0] ??
          payload?.dataWarnings?.[0] ??
          "Analysis failed";
        throw new Error(apiError);
      }

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
        arvConfidence: data.arvConfidence,
        arvRange: data.arvRange,
        arvExplainer: data.arvExplainer,
        arvProvider: data.arvProvider,
        compsCount: data.compsCount,
        rentSource: data.rentSource,
        rentExplainer: data.rentExplainer,
        rentProvider: data.rentProvider,
        nearbyRentCount: data.nearbyRentCount,
        nearbyRentPrices: data.nearbyRentPrices,
        nearbyRentListings: data.nearbyRentListings,
        interestRate: data.interestRate,
        dataWarnings: data.dataWarnings ?? [],
        providerWarnings: data.providerWarnings ?? [],
        providerTrace: data.providerTrace ?? null,
        subjectData: data.subjectData,
        subjectLat: data.subjectLat ?? null,
        subjectLng: data.subjectLng ?? null,
        imageAnalysis: imageAnalysis ?? undefined,
      }));

      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      {showAuthPrompt && <AuthModal onClose={() => setShowAuthPrompt(false)} />}
      {showUpgrade && <UpgradeModal currentPlan={upgradePlan} onClose={() => setShowUpgrade(false)} />}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />

      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 w-full sm:max-w-lg glass-panel rounded-t-[2rem] sm:rounded-[2rem] p-6 sm:p-10 max-h-[92vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-5 right-5 text-zinc-300 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>

        {/* Drag handle — mobile only */}
        <div className="sm:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

        <h2 className="text-xl sm:text-2xl font-serif text-white mb-5 sm:mb-8">Configure Deal Details</h2>

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
            {(() => {
              const n = Number(price.replace(/[^0-9]/g, ""));
              if (n > 0 && n < 20000) return (
                <p className="text-[11px] text-amber-400 mt-1.5">⚠ This price looks unusually low — double-check before analyzing.</p>
              );
              if (n > 5_000_000) return (
                <p className="text-[11px] text-amber-400 mt-1.5">⚠ This price looks unusually high — double-check before analyzing.</p>
              );
              return null;
            })()}
          </div>

          {/* Property Photos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase tracking-widest text-zinc-300">Property Photos</label>
              <span className="text-[10px] text-zinc-600">Optional · AI reads condition</span>
            </div>
            <ImageUploadZone images={uploadedImages} onChange={handleImagesChange} maxImages={10} compact />

            {/* AI analysis feedback */}
            {analyzingImages && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                <Sparkles className="w-3 h-3 animate-pulse text-indigo-400" />
                AI is reading the property...
              </div>
            )}

            {imageAnalysis && !analyzingImages && (
              <div className="mt-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs text-zinc-300">
                    AI suggests: <span className="capitalize font-medium text-white">{imageAnalysis.condition}</span>
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${confidenceColor[imageAnalysis.confidence]}`}>
                    {imageAnalysis.confidence} confidence
                  </span>
                  {aiConditionOverridden && (
                    <span className="text-[10px] text-zinc-600">· overridden</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">{imageAnalysis.summary}</p>
                {imageAnalysis.scopeOfWork.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowScopePreview(!showScopePreview)}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <ChevronRight className={`w-3 h-3 transition-transform ${showScopePreview ? "rotate-90" : ""}`} />
                    {showScopePreview ? "Hide" : "See"} what AI found ({imageAnalysis.scopeOfWork.length} items)
                  </button>
                )}
                {showScopePreview && (
                  <div className="space-y-1 pt-1">
                    {imageAnalysis.scopeOfWork.slice(0, 4).map((item, i) => (
                      <div key={i} className="flex justify-between text-[10px]">
                        <span className="text-zinc-500">{item.category} — {item.issue}</span>
                        <span className="text-zinc-400 shrink-0 ml-2">{item.estimatedCost}</span>
                      </div>
                    ))}
                    {imageAnalysis.scopeOfWork.length > 4 && (
                      <div className="text-[10px] text-zinc-600">+ {imageAnalysis.scopeOfWork.length - 4} more items</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Condition */}
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-300 mb-3 block">Property Condition</label>
            <div className="grid grid-cols-5 gap-2">
              {conditions.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setCondition(c.value);
                    if (imageAnalysis && c.value !== imageAnalysis.condition) {
                      setAiConditionOverridden(true);
                    }
                  }}
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
              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            >
              <div className="col-span-2">
                <label className="text-xs text-zinc-300 mb-1 block">Property Units</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
              {showManualSqft && (
                <div className="col-span-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-4">
                  <label className="text-xs text-amber-300 mb-1 block">Manual Square Footage</label>
                  <p className="text-xs text-amber-200/80 mb-3">
                    ClearPath could not verify the provider square footage. Enter verified square footage to run rehab and ARV calculations safely.
                  </p>
                  <input
                    type="text"
                    value={manualSqft}
                    onChange={(e) => setManualSqft(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 1450"
                    className="w-full bg-black/20 border border-amber-500/20 rounded-xl py-2 px-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/50 transition-colors"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-300 mb-1 block">
                  Beds Override
                  <span className="ml-1 text-zinc-500">(blank = provider data)</span>
                </label>
                <input type="number" min="1" max="20" value={bedsOverride} onChange={(e) => setBedsOverride(e.target.value)}
                  placeholder="auto"
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-zinc-300 mb-1 block">
                  Baths Override
                  <span className="ml-1 text-zinc-500">(blank = provider data)</span>
                </label>
                <input type="number" min="1" max="20" step="0.5" value={bathsOverride} onChange={(e) => setBathsOverride(e.target.value)}
                  placeholder="auto"
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-zinc-300 mb-1 block">Down Payment %</label>
                <input type="text" value={downPayment} onChange={(e) => setDownPayment(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-zinc-300 mb-1 block">Hold Time (Months)</label>
                <input type="text" value={holdTime} onChange={(e) => setHoldTime(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-zinc-300 mb-1 block">Interest Rate %</label>
                <input type="text" value={interestRate} onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-zinc-300 mb-1 block">Insurance $/mo</label>
                <input type="text" value={insurance} onChange={(e) => setInsurance(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-zinc-300 mb-1 block">
                  Rent Override $/mo
                  <span className="ml-1 text-zinc-500">(blank = use provider rental data first)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300 text-sm">$</span>
                  <input type="text" value={rentOverride} onChange={(e) => setRentOverride(e.target.value)}
                    placeholder="auto"
                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 pl-8 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/40 transition-colors" />
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full bg-foreground text-background font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-60 sticky bottom-0"
          >
            {loading ? "Analyzing..." : "Run Analysis →"}
          </button>
        </form>
      </motion.div>
    </motion.div>
    </>
  );
}
