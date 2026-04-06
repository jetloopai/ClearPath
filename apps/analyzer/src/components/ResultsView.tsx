"use client";

import React, { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Lock, TrendingDown, TrendingUp, Minus, Pencil, RotateCcw, FileText, Download } from "lucide-react";
import type { AnalysisResults } from "@/lib/calculations";
import type { AnalysisBreakdown, AlternativeCondition } from "@/app/api/analyze/route";
import type { CompListing } from "@/lib/propertyData";
import { trackEvent } from "@/lib/analytics";
import { AuthModal } from "@/components/AuthModal";
import { supabase } from "@/lib/supabase-browser";

type ViewState = "loading" | "gated" | "unlocked";

interface StoredAnalysis {
  address: string;
  price: number;
  condition: string;
  units?: number;
  analysisId: string;
  results: AnalysisResults;
  breakdown: AnalysisBreakdown;
  compsUsed: (CompListing & { distanceMiles: number })[];
  alternatives: AlternativeCondition[];
  arvMethod: "comps_based" | "price_multiplier";
  compsCount: number;
  rentSource?: "zillow_nearby" | "formula";
  nearbyRentCount?: number;
  nearbyRentPrices?: number[];
  nearbyRentListings?: { price: number; url: string }[];
  interestRate?: number;
}

