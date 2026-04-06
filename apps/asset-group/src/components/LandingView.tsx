"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { UserX, TrendingUp, Clock, MessageSquareOff, Hammer, Key, BarChart3 } from "lucide-react";

export default function LandingView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Hero stagger
      gsap.fromTo(".hero-el", { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.2, ease: "power3.out" });

      // Section reveals
      gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 40 }, {
          opacity: 1, y: 0, duration: 1, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
        });
      });

      // Process steps
      gsap.utils.toArray<HTMLElement>(".process-step").forEach((el, i) => {
        gsap.fromTo(el, { opacity: 0, x: -30 }, {
          opacity: 1, x: 0, duration: 0.8, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" },
          delay: i * 0.1,
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef}>
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] bg-indigo-950/25 rounded-full blur-[200px]" />
          <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-[#050505] to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto text-center">
          <h1 className="hero-el mb-2">
            <span className="block text-5xl md:text-7xl lg:text-8xl font-sans font-extralight tracking-tight text-zinc-500">
              We execute
            </span>
          </h1>
          <h1 className="hero-el">
            <span className="block text-6xl md:text-8xl lg:text-[9rem] font-serif font-bold text-foreground leading-[0.95]">
              Cook County<br className="hidden lg:block" /> real estate.
            </span>
          </h1>

          <p className="hero-el text-lg md:text-xl text-zinc-500 font-light max-w-2xl mx-auto mt-10 mb-12 leading-relaxed">
            From acquisition to cash flow — without you managing contractors or tenants.
          </p>

          <div className="hero-el">
            <a href="#contact" className="inline-block px-10 py-5 rounded-full bg-foreground text-background font-medium text-sm hover:bg-zinc-200 transition-colors">
              Book a Strategy Call
            </a>
          </div>

          <div className="hero-el mt-8">
            <span className="text-xs text-zinc-600 animate-float inline-block">↓ See How It Works</span>
          </div>
        </div>
      </section>

      {/* ─── PROBLEM SECTION ─── */}
      <section className="reveal py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-light text-zinc-300 text-center mb-16">
            The traditional model is <span className="font-serif italic text-foreground">broken.</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: UserX, title: "Bad Contractors", desc: "Unlicensed crews cutting corners. No accountability. No recourse when things go wrong." },
              { icon: TrendingUp, title: "Budget Overruns", desc: "Projects ballooning 40-60% over estimates. Hidden costs that surface after you're already committed." },
              { icon: Clock, title: "Missed Deadlines", desc: "Three-month rehabs stretching to eight. Every delayed month is money bleeding from your deal." },
              { icon: MessageSquareOff, title: "Zero Communication", desc: "Weeks without updates. Decisions made without your input. Your capital in someone else's hands." },
            ].map((item, i) => (
              <div key={i} className="glass-panel rounded-[2rem] p-8">
                <item.icon className="w-10 h-10 text-red-400/70 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SERVICES GRID ─── */}
      <section className="reveal py-28 px-6">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <h2 className="text-xs uppercase tracking-widest text-indigo-400 mb-4">What We Handle</h2>
          <h3 className="text-3xl md:text-5xl font-serif text-foreground">End-to-end execution.</h3>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Hammer, title: "Rehab Management", desc: "From permits to punch list. We vet contractors, manage the build, and deliver weekly photo updates. No surprises." },
            { icon: Key, title: "Lease-Up", desc: "Aggressive marketing, strict screening in compliance with Cook County and IL Fair Housing. We fill units fast." },
            { icon: BarChart3, title: "Stabilization", desc: "We hand you a performing, cash-flowing asset with executed lease, tenant profile, and full completion package." },
          ].map((item, i) => (
            <div key={i} className="glass-panel rounded-[2rem] p-10 text-center hover:border-indigo-500/20 transition-colors duration-300">
              <item.icon className="w-12 h-12 mx-auto mb-6 text-indigo-400" />
              <h4 className="text-xl font-serif text-foreground mb-3">{item.title}</h4>
              <p className="text-sm text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PROCESS TIMELINE ─── */}
      <section id="system" className="reveal py-28 px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto text-center mb-16">
          <h2 className="text-xs uppercase tracking-widest text-indigo-400 mb-4">Our System</h2>
          <h3 className="text-3xl md:text-5xl font-serif text-foreground">We built a system to handle everything.</h3>
        </div>

        <div className="max-w-3xl mx-auto space-y-0">
          {[
            { step: "01", title: "Analyze Deal", desc: "We run precise numbers using our proprietary Analyzer tool to ensure the deal works before you close." },
            { step: "02", title: "Plan Rehab", desc: "Detailed scopes of work, tight permitting, and strict contractor vetting to guarantee execution." },
            { step: "03", title: "Execute", desc: "Our boots on the ground manage the entire construction phase with weekly photographic updates." },
            { step: "04", title: "Lease", desc: "We market the property and execute rigorous tenant screening in compliance with IL Fair Housing." },
            { step: "05", title: "Stabilize", desc: "We hand over a performing, cash-flowing asset with a full completion package and tenant profile." },
          ].map((item, i) => (
            <div key={i} className="process-step flex gap-8 items-start py-8 border-b border-white/[0.04] last:border-0">
              <div className="text-6xl font-serif text-indigo-500/20 leading-none min-w-[4rem]">{item.step}</div>
              <div>
                <h4 className="text-xl font-medium text-foreground mb-2">{item.title}</h4>
                <p className="text-zinc-400 font-light leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TRUST / AUTHORITY ─── */}
      <section className="reveal py-28 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
          {[
            { value: "100%", label: "Projects Delivered On Budget" },
            { value: "14 Days", label: "Average Lease-Up Time" },
            { value: "Cook County", label: "Exclusive Service Area" },
          ].map((stat, i) => (
            <div key={i}>
              <div className="text-5xl font-serif text-foreground mb-2">{stat.value}</div>
              <div className="text-sm text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
        <p className="text-zinc-600 text-center text-sm mt-10 max-w-md mx-auto">
          We only take on projects where the numbers make sense.
        </p>
      </section>

      {/* ─── ANALYZER CROSS-LINK ─── */}
      <section className="reveal py-24 px-6 border-y border-white/[0.04] bg-black/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-serif text-foreground mb-4">Not sure if your deal works?</h2>
          <p className="text-zinc-400 text-sm mb-8 max-w-lg mx-auto">
            Run it through our precision analyzer to get ARV, rehab estimates, and cash flow projections.
          </p>
          <a
            href="https://clearpathanalyzer.com"
            target="_blank"
            rel="noreferrer"
            className="inline-block px-8 py-4 rounded-full border border-white/[0.08] text-sm text-zinc-300 hover:text-foreground hover:border-white/[0.16] transition-all"
          >
            Use ClearPath Analyzer →
          </a>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section id="contact" className="py-36 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-6xl font-serif text-foreground mb-2">
            Bring the capital.
          </h2>
          <h2 className="text-4xl md:text-6xl font-serif text-zinc-500 italic mb-12">
            We handle the execution.
          </h2>
          <a
            href="https://calendly.com/placeholder"
            target="_blank"
            rel="noreferrer"
            className="inline-block px-14 py-6 rounded-full bg-foreground text-background text-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            Book a Strategy Call
          </a>
          <p className="text-sm text-zinc-600 mt-6">
            Or email us at hello@clearpathassetgroup.com
          </p>
        </div>
      </section>
    </div>
  );
}
