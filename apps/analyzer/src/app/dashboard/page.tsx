"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";

const fmt = (v: number) => {
  if (!v) return "$0";
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toLocaleString()}`;
};

export default function DashboardPage() {
  const router = useRouter();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/");
        return;
      }
      
      const fetchDeals = async () => {
        const { data, error } = await supabase
          .from("analyses")
          .select("*")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: false });
          
        if (!error && data) setDeals(data);
        setLoading(false);
      };
      
      fetchDeals();
    });
  }, [router]);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-32 pb-24 text-foreground selection:bg-indigo-500/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-light text-zinc-200 tracking-tight">My Saved Deals</h1>
            <p className="text-zinc-500 text-sm mt-2">Manage and review your saved property analyses.</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64 text-zinc-500">Loading...</div>
          ) : deals.length === 0 ? (
            <div className="glass-panel text-center rounded-[2rem] p-12 py-24 border border-white/[0.05]">
              <div className="text-4xl mb-4 opacity-50">📂</div>
              <h3 className="text-xl font-medium text-zinc-300 mb-2">No saved deals yet</h3>
              <p className="text-zinc-500 text-sm mb-6 max-w-sm mx-auto">
                Any deals you save when analyzing properties will appear here.
              </p>
              <Link href="/" className="px-6 py-3 rounded-full bg-indigo-500/10 text-indigo-400 font-medium hover:bg-indigo-500/20 transition-colors">
                Analyze a Deal
              </Link>
            </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {deals.map(deal => {
                 const profit = deal.flip_profit;
                 const profitSignal = profit >= 30000 ? "text-emerald-400" : profit >= 10000 ? "text-amber-400" : "text-red-400";
                 const cashFlow = deal.monthly_cash_flow;
                 
                 return (
                   <Link key={deal.id} href={`/?address=${encodeURIComponent(deal.input_address)}`} className="group block h-full">
                     <div className="glass-panel h-full rounded-3xl p-6 border border-white/[0.05] hover:border-white/[0.1] transition-all hover:-translate-y-1 relative overflow-hidden">
                       <div className="text-sm font-medium text-zinc-300 truncate mb-1 pr-12">{deal.input_address}</div>
                       <div className="text-xs text-zinc-500 capitalize mb-6">{deal.input_condition} Condition</div>
                       
                       <div className="grid grid-cols-3 gap-4 border-t border-white/[0.05] pt-6 mt-auto">
                         <div>
                           <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">ARV</div>
                           <div className="font-serif text-sm text-zinc-300">{fmt(deal.arv)}</div>
                         </div>
                         <div>
                           <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Flip Margin</div>
                           <div className={`font-serif text-sm font-medium ${profitSignal}`}>{profit >= 0 ? '+' : ''}{fmt(profit)}</div>
                         </div>
                         <div>
                           <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Cash Flow</div>
                           <div className="font-serif text-sm text-zinc-300">{fmt(cashFlow)}<span className="text-[10px]">/mo</span></div>
                         </div>
                       </div>
                       
                       <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center text-zinc-400">
                           →
                         </div>
                       </div>
                     </div>
                   </Link>
                 );
               })}
             </div>
          )}
        </div>
      </div>
    </>
  );
}