const fmt = (val: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

const fmtShort = (val: number) => {
  if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return fmt(val);
};

function SignalBadge({ signal, label }: { signal: string; label: string }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    yellow: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const dotColors: Record<string, string> = {
    green: "text-emerald-400",
    yellow: "text-amber-400",
    red: "text-red-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${colors[signal]}`}>
      <span className={dotColors[signal]}>●</span> {label}
    </span>
  );
}

function SignalDot({ signal }: { signal: string }) {
  const cls: Record<string, string> = {
    green: "bg-emerald-400",
    yellow: "bg-amber-400",
    red: "bg-red-400",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${cls[signal] ?? "bg-zinc-400"}`} />;
}

function WaterfallBar({
  label,
  value,
  type,
  total,
}: {
  label: string;
  value: number;
  type: "positive" | "negative" | "result";
  total: number;
}) {
  const pct = Math.min((Math.abs(value) / Math.abs(total)) * 100, 100);
  const barColor =
    type === "positive"
      ? "bg-emerald-500/30"
      : type === "result"
      ? value >= 0
        ? "bg-emerald-500/40"
        : "bg-red-500/40"
      : "bg-red-500/20";
  const textColor =
    type === "result"
      ? value >= 0
        ? "text-emerald-400"
        : "text-red-400"
      : type === "negative"
      ? "text-zinc-400"
      : "text-zinc-300";

  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-zinc-500 w-32 shrink-0 text-right">{label}</span>
      <div className="flex-1 relative h-7 rounded-md overflow-hidden bg-white/[0.03]">
        <div
          className={`absolute inset-y-0 left-0 rounded-md ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
        <span className={`absolute inset-0 flex items-center px-3 text-xs font-medium ${textColor}`}>
          {type === "negative" ? "−" : ""}
          {fmt(Math.abs(value))}
        </span>
      </div>
    </div>
  );
}

export default function ResultsView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<ViewState>("loading");
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [downloading, setDownloading] = useState<"deal_sheet" | "full_report" | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<string>("Hard Money");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [dealSaved, setDealSaved] = useState(false);

  // ── Rehab editor state ────────────────────────────────────────────────────────
  const [customRehab, setCustomRehab] = useState(0);
  const [isRehabEditing, setIsRehabEditing] = useState(false);
  const [rehabInputValue, setRehabInputValue] = useState("");
  const [flipDisplay, setFlipDisplay] = useState(0);
  const [maoDisplay, setMaoDisplay] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const flipCountRef = useRef({ val: 0 });
  const maoCountRef = useRef({ val: 0 });

  // ── BRRRR state ───────────────────────────────────────────────────────────────
  const [refiLTV, setRefiLTV] = useState(0.75);
  const [refiLTVInput, setRefiLTVInput] = useState("75");
  const [isRefiLTVEditing, setIsRefiLTVEditing] = useState(false);
  const [refiRate, setRefiRate] = useState<number | null>(null); // null = inherit 7.5%
  const [refiRateInput, setRefiRateInput] = useState("");
  const [isRefiRateEditing, setIsRefiRateEditing] = useState(false);
  const [showRefiRateTooltip, setShowRefiRateTooltip] = useState(false);
  const cashOutRef = useRef({ val: 0 });
  const [cashOutDisplay, setCashOutDisplay] = useState(0);

  useEffect(() => {
    const raw = sessionStorage.getItem("clearpath_analysis");
    if (!raw) {
      window.location.href = "/";
      return;
    }
    let data: StoredAnalysis;
    try {
      data = JSON.parse(raw);
    } catch {
      window.location.href = "/";
      return;
    }
    setAnalysis(data);
    setState("gated");
    trackEvent('analysis_completed', { address: data.address, signal: data.results.signal, arv: data.results.arv });
    // Init rehab state from loaded analysis
    setCustomRehab(data.results.rehabEstimate);
    setRehabInputValue(String(data.results.rehabEstimate));
    setFlipDisplay(data.results.flipProfit);
    setMaoDisplay(data.results.mao);
    flipCountRef.current.val = data.results.flipProfit;
    maoCountRef.current.val = data.results.mao;
  }, []);

  // ── Animate flip profit + MAO when customRehab changes ───────────────────────
  useEffect(() => {
    if (!analysis) return;
    const bd = analysis.breakdown;
    const newFlip = Math.round(
      analysis.results.arv - analysis.price - customRehab -
      (bd?.sellingCosts ?? analysis.results.arv * 0.08) -
      (bd?.holdingCosts ?? analysis.price * 0.01 * 6)
    );
    const newMao = Math.round(analysis.results.arv * 0.7 - customRehab);

    gsap.to(flipCountRef.current, {
      val: newFlip,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => setFlipDisplay(Math.round(flipCountRef.current.val)),
    });
    gsap.to(maoCountRef.current, {
      val: newMao,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => setMaoDisplay(Math.round(maoCountRef.current.val)),
    });

    // BRRRR cash-out animation
    const newAllIn = (bd?.downPayment ?? 0) + (bd?.closingCostsBuy ?? 0) + customRehab;
    const newRefiLoan = Math.round(analysis.results.arv * refiLTV);
    const newCashLeft = newAllIn - newRefiLoan;
    gsap.to(cashOutRef.current, {
      val: newCashLeft,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => setCashOutDisplay(Math.round(cashOutRef.current.val)),
    });

    if (customRehab !== analysis.results.rehabEstimate) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 700);
      return () => clearTimeout(t);
    }
  }, [customRehab, refiLTV, refiRate, analysis]);

  useEffect(() => {
    if (state === "gated" && containerRef.current) {
      const cards = containerRef.current.querySelectorAll(".result-card");
      gsap.fromTo(cards, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.12, ease: "power3.out" });
      if (gateRef.current) {
        gsap.fromTo(gateRef.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, delay: 0.4, ease: "power2.out" });
      }
    }
  }, [state]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting || !analysis) return;
    setSubmitting(true);

    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        address: analysis.address,
        is_service_area: analysis.results.isCookCounty,
        deal_signal: analysis.results.flipSignal,
        deal_arv: analysis.results.arv,
        deal_flip_profit: analysis.results.flipProfit,
        deal_cash_flow: analysis.results.monthlyCashFlow,
        deal_condition: analysis.condition,
        analysis_id: analysis.analysisId,
      }),
    });

    if (!res.ok) {
      console.warn('[leads] Failed to save lead — unlocking results anyway');
      setLeadError("Couldn't save your email, but here are your results.");
    }

    if (gateRef.current) gsap.to(gateRef.current, { opacity: 0, y: -20, duration: 0.4, ease: "power2.in" });
    if (blurRef.current) gsap.to(blurRef.current, { filter: "blur(0px)", opacity: 1, duration: 1.2, ease: "power2.out", delay: 0.3 });

    setTimeout(() => {
      setState("unlocked");
      trackEvent('email_submitted', { address: analysis?.address, is_cook_county: analysis?.results.isCookCounty });
      if (containerRef.current) {
        const revealed = containerRef.current.querySelectorAll(".revealed-card");
        gsap.fromTo(revealed, { y: 30, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.12, duration: 0.8, ease: "power3.out" });
        const banner = containerRef.current.querySelector(".upsell-banner");
        if (banner) gsap.fromTo(banner, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 1, delay: 0.6, ease: "expo.out" });
      }
    }, 500);
  };

  // ── Rehab editor helpers ──────────────────────────────────────────────────────
  const reportPayload = (reportType: "deal_sheet" | "full_report") => ({
    reportType,
    address: analysis!.address,
    price: analysis!.price,
    condition: analysis!.condition,
    results: analysis!.results,
    breakdown: analysis!.breakdown,
    compsUsed: analysis!.compsUsed,
    alternatives: analysis!.alternatives,
    arvMethod: analysis!.arvMethod,
    compsCount: analysis!.compsCount,
    customRehab,
  });

  const openReport = async (reportType: "deal_sheet" | "full_report", mode: "preview" | "print") => {
    if (!analysis || downloading) return;
    setDownloading(reportType);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reportPayload(reportType), mode }),
      });
      if (!res.ok) throw new Error("Report failed");
      const html = await res.text();
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      // silently fail
    } finally {
      setDownloading(null);
    }
  };

  const downloadPDF = async (reportType: "deal_sheet" | "full_report") => {
    if (!analysis || downloading) return;
    setDownloading(reportType);
    try {
      // 1. Fetch the styled HTML from the server
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reportPayload(reportType), mode: "preview" }),
      });
      if (!res.ok) throw new Error("Report failed");
      const html = await res.text();

      // 2. Render HTML in a hidden iframe
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:816px;height:1056px;border:none;visibility:hidden;";
      document.body.appendChild(iframe);
      iframe.contentDocument!.open();
      iframe.contentDocument!.write(html);
      iframe.contentDocument!.close();

      // 3. Wait for fonts + layout
      await new Promise(r => setTimeout(r, 1200));

      // 4. Capture with html2canvas
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(iframe.contentDocument!.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: 816,
        windowWidth: 816,
      });

      // 5. Build PDF with jsPDF
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [816, 1056] });
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, 816, 1056);

      const slug = analysis.address.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
      const prefix = reportType === "full_report" ? "ClearPath-Full-Report" : "ClearPath-Deal-Sheet";
      pdf.save(`${prefix}-${slug}.pdf`);

      document.body.removeChild(iframe);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setDownloading(null);
    }
  };

  const commitRehabInput = () => {
    const num = Number(rehabInputValue.replace(/[^0-9]/g, ""));
    if (num > 0) setCustomRehab(num);
    else setRehabInputValue(String(customRehab));
    setIsRehabEditing(false);
  };

  const handleShare = () => {
    if (!analysis) return;
    const url = new URL(window.location.origin + '/results/share');
    url.searchParams.set('address', analysis.address);
    url.searchParams.set('arv', String(analysis.results.arv));
    url.searchParams.set('rehab', String(customRehab));
    url.searchParams.set('flipProfit', String(derivedFlipProfit));
    url.searchParams.set('cashFlow', String(analysis.results.monthlyCashFlow));
    url.searchParams.set('signal', derivedFlipSignal);
    url.searchParams.set('condition', analysis.condition);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDeal = async () => {
    if (!analysis) return;
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setShowAuthModal(true);
      return;
    }
    
    setSavingDeal(true);
    try {
      const { error } = await supabase
        .from("analyses")
        .update({ user_id: session.user.id })
        .eq("id", analysis.analysisId);
        
      if (error) throw error;
      setDealSaved(true);
    } catch (err) {
      console.error("Failed to save deal:", err);
    } finally {
      setSavingDeal(false);
    }
  };

  /* ── LOADING ── */
  if (state === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto gap-4">
        <div className="glass-panel rounded-2xl py-3 px-6 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm text-zinc-400">Loading your analysis...</span>
        </div>
      </div>
    );
  }

  if (!analysis) return null;

  const { results, address, price, condition, units = 1, breakdown, compsUsed, alternatives, arvMethod, compsCount, rentSource, nearbyRentCount, nearbyRentPrices, nearbyRentListings } = analysis;

  // ── Derived values using customRehab ─────────────────────────────────────────
  const derivedFlipProfit = Math.round(
    results.arv - price - customRehab -
    (breakdown?.sellingCosts ?? results.arv * 0.08) -
    (breakdown?.holdingCosts ?? price * 0.01 * 6)
  );
  const derivedMao = Math.round(results.arv * 0.7 - customRehab);
  const derivedFlipROI = Math.round((derivedFlipProfit / (price + customRehab)) * 1000) / 10;
  const derivedFlipSignal: "green" | "yellow" | "red" =
    derivedFlipProfit >= 30000 ? "green" : derivedFlipProfit < 10000 ? "red" : "yellow";

  const isRehabModified = customRehab !== results.rehabEstimate;
  const rehabDelta = customRehab - results.rehabEstimate;

  // ── BRRRR derived calculations ────────────────────────────────────────────────
  const allInCost = (breakdown?.downPayment ?? 0) + (breakdown?.closingCostsBuy ?? 0) + customRehab;
  const effectiveRefiRate = refiRate ?? 0.075;
  const refiLoan = Math.round(results.arv * refiLTV);
  const cashLeftInDeal = allInCost - refiLoan;  // negative = all cash out
  const refiMonthlyRate = effectiveRefiRate / 12;
  const refiMortgage = Math.round(
    refiLoan * (refiMonthlyRate * Math.pow(1 + refiMonthlyRate, 360)) /
    (Math.pow(1 + refiMonthlyRate, 360) - 1)
  );
  const monthlyExpenses =
    (breakdown?.vacancy ?? 0) + (breakdown?.mgmt ?? 0) +
    (breakdown?.maintenance ?? 0) + (breakdown?.capex ?? 0) +
    (breakdown?.insurance ?? 0) + (breakdown?.taxes ?? 0);
  const postRefiCashFlow = results.rentEstimate - refiMortgage - monthlyExpenses;
  const postRefiCoC = cashLeftInDeal <= 0
    ? Infinity
    : Math.round((postRefiCashFlow * 12) / cashLeftInDeal * 10) / 10;
  const annualNOI = (results.rentEstimate - monthlyExpenses) * 12;
  const dscr = Math.round((annualNOI / (refiMortgage * 12)) * 100) / 100;
  const brrrrSignal: "green" | "yellow" | "red" =
    cashLeftInDeal <= 0 ? "green" :
    cashLeftInDeal <= allInCost * 0.2 ? "yellow" : "red";

  // Slider range: 50% of low → 150% of high, snapping to $1K
  const sliderMin = Math.max(0, Math.round(results.rehabLow * 0.5 / 1000) * 1000);
  const sliderMax = Math.round(results.rehabHigh * 1.5 / 1000) * 1000;

  // Slider fill color
  const sliderColor =
    derivedFlipSignal === "green" ? "#34d399" : derivedFlipSignal === "yellow" ? "#fbbf24" : "#f87171";

  const flipLabel =
    derivedFlipSignal === "green" ? "Strong Flip" : derivedFlipSignal === "yellow" ? "Marginal Flip" : "Weak Flip";
  const rentalLabel =
    results.rentalSignal === "green" ? "Strong Rental" : results.rentalSignal === "yellow" ? "Marginal Rental" : "Weak Rental";

  /* ── Deal Narrative ── */
  const condLabel = condition.charAt(0).toUpperCase() + condition.slice(1);
  let narrative = "";
  if (derivedFlipSignal === "green" && results.rentalSignal === "green") {
    narrative = `This ${condLabel}-condition property works both ways. At ${fmt(price)}, you're looking at ${fmt(derivedFlipProfit)} gross flip profit or ${fmt(results.monthlyCashFlow)}/mo cash flow if you hold. Dual-exit flexibility is rare — max offer is ${fmt(derivedMao)}.`;
  } else if (derivedFlipSignal === "green") {
    narrative = `Strong flip opportunity at ${fmt(price)}. The numbers project ${fmt(derivedFlipProfit)} in gross profit. Rental cash flow is tighter at ${fmt(results.monthlyCashFlow)}/mo, so the flip exit is your best play. Max offer: ${fmt(derivedMao)}.`;
  } else if (results.rentalSignal === "green") {
    narrative = `This one is built for buy-and-hold. At ${fmt(price)} you'd clear ${fmt(results.monthlyCashFlow)}/mo after all expenses. The flip margin is thin at ${fmt(derivedFlipProfit)}, so plan to hold. Max offer: ${fmt(derivedMao)}.`;
  } else if (derivedFlipSignal === "red" && results.rentalSignal === "red") {
    narrative = `At ${fmt(price)}, the numbers are tight on both exits. Flip profit is ${fmt(derivedFlipProfit)} and cash flow is ${fmt(results.monthlyCashFlow)}/mo. You'd need to negotiate down to ${fmt(derivedMao)} to make the flip pencil.`;
  } else {
    narrative = `At ${fmt(price)}, this ${condLabel}-condition deal has marginal returns. Flip profit is ${fmt(derivedFlipProfit)} and cash flow is ${fmt(results.monthlyCashFlow)}/mo. If you can move the price down to ${fmt(derivedMao)}, the flip math improves materially.`;
  }

  const hasComps = compsUsed && compsUsed.length > 0;

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto">
      {/* Property Header */}
      <div className="text-center mb-8">
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Deal Analysis</h2>
        <h1 className="text-3xl md:text-4xl font-light text-zinc-200">{address}</h1>
        <p className="text-xs text-zinc-600 mt-2 capitalize">
          {results.units > 1 ? `${results.units}-Unit · ` : ""}{condition} condition ·{" "}
          {arvMethod === "comps_based" ? `ARV from ${compsCount} nearby comp${compsCount !== 1 ? "s" : ""}` : "ARV estimated from price"}
        </p>

        {results.isCookCounty && (
          <a
            href="https://clearpathassetgroup.com"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium cursor-pointer hover:bg-indigo-500/20 transition-colors"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
            </span>
            Cook County Market — We operate here
          </a>
        )}
        <div className="border-b border-white/[0.06] mt-8" />
      </div>

      {/* ── Section 1: Deal Narrative ── */}
      <div className="result-card glass-panel rounded-[2rem] p-8 mb-6">
        <div className="flex items-start gap-4">
          <div className="mt-1 shrink-0">
            {results.signal === "green" ? (
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            ) : results.signal === "red" ? (
              <TrendingDown className="w-5 h-5 text-red-400" />
            ) : (
              <Minus className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Analyst Verdict</div>
            <p className="text-zinc-300 text-sm leading-relaxed">{narrative}</p>
            <div className="flex gap-2 mt-4">
              <SignalBadge signal={derivedFlipSignal} label={flipLabel} />
              <SignalBadge signal={results.rentalSignal} label={rentalLabel} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: ARV + Rehab ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* ARV card */}
        <div className="result-card glass-panel rounded-[2rem] p-8">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">After Repair Value (ARV)</div>
          <div className="text-4xl md:text-5xl font-serif text-foreground">{fmt(results.arv)}</div>
          <div className="text-xs text-zinc-600 mt-3">
            {arvMethod === "comps_based" ? `Based on ${compsCount} nearby comps` : "Estimated from purchase price"}
          </div>
        </div>

        {/* Rehab card — editable */}
        <div className="result-card glass-panel rounded-[2rem] p-8">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-zinc-500">Estimated Rehab Cost</div>
            {isRehabModified && (
              <button
                onClick={() => {
                  setCustomRehab(results.rehabEstimate);
                  setRehabInputValue(String(results.rehabEstimate));
                  setIsRehabEditing(false);
                }}
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-amber-400 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>

          {/* AI range context */}
          <div className="text-xs text-zinc-600 mb-3">
            AI estimate range: {fmt(results.rehabLow)} – {fmt(results.rehabHigh)}
          </div>

          {/* Editable number */}
          <div className="flex items-baseline gap-3">
            {isRehabEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl text-zinc-500 font-serif">$</span>
                <input
                  autoFocus
                  type="text"
                  value={rehabInputValue}
                  onChange={(e) => setRehabInputValue(e.target.value.replace(/[^0-9]/g, ""))}
                  onBlur={commitRehabInput}
                  onKeyDown={(e) => { if (e.key === "Enter") commitRehabInput(); if (e.key === "Escape") { setIsRehabEditing(false); setRehabInputValue(String(customRehab)); } }}
                  className="text-3xl font-serif bg-transparent border-b border-indigo-500/60 text-foreground focus:outline-none w-36 pb-0.5"
                />
              </div>
            ) : (
              <button
                onClick={() => { setIsRehabEditing(true); setRehabInputValue(String(customRehab)); }}
                className="group flex items-baseline gap-2"
              >
                <span className="text-3xl md:text-4xl font-serif text-foreground group-hover:text-zinc-300 transition-colors">
                  {fmt(customRehab)}
                </span>
                <Pencil className="w-3.5 h-3.5 text-zinc-600 group-hover:text-indigo-400 transition-colors mb-1" />
              </button>
            )}

            {/* Delta badge */}
            {isRehabModified && !isRehabEditing && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                rehabDelta > 0
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                {rehabDelta > 0 ? "+" : ""}{fmtShort(rehabDelta)} vs AI
              </span>
            )}
          </div>

          {/* Slider + Pills — visible when editing or always show */}
          <div className={`mt-5 space-y-3 transition-all duration-300 ${isRehabEditing || isRehabModified ? "opacity-100" : "opacity-60 hover:opacity-100"}`}>
            {/* Color-coded slider */}
            <div className="relative">
              <input
                type="range"
                min={sliderMin}
                max={sliderMax}
                step={1000}
                value={customRehab}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setCustomRehab(v);
                  setRehabInputValue(String(v));
                }}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${sliderColor} 0%, ${sliderColor} ${((customRehab - sliderMin) / (sliderMax - sliderMin)) * 100}%, rgba(255,255,255,0.06) ${((customRehab - sliderMin) / (sliderMax - sliderMin)) * 100}%, rgba(255,255,255,0.06) 100%)`,
                }}
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>{fmtShort(sliderMin)}</span>
                <span>{fmtShort(sliderMax)}</span>
              </div>
            </div>

            {/* Quick-adjust pills */}
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "−10%", value: Math.round(results.rehabEstimate * 0.9 / 1000) * 1000 },
                { label: "Midpoint", value: results.rehabEstimate },
                { label: "+10%", value: Math.round(results.rehabEstimate * 1.1 / 1000) * 1000 },
                { label: "+25%", value: Math.round(results.rehabEstimate * 1.25 / 1000) * 1000 },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => { setCustomRehab(value); setRehabInputValue(String(value)); setIsRehabEditing(false); }}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    customRehab === value
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <span className="inline-block mt-4 text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
            {condition}
          </span>
        </div>
      </div>

      {/* ── Gated section ── */}
      <div className="relative mt-4">
        <div
          ref={blurRef}
          className={state === "gated" ? "filter blur-[8px] opacity-40 pointer-events-none select-none" : ""}
        >
          {/* Flip + Rental summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Flip card — animated + pulsing */}
            <div
              className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8 transition-all duration-300 ${
                pulsing ? "ring-1 ring-indigo-500/30 shadow-[0_0_24px_rgba(99,102,241,0.15)]" : ""
              }`}
            >
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Flip Economics</div>
              <div className={`text-4xl md:text-5xl font-serif transition-colors duration-300 ${
                derivedFlipSignal === "green" ? "text-emerald-400" : derivedFlipSignal === "red" ? "text-red-400" : "text-amber-400"
              }`}>
                {fmt(flipDisplay)}
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm text-zinc-400">
                <span>ROI: {derivedFlipROI}%</span>
                <span>MAO: {fmt(maoDisplay)}</span>
              </div>
              <div className="mt-3">
                <SignalBadge signal={derivedFlipSignal} label={flipLabel} />
              </div>
            </div>

            {/* Rental card */}
            <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8`}>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Buy & Hold (Rental)</div>
              <div className={`text-4xl md:text-5xl font-serif ${
                results.rentalSignal === "green" ? "text-emerald-400" : results.rentalSignal === "red" ? "text-red-400" : "text-amber-400"
              }`}>
                {results.monthlyCashFlow >= 0 ? "+" : ""}
                {fmt(results.monthlyCashFlow)}
                <span className="text-2xl text-zinc-500">/mo</span>
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm text-zinc-400">
                <span>Rent: {results.units > 1 ? `${fmt(results.rentPerUnit)}/unit/mo (${fmt(results.rentEstimate)} total)` : `${fmt(results.rentEstimate)}/mo`}</span>
                <span>CoC: {results.cashOnCash}%</span>
              </div>
              <div className="mt-3">
                <SignalBadge signal={results.rentalSignal} label={rentalLabel} />
              </div>
            </div>
          </div>

          {/* ── Section 3: Flip Cost Waterfall ── */}
          {breakdown && (
            <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8 mb-6`}>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-6">Flip Cost Waterfall</div>
              <div className="space-y-2.5">
                <WaterfallBar label="ARV" value={results.arv} type="positive" total={results.arv} />
                <WaterfallBar label="Purchase Price" value={breakdown.purchasePrice} type="negative" total={results.arv} />
                <WaterfallBar label="Rehab" value={customRehab} type="negative" total={results.arv} />
                <WaterfallBar label="Holding Costs" value={breakdown.holdingCosts} type="negative" total={results.arv} />
                <WaterfallBar label="Selling Costs" value={breakdown.sellingCosts} type="negative" total={results.arv} />
                <div className="border-t border-white/[0.06] my-3" />
                <WaterfallBar label="Net Flip Profit" value={derivedFlipProfit} type="result" total={results.arv} />
              </div>
              {isRehabModified && (
                <p className="text-xs text-amber-400/70 mt-4">
                  Using your rehab estimate of {fmt(customRehab)} · AI estimate was {fmt(results.rehabEstimate)}
                </p>
              )}
              {!isRehabModified && (
                <p className="text-xs text-zinc-600 mt-4">
                  Selling costs include agent commissions &amp; title/closing fees · Holding costs cover financing during rehab
                </p>
              )}
            </div>
          )}

          {/* ── Section 4: Rental P&L ── */}
          {breakdown && (
            <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8 mb-6`}>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-6">Monthly Rental P&amp;L</div>

              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Income</div>

                {/* Gross rent row */}
                <div className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                  <span className="text-sm text-zinc-400">
                    {units > 1 ? `Gross Rent (${units} units)` : "Gross Rent"}
                    {rentSource === "zillow_nearby" && nearbyRentCount && nearbyRentCount > 0 && (
                      <span className="ml-2 text-[10px] text-emerald-500 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                        {nearbyRentCount} Zillow listings
                      </span>
                    )}
                    {rentSource === "formula" && (
                      <span className="ml-2 text-[10px] text-zinc-600 border border-white/[0.06] rounded-full px-1.5 py-0.5">
                        estimated
                      </span>
                    )}
                  </span>
                  <div className="text-right">
                    <div className="text-sm text-emerald-400 font-medium">{fmt(results.rentEstimate)}/mo</div>
                    {units > 1 && (
                      <div className="text-xs text-zinc-600">{fmt(results.rentPerUnit)}/unit</div>
                    )}
                  </div>
                </div>

                {/* Nearby rental listings used as basis */}
                {(() => {
                  const listings = nearbyRentListings && nearbyRentListings.length > 0
                    ? nearbyRentListings
                    : nearbyRentPrices && nearbyRentPrices.length > 0
                    ? nearbyRentPrices.map(p => ({ price: p, url: '' }))
                    : null;
                  if (!listings) return null;
                  return (
                    <div className="mt-2 mb-1">
                      <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1.5">Nearby Rental Listings Used</div>
                      <div className="flex flex-wrap gap-1.5">
                        {listings.slice().sort((a, b) => a.price - b.price).map((l, i) => {
                          const isMedian = l.price === results.rentPerUnit;
                          const cls = `text-xs px-2.5 py-1 rounded-full border transition-all hover:scale-105 ${
                            isMedian
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                              : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                          }`;
                          return l.url ? (
                            <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className={cls}>
                              {fmt(l.price)}/mo ↗
                            </a>
                          ) : (
                            <span key={i} className={cls}>{fmt(l.price)}/mo</span>
                          );
                        })}
                        <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.02] border border-white/[0.04] text-zinc-600">
                          median → {fmt(results.rentPerUnit)}/mo used
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mb-4">
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Expenses</div>
                {[
                  { label: "Mortgage (PITI)", value: breakdown.mortgage },
                  { label: "Vacancy (8%)", value: breakdown.vacancy },
                  { label: "Property Mgmt (10%)", value: breakdown.mgmt },
                  { label: "Maintenance (6%)", value: breakdown.maintenance },
                  { label: "CapEx Reserve (5%)", value: breakdown.capex },
                  { label: "Insurance", value: breakdown.insurance },
                  { label: "Property Taxes", value: breakdown.taxes },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-white/[0.04]">
                    <span className="text-sm text-zinc-500">{label}</span>
                    <span className="text-sm text-zinc-400">− {fmt(value)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center py-3 rounded-xl bg-white/[0.02] px-4">
                <span className="text-sm font-medium text-zinc-300">Monthly Cash Flow</span>
                <span className={`text-lg font-serif ${
                  results.monthlyCashFlow >= 300 ? "text-emerald-400" : results.monthlyCashFlow >= 0 ? "text-amber-400" : "text-red-400"
                }`}>
                  {results.monthlyCashFlow >= 0 ? "+" : ""}
                  {fmt(results.monthlyCashFlow)}
                </span>
              </div>

              <div className="mt-5 pt-5 border-t border-white/[0.06]">
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Total Cash Required</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Down Payment", value: breakdown.downPayment },
                    { label: "Closing Costs", value: breakdown.closingCostsBuy },
                    { label: "Rehab", value: customRehab },
                  ].map(({ label, value }) => (
                    <div key={label} className="glass-panel rounded-xl p-3 text-center">
                      <div className="text-xs text-zinc-500 mb-1">{label}</div>
                      <div className="text-sm text-zinc-300 font-medium">{fmtShort(value)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <span className="text-xs text-zinc-600">Total cash-in: </span>
                  <span className="text-xs text-zinc-400 font-medium">
                    {fmt(breakdown.downPayment + breakdown.closingCostsBuy + customRehab)}
                  </span>
                  <span className="text-xs text-zinc-600"> · Annual CoC: </span>
                  <span className="text-xs text-zinc-400 font-medium">{results.cashOnCash}%</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 5: BRRRR Refinance Analysis ── */}
          <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8 mb-6`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-xs uppercase tracking-widest text-zinc-500">BRRRR Refinance Analysis</div>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                brrrrSignal === "green"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : brrrrSignal === "yellow"
                  ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>
                {brrrrSignal === "green" ? "✓ All Cash Out" : brrrrSignal === "yellow" ? "Mostly Out" : "Capital Trapped"}
              </span>
            </div>

            {/* Editable Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              {/* Refi LTV */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Refi LTV</div>
                <div className="flex items-center gap-2 mb-2">
                  {isRefiLTVEditing ? (
                    <input
                      autoFocus
                      type="number"
                      value={refiLTVInput}
                      min={60} max={80}
                      onChange={e => setRefiLTVInput(e.target.value)}
                      onBlur={() => {
                        const n = parseFloat(refiLTVInput);
                        if (n >= 60 && n <= 80) { setRefiLTV(n / 100); setRefiLTVInput(String(n)); }
                        else setRefiLTVInput(String(Math.round(refiLTV * 100)));
                        setIsRefiLTVEditing(false);
                      }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setRefiLTVInput(String(Math.round(refiLTV * 100))); setIsRefiLTVEditing(false); } }}
                      className="w-16 bg-transparent border-b border-indigo-400 text-foreground text-sm font-semibold outline-none text-center"
                    />
                  ) : (
                    <button onClick={() => { setRefiLTVInput(String(Math.round(refiLTV * 100))); setIsRefiLTVEditing(true); }}
                      className="text-sm font-semibold text-foreground hover:text-indigo-300 transition-colors flex items-center gap-1">
                      {Math.round(refiLTV * 100)}%
                      <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  )}
                  {refiLTV !== 0.75 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {refiLTV > 0.75 ? "+" : ""}{Math.round((refiLTV - 0.75) * 100)}% from default
                    </span>
                  )}
                  {refiLTV !== 0.75 && (
                    <button onClick={() => { setRefiLTV(0.75); setRefiLTVInput("75"); }} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">×</button>
                  )}
                </div>
                {/* Slider */}
                <div className="relative mb-2">
                  <input
                    type="range" min={60} max={80} step={1}
                    value={Math.round(refiLTV * 100)}
                    onChange={e => { const v = Number(e.target.value); setRefiLTV(v / 100); setRefiLTVInput(String(v)); }}
                    style={{ background: `linear-gradient(to right, ${brrrrSignal === "green" ? "#34d399" : brrrrSignal === "yellow" ? "#fbbf24" : "#f87171"} ${((refiLTV - 0.6) / 0.2) * 100}%, rgba(255,255,255,0.08) 0%)` }}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  />
                </div>
                {/* Pills */}
                <div className="flex gap-1.5">
                  {[65, 70, 75, 80].map(v => (
                    <button key={v} onClick={() => { setRefiLTV(v / 100); setRefiLTVInput(String(v)); }}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-all ${Math.round(refiLTV * 100) === v ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300" : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-zinc-300"}`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Refi Interest Rate */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Refi Interest Rate</div>
                <div className="flex items-center gap-2">
                  {isRefiRateEditing ? (
                    <input
                      autoFocus
                      type="number"
                      value={refiRateInput}
                      step={0.1} min={4} max={15}
                      onChange={e => setRefiRateInput(e.target.value)}
                      onBlur={() => {
                        const n = parseFloat(refiRateInput);
                        if (n >= 4 && n <= 15) { setRefiRate(n / 100); setRefiRateInput(n.toFixed(1)); }
                        else { setRefiRateInput(((refiRate ?? 0.075) * 100).toFixed(1)); }
                        setIsRefiRateEditing(false);
                      }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setIsRefiRateEditing(false); }}
                      className="w-16 bg-transparent border-b border-indigo-400 text-foreground text-sm font-semibold outline-none text-center"
                    />
                  ) : (
                    <button onClick={() => { setRefiRateInput(((refiRate ?? 0.075) * 100).toFixed(1)); setIsRefiRateEditing(true); }}
                      className="text-sm font-semibold text-foreground hover:text-indigo-300 transition-colors flex items-center gap-1">
                      {((refiRate ?? 0.075) * 100).toFixed(1)}%
                      <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  )}
                  {refiRate !== null && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {refiRate > 0.075 ? "+" : ""}{((refiRate - 0.075) * 100).toFixed(1)}% from default
                    </span>
                  )}
                  {refiRate !== null && (
                    <button onClick={() => setRefiRate(null)} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">×</button>
                  )}
                </div>
                <div className="text-[10px] text-zinc-600 mt-2">Refi loan is separate from purchase financing</div>
              </div>
            </div>

            {/* 3 Key Metric Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] p-4 text-center">
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Refi Loan</div>
                <div className="text-xl font-bold text-foreground">{fmt(refiLoan)}</div>
                <div className="text-[10px] text-zinc-600 mt-1">{Math.round(refiLTV * 100)}% of {fmt(results.arv)} ARV</div>
              </div>
              <div className={`rounded-2xl border p-4 text-center ${
                brrrrSignal === "green" ? "bg-emerald-500/[0.06] border-emerald-500/20" :
                brrrrSignal === "yellow" ? "bg-amber-500/[0.06] border-amber-500/20" :
                "bg-red-500/[0.06] border-red-500/20"
              }`}>
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Cash Left in Deal</div>
                <div className={`text-xl font-bold ${brrrrSignal === "green" ? "text-emerald-400" : brrrrSignal === "yellow" ? "text-amber-400" : "text-red-400"}`}>
                  {cashLeftInDeal <= 0 ? `−${fmt(Math.abs(cashLeftInDeal))}` : fmt(cashLeftInDeal)}
                </div>
                <div className={`text-[10px] mt-1 ${brrrrSignal === "green" ? "text-emerald-600" : "text-zinc-600"}`}>
                  {cashLeftInDeal <= 0 ? "✓ All cash recycled" : `of ${fmt(allInCost)} all-in`}
                </div>
              </div>
              <div className={`rounded-2xl border p-4 text-center ${
                postRefiCashFlow >= 200 ? "bg-emerald-500/[0.06] border-emerald-500/20" :
                postRefiCashFlow >= 0 ? "bg-amber-500/[0.06] border-amber-500/20" :
                "bg-red-500/[0.06] border-red-500/20"
              }`}>
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Post-Refi Flow</div>
                <div className={`text-xl font-bold ${postRefiCashFlow >= 200 ? "text-emerald-400" : postRefiCashFlow >= 0 ? "text-amber-400" : "text-red-400"}`}>
                  {postRefiCashFlow >= 0 ? "+" : ""}{fmt(postRefiCashFlow)}/mo
                </div>
                <div className="text-[10px] text-zinc-600 mt-1">
                  {postRefiCoC === Infinity ? "∞ CoC — all capital out" : `${postRefiCoC}% CoC return`}
                </div>
              </div>
            </div>

            {/* BRRRR Waterfall */}
            <div className="mb-6">
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Capital Flow</div>
              <div className="flex items-center gap-2 text-sm">
                <div className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
                  <div className="text-[10px] text-zinc-500 mb-0.5">All-In Cost</div>
                  <div className="font-semibold text-foreground">{fmt(allInCost)}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">Down + Closing + Rehab</div>
                </div>
                <div className="text-zinc-600">→</div>
                <div className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
                  <div className="text-[10px] text-zinc-500 mb-0.5">Refi Loan</div>
                  <div className="font-semibold text-foreground">{fmt(refiLoan)}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{Math.round(refiLTV * 100)}% LTV on ARV</div>
                </div>
                <div className="text-zinc-600">→</div>
                <div className={`flex-1 rounded-xl border p-3 text-center ${cashLeftInDeal <= 0 ? "bg-emerald-500/[0.06] border-emerald-500/20" : "bg-amber-500/[0.06] border-amber-500/20"}`}>
                  <div className="text-[10px] text-zinc-500 mb-0.5">{cashLeftInDeal <= 0 ? "Cash Back" : "Cash Remaining"}</div>
                  <div className={`font-semibold ${cashLeftInDeal <= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                    {cashLeftInDeal <= 0 ? `+${fmt(Math.abs(cashLeftInDeal))}` : fmt(cashLeftInDeal)}
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{cashLeftInDeal <= 0 ? "returned at close" : "still invested"}</div>
                </div>
              </div>
            </div>

            {/* Before/After P&L Comparison */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Before Refi</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Original Mortgage</span><span>− {fmt(breakdown?.mortgage ?? 0)}/mo</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>All Expenses</span><span>− {fmt(monthlyExpenses)}/mo</span>
                  </div>
                  <div className={`flex justify-between font-semibold pt-1 border-t border-white/[0.05] ${results.monthlyCashFlow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    <span>Cash Flow</span><span>{results.monthlyCashFlow >= 0 ? "+" : ""}{fmt(results.monthlyCashFlow)}/mo</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">After Refi</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Refi Mortgage</span><span>− {fmt(refiMortgage)}/mo</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>All Expenses</span><span>− {fmt(monthlyExpenses)}/mo</span>
                  </div>
                  <div className={`flex justify-between font-semibold pt-1 border-t border-white/[0.05] ${postRefiCashFlow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    <span>Cash Flow</span><span>{postRefiCashFlow >= 0 ? "+" : ""}{fmt(postRefiCashFlow)}/mo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* DSCR */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/[0.05]">
              <div className="text-xs text-zinc-500">DSCR</div>
              <span className={`text-sm font-bold px-2.5 py-1 rounded-full border ${
                dscr >= 1.25 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                dscr >= 1.0 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                "bg-red-500/10 border-red-500/20 text-red-400"
              }`}>{dscr.toFixed(2)}</span>
              <span className={`text-xs ${dscr >= 1.25 ? "text-emerald-600" : dscr >= 1.0 ? "text-amber-600" : "text-red-600"}`}>
                {dscr >= 1.25 ? "Lender Ready" : dscr >= 1.0 ? "Borderline" : "Negative Coverage"}
              </span>
              <div className="relative ml-auto">
                <button
                  onMouseEnter={() => setShowRefiRateTooltip(true)}
                  onMouseLeave={() => setShowRefiRateTooltip(false)}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs border border-white/[0.06] rounded-full w-4 h-4 flex items-center justify-center"
                >?</button>
                {showRefiRateTooltip && (
                  <div className="absolute bottom-6 right-0 w-56 bg-zinc-900 border border-white/[0.08] rounded-xl p-3 text-xs text-zinc-400 z-10 shadow-xl">
                    <strong className="text-zinc-200 block mb-1">Debt Service Coverage Ratio</strong>
                    Annual NOI ÷ Annual Debt Payments. Lenders typically require ≥ 1.25 for DSCR loans. Below 1.0 means the rent doesn&apos;t cover the mortgage.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Section 6: Comps Used ── */}
          {hasComps && (
            <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8 mb-6`}>
              <div className="flex items-center justify-between mb-6">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Comparable Properties Used for ARV</div>
                <span className="text-xs text-zinc-600">{compsUsed.length} comps</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-zinc-600 border-b border-white/[0.06]">
                      <th className="text-left py-2 pr-4 font-normal">Distance</th>
                      <th className="text-left py-2 pr-4 font-normal">Address</th>
                      <th className="text-right py-2 pr-4 font-normal">Sold Date</th>
                      <th className="text-right py-2 pr-4 font-normal">Price</th>
                      <th className="text-right py-2 pr-4 font-normal">SqFt</th>
                      <th className="text-right py-2 pr-4 font-normal">Beds</th>
                      <th className="text-right py-2 font-normal">$/SqFt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compsUsed.map((comp, i) => {
                      const ppsf = comp.living_area_sqft > 0 ? Math.round(comp.price / comp.living_area_sqft) : 0;
                      return (
                        <tr key={i} className="border-b border-white/[0.03]">
                          <td className="py-2.5 pr-4 text-zinc-500">{comp.distanceMiles.toFixed(2)} mi</td>
                          <td className="py-2.5 pr-4 text-zinc-400 text-xs" title={comp.address || "No address data"}>
                            <div className="max-w-[180px] truncate">{comp.address || "N/A"}</div>
                          </td>
                          <td className="py-2.5 pr-4 text-right text-zinc-400 text-xs whitespace-nowrap">
                            {(() => {
                              if (!comp.date_sold) return "Unknown";
                              const days = (Date.now() - comp.date_sold) / (1000 * 60 * 60 * 24);
                              if (days < 30) return "< 1 mo ago";
                              return `${Math.round(days / 30)} mo ago`;
                            })()}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-zinc-300 font-medium">{fmt(comp.price)}</td>
                          <td className="py-2.5 pr-4 text-right text-zinc-500">{comp.living_area_sqft.toLocaleString()}</td>
                          <td className="py-2.5 pr-4 text-right text-zinc-500">{comp.bedrooms}</td>
                          <td className="py-2.5 text-right text-zinc-400">${ppsf}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-600 mt-4">
                ARV = subject sqft × median $/sqft of filtered comps × {condition} condition uplift
              </p>
              <p className="text-[10px] text-zinc-700 mt-1">
                * Comps older than 6 months are excluded, expanding to 1 year only if recent data is sparse.
              </p>
            </div>
          )}

          {/* ── Section 6: What Would Work? ── */}
          {alternatives && alternatives.length > 0 && (
            <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8 mb-6`}>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">What Would Work?</div>
              <p className="text-xs text-zinc-600 mb-6">
                How the deal changes at each rehab scope — same purchase price of {fmt(price)}.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-zinc-600 border-b border-white/[0.06]">
                      <th className="text-left py-2 pr-4 font-normal">Condition</th>
                      <th className="text-right py-2 pr-4 font-normal">ARV</th>
                      <th className="text-right py-2 pr-4 font-normal">Rehab</th>
                      <th className="text-right py-2 pr-4 font-normal">Flip Profit</th>
                      <th className="text-right py-2 pr-4 font-normal">Cash Flow</th>
                      <th className="text-right py-2 font-normal">Signals</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alternatives.map((alt) => (
                      <tr key={alt.condition} className={`border-b border-white/[0.03] ${alt.condition === condition ? "bg-indigo-500/5" : ""}`}>
                        <td className="py-2.5 pr-4 capitalize text-zinc-400">
                          {alt.condition}
                          {alt.condition === condition && (
                            <span className="ml-2 text-[10px] text-indigo-400 border border-indigo-500/20 rounded-full px-1.5 py-0.5">selected</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-zinc-300">{fmtShort(alt.arv)}</td>
                        <td className="py-2.5 pr-4 text-right text-zinc-500">{fmtShort(alt.rehabMidpoint)}</td>
                        <td className={`py-2.5 pr-4 text-right font-medium ${alt.flipSignal === "green" ? "text-emerald-400" : alt.flipSignal === "red" ? "text-red-400" : "text-amber-400"}`}>
                          {alt.flipProfit >= 0 ? "+" : ""}{fmtShort(alt.flipProfit)}
                        </td>
                        <td className={`py-2.5 pr-4 text-right font-medium ${alt.rentalSignal === "green" ? "text-emerald-400" : alt.rentalSignal === "red" ? "text-red-400" : "text-amber-400"}`}>
                          {alt.monthlyCashFlow >= 0 ? "+" : ""}{fmtShort(alt.monthlyCashFlow)}/mo
                        </td>
                        <td className="py-2.5 text-right">
                          <span className="inline-flex gap-1 items-center">
                            <SignalDot signal={alt.flipSignal} />
                            <SignalDot signal={alt.rentalSignal} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Section 7: MAO Explainer ── */}
          <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8 mb-6 transition-all duration-300 ${
            pulsing ? "ring-1 ring-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]" : ""
          }`}>
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Maximum Allowable Offer (MAO)</div>
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="shrink-0">
                <div className="text-5xl font-serif text-foreground">{fmt(maoDisplay)}</div>
                <div className="text-xs text-zinc-600 mt-2">vs. asking {fmt(price)}</div>
                <div className={`text-sm font-medium mt-1 ${price <= maoDisplay ? "text-emerald-400" : "text-red-400"}`}>
                  {price <= maoDisplay ? `${fmt(maoDisplay - price)} under MAO` : `${fmt(price - maoDisplay)} over MAO`}
                </div>
              </div>
              <div className="text-sm text-zinc-500 leading-relaxed space-y-2">
                <p>
                  MAO is calculated as <span className="text-zinc-300">ARV × 70%</span> minus rehab costs — the classic
                  investor formula that preserves enough spread to cover holding, selling, and profit.
                </p>
                <p>
                  At {fmt(derivedMao)}, a buyer would capture roughly {fmt(results.arv * 0.3)} in gross equity after
                  purchase and rehab. Use this as your ceiling in negotiations.
                </p>
                <div className="flex gap-2 flex-wrap pt-1">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-400">
                    ARV {fmt(results.arv)} × 70%
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-400">
                    − Rehab {fmt(customRehab)}
                    {isRehabModified && <span className="ml-1 text-amber-400/70">(your estimate)</span>}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-300 font-medium">
                    = MAO {fmt(derivedMao)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gate overlay */}
        {state === "gated" && (
          <div ref={gateRef} className="absolute inset-0 flex items-center justify-center p-6">
            <div className="glass-panel rounded-[2rem] p-10 max-w-md w-full text-center">
              <Lock className="w-8 h-8 text-indigo-400 mx-auto mb-4" />
              <h3 className="text-xl font-serif text-foreground mb-2">Unlock the Full Deal Breakdown</h3>
              <p className="text-sm text-zinc-400 mb-6">
                Enter your email to see monthly cash flow, flip waterfall, comparable properties, and your Maximum
                Allowable Offer with full context.
              </p>
              <form onSubmit={handleUnlock} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-full py-4 px-6 text-foreground placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-full bg-foreground text-background font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-60"
                >
                  {submitting ? "Unlocking..." : "Unlock Full Analysis"}
                </button>
              </form>
              <p className="text-xs text-zinc-600 mt-3">No spam. Unsubscribe anytime.</p>
            </div>
          </div>
        )}
      </div>

      {/* Lead save error — shown after unlock, non-blocking */}
      {state === "unlocked" && leadError && (
        <p className="text-xs text-zinc-500 text-center mt-4">{leadError}</p>
      )}

      {/* Action buttons */}
      {state === "unlocked" && (
        <div className="mt-10 revealed-card space-y-4">
          {/* Export panel */}
          <div className="glass-panel rounded-[2rem] p-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-5 text-center">Export This Analysis</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Deal Sheet */}
              <div className="border border-indigo-500/20 bg-indigo-500/5 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Deal Sheet</div>
                    <div className="text-xs text-zinc-500">1-page · partners &amp; lenders</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openReport("deal_sheet", "preview")}
                    disabled={downloading !== null}
                    className="flex-1 py-2 rounded-xl border border-indigo-500/20 text-xs text-indigo-400 hover:bg-indigo-500/10 transition-all disabled:opacity-40"
                  >
                    {downloading === "deal_sheet" ? "…" : "Preview"}
                  </button>
                  <button
                    onClick={() => downloadPDF("deal_sheet")}
                    disabled={downloading !== null}
                    className="flex-1 py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-xs text-indigo-300 hover:bg-indigo-500/25 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    {downloading === "deal_sheet" ? "Building PDF…" : "Download PDF"}
                  </button>
                </div>
              </div>

              {/* Full Report */}
              <div className="border border-white/[0.07] bg-white/[0.02] rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-zinc-200">Full Report</div>
                    <div className="text-xs text-zinc-500">All sections · comps · P&amp;L · scenarios</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openReport("full_report", "preview")}
                    disabled={downloading !== null}
                    className="flex-1 py-2 rounded-xl border border-white/[0.07] text-xs text-zinc-400 hover:bg-white/[0.04] transition-all disabled:opacity-40"
                  >
                    {downloading === "full_report" ? "…" : "Preview"}
                  </button>
                  <button
                    onClick={() => downloadPDF("full_report")}
                    disabled={downloading !== null}
                    className="flex-1 py-2 rounded-xl bg-white/[0.05] border border-white/[0.09] text-xs text-zinc-300 hover:bg-white/[0.08] transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    {downloading === "full_report" ? "Building PDF…" : "Download PDF"}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Secondary nav */}
          <div className="flex justify-center gap-4">
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 rounded-full border border-white/[0.06] text-sm text-zinc-400 hover:text-foreground hover:border-white/[0.12] transition-all"
            >
              Edit Inputs
            </button>
            <button
              onClick={handleSaveDeal}
              disabled={savingDeal || dealSaved}
              className="px-6 py-3 rounded-full border border-white/[0.06] text-sm text-zinc-400 hover:text-foreground hover:border-white/[0.12] transition-all disabled:opacity-50"
            >
              {dealSaved ? "✓ Saved" : savingDeal ? "Saving..." : "Save Deal"}
            </button>
            <button
              onClick={handleShare}
              className="px-6 py-3 rounded-full border border-white/[0.06] text-sm text-zinc-400 hover:text-foreground hover:border-white/[0.12] transition-all"
            >
              {copied ? "Link Copied!" : "Share Link"}
            </button>
          </div>
        </div>
      )}

      {/* Lender Matching CTA (Phase 2 Prep) */}
      {state === "unlocked" && breakdown && (
        <div className="mt-16 relative glass-panel rounded-[2rem] overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
          <div className="p-8 md:p-12 text-center">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-2xl font-serif text-foreground mb-4">Need financing for this deal?</h3>
            
            <div className="max-w-md mx-auto bg-black/40 rounded-2xl p-6 border border-white/[0.05] mb-8 text-left text-sm">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4 font-semibold">Based on your analysis:</div>
              <ul className="space-y-3">
                <li className="flex justify-between">
                  <span className="text-zinc-400">Purchase</span>
                  <span className="text-zinc-200 font-medium">{fmt(price)}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-zinc-400">Down payment</span>
                  <span className="text-zinc-200 font-medium">{fmt(breakdown.downPayment)} ({Math.round((breakdown.downPayment / price) * 100)}%)</span>
                </li>
                <li className="flex justify-between pt-3 border-t border-white/[0.05]">
                  <span className="text-zinc-300 font-medium">Loan needed</span>
                  <span className="text-amber-400 font-bold font-serif text-lg">{fmt(price - breakdown.downPayment)}</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {['Hard Money', 'DSCR Loan', 'Conventional'].map((loan) => (
                <button
                  key={loan}
                  onClick={() => {
                    setSelectedLoan(loan);
                    trackEvent('financing_interest', { loan_type: loan, loan_amount: price - breakdown.downPayment });
                  }}
                  className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${
                    selectedLoan === loan
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "bg-white/[0.02] border-white/[0.05] text-zinc-400 hover:border-white/[0.1] hover:text-zinc-300"
                  }`}
                >
                  {loan}
                </button>
              ))}
            </div>

            <button
              disabled
              className="px-10 py-4 rounded-full bg-white/[0.03] border border-white/[0.05] text-zinc-500 font-medium cursor-not-allowed"
            >
              Get Pre-Qualified → (Coming Soon)
            </button>
          </div>
        </div>
      )}

      {/* Cook County Upsell */}
      {state === "unlocked" && results.isCookCounty && (
        <div className="upsell-banner mt-16 rounded-[2rem] p-10 text-center bg-gradient-to-r from-indigo-950/30 to-indigo-900/10 border border-indigo-500/20">
          <h3 className="text-2xl font-serif text-foreground mb-3">Looks like a solid Cook County deal.</h3>
          <p className="text-zinc-400 text-sm mb-6 max-w-lg mx-auto">
            Need reliable boots on the ground? ClearPath Asset Group handles rehab, leasing, and stabilization in the Cook County market.
          </p>
          <a
            href="https://clearpathassetgroup.com"
            className="inline-block px-8 py-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Learn About Our Service →
          </a>
        </div>
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </div>
  );
}
