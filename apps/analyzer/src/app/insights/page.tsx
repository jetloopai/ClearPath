import React from 'react';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-server';

export const revalidate = 60; // optionally cache for 60 seconds

export const metadata = {
  title: 'ClearPath Insights | Market Intelligence',
  description: 'Real-time data from ClearPath analyses showing where investors are looking.',
};

const fmt = (v: number) => {
  if (!v) return '$0';
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

export default async function InsightsPage() {
  // Execute aggregation query via RPC or direct PostgREST if views exist.
  // We can also fetch the raw data and aggregate in memory for simple scaling,
  // but Supabase JS doesn't natively do GROUP BY easily without RPC.
  // Instead, we will fetch standard analyses and aggregate them here. 
  // For a robust system, an RPC function \`get_top_markets\` is needed, 
  // but we can aggregate the last 1000 rows in edge safely.

  const { data: analyses } = await supabaseAdmin
    .from('analyses')
    .select('input_address, arv, flip_profit')
    .order('created_at', { ascending: false })
    .limit(1000);

  let leaderboard: any[] = [];
  
  if (analyses) {
    const agg: Record<string, { count: number; arvSum: number; profitSum: number }> = {};
    for (const row of analyses) {
      if (!row.input_address) continue;
      // Truncate to zip code or street to prevent tiny mismatches
      const key = row.input_address.trim();
      if (!agg[key]) agg[key] = { count: 0, arvSum: 0, profitSum: 0 };
      agg[key].count++;
      agg[key].arvSum += row.arv || 0;
      agg[key].profitSum += row.flip_profit || 0;
    }
    
    leaderboard = Object.entries(agg)
      .map(([address, stats]) => ({
        address,
        analysis_count: stats.count,
        avg_arv: stats.arvSum / stats.count,
        avg_profit: stats.profitSum / stats.count,
      }))
      .sort((a, b) => b.analysis_count - a.analysis_count)
      .slice(0, 20);
  }

  return (
    <div className="min-h-screen bg-background pt-32 pb-24 text-foreground selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-xs uppercase tracking-widest text-indigo-400 mb-3 font-semibold">Market Insights</h2>
          <h1 className="text-4xl md:text-5xl font-light text-zinc-200 mb-4 tracking-tight">Where Investors Are Looking</h1>
          <p className="text-zinc-500 text-sm max-w-lg mx-auto">
            Real-time data aggregated from recent ClearPath analyses.
          </p>
        </div>

        {leaderboard.length === 0 ? (
          <div className="glass-panel rounded-3xl p-12 text-center border border-white/[0.05]">
            <p className="text-zinc-400">Not enough data yet — check back soon.</p>
          </div>
        ) : (
          <div className="glass-panel rounded-3xl overflow-hidden border border-white/[0.05]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/[0.02] border-b border-white/[0.05]">
                  <tr>
                    <th className="py-4 px-6 font-medium text-xs text-zinc-500 uppercase tracking-wider">Rank</th>
                    <th className="py-4 px-6 font-medium text-xs text-zinc-500 uppercase tracking-wider">Area / Address</th>
                    <th className="py-4 px-6 font-medium text-xs text-zinc-500 uppercase tracking-wider text-right">Activity</th>
                    <th className="py-4 px-6 font-medium text-xs text-zinc-500 uppercase tracking-wider text-right">Avg ARV</th>
                    <th className="py-4 px-6 font-medium text-xs text-zinc-500 uppercase tracking-wider text-right">Avg Flip Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {leaderboard.map((item, i) => {
                    const profitSignal = item.avg_profit >= 30000 ? 'text-emerald-400' : item.avg_profit >= 10000 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 px-6 text-zinc-500 w-16">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/[0.05] text-[10px] font-medium">
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-zinc-300 font-medium truncate max-w-[200px]">{item.address}</td>
                        <td className="py-4 px-6 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {item.analysis_count} checks
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right text-zinc-400 font-serif">{fmt(item.avg_arv)}</td>
                        <td className={`py-4 px-6 text-right font-medium ${profitSignal} font-serif`}>
                          {item.avg_profit >= 0 ? '+' : ''}{fmt(item.avg_profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
