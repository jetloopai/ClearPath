import React from "react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background py-16">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <div className="font-serif text-2xl font-semibold tracking-wide text-foreground mb-4">
            ClearPath<span className="text-brand-400">.</span> Asset Group
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-signal-green animate-pulse" />
            <span className="text-xs text-zinc-500 font-medium tracking-wide uppercase">System Operational</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-8 text-sm text-zinc-500">
          <Link href="#system" className="hover:text-zinc-300 transition-colors">Our System</Link>
          <Link href="#process" className="hover:text-zinc-300 transition-colors">Process</Link>
          <Link href="https://clearpathanalyzer.com" className="hover:text-zinc-300 transition-colors">ClearPath Analyzer</Link>
        </div>
      </div>
    </footer>
  );
}
