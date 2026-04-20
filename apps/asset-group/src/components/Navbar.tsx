"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-700 ease-in-out border-b ${
        scrolled
          ? "bg-black/60 backdrop-blur-xl border-white/[0.05] py-4"
          : "bg-black/20 backdrop-blur-sm border-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="ClearPath Asset Group" width={160} height={44} className="h-10 w-auto" priority/>
        </Link>
        <div className="flex items-center gap-8">
          <Link href="#system" className="text-sm text-zinc-400 hover:text-white transition-colors hidden md:block">
            Our System
          </Link>
          <a
            href="#contact"
            className="px-5 py-2 rounded-full bg-foreground text-background text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Book a Call
          </a>
        </div>
      </div>
    </header>
  );
}
