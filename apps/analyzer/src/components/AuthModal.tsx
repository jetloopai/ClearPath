"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import gsap from "gsap";
import { supabase } from "@/lib/supabase-browser";

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (cardRef.current) gsap.from(cardRef.current, { y: 30, opacity: 0, duration: 0.5, ease: "expo.out" });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (signUpError) throw signUpError;
        // If Supabase auto-confirms (email confirmation disabled in dashboard), sign in immediately
        if (data.session) {
          onClose();
          router.refresh();
        } else {
          setSuccessMsg("Check your email for a confirmation link, then come back and sign in.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onClose();
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
        <div ref={cardRef} className="relative z-10 w-full max-w-sm rounded-[2rem] p-10 text-center bg-zinc-900 border border-white/[0.1] shadow-2xl">
          <button onClick={onClose} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-serif text-foreground mb-2">{isSignUp ? "Create an Account" : "Welcome Back"}</h2>
          <p className="text-sm text-zinc-400 mb-8">{isSignUp ? "Save deals and access market insights." : "Sign in to view your saved deals."}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className="w-full bg-zinc-800 border border-white/[0.12] rounded-2xl py-3 px-5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/60" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-zinc-800 border border-white/[0.12] rounded-2xl py-3 px-5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/60" />
            
            {error && <div className="text-red-400 text-xs text-left">{error}</div>}
            {successMsg && <div className="text-emerald-400 text-xs text-left">{successMsg}</div>}

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-full bg-foreground text-background font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-60 mt-4">
              {loading ? "Processing..." : (isSignUp ? "Sign Up" : "Sign In")}
            </button>
          </form>

          <p className="text-xs text-zinc-500 mt-6">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(""); setSuccessMsg(""); }} className="ml-1 text-indigo-400 hover:text-indigo-300">
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
