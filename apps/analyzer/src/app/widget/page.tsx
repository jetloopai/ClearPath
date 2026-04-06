import React from 'react';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';

export const metadata = {
  title: 'ClearPath Analyzer | Embed Widget',
  description: 'Add the ClearPath Deal Analyzer to your own website with our lightweight embed snippet.',
};

export default function WidgetPage() {
  const codeSnippet = `<script src="https://clearpathanalyzer.com/widget.js" data-address="YOUR ADDRESS HERE"></script>`;

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background pt-32 pb-24 text-foreground selection:bg-indigo-500/30">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-xs uppercase tracking-widest text-indigo-400 mb-3 font-semibold">Integrations</h2>
            <h1 className="text-4xl md:text-5xl font-light text-zinc-200 mb-4 tracking-tight">Embeddable Widget</h1>
            <p className="text-zinc-500 text-sm max-w-lg mx-auto">
              Allow your visitors, blog readers, or wholesale buyers to analyze your deals instantly by dropping our free floating button on your website.
            </p>
          </div>

          <div className="glass-panel rounded-[2rem] p-8 md:p-12 mb-8">
            <h3 className="text-xl font-serif text-zinc-200 mb-4">How it works</h3>
            <ol className="list-decimal pl-5 space-y-3 text-zinc-400 text-sm mb-8">
              <li>Place the script tag below anywhere in your website's HTML (Squarespace, WordPress, Webflow, etc.).</li>
              <li>Replace <code className="text-indigo-400">YOUR ADDRESS HERE</code> with the actual property address you are featuring.</li>
              <li>A beautiful "Analyze This Deal" floating button will appear on the bottom-right of your page.</li>
              <li>When clicked, the user is redirected to ClearPath Analyzer with the address pre-filled, so they can instantly see ARV and profit margins.</li>
            </ol>

            <h3 className="text-lg font-serif text-zinc-200 mb-3">Your Embed Code</h3>
            <div className="relative">
              <pre className="bg-black/50 border border-white/[0.05] rounded-xl p-5 overflow-x-auto text-xs text-indigo-300 font-mono">
                {codeSnippet}
              </pre>
            </div>
            
            <p className="mt-4 text-[11px] text-zinc-600 uppercase tracking-widest">
              No dependencies • Vanilla JS • Lightning Fast
            </p>
          </div>
          
          <div className="text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/[0.05] text-sm font-medium hover:bg-white/[0.05] transition-colors"
            >
              Back to Analyzer
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
