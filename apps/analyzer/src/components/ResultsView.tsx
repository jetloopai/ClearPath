"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";

const CompsMap = dynamic(
  () => import("@/components/CompsMap").then(m => m.CompsMap),
  { ssr: false, loading: () => <div className="w-full h-56 rounded-2xl bg-white/[0.02] border border-white/[0.06] animate-pulse" /> }
);
import { Lock, TrendingDown, TrendingUp, Minus, Pencil, RotateCcw, FileText, Download, Camera, Sparkles, ChevronDown } from "lucide-react";
import type { AnalysisResults } from "@/lib/calculations";
import type { AnalysisBreakdown, AlternativeCondition } from "@/app/api/analyze/route";
import type { CompListing, ProviderTrace } from "@/lib/propertyData";
import type { ImageAnalysisResult } from "@/lib/imageAnalysis";
import { trackEvent } from "@/lib/analytics";
import { AuthModal } from "@/components/AuthModal";
import { supabase } from "@/lib/supabase-browser";
import { ImageUploadZone } from "@/components/ImageUploadZone";

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
  arvMethod: "comps_based" | "provider_avm" | "rough_estimate";
  arvConfidence?: "high" | "medium" | "low";
  arvRange?: { low: number; high: number } | null;
  arvExplainer?: string;
  arvProvider?: string | null;
  compsCount: number;
  rentSource?: "nearby_listings" | "provider_estimate" | "formula" | "manual";
  rentExplainer?: string;
  rentProvider?: string | null;
  nearbyRentCount?: number;
  nearbyRentPrices?: number[];
  nearbyRentListings?: { price: number; url: string; address?: string | null }[];
  interestRate?: number;
  dataWarnings?: string[];
  providerWarnings?: string[];
  providerTrace?: ProviderTrace | null;
  subjectLat?: number | null;
  subjectLng?: number | null;
  subjectData?: {
    source: "property_api" | "manual" | "stub";
    provider: string | null;
    detailsStatus: "complete" | "missing" | "stub";
    sqftSource: "property_api" | "manual" | "missing" | "stub";
    subjectSqft: number | null;
    effectiveSqft: number;
    label: string;
    summary: string;
  };
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
    <div className="flex items-center gap-2 sm:gap-4">
      <span className="text-xs text-zinc-500 w-20 sm:w-32 shrink-0 text-right">{label}</span>
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
  const [priceAdjust, setPriceAdjust] = useState(0);
  const [maoCopied, setMaoCopied] = useState(false);
  const [targetProfit, setTargetProfit] = useState("");
  const [altOverride, setAltOverride] = useState<AlternativeCondition | null>(null);

  // ── Rehab line-item state ─────────────────────────────────────────────────────
  const [showLineItems, setShowLineItems] = useState(false);
  type LineItem = { id: string; label: string; cost: string };
  const DEFAULT_LINE_ITEMS: LineItem[] = [
    { id: "roof",       label: "Roof",            cost: "" },
    { id: "hvac",       label: "HVAC",            cost: "" },
    { id: "kitchen",    label: "Kitchen",         cost: "" },
    { id: "bathrooms",  label: "Bathrooms",       cost: "" },
    { id: "flooring",   label: "Flooring",        cost: "" },
    { id: "electrical", label: "Electrical",      cost: "" },
    { id: "plumbing",   label: "Plumbing",        cost: "" },
    { id: "windows",    label: "Windows/Doors",   cost: "" },
    { id: "paint",      label: "Paint/Drywall",   cost: "" },
    { id: "exterior",   label: "Exterior/Landscaping", cost: "" },
    { id: "other",      label: "Other",           cost: "" },
  ];
  const [lineItems, setLineItems] = useState<LineItem[]>(DEFAULT_LINE_ITEMS);
  const lineItemTotal = lineItems.reduce((s, li) => s + (parseInt(li.cost.replace(/[^0-9]/g, ""), 10) || 0), 0);

  // ── Rehab editor state ────────────────────────────────────────────────────────
  const [customRehab, setCustomRehab] = useState(0);
  const [isRehabEditing, setIsRehabEditing] = useState(false);
  const [rehabInputValue, setRehabInputValue] = useState("");
  const [flipDisplay, setFlipDisplay] = useState(0);
  const [maoDisplay, setMaoDisplay] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const flipCountRef = useRef({ val: 0 });
  const maoCountRef = useRef({ val: 0 });

  // ── Deal sheet section toggles ────────────────────────────────────────────────
  const [dealSheetSections, setDealSheetSections] = useState({
    flip: true,
    buyhold: true,
    brrrr: true,
    mao: true,
  });
  const toggleSection = (key: keyof typeof dealSheetSections) =>
    setDealSheetSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Image analysis state ──────────────────────────────────────────────────────
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [refineImages, setRefineImages] = useState<string[]>([]);
  const [refineAnalysis, setRefineAnalysis] = useState<ImageAnalysisResult | null>(null);
  const [refineLoading, setRefineLoading] = useState(false);
  const [showRefinePanel, setShowRefinePanel] = useState(false);
  const [showScopeTable, setShowScopeTable] = useState(true);
  const confidenceColor: Record<string, string> = {
    high: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
    medium: "text-amber-400 border-amber-500/20 bg-amber-500/10",
    low: "text-zinc-400 border-white/[0.08] bg-white/[0.03]",
  };

  // ── Neighborhood data state ───────────────────────────────────────────────────
  const [neighborhoodData, setNeighborhoodData] = useState<{
    zip: string; hasData: boolean; count: number;
    avgArv?: number; avgFlip?: number; avgCashFlow?: number; greenPct?: number;
  } | null>(null);

  // ── STR / Airbnb analysis state ──────────────────────────────────────────────
  const [strNightlyRate, setStrNightlyRate] = useState("");
  const [strOccupancy, setStrOccupancy] = useState("65");
  const [strAvgStay, setStrAvgStay] = useState("3");

  // ── Hard Money Loan state ─────────────────────────────────────────────────────
  const [hmlRate, setHmlRate] = useState("12");
  const [hmlPoints, setHmlPoints] = useState("2");
  const [hmlLTV, setHmlLTV] = useState("90");

  // ── BRRRR state ───────────────────────────────────────────────────────────────
  const [refiLTV, setRefiLTV] = useState(0.75);
  const [refiLTVInput, setRefiLTVInput] = useState("75");
  const [isRefiLTVEditing, setIsRefiLTVEditing] = useState(false);
  const [refiRate, setRefiRate] = useState<number | null>(null); // null = inherit 7.5%
  const [refiRateInput, setRefiRateInput] = useState("");
  const [isRefiRateEditing, setIsRefiRateEditing] = useState(false);
  const [showRefiRateTooltip, setShowRefiRateTooltip] = useState(false);
  const cashOutRef = useRef({ val: 0 });
  // cashOutDisplay drives re-renders via GSAP onUpdate; reading it is intentional
  const [, setCashOutDisplay] = useState(0);

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
    trackEvent('analysis_completed', { address: data.address, signal: data.results.signal, arv: data.results.arv });

    // Fetch neighborhood data from ZIP in address
    const zipMatch = data.address.match(/\b(\d{5})\b/);
    if (zipMatch) {
      fetch(`/api/neighborhood?zip=${zipMatch[1]}`)
        .then(r => r.ok ? r.json() : null)
        .then(nd => { if (nd) setNeighborhoodData(nd); })
        .catch(() => {});
    }

    // Init rehab state
    setCustomRehab(data.results.rehabEstimate);
    setRehabInputValue(String(data.results.rehabEstimate));
    setFlipDisplay(data.results.flipProfit);
    setMaoDisplay(data.results.mao);
    flipCountRef.current.val = data.results.flipProfit;
    maoCountRef.current.val = data.results.mao;

    // Init image analysis if it came from ConfigModal
    if ((data as any).imageAnalysis) {
      setImageAnalysis((data as any).imageAnalysis);
    }

    // fromDashboard: user already verified by dashboard — skip gate immediately
    if ((data as any).fromDashboard) {
      setState("unlocked");
    }
  }, []);

  // ── Auth gate logic — runs once analysis is loaded ────────────────────────────
  // Uses onAuthStateChange instead of getSession() so it fires AFTER Supabase
  // has finished loading the session from localStorage (INITIAL_SESSION event).
  useEffect(() => {
    if (!analysis) return;
    if ((analysis as any).fromDashboard) return; // already unlocked above

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        // Reliable: fires after client has fully initialized from storage
        setState(session ? "unlocked" : "gated");
      }

      if (event === 'SIGNED_IN' && session) {
        // User signed in from the gate — animate out and save
        if (gateRef.current) gsap.to(gateRef.current, { opacity: 0, y: -20, duration: 0.4, ease: "power2.in" });
        if (blurRef.current) gsap.to(blurRef.current, { filter: "blur(0px)", opacity: 1, duration: 1.2, ease: "power2.out", delay: 0.3 });
        setTimeout(() => {
          setState("unlocked");
          handleSaveDeal();
        }, 500);
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

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
    arvConfidence: analysis!.arvConfidence,
    arvRange: analysis!.arvRange,
    arvExplainer: analysis!.arvExplainer,
    compsCount: analysis!.compsCount,
    rentSource: analysis!.rentSource,
    rentExplainer: analysis!.rentExplainer,
    subjectData: analysis!.subjectData,
    customRehab,
    // BRRRR values for report
    brrrr: {
      refiLTV,
      refiLoan,
      allInCost,
      cashLeftInDeal,
      refiMortgage,
      postRefiCashFlow,
      postRefiCoC,
      dscr,
      brrrrSignal,
      effectiveRefiRate,
    },
    // Deal sheet section toggles (ignored for full report)
    sections: dealSheetSections,
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
      // 1. Fetch HTML
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reportPayload(reportType), mode: "preview" }),
      });
      if (!res.ok) throw new Error("Report failed");
      const html = await res.text();

      // Letter page dimensions in px at 96dpi
      const PAGE_W = 816;
      const PAGE_H = 1056;

      // 2. Render in a hidden iframe — tall enough to hold full content
      const iframe = document.createElement("iframe");
      iframe.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${PAGE_W}px;height:${PAGE_H * 3}px;border:none;visibility:hidden;`;
      document.body.appendChild(iframe);
      iframe.contentDocument!.open();
      iframe.contentDocument!.write(html);
      iframe.contentDocument!.close();

      // 3. Wait for layout + fonts
      await new Promise(r => setTimeout(r, 1000));

      // Measure real content height
      const contentH = iframe.contentDocument!.body.scrollHeight;
      iframe.style.height = `${contentH}px`;
      await new Promise(r => setTimeout(r, 200));

      // 4. Capture full content at 2× for sharpness
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(iframe.contentDocument!.body, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        width: PAGE_W,
        height: contentH,
        windowWidth: PAGE_W,
        windowHeight: contentH,
      });

      // 5. Slice canvas into letter-page chunks and build multi-page PDF
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [PAGE_W, PAGE_H] });

      const totalPages = Math.ceil(contentH / PAGE_H);
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        // Crop the canvas for this page
        const srcY = page * PAGE_H * 2;          // ×2 for scale
        const srcH = Math.min(PAGE_H * 2, canvas.height - srcY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = PAGE_W * 2;
        pageCanvas.height = PAGE_H * 2;
        const ctx = pageCanvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, srcY, PAGE_W * 2, srcH, 0, 0, PAGE_W * 2, srcH);
        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        pdf.addImage(imgData, "JPEG", 0, 0, PAGE_W, PAGE_H);
      }

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
    const url = new URL(`/r/${analysis.analysisId}`, window.location.origin);
    navigator.clipboard.writeText(url.toString());
    setCopied(true);
    trackEvent('share_deal_clicked', { address: analysis.address, signal: analysis.results.signal });
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

  const {
    results,
    address,
    price,
    condition,
    units = 1,
    breakdown,
    compsUsed,
    alternatives,
    arvMethod,
    arvConfidence = "low",
    arvRange,
    arvExplainer,
    arvProvider,
    compsCount,
    rentSource,
    rentExplainer,
    rentProvider,
    nearbyRentCount,
    nearbyRentPrices,
    nearbyRentListings,
    subjectData,
    subjectLat,
    subjectLng,
  } = analysis;

  // ── Alt-override layer (condition switcher) ──────────────────────────────────
  const displayArv    = altOverride ? altOverride.arv : results.arv;
  const displayRehab  = altOverride ? altOverride.rehabMidpoint : customRehab;
  const displayCondition = altOverride ? altOverride.condition : condition;

  // ── Derived values using customRehab ─────────────────────────────────────────
  const derivedFlipProfit = altOverride
    ? altOverride.flipProfit
    : Math.round(
        results.arv - price - customRehab -
        (breakdown?.sellingCosts ?? results.arv * 0.08) -
        (breakdown?.holdingCosts ?? price * 0.01 * 6)
      );
  const derivedMao = Math.round(displayArv * 0.7 - displayRehab);
  const derivedFlipROI = Math.round((derivedFlipProfit / (price + displayRehab)) * 1000) / 10;
  const derivedFlipSignal: "green" | "yellow" | "red" = altOverride
    ? altOverride.flipSignal
    : derivedFlipProfit >= 30000 ? "green" : derivedFlipProfit < 10000 ? "red" : "yellow";

  const isRehabModified = customRehab !== results.rehabEstimate;
  const rehabDelta = customRehab - results.rehabEstimate;

  // ── Price sensitivity derived values ─────────────────────────────────────────
  const adjustedPrice = price + priceAdjust;
  const holdingRate = breakdown?.holdingCosts ? breakdown.holdingCosts / price : 0.06;
  const adjustedFlipProfit = priceAdjust !== 0
    ? Math.round(results.arv - adjustedPrice - customRehab - (breakdown?.sellingCosts ?? results.arv * 0.08) - adjustedPrice * holdingRate)
    : derivedFlipProfit;
  const adjustedFlipSignal: "green" | "yellow" | "red" =
    adjustedFlipProfit >= 30000 ? "green" : adjustedFlipProfit < 10000 ? "red" : "yellow";

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

  // ── Hard Money Loan derived calculations ──────────────────────────────────────
  const holdMonths = breakdown?.holdingCosts ? Math.max(1, Math.round(breakdown.holdingCosts / (price * 0.01))) : 6;
  const hmlRateNum = Math.max(0, Math.min(30, parseFloat(hmlRate) || 12)) / 100;
  const hmlPointsNum = Math.max(0, Math.min(10, parseFloat(hmlPoints) || 2)) / 100;
  const hmlLTVNum = Math.max(50, Math.min(100, parseFloat(hmlLTV) || 90)) / 100;
  const hmlLoan = Math.round(price * hmlLTVNum);
  const hmlDownRequired = price - hmlLoan;
  const hmlMonthlyPayment = Math.round(hmlLoan * hmlRateNum / 12);
  const hmlPointsFee = Math.round(hmlLoan * hmlPointsNum);
  const hmlTotalInterest = hmlMonthlyPayment * holdMonths;
  const hmlFlipProfit = Math.round(
    results.arv - price - customRehab -
    (breakdown?.sellingCosts ?? results.arv * 0.08) -
    hmlTotalInterest - hmlPointsFee
  );
  const hmlCashNeeded = hmlDownRequired + hmlPointsFee + customRehab + (breakdown?.closingCostsBuy ?? Math.round(price * 0.02));
  const hmlFlipROI = hmlCashNeeded > 0 ? Math.round((hmlFlipProfit / hmlCashNeeded) * 1000) / 10 : 0;
  const hmlFlipSignal: "green" | "yellow" | "red" = hmlFlipProfit >= 30000 ? "green" : hmlFlipProfit < 10000 ? "red" : "yellow";
  const convCashNeeded = (breakdown?.downPayment ?? Math.round(price * 0.25)) + customRehab + (breakdown?.closingCostsBuy ?? Math.round(price * 0.02));
  const convFlipROI = convCashNeeded > 0 ? Math.round((derivedFlipProfit / convCashNeeded) * 1000) / 10 : 0;

  // ── STR / Airbnb derived calculations ────────────────────────────────────────
  const defaultNightlyRate = Math.round(results.rentEstimate * 2.5 / 30);
  const effectiveNightlyRate = strNightlyRate ? (parseFloat(strNightlyRate) || defaultNightlyRate) : defaultNightlyRate;
  const strOccPct = Math.max(10, Math.min(100, parseFloat(strOccupancy) || 65)) / 100;
  const strStay = Math.max(1, Math.min(30, parseFloat(strAvgStay) || 3));
  const strGrossMonthly = Math.round(effectiveNightlyRate * 30 * strOccPct);
  const strPlatformFee = Math.round(strGrossMonthly * 0.03);
  const strTurnovers = Math.max(1, Math.round((30 * strOccPct) / strStay));
  const strCleaningCost = strTurnovers * 100;
  const strNetIncome = strGrossMonthly - strPlatformFee - strCleaningCost;
  const strExpenses = (breakdown?.mortgage ?? 0) + (breakdown?.insurance ?? 0) + (breakdown?.taxes ?? 0);
  const strCashFlow = strNetIncome - strExpenses;
  const strCashFlowSignal: "green" | "yellow" | "red" = strCashFlow >= 500 ? "green" : strCashFlow >= 0 ? "yellow" : "red";
  const strVsLtr = strCashFlow - results.monthlyCashFlow;
  const strAnnualNet = strNetIncome * 12;

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
  const showTrustCallout = arvMethod === "rough_estimate" || (subjectData && subjectData.source !== "property_api");
  const arvConfidenceLabel = arvConfidence.charAt(0).toUpperCase() + arvConfidence.slice(1);

  const runRefineAnalysis = async () => {
    if (refineImages.length === 0) return;
    setRefineLoading(true);
    try {
      const res = await fetch("/api/analyze-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: refineImages }),
      });
      if (!res.ok) throw new Error();
      const result: ImageAnalysisResult = await res.json();
      setRefineAnalysis(result);
    } catch {
      // silently fail
    } finally {
      setRefineLoading(false);
    }
  };

  const activeImageAnalysis = refineAnalysis ?? imageAnalysis;

  return (
    <div ref={containerRef} className="max-w-5xl mx-auto">
      {/* Property Header */}
      <div className="text-center mb-8">
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Deal Analysis</h2>
        <h1 className="text-3xl md:text-4xl font-light text-zinc-200">{address}</h1>
        <p className="text-xs text-zinc-600 mt-2 capitalize">
          {results.units > 1 ? `${results.units}-Unit · ` : ""}{condition} condition ·{" "}
          {arvMethod === "comps_based" ? `ARV from ${compsCount} nearby comp${compsCount !== 1 ? "s" : ""}` : "ARV shown as rough estimate"}
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

      {/* ── Data quality warnings ── */}
      {analysis.dataWarnings && analysis.dataWarnings.length > 0 && (
        <div className="mb-6 space-y-2">
          {analysis.dataWarnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-amber-400 text-sm mt-0.5 shrink-0">⚠</span>
              <p className="text-xs text-amber-300 leading-relaxed">{warning}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Section 1: Deal Narrative ── */}
      {showTrustCallout && (
        <div className="mb-6 rounded-[2rem] border border-amber-500/20 bg-amber-500/10 px-6 py-5">
          <div className="text-xs uppercase tracking-widest text-amber-300 mb-2">Underwriting Trust Check</div>
          <p className="text-sm text-amber-100/90 leading-relaxed">
            {subjectData?.summary ?? "Some core property facts were incomplete, so treat this analysis as directional until the missing data is verified."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-panel rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">ARV Source</div>
          <div className="text-sm text-zinc-200">
            {arvMethod === "comps_based" ? "Comps-based" : arvMethod === "provider_avm" ? (arvProvider ?? "Provider AVM") : "Rough estimate"}
          </div>
          <p className="text-xs text-zinc-500 mt-2">{arvExplainer ?? "ARV source unavailable."}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Rent Source</div>
          <div className="text-sm text-zinc-200">
            {rentSource === "manual" ? "Manual override" : rentSource === "nearby_listings" ? `${rentProvider ?? "Provider"} listings` : rentSource === "provider_estimate" ? `${rentProvider ?? "Provider"} estimate` : "Formula estimate"}
          </div>
          <p className="text-xs text-zinc-500 mt-2">{rentExplainer ?? "Rent source unavailable."}</p>
        </div>
        <div className="glass-panel rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Subject Facts</div>
          <div className="text-sm text-zinc-200">{subjectData?.label ?? "Property details"}</div>
          <p className="text-xs text-zinc-500 mt-2">
            {subjectData ? `${subjectData.effectiveSqft.toLocaleString()} sq ft used in the analysis.` : "Subject data source unavailable."}
          </p>
        </div>
      </div>

      <div className="result-card glass-panel rounded-[2rem] p-5 md:p-8 mb-6">
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
        <div className="result-card glass-panel rounded-[2rem] p-5 md:p-8">
          <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">After Repair Value (ARV)</div>
          <div className="text-3xl md:text-5xl font-serif text-foreground">{fmt(displayArv)}</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className={`text-[10px] px-2 py-1 rounded-full border ${
              arvConfidence === "high"
                ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/10"
                : arvConfidence === "medium"
                ? "border-amber-500/20 text-amber-400 bg-amber-500/10"
                : "border-white/[0.08] text-zinc-400 bg-white/[0.04]"
            }`}>
              {arvConfidenceLabel} confidence
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full border border-white/[0.08] text-zinc-400 bg-white/[0.04]">
              {arvMethod === "comps_based" ? `${compsCount} comps used` : "No comp-backed ARV"}
            </span>
          </div>
          {arvRange && (() => {
            const span = arvRange.high - arvRange.low;
            const midPct = span > 0 ? ((results.arv - arvRange.low) / span) * 100 : 50;
            return (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
                  <span>{fmt(arvRange.low)}</span>
                  <span>{fmt(arvRange.high)}</span>
                </div>
                <div className="relative h-1.5 rounded-full bg-white/[0.06]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-indigo-500/30"
                    style={{ width: "100%" }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-indigo-400 border border-white/20 shadow"
                    style={{ left: `calc(${Math.min(Math.max(midPct, 4), 96)}% - 5px)` }}
                  />
                </div>
                <div className="text-[10px] text-zinc-600 mt-1 text-center">
                  ARV range · {fmt(span)} spread
                </div>
              </div>
            );
          })()}
          <div className="text-xs text-zinc-600 mt-3">
            {arvExplainer ?? (arvMethod === "comps_based" ? `Based on ${compsCount} nearby comps` : "Estimated from purchase price")}
          </div>
        </div>

        {/* Rehab card — editable */}
        <div className="result-card glass-panel rounded-[2rem] p-5 md:p-8">
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

          {/* Line-item scope builder */}
          <div className="mt-5 pt-5 border-t border-white/[0.05]">
            <button
              onClick={() => setShowLineItems(o => !o)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showLineItems ? "rotate-180" : ""}`} />
              {showLineItems ? "Hide" : "Build"} line-item scope
              {lineItemTotal > 0 && (
                <span className="ml-1 text-indigo-400 font-medium">(total: {fmtShort(lineItemTotal)})</span>
              )}
            </button>
            {showLineItems && (
              <div className="mt-3 space-y-2">
                {lineItems.map((li, idx) => (
                  <div key={li.id} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 w-32 shrink-0">{li.label}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 text-xs">$</span>
                      <input
                        type="text"
                        value={li.cost}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^0-9]/g, "");
                          const formatted = raw ? Number(raw).toLocaleString("en-US") : "";
                          setLineItems(prev => prev.map((l, i) => i === idx ? { ...l, cost: formatted } : l));
                        }}
                        placeholder="0"
                        className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg py-1.5 pl-7 pr-3 text-xs text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-indigo-500/30 transition-colors"
                      />
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <span className="text-xs text-zinc-400 font-medium">Line-item total</span>
                  <span className="text-sm font-serif text-zinc-200 font-medium">{fmt(lineItemTotal)}</span>
                </div>
                {lineItemTotal > 0 && (
                  <button
                    onClick={() => { setCustomRehab(lineItemTotal); setRehabInputValue(String(lineItemTotal)); setIsRehabEditing(false); }}
                    className="w-full py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                  >
                    Apply {fmt(lineItemTotal)} to analysis →
                  </button>
                )}
              </div>
            )}
          </div>

          <span className="inline-block mt-4 text-xs px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 capitalize">
            {displayCondition}
          </span>
        </div>
      </div>

      {/* ── Condition override banner ── */}
      {altOverride && (
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
          <span className="text-xs text-indigo-300">
            Viewing <span className="font-medium capitalize">{altOverride.condition}</span> condition — ARV {fmt(altOverride.arv)}, Rehab {fmt(altOverride.rehabMidpoint)}, Flip {altOverride.flipProfit >= 0 ? "+" : ""}{fmt(altOverride.flipProfit)}
          </span>
          <button
            onClick={() => setAltOverride(null)}
            className="ml-auto text-[11px] text-indigo-400 hover:text-white border border-indigo-500/30 hover:border-indigo-500/60 px-2.5 py-1 rounded-full transition-all"
          >
            ← Back to {condition}
          </button>
        </div>
      )}

      {/* ── MAO Hero Card ── */}
      <div className="result-card glass-panel rounded-[2rem] p-5 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Max Allowable Offer (70% Rule)</div>
            <div className="flex items-baseline gap-4 mb-2">
              <div className={`text-4xl md:text-5xl font-serif ${price <= derivedMao ? "text-emerald-400" : "text-red-400"}`}>
                {fmt(derivedMao)}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(String(derivedMao)); setMaoCopied(true); setTimeout(() => setMaoCopied(false), 2000); }}
                className="text-xs px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:text-white hover:border-white/[0.2] transition-all"
              >
                {maoCopied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <p className={`text-sm ${price <= derivedMao ? "text-emerald-400" : "text-red-400"}`}>
              {price <= derivedMao
                ? `${fmt(derivedMao - price)} under MAO — you're in the money at ${fmt(price)}`
                : `${fmt(price - derivedMao)} over MAO — negotiate down to ${fmt(derivedMao)} to hit 70% rule`}
            </p>
          </div>

          {/* Price sensitivity */}
          <div className="md:w-72 shrink-0">
            <div className="text-xs text-zinc-600 mb-2">Adjust offer price — see flip impact:</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {[-30000, -20000, -10000, 0, 10000, 20000].map(adj => (
                <button
                  key={adj}
                  onClick={() => setPriceAdjust(adj)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    priceAdjust === adj
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-300"
                  }`}
                >
                  {adj === 0 ? `${fmt(price)}` : `${adj > 0 ? "+" : ""}${fmtShort(adj)}`}
                </button>
              ))}
            </div>
            {priceAdjust !== 0 && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div className="text-[10px] text-zinc-600 mb-1">At offer price {fmt(adjustedPrice)}</div>
                <div className={`text-lg font-serif font-medium ${adjustedFlipSignal === "green" ? "text-emerald-400" : adjustedFlipSignal === "red" ? "text-red-400" : "text-amber-400"}`}>
                  {adjustedFlipProfit >= 0 ? "+" : ""}{fmt(adjustedFlipProfit)} flip profit
                </div>
                <div className="text-[10px] text-zinc-600 mt-0.5">
                  {adjustedFlipProfit >= derivedFlipProfit
                    ? `${fmt(adjustedFlipProfit - derivedFlipProfit)} better than current`
                    : `${fmt(derivedFlipProfit - adjustedFlipProfit)} worse than current`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Reverse MAO ── */}
      {(() => {
        const targetNum = parseInt(targetProfit.replace(/[^0-9]/g, ""), 10);
        const sellingCosts = breakdown?.sellingCosts ?? results.arv * 0.08;
        const holdingCosts = breakdown?.holdingCosts ?? price * 0.01 * 6;
        const maxOffer = isNaN(targetNum)
          ? null
          : Math.round(results.arv - customRehab - sellingCosts - holdingCosts - targetNum);
        return (
          <div className="result-card glass-panel rounded-[2rem] p-5 md:p-8 mb-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Reverse MAO — target profit</div>
            <p className="text-xs text-zinc-600 mb-4">Enter a profit target to see the max you can pay.</p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={targetProfit}
                  onChange={e => setTargetProfit(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="30000"
                  className="pl-7 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-zinc-200 text-sm w-36 focus:outline-none focus:border-indigo-500/40"
                />
              </div>
              {maxOffer !== null && (
                <div className={`flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]`}>
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-0.5">Max offer for {targetNum >= 0 ? fmt(targetNum) : "—"} profit</div>
                    <div className={`text-2xl font-serif font-medium ${maxOffer >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {maxOffer >= 0 ? fmt(maxOffer) : "Not possible at current ARV"}
                    </div>
                    {maxOffer >= 0 && price > maxOffer && (
                      <div className="text-xs text-amber-400 mt-0.5">Asking price is {fmt(price - maxOffer)} above this target</div>
                    )}
                    {maxOffer >= 0 && price <= maxOffer && (
                      <div className="text-xs text-emerald-400 mt-0.5">Current price qualifies — {fmt(maxOffer - price)} of room</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
              <div className={`text-3xl md:text-5xl font-serif transition-colors duration-300 ${
                derivedFlipSignal === "green" ? "text-emerald-400" : derivedFlipSignal === "red" ? "text-red-400" : "text-amber-400"
              }`}>
                {fmt(flipDisplay)}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-zinc-400">
                <span>ROI: {derivedFlipROI}%</span>
                <span>MAO: {fmt(maoDisplay)}</span>
              </div>
              <div className="mt-3">
                <SignalBadge signal={derivedFlipSignal} label={flipLabel} />
              </div>
            </div>

            {/* Rental card */}
            <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-5 md:p-8`}>
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Buy & Hold (Rental)</div>
              <div className={`text-3xl md:text-5xl font-serif ${
                results.rentalSignal === "green" ? "text-emerald-400" : results.rentalSignal === "red" ? "text-red-400" : "text-amber-400"
              }`}>
                {results.monthlyCashFlow >= 0 ? "+" : ""}
                {fmt(results.monthlyCashFlow)}
                <span className="text-xl md:text-2xl text-zinc-500">/mo</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-zinc-400">
                <span>Rent: {results.units > 1 ? `${fmt(results.rentPerUnit)}/unit` : `${fmt(results.rentEstimate)}/mo`}</span>
                <span>CoC: {results.cashOnCash}%</span>
              </div>
              <div className="mt-3">
                <SignalBadge signal={results.rentalSignal} label={rentalLabel} />
              </div>
            </div>
          </div>

          {/* ── AI Photo Assessment ── */}
          {state === "unlocked" && (
            <div className="revealed-card glass-panel rounded-[2rem] p-8 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-zinc-500" />
                  <div className="text-xs uppercase tracking-widest text-zinc-500">AI Photo Assessment</div>
                </div>
                {activeImageAnalysis && (
                  <div className="flex items-center gap-2">
                    <span className="capitalize text-xs text-zinc-300 font-medium">{activeImageAnalysis.condition}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${confidenceColor[activeImageAnalysis.confidence]}`}>
                      {activeImageAnalysis.confidence} confidence
                    </span>
                  </div>
                )}
              </div>

              {activeImageAnalysis ? (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400 leading-relaxed">{activeImageAnalysis.summary}</p>

                  {activeImageAnalysis.scopeOfWork.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowScopeTable(!showScopeTable)}
                        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-3"
                      >
                        <ChevronDown className={`w-3 h-3 transition-transform ${showScopeTable ? "rotate-180" : ""}`} />
                        Scope of Work ({activeImageAnalysis.scopeOfWork.length} items)
                      </button>
                      {showScopeTable && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-widest text-zinc-600 border-b border-white/[0.06]">
                                <th className="text-left py-2 pr-4 font-normal">Category</th>
                                <th className="text-left py-2 pr-4 font-normal">Issue</th>
                                <th className="text-right py-2 font-normal">Est. Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeImageAnalysis.scopeOfWork.map((item, i) => (
                                <tr key={i} className="border-b border-white/[0.03]">
                                  <td className="py-2.5 pr-4 text-zinc-400 text-xs font-medium whitespace-nowrap">{item.category}</td>
                                  <td className="py-2.5 pr-4 text-zinc-500 text-xs">{item.issue}</td>
                                  <td className="py-2.5 text-right text-zinc-300 text-xs whitespace-nowrap">{item.estimatedCost}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/[0.05]">
                    <button
                      onClick={() => setShowRefinePanel(!showRefinePanel)}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      {showRefinePanel ? "Hide" : "Add more photos to refine assessment"}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setShowRefinePanel(!showRefinePanel)}
                    className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-500/60" />
                    Upload photos for AI condition assessment
                    <ChevronDown className={`w-3 h-3 transition-transform ${showRefinePanel ? "rotate-180" : ""}`} />
                  </button>
                </div>
              )}

              {showRefinePanel && (
                <div className="mt-4 pt-4 border-t border-white/[0.05] space-y-3">
                  <div className="text-xs text-zinc-600">
                    {activeImageAnalysis ? "Add more photos — up to 10 total" : "Upload interior and exterior photos for best results"}
                  </div>
                  <ImageUploadZone images={refineImages} onChange={setRefineImages} maxImages={10} />
                  {refineImages.length > 0 && (
                    <button
                      onClick={runRefineAnalysis}
                      disabled={refineLoading}
                      className="px-5 py-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                    >
                      {refineLoading ? "Analyzing..." : "Analyze Photos"}
                    </button>
                  )}
                  {refineAnalysis && !refineLoading && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="text-xs text-zinc-400">
                        Updated assessment: <span className="capitalize text-white font-medium">{refineAnalysis.condition}</span>
                        <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full border ${confidenceColor[refineAnalysis.confidence]}`}>
                          {refineAnalysis.confidence}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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

          {/* ── Multi-family rent roll (2–4 units) ── */}
          {units > 1 && state === "unlocked" && breakdown && (
            <div className="revealed-card glass-panel rounded-[2rem] p-8 mb-6">
              <div className="text-xs uppercase tracking-widest text-zinc-500 mb-6">{units}-Unit Rent Roll</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-zinc-600 font-normal">Unit</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-widest text-zinc-600 font-normal">Est. Rent</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-widest text-zinc-600 font-normal">Vacancy (8%)</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-widest text-zinc-600 font-normal">Effective</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {Array.from({ length: units }, (_, i) => {
                      const unitRent = results.rentPerUnit;
                      const vacancy = Math.round(unitRent * 0.08);
                      const effective = unitRent - vacancy;
                      return (
                        <tr key={i}>
                          <td className="py-2.5 px-3 text-zinc-400">Unit {i + 1}</td>
                          <td className="py-2.5 px-3 text-right text-zinc-300">{fmt(unitRent)}</td>
                          <td className="py-2.5 px-3 text-right text-zinc-500">− {fmt(vacancy)}</td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-medium">{fmt(effective)}</td>
                        </tr>
                      );
                    })}
                    <tr className="border-t border-white/[0.08]">
                      <td className="py-2.5 px-3 text-zinc-300 font-medium">Total</td>
                      <td className="py-2.5 px-3 text-right text-zinc-300 font-medium">{fmt(results.rentEstimate)}</td>
                      <td className="py-2.5 px-3 text-right text-zinc-500">− {fmt(Math.round(results.rentEstimate * 0.08))}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-bold font-serif">{fmt(Math.round(results.rentEstimate * 0.92))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Gross Rent", value: fmt(results.rentEstimate) + "/mo" },
                  { label: "Per Unit", value: fmt(results.rentPerUnit) + "/unit" },
                  { label: "Cap Rate", value: `${Math.round(((results.rentEstimate - monthlyExpenses) * 12 / results.arv) * 1000) / 10}%` },
                  { label: "GRM", value: `${Math.round(results.arv / (results.rentEstimate * 12) * 10) / 10}x` },
                ].map(s => (
                  <div key={s.label} className="glass-panel rounded-xl p-3 text-center border border-white/[0.04]">
                    <div className="text-[10px] text-zinc-600 mb-1 uppercase tracking-widest">{s.label}</div>
                    <div className="text-sm font-serif text-zinc-200">{s.value}</div>
                  </div>
                ))}
              </div>
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
                    {rentSource === "nearby_listings" && nearbyRentCount && nearbyRentCount > 0 && (
                      <span className="ml-2 text-[10px] text-emerald-500 border border-emerald-500/20 rounded-full px-1.5 py-0.5">
                        {nearbyRentCount} provider listings
                      </span>
                    )}
                    {rentSource === "manual" && (
                      <span className="ml-2 text-[10px] text-indigo-300 border border-indigo-500/20 rounded-full px-1.5 py-0.5">
                        manual override
                      </span>
                    )}
                    {rentSource === "provider_estimate" && (
                      <span className="ml-2 text-[10px] text-sky-300 border border-sky-500/20 rounded-full px-1.5 py-0.5">
                        provider estimate
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

                {rentExplainer && (
                  <p className="text-xs text-zinc-600 mt-3">{rentExplainer}</p>
                )}

                {/* Nearby rental listings used as basis */}
                {(() => {
                  const listings = nearbyRentListings && nearbyRentListings.length > 0
                    ? nearbyRentListings
                    : nearbyRentPrices && nearbyRentPrices.length > 0
                    ? nearbyRentPrices.map(p => ({ price: p, url: '', address: null }))
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
                            <a
                              key={i}
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cls}
                              title={l.address ? `Open listing search for ${l.address}` : 'Open listing search'}
                              aria-label={l.address ? `Open listing search for ${l.address}` : 'Open listing search'}
                            >
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

          {/* ── Section 5: Short-Term Rental / Airbnb Analysis ── */}
          {state === "unlocked" && (
            <div className="revealed-card glass-panel rounded-[2rem] p-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Short-Term Rental / Airbnb</div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                  strCashFlowSignal === "green" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : strCashFlowSignal === "yellow" ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}>
                  {strCashFlowSignal === "green" ? "Strong STR" : strCashFlowSignal === "yellow" ? "Marginal STR" : "Weak STR"}
                </span>
              </div>

              {/* Inputs */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2 block">Nightly Rate</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
                    <input
                      type="text"
                      value={strNightlyRate}
                      onChange={e => setStrNightlyRate(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder={String(defaultNightlyRate)}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2 pl-7 pr-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors"
                    />
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">Default: ~2.5× LTR/night</div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2 block">Occupancy %</label>
                  <input
                    type="text"
                    value={strOccupancy}
                    onChange={e => setStrOccupancy(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                  <div className="text-[10px] text-zinc-600 mt-1">US avg: 55–75%</div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2 block">Avg Stay (nights)</label>
                  <input
                    type="text"
                    value={strAvgStay}
                    onChange={e => setStrAvgStay(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-indigo-500/40 transition-colors"
                  />
                  <div className="text-[10px] text-zinc-600 mt-1">Affects cleaning cost</div>
                </div>
              </div>

              {/* Revenue breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">STR Revenue</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Gross ({Math.round(strOccPct * 100)}% occ · ${effectiveNightlyRate}/night)</span>
                      <span className="text-emerald-400 font-medium">{fmt(strGrossMonthly)}/mo</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Platform fee (3%)</span>
                      <span className="text-zinc-400">− {fmt(strPlatformFee)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Cleaning ({strTurnovers} turns × $100)</span>
                      <span className="text-zinc-400">− {fmt(strCleaningCost)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-white/[0.05] pt-2">
                      <span className="text-zinc-300 font-medium">Net STR Income</span>
                      <span className="text-zinc-200 font-medium">{fmt(strNetIncome)}/mo</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">Ownership Expenses</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Mortgage</span>
                      <span className="text-zinc-400">− {fmt(breakdown?.mortgage ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Insurance</span>
                      <span className="text-zinc-400">− {fmt(breakdown?.insurance ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Property taxes</span>
                      <span className="text-zinc-400">− {fmt(breakdown?.taxes ?? 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-white/[0.05] pt-2">
                      <span className="text-zinc-300 font-medium">STR Cash Flow</span>
                      <span className={`font-serif font-bold text-lg ${strCashFlowSignal === "green" ? "text-emerald-400" : strCashFlowSignal === "yellow" ? "text-amber-400" : "text-red-400"}`}>
                        {strCashFlow >= 0 ? "+" : ""}{fmt(strCashFlow)}/mo
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* STR vs LTR comparison */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.04] p-5">
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-4">STR vs Long-Term Rental</div>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-1">LTR Cash Flow</div>
                    <div className={`text-base font-serif font-medium ${results.rentalSignal === "green" ? "text-emerald-400" : results.rentalSignal === "yellow" ? "text-amber-400" : "text-red-400"}`}>
                      {results.monthlyCashFlow >= 0 ? "+" : ""}{fmt(results.monthlyCashFlow)}/mo
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-1">STR Cash Flow</div>
                    <div className={`text-base font-serif font-medium ${strCashFlowSignal === "green" ? "text-emerald-400" : strCashFlowSignal === "yellow" ? "text-amber-400" : "text-red-400"}`}>
                      {strCashFlow >= 0 ? "+" : ""}{fmt(strCashFlow)}/mo
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-1">STR Advantage</div>
                    <div className={`text-base font-serif font-medium ${strVsLtr >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {strVsLtr >= 0 ? "+" : ""}{fmt(strVsLtr)}/mo
                    </div>
                  </div>
                </div>
                <p className="text-xs text-zinc-600">
                  {strVsLtr > 200
                    ? `STR outperforms long-term rental by ${fmt(strVsLtr * 12)}/yr at ${Math.round(strOccPct * 100)}% occupancy. Verify local STR permit requirements before committing.`
                    : strVsLtr > 0
                    ? `STR has a modest edge of ${fmt(strVsLtr)}/mo. May not justify the added management complexity — consider your market's STR regulations.`
                    : `Long-term rental outperforms STR at this occupancy rate. Try raising the nightly rate or occupancy % above to find the break-even.`}
                </p>
              </div>
            </div>
          )}

          {/* ── Section 6: BRRRR Refinance Analysis ── */}
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
                <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">
                  {cashLeftInDeal <= 0 ? "Cash Back" : "Cash Left in Deal"}
                </div>
                <div className={`text-xl font-bold ${brrrrSignal === "green" ? "text-emerald-400" : brrrrSignal === "yellow" ? "text-amber-400" : "text-red-400"}`}>
                  {cashLeftInDeal <= 0 ? `+${fmt(Math.abs(cashLeftInDeal))}` : fmt(cashLeftInDeal)}
                </div>
                <div className={`text-[10px] mt-1 ${brrrrSignal === "green" ? "text-emerald-600" : "text-zinc-600"}`}>
                  {cashLeftInDeal <= 0 ? "✓ All capital recycled" : `of ${fmt(allInCost)} all-in`}
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
                  {postRefiCoC === Infinity
                    ? (postRefiCashFlow >= 0 ? "∞ CoC — all capital out" : "→ CoC — all capital out")
                    : `${postRefiCoC}% CoC return`}
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
          {!hasComps && (analysis as any).fromDashboard && (
            <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-6 mb-6 flex items-center gap-3`}>
              <div className="text-xs uppercase tracking-widest text-zinc-600">Comparable Sales</div>
              <span className="text-xs text-zinc-700">— comp addresses not stored. Re-run the analysis from the home page to see the full comp table.</span>
            </div>
          )}
          {hasComps && (
            <div className={`${state === "unlocked" ? "revealed-card" : ""} glass-panel rounded-[2rem] p-8 mb-6`}>
              <div className="flex items-center justify-between mb-6">
                <div className="text-xs uppercase tracking-widest text-zinc-500">Comparable Properties Used for ARV</div>
                <span className="text-xs text-zinc-600">{compsUsed.length} comps</span>
              </div>
              {subjectLat && subjectLng && (
                <div className="mb-6">
                  <CompsMap
                    subjectLat={subjectLat}
                    subjectLng={subjectLng}
                    subjectAddress={address}
                    comps={compsUsed.map(c => ({
                      address: c.address,
                      price: c.price,
                      distanceMiles: c.distanceMiles,
                      latitude: c.latitude,
                      longitude: c.longitude,
                    }))}
                  />
                </div>
              )}
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
                            {comp.address ? (
                              <a
                                href={comp.url || (() => {
                                  // Build a Redfin address URL: /STATE/City-Slug/Street-Slug-ZIP/
                                  const parts = comp.address.split(',').map((s: string) => s.trim())
                                  const street = (parts[0] || '').replace(/\s+/g, '-')
                                  const city = (parts[1] || '').replace(/\s+/g, '-')
                                  const stateZip = (parts[2] || '').trim().split(/\s+/)
                                  const state = stateZip[0] || ''
                                  const zip = stateZip[1] || ''
                                  return `https://www.redfin.com/${state}/${city}/${street}-${zip}/`
                                })()}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="max-w-[180px] truncate block hover:text-indigo-400 transition-colors underline-offset-2 hover:underline"
                              >
                                {comp.address}
                              </a>
                            ) : (
                              <div className="max-w-[180px] truncate">N/A</div>
                            )}
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
                How the deal changes at each rehab scope — same purchase price of {fmt(price)}. Click any row to view that condition.
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
                    {alternatives.map((alt) => {
                      const isActive = altOverride ? alt.condition === altOverride.condition : alt.condition === condition;
                      return (
                        <tr
                          key={alt.condition}
                          onClick={() => setAltOverride(alt.condition === condition ? null : alt)}
                          className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                            isActive ? "bg-indigo-500/[0.08]" : "hover:bg-white/[0.02]"
                          }`}
                        >
                          <td className="py-2.5 pr-4 capitalize text-zinc-400">
                            {alt.condition}
                            {isActive && (
                              <span className="ml-2 text-[10px] text-indigo-400 border border-indigo-500/20 rounded-full px-1.5 py-0.5">
                                {alt.condition === condition ? "original" : "viewing"}
                              </span>
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
                      );
                    })}
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
                See cash flow, flip waterfall, comps, and your MAO — and save this deal to your account.
              </p>

              {/* Primary: Sign in to save */}
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="w-full py-4 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white font-medium text-sm transition-colors mb-3"
              >
                Sign in to unlock &amp; save deal
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-xs text-zinc-600">or</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* Secondary: Email-only */}
              <form onSubmit={handleUnlock} className="space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Continue with email only..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-full py-3.5 px-6 text-foreground placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06] font-medium text-sm transition-colors disabled:opacity-60"
                >
                  {submitting ? "Unlocking..." : "Unlock without account"}
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

                {/* Section toggles */}
                <div className="mb-3 space-y-1.5">
                  {([
                    { key: "flip",    label: "Flip Analysis" },
                    { key: "buyhold", label: "Buy & Hold" },
                    { key: "brrrr",   label: "BRRRR Analysis" },
                    { key: "mao",     label: "MAO / Key Numbers" },
                  ] as const).map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleSection(key)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-indigo-500/20 transition-all"
                    >
                      <span className="text-xs text-zinc-400">{label}</span>
                      <span className={`w-7 h-4 rounded-full transition-colors flex items-center px-0.5 ${dealSheetSections[key] ? "bg-indigo-500" : "bg-white/10"}`}>
                        <span className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${dealSheetSections[key] ? "translate-x-3" : "translate-x-0"}`} />
                      </span>
                    </button>
                  ))}
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
                    <div className="text-xs text-zinc-500">Flip · Rental · BRRRR · Comps · Scenarios</div>
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
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="px-5 py-3 rounded-full border border-white/[0.06] text-sm text-zinc-400 hover:text-foreground hover:border-white/[0.12] transition-all"
            >
              Edit Inputs
            </button>
            <button
              onClick={handleSaveDeal}
              disabled={savingDeal || dealSaved}
              className="px-5 py-3 rounded-full border border-white/[0.06] text-sm text-zinc-400 hover:text-foreground hover:border-white/[0.12] transition-all disabled:opacity-50"
            >
              {dealSaved ? "✓ Saved" : savingDeal ? "Saving..." : "Save Deal"}
            </button>
            <button
              onClick={handleShare}
              className="px-5 py-3 rounded-full border border-white/[0.06] text-sm text-zinc-400 hover:text-foreground hover:border-white/[0.12] transition-all"
            >
              {copied ? "Link Copied ✓" : "Share Link"}
            </button>
          </div>
        </div>
      )}

      {/* ── Neighborhood Snapshot ── */}
      {state === "unlocked" && neighborhoodData && (
        <div className="mt-8 glass-panel rounded-[2rem] p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs uppercase tracking-widest text-zinc-500">Neighborhood Snapshot</div>
            <span className="text-xs text-zinc-600">ZIP {neighborhoodData.zip}</span>
          </div>

          {neighborhoodData.hasData && neighborhoodData.count >= 3 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {[
                  { label: "Avg ARV in ZIP", value: neighborhoodData.avgArv ? `$${Math.round(neighborhoodData.avgArv / 1000)}K` : "—" },
                  { label: "Avg Flip Profit", value: neighborhoodData.avgFlip != null ? `${neighborhoodData.avgFlip >= 0 ? "+" : ""}$${Math.round(neighborhoodData.avgFlip / 1000)}K` : "—", positive: (neighborhoodData.avgFlip ?? 0) > 0 },
                  { label: "Avg Cash Flow", value: neighborhoodData.avgCashFlow != null ? `${neighborhoodData.avgCashFlow >= 0 ? "+" : ""}$${neighborhoodData.avgCashFlow}/mo` : "—", positive: (neighborhoodData.avgCashFlow ?? 0) > 0 },
                  { label: "Green Deal %", value: `${neighborhoodData.greenPct ?? 0}%`, positive: (neighborhoodData.greenPct ?? 0) >= 40 },
                ].map(s => (
                  <div key={s.label} className="glass-panel rounded-xl p-4 text-center border border-white/[0.04]">
                    <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">{s.label}</div>
                    <div className={`text-base font-serif font-medium ${s.positive === true ? "text-emerald-400" : s.positive === false ? "text-red-400" : "text-zinc-200"}`}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-600">
                Based on {neighborhoodData.count} deal{neighborhoodData.count !== 1 ? "s" : ""} analyzed in ZIP {neighborhoodData.zip} by ClearPath users. No individual addresses or owner data exposed.
                {results.arv > 0 && neighborhoodData.avgArv && Math.abs(results.arv - neighborhoodData.avgArv) > neighborhoodData.avgArv * 0.15 && (
                  <span className="text-amber-400 ml-2">
                    ⚠ This property&apos;s ARV ({fmt(results.arv)}) is {results.arv > neighborhoodData.avgArv ? "above" : "below"} the ZIP average — verify comps carefully.
                  </span>
                )}
              </p>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="text-zinc-500 text-sm mb-2">Not enough data yet for ZIP {neighborhoodData.zip}</div>
              <p className="text-xs text-zinc-600">As more deals are analyzed in this area, neighborhood trends will appear here.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Financing Calculator ── */}
      {state === "unlocked" && (
        <div className="mt-16 relative glass-panel rounded-[2rem] overflow-hidden mb-6">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500" />
          <div className="p-8 md:p-12">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Financing Calculator</div>
            <h3 className="text-xl font-serif text-foreground mb-6">How does financing affect this deal?</h3>

            <div className="flex flex-wrap gap-3 mb-8">
              {(['Hard Money', 'Conventional', 'DSCR Loan'] as const).map((loan) => (
                <button
                  key={loan}
                  onClick={() => { setSelectedLoan(loan); trackEvent('financing_interest', { loan_type: loan }); }}
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

            {selectedLoan === 'Hard Money' && (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Interest Rate %</label>
                    <input
                      type="text"
                      value={hmlRate}
                      onChange={e => setHmlRate(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-colors"
                    />
                    <div className="text-[10px] text-zinc-600 mt-1">Typical: 10–14%</div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Points</label>
                    <input
                      type="text"
                      value={hmlPoints}
                      onChange={e => setHmlPoints(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-colors"
                    />
                    <div className="text-[10px] text-zinc-600 mt-1">Typical: 1–3 points</div>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">LTV %</label>
                    <input
                      type="text"
                      value={hmlLTV}
                      onChange={e => setHmlLTV(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-colors"
                    />
                    <div className="text-[10px] text-zinc-600 mt-1">Typical: 70–90%</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  {/* HML column */}
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="text-xs uppercase tracking-widest text-amber-400">Hard Money</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        hmlFlipSignal === 'green' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        hmlFlipSignal === 'yellow' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                        'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>{hmlFlipSignal === 'green' ? 'Strong' : hmlFlipSignal === 'yellow' ? 'Marginal' : 'Weak'}</span>
                    </div>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-500">Loan amount</span><span className="text-zinc-200">{fmt(hmlLoan)} ({hmlLTV}%)</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Down required</span><span className="text-zinc-200">{fmt(hmlDownRequired)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Monthly payment</span><span className="text-zinc-200">{fmt(hmlMonthlyPayment)}/mo (I/O)</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Points fee</span><span className="text-zinc-200">{fmt(hmlPointsFee)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Total interest ({holdMonths}mo hold)</span><span className="text-zinc-200">{fmt(hmlTotalInterest)}</span></div>
                      <div className="flex justify-between border-t border-white/[0.05] pt-2.5"><span className="text-zinc-400">Cash needed at close</span><span className="text-zinc-200 font-medium">{fmt(hmlCashNeeded)}</span></div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 font-medium">Flip profit</span>
                        <span className={`font-serif font-bold text-lg ${hmlFlipSignal === 'green' ? 'text-emerald-400' : hmlFlipSignal === 'yellow' ? 'text-amber-400' : 'text-red-400'}`}>
                          {hmlFlipProfit >= 0 ? '+' : ''}{fmt(hmlFlipProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-zinc-500">ROI on cash</span><span className="text-zinc-300">{hmlFlipROI}%</span></div>
                    </div>
                  </div>

                  {/* Conventional column */}
                  <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="text-xs uppercase tracking-widest text-indigo-400">Conventional</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                        derivedFlipSignal === 'green' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                        derivedFlipSignal === 'yellow' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                        'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>{derivedFlipSignal === 'green' ? 'Strong' : derivedFlipSignal === 'yellow' ? 'Marginal' : 'Weak'}</span>
                    </div>
                    <div className="space-y-2.5 text-sm">
                      <div className="flex justify-between"><span className="text-zinc-500">Loan amount</span><span className="text-zinc-200">{fmt(price - (breakdown?.downPayment ?? Math.round(price * 0.25)))} ({100 - Math.round(((breakdown?.downPayment ?? Math.round(price * 0.25)) / price) * 100)}%)</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Down required</span><span className="text-zinc-200">{fmt(breakdown?.downPayment ?? Math.round(price * 0.25))}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Monthly payment</span><span className="text-zinc-200">{fmt(breakdown?.mortgage ?? 0)}/mo (P&amp;I)</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Points fee</span><span className="text-zinc-200">$0</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Holding costs ({holdMonths}mo hold)</span><span className="text-zinc-200">{fmt(breakdown?.holdingCosts ?? 0)}</span></div>
                      <div className="flex justify-between border-t border-white/[0.05] pt-2.5"><span className="text-zinc-400">Cash needed at close</span><span className="text-zinc-200 font-medium">{fmt(convCashNeeded)}</span></div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400 font-medium">Flip profit</span>
                        <span className={`font-serif font-bold text-lg ${derivedFlipSignal === 'green' ? 'text-emerald-400' : derivedFlipSignal === 'yellow' ? 'text-amber-400' : 'text-red-400'}`}>
                          {derivedFlipProfit >= 0 ? '+' : ''}{fmt(derivedFlipProfit)}
                        </span>
                      </div>
                      <div className="flex justify-between"><span className="text-zinc-500">ROI on cash</span><span className="text-zinc-300">{convFlipROI}%</span></div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 text-xs text-zinc-500">
                  <span className="text-zinc-400 font-medium">HML vs Conventional: </span>
                  {hmlFlipProfit > derivedFlipProfit
                    ? `Hard money produces ${fmt(hmlFlipProfit - derivedFlipProfit)} more profit — you tie up ${fmt(convCashNeeded - hmlCashNeeded)} less cash at close, freeing capital for the next deal.`
                    : `Conventional financing saves ${fmt(derivedFlipProfit - hmlFlipProfit)} in profit vs hard money. HML makes sense if capital is constrained or you need to close fast.`}
                </div>
              </div>
            )}

            {selectedLoan === 'Conventional' && (
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-6">
                <div className="text-xs uppercase tracking-widest text-indigo-400 mb-4">Conventional Financing</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 text-sm">
                  <div><div className="text-[10px] text-zinc-600 mb-1">Loan Amount</div><div className="text-zinc-200 font-medium font-serif">{fmt(price - (breakdown?.downPayment ?? Math.round(price * 0.25)))}</div></div>
                  <div><div className="text-[10px] text-zinc-600 mb-1">Down Payment</div><div className="text-zinc-200 font-medium font-serif">{fmt(breakdown?.downPayment ?? Math.round(price * 0.25))}</div></div>
                  <div><div className="text-[10px] text-zinc-600 mb-1">Monthly P&amp;I</div><div className="text-zinc-200 font-medium font-serif">{fmt(breakdown?.mortgage ?? 0)}/mo</div></div>
                  <div><div className="text-[10px] text-zinc-600 mb-1">Holding Costs</div><div className="text-zinc-200 font-medium font-serif">{fmt(breakdown?.holdingCosts ?? 0)}</div></div>
                  <div><div className="text-[10px] text-zinc-600 mb-1">Cash Needed</div><div className="text-zinc-200 font-medium font-serif">{fmt(convCashNeeded)}</div></div>
                  <div><div className="text-[10px] text-zinc-600 mb-1">Flip Profit</div>
                    <div className={`font-serif font-bold text-lg ${derivedFlipSignal === 'green' ? 'text-emerald-400' : derivedFlipSignal === 'yellow' ? 'text-amber-400' : 'text-red-400'}`}>
                      {derivedFlipProfit >= 0 ? '+' : ''}{fmt(derivedFlipProfit)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedLoan === 'DSCR Loan' && (
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-6">
                <div className="text-xs uppercase tracking-widest text-violet-400 mb-2">DSCR Loan — Rental Analysis</div>
                <p className="text-xs text-zinc-500 mb-5">DSCR loans qualify on property income, not personal income. Full refi analysis is in the BRRRR section above.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5 text-sm">
                  <div><div className="text-[10px] text-zinc-600 mb-1">Monthly Rent</div><div className="text-zinc-200 font-medium font-serif">{fmt(results.rentEstimate)}/mo</div></div>
                  <div><div className="text-[10px] text-zinc-600 mb-1">Monthly Expenses</div><div className="text-zinc-200 font-medium font-serif">{fmt(monthlyExpenses)}/mo</div></div>
                  <div><div className="text-[10px] text-zinc-600 mb-1">Annual NOI</div><div className="text-zinc-200 font-medium font-serif">{fmt(annualNOI)}</div></div>
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-1">DSCR</div>
                    <div className={`font-serif font-bold text-lg ${dscr >= 1.25 ? 'text-emerald-400' : dscr >= 1.0 ? 'text-amber-400' : 'text-red-400'}`}>{dscr.toFixed(2)}x</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-1">Lender Readiness</div>
                    <div className={`text-xs font-medium ${dscr >= 1.25 ? 'text-emerald-400' : dscr >= 1.0 ? 'text-amber-400' : 'text-red-400'}`}>
                      {dscr >= 1.25 ? 'Strong — qualifies easily' : dscr >= 1.0 ? 'Marginal — some lenders' : 'Below threshold'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-1">Cash Flow</div>
                    <div className={`font-serif font-bold text-lg ${results.rentalSignal === 'green' ? 'text-emerald-400' : results.rentalSignal === 'yellow' ? 'text-amber-400' : 'text-red-400'}`}>
                      {results.monthlyCashFlow >= 0 ? '+' : ''}{fmt(results.monthlyCashFlow)}/mo
                    </div>
                  </div>
                </div>
              </div>
            )}
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
