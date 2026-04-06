"use client";

import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ConfigModal } from "@/components/ConfigModal";
import { PlacesAutocomplete } from "@/components/maps/PlacesAutocomplete";
import { Search } from "lucide-react";

export default function Home() {
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
        {/* Background orb */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-indigo-950/20 rounded-full blur-[180px]" />
          <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-[#050505] to-transparent" />
        </div>

        <div className="relative z-10 w-full max-w-4xl mx-auto text-center">
          {/* Massive headline */}
          <h1 className="mb-8">
            <span className="block text-5xl md:text-7xl lg:text-8xl font-sans font-extralight tracking-tight text-zinc-500">
              Analyze the
            </span>
            <span className="block text-6xl md:text-8xl lg:text-[10rem] font-serif font-bold italic text-foreground leading-none mt-2">
              Deal.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-500 font-light max-w-xl mx-auto mb-12">
            ARV, rehab, rent, and profit — instantly.
          </p>

          {/* Hero Input */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
            <div className="relative flex items-center rounded-full bg-white/[0.04] border border-white/[0.08] focus-within:border-indigo-500/40 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all duration-300">
              <Search className="absolute left-6 w-5 h-5 text-zinc-600" />
              <PlacesAutocomplete
                onSelect={handleAddressSelect}
                placeholder="Enter property address..."
                className="w-full bg-transparent pl-14 pr-40 py-5 text-lg text-foreground placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                type="submit"
                className="absolute right-3 px-6 py-2.5 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors rounded-full hover:bg-white/[0.04]"
              >
                Analyze Deal →
              </button>
            </div>
          </form>
        </div>

        {/* How It Works — below the fold */}
        <div className="relative z-10 w-full max-w-3xl mx-auto mt-32 mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { step: "01", title: "Enter Address", desc: "Paste a Zillow link or type any US address." },
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
      </main>

      {/* Config Modal */}
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

