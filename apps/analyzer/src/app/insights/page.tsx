import React from 'react';
import { supabaseAdmin } from '@/lib/supabase-server';
import InsightsClient, { type ZipRow } from './InsightsClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ClearPath Insights | Market Intelligence',
  description: 'Real-time market data aggregated from recent ClearPath analyses — by neighborhood.',
};

export default async function InsightsPage() {
  const { data: analyses } = await supabaseAdmin
    .from('analyses')
    .select('inputs, arv, flip_profit, monthly_cash_flow, deal_signal')
    .order('created_at', { ascending: false })
    .limit(10000);

  type Agg = {
    zip: string; city: string; state: string; county: string;
    count: number; arvSum: number; profitSum: number; cashFlowSum: number;
    greenCount: number; yellowCount: number; redCount: number;
  };

  const agg: Record<string, Agg> = {};

  for (const row of analyses ?? []) {
    const prop = row.inputs?.property;
    const zip   = prop?.zip?.trim();
    const city  = prop?.city?.trim();
    const state = prop?.state?.trim()?.toUpperCase();

    // Filter: must have a valid ZIP and a 2-letter US state code
    if (!zip || zip === '' || zip === 'Unknown') continue;
    if (!state || state.length !== 2) continue;

    const key = `${zip}-${state}`;
    if (!agg[key]) {
      agg[key] = {
        zip, city: city || 'Unknown', state,
        county: prop?.county || '',
        count: 0, arvSum: 0, profitSum: 0, cashFlowSum: 0,
        greenCount: 0, yellowCount: 0, redCount: 0,
      };
    }
    agg[key].count++;
    agg[key].arvSum      += row.arv            || 0;
    agg[key].profitSum   += row.flip_profit    || 0;
    agg[key].cashFlowSum += row.monthly_cash_flow || 0;
    if (row.deal_signal === 'green')      agg[key].greenCount++;
    else if (row.deal_signal === 'red')   agg[key].redCount++;
    else                                  agg[key].yellowCount++;
  }

  const rows: ZipRow[] = Object.values(agg).map(s => ({
    zip:            s.zip,
    city:           s.city,
    state:          s.state,
    county:         s.county,
    count:          s.count,
    avg_arv:        Math.round(s.arvSum      / s.count),
    avg_profit:     Math.round(s.profitSum   / s.count),
    avg_cash_flow:  Math.round(s.cashFlowSum / s.count),
    greenCount:     s.greenCount,
    yellowCount:    s.yellowCount,
    redCount:       s.redCount,
  }));

  const states = Array.from(new Set(rows.map(r => r.state))).sort();

  return (
    <InsightsClient
      rows={rows}
      states={states}
      totalRaw={(analyses ?? []).length}
    />
  );
}
