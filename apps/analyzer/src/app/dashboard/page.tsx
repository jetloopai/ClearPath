"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import Link from "next/link";
import { ChevronDown, ChevronUp, Link2, FileText, StickyNote, RefreshCw } from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number) => {
  if (!v) return "$0";
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const SIGNAL_DOT: Record<string, string> = {
  green:  "bg-emerald-400",
  yellow: "bg-amber-400",
  red:    "bg-red-400",
};
const SIGNAL_LABEL: Record<string, string> = {
  green: "Strong", yellow: "Marginal", red: "Weak",
};
const SIGNAL_PILL: Record<string, string> = {
  green:  "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  yellow: "bg-amber-500/10  text-amber-400  border-amber-500/20",
  red:    "bg-red-500/10    text-red-400    border-red-500/20",
};
const PROFIT_COLOR = (p: number) =>
  p >= 30000 ? "text-emerald-400" : p >= 10000 ? "text-amber-400" : "text-red-400";

const CONDITIONS = ["cosmetic", "light", "medium", "heavy", "gut"] as const;

// ── Filter pill ───────────────────────────────────────────────────────────────

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active
          ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
          : "bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:border-white/[0.14] hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

// ── Scenario row inside a grouped card ───────────────────────────────────────

function ScenarioRow({
  deal, onView, onDelete, deleting,
}: { deal: any; onView: () => void; onDelete: () => void; deleting: boolean }) {
  const profit   = deal.flip_profit ?? 0;
  const cashFlow = deal.monthly_cash_flow ?? 0;
  const signal   = deal.deal_signal ?? "yellow";

  return (
    <div className="flex items-center gap-4 py-3 border-t border-white/[0.05] first:border-t-0 group/row">
      {/* Condition + signal */}
      <div className="w-28 shrink-0 flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SIGNAL_DOT[signal] ?? "bg-zinc-400"}`} />
        <span className="text-xs capitalize text-zinc-400">{deal.input_condition}</span>
      </div>

      {/* Stats */}
      <div className="flex-1 grid grid-cols-3 gap-3 min-w-0">
        <div>
          <div className="text-[10px] text-zinc-600 mb-0.5">ARV</div>
          <div className="text-sm font-serif text-zinc-300">{fmt(deal.arv)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-600 mb-0.5">Flip</div>
          <div className={`text-sm font-serif font-medium ${PROFIT_COLOR(profit)}`}>
            {profit >= 0 ? "+" : ""}{fmt(profit)}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-600 mb-0.5">Cash Flow</div>
          <div className="text-sm font-serif text-zinc-300">
            {cashFlow >= 0 ? "+" : ""}{fmt(cashFlow)}<span className="text-[10px]">/mo</span>
          </div>
        </div>
      </div>

      {/* Time + actions */}
      <div className="shrink-0 flex items-center gap-2">
        <span className="text-[10px] text-zinc-600">{timeAgo(deal.created_at)}</span>
        <button
          onClick={onView}
          className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-400 hover:text-white hover:border-white/[0.18] transition-all opacity-0 group-hover/row:opacity-100"
        >
          View →
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="w-6 h-6 rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover/row:opacity-100 flex items-center justify-center text-sm"
          title="Remove"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Grouped address card ──────────────────────────────────────────────────────

function AddressCard({
  address, scenarios, onView, onDelete, deleting,
}: {
  address: string;
  scenarios: any[];
  onView: (deal: any) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  const [expanded, setExpanded]     = useState(true);
  const [showNotes, setShowNotes]   = useState(false);
  const [note, setNote]             = useState<string>(scenarios[0]?.notes ?? "");
  const [savingNote, setSavingNote] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const noteRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const best      = scenarios[0];
  const signals   = scenarios.map(d => d.deal_signal ?? "yellow");
  const hasGreen  = signals.includes("green");
  const hasRed    = signals.includes("red");
  const topSignal = hasGreen ? "green" : hasRed ? "red" : "yellow";

  const handleNoteChange = (val: string) => {
    setNote(val);
    if (noteRef.current) clearTimeout(noteRef.current);
    noteRef.current = setTimeout(async () => {
      setSavingNote(true);
      await supabase.from("analyses").update({ notes: val }).eq("id", best.id);
      setSavingNote(false);
    }, 800);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/r/${best.id}`;
    navigator.clipboard.writeText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handlePDF = () => {
    window.open(`/r/${best.id}`, "_blank");
  };

  const handleReanalyze = () => {
    sessionStorage.setItem("clearpath_reanalyze", JSON.stringify({
      address: best.input_address,
      price: String(best.input_purchase_price),
      condition: best.input_condition,
    }));
    window.location.href = "/analyze";
  };

  return (
    <div className="glass-panel rounded-3xl border border-white/[0.05] overflow-hidden">
      {/* Address header */}
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${SIGNAL_DOT[topSignal]}`} />
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${SIGNAL_PILL[topSignal]}`}>
                {SIGNAL_LABEL[topSignal]}
              </span>
              {scenarios.length > 1 && (
                <span className="text-[10px] text-zinc-600">{scenarios.length} scenarios</span>
              )}
            </div>
            <div className="text-sm font-medium text-zinc-200 leading-snug line-clamp-2">
              {address}
            </div>
          </div>
          {scenarios.length > 1 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="shrink-0 mt-1 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* If only 1 scenario, show stats inline */}
        {scenarios.length === 1 && (
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/[0.05]">
            {[
              { label: "ARV",       value: fmt(best.arv),           color: "" },
              { label: "Flip",      value: `${(best.flip_profit ?? 0) >= 0 ? "+" : ""}${fmt(best.flip_profit ?? 0)}`, color: PROFIT_COLOR(best.flip_profit ?? 0) },
              { label: "Cash Flow", value: `${(best.monthly_cash_flow ?? 0) >= 0 ? "+" : ""}${fmt(best.monthly_cash_flow ?? 0)}/mo`, color: "" },
            ].map(s => (
              <div key={s.label}>
                <div className="text-[10px] text-zinc-600 mb-1">{s.label}</div>
                <div className={`text-sm font-serif ${s.color || "text-zinc-300"}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scenarios list (multi or single) */}
      {(expanded || scenarios.length === 1) && (
        <div className={`px-6 ${scenarios.length === 1 ? "pb-2" : "pb-4"}`}>
          {scenarios.length > 1 && (
            <div className="space-y-0">
              {scenarios.map(deal => (
                <ScenarioRow
                  key={deal.id}
                  deal={deal}
                  onView={() => onView(deal)}
                  onDelete={() => onDelete(deal.id)}
                  deleting={deleting === deal.id}
                />
              ))}
            </div>
          )}
          {scenarios.length === 1 && (
            <div className="flex items-center justify-between pb-3">
              <span className="text-[10px] text-zinc-600">
                <span className="capitalize">{best.input_condition}</span> · {timeAgo(best.created_at)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onView(best)}
                  className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-400 hover:text-white hover:border-white/[0.18] transition-all"
                >
                  View →
                </button>
                <button
                  onClick={() => onDelete(best.id)}
                  disabled={deleting === best.id}
                  className="w-6 h-6 rounded-full text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center text-sm"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Card action bar ── */}
      <div className="px-4 sm:px-6 pb-4 flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-3">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] text-zinc-500 hover:text-zinc-300 border border-white/[0.05] hover:border-white/[0.12] transition-all"
        >
          <Link2 className="w-3 h-3" />
          {linkCopied ? "Copied!" : "Share"}
        </button>
        <button
          onClick={handlePDF}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] text-zinc-500 hover:text-zinc-300 border border-white/[0.05] hover:border-white/[0.12] transition-all"
        >
          <FileText className="w-3 h-3" />
          View Report
        </button>
        <button
          onClick={handleReanalyze}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] text-zinc-500 hover:text-zinc-300 border border-white/[0.05] hover:border-white/[0.12] transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          Re-analyze
        </button>
        <button
          onClick={() => setShowNotes(n => !n)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] border transition-all ml-auto ${
            showNotes || note
              ? "text-indigo-400 border-indigo-500/30 bg-indigo-500/10"
              : "text-zinc-500 hover:text-zinc-300 border-white/[0.05] hover:border-white/[0.12]"
          }`}
        >
          <StickyNote className="w-3 h-3" />
          {note ? "Note ✓" : "Add Note"}
        </button>
      </div>

      {/* ── Notes field ── */}
      {showNotes && (
        <div className="px-6 pb-5">
          <textarea
            value={note}
            onChange={e => handleNoteChange(e.target.value)}
            placeholder="Seller motivated, call back Tuesday… price came down to $140K…"
            rows={3}
            className="w-full bg-white/[0.02] border border-white/[0.07] rounded-2xl px-4 py-3 text-xs text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/30 resize-none transition-colors"
          />
          <div className="text-[10px] text-zinc-700 mt-1">
            {savingNote ? "Saving…" : note ? "Saved" : "Auto-saves as you type"}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type SortKey = "newest" | "best_flip" | "best_cashflow" | "arv_high";
type TimeFilter = "all" | "7d" | "30d";

export default function DashboardPage() {
  const router = useRouter();
  const [deals, setDeals]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Filters
  const [signals, setSignals]       = useState<string[]>([]);
  const [strategies, setStrategies] = useState<string[]>([]);
  const [conditions, setConditions] = useState<string[]>([]);
  const [time, setTime]             = useState<TimeFilter>("all");
  const [sort, setSort]             = useState<SortKey>("newest");
  const [search, setSearch]         = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/"); return; }
      supabase
        .from("analyses")
        .select("*, notes")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setDeals(data);
          setLoading(false);
        });
    });
  }, [router]);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this deal?")) return;
    setDeleting(id);
    await supabase.from("analyses").update({ user_id: null }).eq("id", id);
    setDeals(prev => prev.filter(d => d.id !== id));
    setDeleting(null);
  };

  const handleView = (deal: any) => {
    const p       = deal.input_purchase_price;
    const arv     = deal.arv ?? deal.results?.arv ?? p;
    const downPct = deal.input_down_pct ?? 0.25;
    const hold    = deal.input_hold_months ?? 6;
    const sqft    = deal.inputs?.provenance?.subjectData?.effectiveSqft ?? deal.inputs?.property?.sqft ?? null;

    const rent = deal.results?.rentEstimate ?? 0;
    const reconstructedBreakdown = {
      purchasePrice:   p,
      rehabMidpoint:   deal.rehab_estimate ?? 0,
      holdingCosts:    Math.round(p * 0.01 * hold),
      sellingCosts:    Math.round(arv * 0.08),
      mortgage:        deal.monthly_mortgage ?? 0,
      vacancy:         Math.round(rent * 0.08),
      mgmt:            Math.round(rent * 0.10),
      maintenance:     Math.round(rent * 0.06),
      capex:           Math.round(rent * 0.05),
      insurance:       deal.inputs?.insuranceOverride ?? 100,
      taxes:           Math.round((arv * 0.015) / 12),
      downPayment:     Math.round(p * downPct),
      closingCostsBuy: Math.round(p * 0.02),
    };

    // Reconstruct alternatives table using same multipliers as the API
    const arvMultipliers: Record<string, number> = { cosmetic: 1.20, light: 1.30, medium: 1.45, heavy: 1.60, gut: 1.80 };
    const rehabMidRates:  Record<string, number> = { cosmetic: 15, light: 27.5, medium: 45, heavy: 70, gut: 117.5 };
    const conditions = ['cosmetic', 'light', 'medium', 'heavy', 'gut'] as const;
    const alternatives = sqft ? conditions.map(cond => {
      const cArv   = Math.round(p * arvMultipliers[cond]);
      const cRehab = Math.round(sqft * rehabMidRates[cond]);
      const cFlip  = Math.round(cArv - p - cRehab - cArv * 0.08 - p * 0.01 * hold);
      const cCashFlow = deal.results?.monthlyCashFlow ?? 0;
      return {
        condition:      cond,
        arv:            cArv,
        rehabMidpoint:  cRehab,
        flipProfit:     cFlip,
        monthlyCashFlow: cCashFlow,
        flipSignal:     cFlip >= 30000 ? 'green' : cFlip < 10000 ? 'red' : 'yellow',
        rentalSignal:   (cCashFlow >= 300 ? 'green' : cCashFlow < 0 ? 'red' : 'yellow') as 'green' | 'yellow' | 'red',
      };
    }) : [];

    const compsUsed = deal.comps_used ?? [];
    sessionStorage.setItem("clearpath_analysis", JSON.stringify({
      address:      deal.input_address,
      price:        p,
      condition:    deal.input_condition,
      analysisId:   deal.id,
      results:      deal.results,
      breakdown:    reconstructedBreakdown,
      compsUsed,
      alternatives,
      arvMethod:    deal.arv_method ?? "rough_estimate",
      arvConfidence: deal.inputs?.provenance?.arvConfidence ?? "low",
      arvRange:     deal.inputs?.provenance?.arvRange ?? null,
      arvExplainer: deal.inputs?.provenance?.arvExplainer,
      compsCount:   compsUsed.length,
      rentSource:   deal.inputs?.provenance?.rentSource,
      rentExplainer: deal.inputs?.provenance?.rentExplainer,
      dataWarnings: deal.inputs?.provenance?.dataWarnings ?? [],
      subjectData:  deal.inputs?.provenance?.subjectData,
      fromDashboard: true,
    }));
    router.push("/results");
  };

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const cutoff = time === "7d"
      ? Date.now() - 7  * 86_400_000
      : time === "30d"
      ? Date.now() - 30 * 86_400_000
      : 0;

    return deals.filter(d => {
      if (cutoff && new Date(d.created_at).getTime() < cutoff) return false;
      if (search && !d.input_address.toLowerCase().includes(search.toLowerCase())) return false;
      if (signals.length && !signals.includes(d.deal_signal)) return false;
      if (conditions.length && !conditions.includes(d.input_condition)) return false;
      if (strategies.length) {
        const isFlip   = strategies.includes("flip")   && (d.flip_profit ?? 0) >= 10000;
        const isRental = strategies.includes("rental")  && (d.monthly_cash_flow ?? 0) >= 300;
        const isBoth   = strategies.includes("both")
          && (d.flip_profit ?? 0) >= 10000
          && (d.monthly_cash_flow ?? 0) >= 300;
        if (!isFlip && !isRental && !isBoth) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sort === "newest")       return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "best_flip")    return (b.flip_profit ?? 0) - (a.flip_profit ?? 0);
      if (sort === "best_cashflow") return (b.monthly_cash_flow ?? 0) - (a.monthly_cash_flow ?? 0);
      if (sort === "arv_high")     return (b.arv ?? 0) - (a.arv ?? 0);
      return 0;
    });
  }, [deals, signals, strategies, conditions, time, sort, search]);

  // ── Group by address ───────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const d of filtered) {
      const key = d.input_address;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries()).map(([address, scenarios]) => ({ address, scenarios }));
  }, [filtered]);

  // ── Summary stats (across all deals, unfiltered) ───────────────────────────
  const bestFlip   = deals.length ? Math.max(...deals.map(d => d.flip_profit ?? 0)) : 0;
  const avgCashFlow = deals.length
    ? Math.round(deals.reduce((s, d) => s + (d.monthly_cash_flow ?? 0), 0) / deals.length)
    : 0;
  const totalCapital = deals.reduce((s, d) => {
    const p = d.input_purchase_price ?? 0;
    const downPct = d.input_down_pct ?? 0.25;
    const rehab = d.rehab_estimate ?? 0;
    return s + Math.round(p * downPct) + rehab;
  }, 0);
  const bestZip = (() => {
    const zipScores: Record<string, number> = {};
    for (const d of deals) {
      const m = d.input_address?.match(/\b(\d{5})\b/);
      if (!m) continue;
      const zip = m[1];
      zipScores[zip] = (zipScores[zip] ?? 0) + (d.deal_signal === "green" ? 2 : d.deal_signal === "yellow" ? 1 : 0);
    }
    const best = Object.entries(zipScores).sort((a, b) => b[1] - a[1])[0];
    return best?.[1] > 0 ? best[0] : null;
  })();

  const toggle = <T extends string>(
    list: T[], setList: (v: T[]) => void, val: T
  ) => setList(list.includes(val) ? list.filter(x => x !== val) : [...list, val]);

  const activeFilterCount =
    signals.length + strategies.length + conditions.length +
    (time !== "all" ? 1 : 0);

  return (
    <div className="min-h-screen bg-background pt-28 pb-24 text-foreground">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-light text-zinc-200 tracking-tight">My Saved Deals</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {loading
                ? "Loading..."
                : `${grouped.length} propert${grouped.length !== 1 ? "ies" : "y"} · ${filtered.length} scenario${filtered.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Link href="/analyze" className="shrink-0 px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-400 text-sm font-medium hover:bg-indigo-500/20 transition-colors">
            + New Analysis
          </Link>
        </div>

        {!loading && deals.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                { label: "Properties",        value: `${new Set(deals.map(d => d.input_address)).size}` },
                { label: "Best Flip",         value: fmt(bestFlip) },
                { label: "Avg Cash Flow",     value: `${avgCashFlow >= 0 ? "+" : ""}${fmt(avgCashFlow)}/mo` },
                { label: "Capital Deployed",  value: totalCapital > 0 ? fmt(totalCapital) : "—" },
                { label: "Best ZIP",          value: bestZip ?? "—" },
              ].map(s => (
                <div key={s.label} className="glass-panel rounded-2xl px-5 py-4">
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">{s.label}</div>
                  <div className="text-xl font-serif text-zinc-200">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by address..."
              className="w-full mb-5 bg-white/[0.03] border border-white/[0.08] rounded-2xl py-2.5 px-4 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/30 transition-colors"
            />

            {/* Filter panel */}
            <div className="glass-panel rounded-2xl border border-white/[0.05] px-5 py-4 mb-6 space-y-3">
              {/* Signal */}
              <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2 sm:gap-3">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 w-full sm:w-16 shrink-0">Signal</span>
                <div className="flex flex-wrap gap-2">
                  {(["green", "yellow", "red"] as const).map(s => (
                    <Pill key={s} active={signals.includes(s)} onClick={() => toggle(signals, setSignals, s)}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${SIGNAL_DOT[s]}`} />
                      {SIGNAL_LABEL[s]}
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Strategy */}
              <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2 sm:gap-3">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 w-full sm:w-16 shrink-0">Strategy</span>
                <div className="flex flex-wrap gap-2">
                  {(["flip", "rental", "both"] as const).map(s => (
                    <Pill key={s} active={strategies.includes(s)} onClick={() => toggle(strategies, setStrategies, s)}>
                      {s === "flip" ? "Flip" : s === "rental" ? "Rental" : "Both"}
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Condition */}
              <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2 sm:gap-3">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 w-full sm:w-16 shrink-0">Condition</span>
                <div className="flex flex-wrap gap-2">
                  {CONDITIONS.map(c => (
                    <Pill key={c} active={conditions.includes(c)} onClick={() => toggle(conditions, setConditions, c)}>
                      <span className="capitalize">{c}</span>
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Time */}
              <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2 sm:gap-3">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 w-full sm:w-16 shrink-0">Time</span>
                <div className="flex flex-wrap gap-2">
                  {(["7d", "30d", "all"] as const).map(t => (
                    <Pill key={t} active={time === t} onClick={() => setTime(t)}>
                      {t === "7d" ? "7 days" : t === "30d" ? "30 days" : "All time"}
                    </Pill>
                  ))}
                </div>
              </div>

              {/* Divider before sort */}
              <div className="border-t border-white/[0.05] pt-3 flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-2 sm:gap-3">
                <span className="text-[10px] uppercase tracking-widest text-zinc-600 w-20 shrink-0">Sort by</span>
                <div className="flex flex-wrap gap-2 flex-1">
                  {([
                    ["newest",        "Newest"],
                    ["best_flip",     "Best Flip"],
                    ["best_cashflow", "Best Cash Flow"],
                    ["arv_high",      "ARV ↓"],
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <Pill key={key} active={sort === key} onClick={() => setSort(key)}>{label}</Pill>
                  ))}
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setSignals([]); setStrategies([]); setConditions([]); setTime("all"); }}
                    className="ml-auto shrink-0 px-3 py-1.5 rounded-full text-xs text-zinc-500 hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/5 transition-all"
                  >
                    Clear {activeFilterCount}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64 text-zinc-500">Loading...</div>
        ) : deals.length === 0 ? (
          <div className="glass-panel text-center rounded-[2rem] p-12 py-24 border border-white/[0.05]">
            <div className="text-4xl mb-4 opacity-40">📂</div>
            <h3 className="text-xl font-medium text-zinc-300 mb-2">No saved deals yet</h3>
            <p className="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">
              Sign in before running an analysis, or click "Save Deal" on your results page.
            </p>
            <Link href="/" className="px-6 py-3 rounded-full bg-indigo-500/10 text-indigo-400 font-medium hover:bg-indigo-500/20 transition-colors">
              Analyze a Deal
            </Link>
          </div>
        ) : grouped.length === 0 ? (
          <div className="text-center py-24 text-zinc-500 text-sm">
            No deals match these filters.{" "}
            <button
              onClick={() => { setSignals([]); setStrategies([]); setConditions([]); setTime("all"); setSearch(""); }}
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              Clear all
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {grouped.map(({ address, scenarios }) => (
              <AddressCard
                key={address}
                address={address}
                scenarios={scenarios}
                onView={handleView}
                onDelete={handleDelete}
                deleting={deleting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
