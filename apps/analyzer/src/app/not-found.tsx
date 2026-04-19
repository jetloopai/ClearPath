'use client'

import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex flex-col items-center justify-center flex-1 px-6 py-32 text-center">
      <p className="text-xs uppercase tracking-widest text-indigo-400 mb-4">404</p>
      <h1 className="text-4xl md:text-5xl font-serif text-zinc-100 mb-4">Page not found</h1>
      <p className="text-zinc-400 text-sm mb-10 max-w-sm">
        This page doesn&apos;t exist or was moved. Head back to run a deal analysis.
      </p>
      <Link
        href="/"
        className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
      >
        Back to Analyzer
      </Link>
    </main>
  )
}
