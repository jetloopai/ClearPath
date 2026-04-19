import React from "react";
import Link from "next/link";
import { NewsletterSignup } from "./NewsletterSignup";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background py-8">
      <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-signal-green animate-pulse" />
          <span className="text-xs text-zinc-500 font-medium tracking-wide uppercase">Analyzer Operational</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <Link href="/disclaimer" className="hover:text-zinc-300 transition-colors">Disclaimer</Link>
          <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms of Use</Link>
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
        </div>
        <NewsletterSignup />
      </div>
    </footer>
  );
}
