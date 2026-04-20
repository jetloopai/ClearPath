"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase-browser";
import { AuthModal } from "./AuthModal";
import { UpgradeModal } from "./UpgradeModal";

interface Credits {
  plan: string;
  credits_remaining: number;
  credits_monthly: number;
}

export function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchCredits = useCallback(async (token: string) => {
    try {
      const res = await fetch('/api/user/credits', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCredits(await res.json());
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.access_token) fetchCredits(session.access_token);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.access_token) fetchCredits(session.access_token);
      else setCredits(null);
    });

    return () => subscription.unsubscribe();
  }, [fetchCredits]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  async function handleManageBilling() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  function CreditsChip() {
    if (!credits) return null;
    const isFree = credits.plan === 'free';
    const isLow = credits.credits_remaining <= 3;
    const label = isFree
      ? `${credits.credits_remaining} free report${credits.credits_remaining !== 1 ? 's' : ''} left`
      : `${credits.credits_remaining} / ${credits.credits_monthly} reports`;

    return (
      <button
        onClick={() => isFree || isLow ? setShowUpgrade(true) : handleManageBilling()}
        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
          isFree || isLow
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
            : 'border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:bg-white/[0.06]'
        }`}
      >
        {label}
      </button>
    );
  }

  const navLinks = (
    <>
      <Link href="/insights" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Insights</Link>
      <Link href="/arbitrage" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Arbitrage</Link>
      <Link href="/pricing" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Pricing</Link>
      <Link href="/analyze" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">Analyze Deal</Link>
      {user ? (
        <>
          <CreditsChip />
          <Link href="/dashboard" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">My Deals</Link>
          <button onClick={() => { handleSignOut(); setMenuOpen(false); }} className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">Sign Out</button>
        </>
      ) : (
        <button onClick={() => { setShowAuth(true); setMenuOpen(false); }} className="text-sm font-medium px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-300 hover:bg-white/[0.1] transition-colors">
          Sign In
        </button>
      )}
    </>
  );

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity" style={{mixBlendMode: 'screen'}}>
            <Image src="/logo.png" alt="ClearPath Analyzer" width={140} height={40} className="h-9 w-auto" style={{filter: 'hue-rotate(-30deg) contrast(2.2) saturate(0.9)'}} priority/>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-6 items-center">
            {navLinks}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/[0.05] bg-black/80 backdrop-blur-xl px-6 py-4 flex flex-col gap-4">
            {navLinks}
          </div>
        )}
      </header>
      {showAuth && createPortal(<AuthModal onClose={() => setShowAuth(false)} />, document.body)}
      {showUpgrade && createPortal(<UpgradeModal currentPlan={credits?.plan ?? 'free'} onClose={() => setShowUpgrade(false)} />, document.body)}
    </>
  );
}
