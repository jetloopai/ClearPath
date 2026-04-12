"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ConfigModal } from "@/components/ConfigModal";
import { PlacesAutocomplete } from "@/components/maps/PlacesAutocomplete";
import { Search } from "lucide-react";

export default function AnalyzePage() {
  const [address, setAddress] = useState("");
  const [county, setCounty] = useState("");
  const [showModal, setShowModal] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addr = params.get("address");
    if (addr) {
      setAddress(addr);
      setShowModal(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setShowModal(true);
  };

  const handleAddressSelect = (selectedAddress: string, selectedCounty: string) => {
    setAddress(selectedAddress);
    setCounty(selectedCounty);
  };

  return (
    <>
      <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-950/15 rounded-full blur-[180px]" />
        </div>

        <div className="relative z-10 w-full max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-light text-zinc-200 mb-3 tracking-tight">
            Analyze a Deal
          </h1>
          <p className="text-sm text-zinc-500 mb-10">
            Enter any US property address to get ARV, rehab, rent, and profit — instantly.
          </p>

          {/* AI photo callout */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] mb-6">
            <span className="text-indigo-400 text-sm">✦</span>
            <span className="text-xs text-zinc-500">Upload property photos for AI-powered condition assessment</span>
          </div>

          {/* Address input */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto mb-16">
            <div className="relative flex items-center rounded-full bg-white/[0.04] border border-white/[0.08] focus-within:border-indigo-500/40 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-300">
              <Search className="absolute left-6 w-5 h-5 text-zinc-600" />
              <PlacesAutocomplete
                onSelect={handleAddressSelect}
                placeholder="Enter property address..."
                className="w-full bg-transparent pl-14 pr-6 sm:pr-40 py-4 sm:py-5 text-base sm:text-lg text-foreground placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                type="submit"
                className="hidden sm:block absolute right-3 px-6 py-2.5 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors rounded-full hover:bg-white/[0.04]"
              >
                Analyze Deal →
              </button>
            </div>
            <button
              type="submit"
              className="sm:hidden w-full py-4 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-sm font-medium text-indigo-300 hover:bg-indigo-500/30 transition-colors"
            >
              Analyze Deal →
            </button>
          </form>

          {/* How It Works */}
          <div className="w-full max-w-2xl mx-auto">
            <div className="text-xs uppercase tracking-widest text-zinc-600 text-center mb-6">How it works</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              {[
                { step: "01", title: "Enter Address", desc: "Type any US property address to get started." },
                { step: "02", title: "Review Numbers", desc: "Get ARV, rehab, rent, and profit estimates." },
                { step: "03", title: "Make Offers", desc: "Use your MAO to negotiate with confidence." },
              ].map((item) => (
                <div key={item.step} className="glass-panel rounded-[2rem] p-6">
                  <div className="text-3xl font-serif text-indigo-500/30 mb-3">{item.step}</div>
                  <h3 className="text-sm font-medium text-foreground mb-1">{item.title}</h3>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600 text-center mt-6">Data powered by millions of local comps.</p>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showModal && (
          <ConfigModal
            address={address}
            county={county}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
