"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";

const fmt = (v: number) => {
  if (!v) return "$0";
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

const fmtCash = (v: number) => {
  const sign = v >= 0 ? "+" : "";
  return `${sign}$${Math.abs(v).toLocaleString()}/mo`;
};

export interface ZipRow {
  zip: string;
  city: string;
  state: string;
  county: string;
  count: number;
  avg_arv: number;
  avg_profit: number;
  avg_cash_flow: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
}

interface Props {
  rows: ZipRow[];
  states: string[];
  totalRaw: number;
}

type SortKey = "count" | "avg_arv" | "avg_profit" | "avg_cash_flow" | "deal_quality";

export default function InsightsClient({ rows, states, totalRaw }: Props) {
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortKey>("count");

  const filtered = useMemo(() => {
    let r = selectedState === "ALL" ? rows : rows.filter(r => r.state === selectedState);
    return r
      .map(r => ({ ...r, deal_quality: r.greenCount / r.count }))
      .sort((a, b) => {
        if (sortBy === "deal_quality") return b.deal_quality - a.deal_quality;
        return (b[sortBy] as number) - (a[sortBy] as number);
      });
  }, [rows, selectedState, sortBy]);

  // Top 5 cities by analysis count in current filter
  const topCities = useMemo(() => {
    const cityAgg: Record<string, { city: string; state: string; count: number; arvSum: number; profitSum: number; green: number }> = {};
    for (const r of filtered) {
      if (!r.city || r.city === "Unknown") continue;
      const key = `${r.city}-${r.state}`;
      if (!cityAgg[key]) cityAgg[key] = { city: r.city, state: r.state, count: 0, arvSum: 0, profitSum: 0, green: 0 };
      cityAgg[key].count += r.count;
      cityAgg[key].arvSum += r.avg_arv * r.count;
      cityAgg[key].profitSum += r.avg_profit * r.count;
      cityAgg[key].green += r.greenCount;
    }
    return Object.values(cityAgg)
      .map(c => ({ ...c, avg_arv: Math.round(c.arvSum / c.count), avg_profit: Math.round(c.profitSum / c.count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered]);

  const totalFiltered = filtered.reduce((s, r) => s + r.count, 0);
  const avgARV = filtered.length ? Math.round(filtered.reduce((s, r) => s + r.avg_arv * r.count, 0) / Math.max(totalFiltered, 1)) : 0;
  const avgProfit = filtered.length ? Math.round(filtered.reduce((s, r) => s + r.avg_profit * r.count, 0) / Math.max(totalFiltered, 1)) : 0;
  const greenPct = filtered.length ? Math.round((filtered.reduce((s, r) => s + r.greenCount, 0) / Math.max(totalFiltered, 1)) * 100) : 0;

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "count", label: "Most Active" },
    { key: "avg_profit", label: "Best Flip" },
    { key: "avg_cash_flow", label: "Best Cash Flow" },
    { key: "avg_arv", label: "Highest ARV" },
    { key: "deal_quality", label: "Deal Quality" },
  ];

  return (
    <div className="min-h-screen bg-background pt-32 pb-24 text-foreground">
      <div className="max-w-5xl mx-auto px-6">

        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-xs uppercase tracking-widest text-indigo-400 mb-3 font-semibold">Market Insights</h2>
          <h1 className="text-4xl md:text-5xl font-light text-zinc-200 mb-4 tracking-tight">Where Investors Are Looking</h1>
          <p className="text-zinc-500 text-sm max-w-lg mx-auto">
            Aggregated by ZIP code — no individual deals or addresses exposed.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: "Analyses Run", value: totalFiltered.toLocaleString() },
            { label: "Avg ARV", value: fmt(avgARV) },
            { label: "Avg Flip Profit", value: fmt(avgProfit) },
            { label: "Green Deals", value: `${greenPct}%` },
          ].map(({ label, value }) => (
            <div key={label} className="glass-panel rounded-2xl p-5 text-center border border-white/[0.05]">
              <div className="text-xl md:text-2xl font-serif text-zinc-200">{value}</div>
              <div className="text-xs text-zinc-600 uppercase tracking-widest mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Top 5 Cities */}
        {topCities.length > 0 && (
          <div className="mb-10">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Top Cities</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {topCities.map((city, i) => {
                const profitColor = city.avg_profit >= 30000 ? "text-emerald-400" : city.avg_profit >= 10000 ? "text-amber-400" : "text-red-400";
                return (
                  <div key={`${city.city}-${i}`} className="glass-panel rounded-2xl p-4 border border-white/[0.05] relative overflow-hidden">
                    <div className="absolute top-3 right-3 text-[10px] text-zinc-700 font-medium">#{i + 1}</div>
                    <div className="text-sm font-medium text-zinc-200 pr-5 leading-tight">{city.city}</div>
                    <div className="text-[10px] text-zinc-600 mt-0.5">{city.state}</div>
                    <div className="mt-3 space-y-1">
                      <div className="text-xs text-zinc-400">{fmt(city.avg_arv)} ARV</div>
                      <div className={`text-xs font-medium ${profitColor}`}>
                        {city.avg_profit >= 0 ? "+" : ""}{fmt(city.avg_profit)} flip
                      </div>
                      <div className="text-[10px] text-zinc-600">{city.count} {city.count === 1 ? "analysis" : "analyses"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 mb-6">
          {/* State filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-600 uppercase tracking-widest">State</span>
            {["ALL", ...states].map(s => (
              <button
                key={s}
                onClick={() => setSelectedState(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  selectedState === s
                    ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                }`}
              >
                {s === "ALL" ? "All States" : s}
              </button>
            ))}
          </div>

          <div className="sm:ml-auto flex items-center gap-2 flex-wrap sm:justify-end">
            <span className="text-xs text-zinc-600 uppercase tracking-widest">Sort</span>
            {sortOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  sortBy === opt.key
                    ? "bg-white/[0.06] border-white/[0.12] text-zinc-200"
                    : "bg-white/[0.02] border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center border border-white/[0.05]">
            <p className="text-zinc-400">No data for this filter yet.</p>
          </div>
        ) : (
          <div className="-mx-6 md:mx-0 md:rounded-3xl overflow-hidden border-y md:border border-white/[0.05] bg-[#0d0d0d]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-white/[0.05]">
                  <tr>
                    <th className="sticky left-0 z-10 bg-[#0d0d0d] py-3 px-4 font-medium text-[10px] text-zinc-500 uppercase tracking-wider min-w-[160px] border-r border-white/[0.06]"># &nbsp;Neighborhood / ZIP</th>
                    <th className="bg-[#0d0d0d] py-3 px-3 font-medium text-[10px] text-zinc-500 uppercase tracking-wider text-center whitespace-nowrap">Activity</th>
                    <th className="bg-[#0d0d0d] py-3 px-3 font-medium text-[10px] text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Avg ARV</th>
                    <th className="bg-[#0d0d0d] py-3 px-3 font-medium text-[10px] text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Avg Flip</th>
                    <th className="bg-[#0d0d0d] py-3 px-3 font-medium text-[10px] text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Cash Flow</th>
                    <th className="bg-[#0d0d0d] py-3 px-3 font-medium text-[10px] text-zinc-500 uppercase tracking-wider text-center whitespace-nowrap">Quality</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {filtered.slice(0, 100).map((item, i) => {
                    const profitColor = item.avg_profit >= 30000 ? "text-emerald-400" : item.avg_profit >= 10000 ? "text-amber-400" : "text-red-400";
                    const cfColor = item.avg_cash_flow >= 300 ? "text-emerald-400" : item.avg_cash_flow >= 0 ? "text-amber-400" : "text-red-400";
                    const greenPct = Math.round((item.greenCount / item.count) * 100);
                    const redPct = Math.round((item.redCount / item.count) * 100);

                    return (
                      <tr key={`${item.zip}-${i}`} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="sticky left-0 z-10 bg-[#0d0d0d] group-hover:bg-[#111111] transition-colors py-3 px-4 min-w-[160px] border-r border-white/[0.06]">
                          <div className="flex items-center gap-2">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/[0.05] text-[9px] font-medium text-zinc-600 flex items-center justify-center">
                              {i + 1}
                            </span>
                            <div>
                              <div className="text-zinc-200 font-medium leading-tight text-xs">
                                {item.city !== "Unknown" ? item.city : `ZIP ${item.zip}`}
                              </div>
                              <div className="text-[9px] text-zinc-600 mt-0.5">
                                {item.zip} · {item.state}{item.county ? ` · ${item.county}` : ""}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
                            {item.count}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right text-zinc-400 text-xs whitespace-nowrap">{fmt(item.avg_arv)}</td>
                        <td className={`py-3 px-3 text-right font-medium text-xs whitespace-nowrap ${profitColor}`}>
                          {item.avg_profit >= 0 ? "+" : ""}{fmt(item.avg_profit)}
                        </td>
                        <td className={`py-3 px-3 text-right text-xs font-medium whitespace-nowrap ${cfColor}`}>
                          {fmtCash(item.avg_cash_flow)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 justify-center">
                            <div className="w-14 h-1.5 rounded-full overflow-hidden bg-white/[0.05] flex">
                              <div className="bg-emerald-500/70 h-full" style={{ width: `${greenPct}%` }} />
                              <div className="bg-amber-500/70 h-full" style={{ width: `${100 - greenPct - redPct}%` }} />
                              <div className="bg-red-500/70 h-full" style={{ width: `${redPct}%` }} />
                            </div>
                            <span className="text-[9px] text-zinc-600 w-6 text-right">{greenPct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-white/[0.05] flex items-center gap-4 flex-wrap">
              <span className="text-[10px] text-zinc-700 uppercase tracking-widest">Deal Quality</span>
              {[
                { color: "bg-emerald-500/70", label: "Green deals" },
                { color: "bg-amber-500/70", label: "Yellow" },
                { color: "bg-red-500/70", label: "Red deals" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-1.5 rounded-full ${color}`} />
                  <span className="text-[10px] text-zinc-600">{label}</span>
                </div>
              ))}
              <span className="ml-auto text-[10px] text-zinc-700">No individual addresses shown</span>
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Analyze Your Own Deal →
          </Link>
        </div>
      </div>
    </div>
  );
}
