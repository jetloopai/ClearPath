"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-browser";
import { AuthModal } from "./AuthModal";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-700 ease-in-out border-b ${
        scrolled
          ? "bg-black/40 backdrop-blur-xl border-white/[0.05] py-4"
          : "bg-transparent border-transparent py-6"
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className={`font-serif text-xl tracking-wide transition-colors duration-700 ${scrolled ? "text-foreground" : "text-zinc-600"}`}>
          ClearPath<span className="text-indigo-400">.</span>
        </Link>
        <div className={`flex gap-6 items-center transition-all duration-500 ${scrolled ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <Link href="/insights" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Insights
          </Link>
          <Link href="/" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Analyze Deal
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors">
                My Deals
              </Link>
              <button onClick={handleSignOut} className="text-sm font-medium text-zinc-500 hover:text-white transition-colors">
                Sign Out
              </button>
            </>
          ) : (
            <button onClick={() => setShowAuth(true)} className="text-sm font-medium px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-zinc-300 hover:bg-white/[0.1] transition-colors">
              Sign In
            </button>
          )}
        </div>
      </div>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </header>
  );
}
