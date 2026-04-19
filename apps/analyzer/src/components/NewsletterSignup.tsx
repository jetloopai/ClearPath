'use client'

import { useState } from 'react'

export function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error()
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return <p className="text-xs text-emerald-400">You're on the list.</p>
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-center">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Investor updates"
        required
        className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 w-44"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="px-3 py-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-medium hover:bg-indigo-600/50 transition-colors disabled:opacity-50"
      >
        {status === 'loading' ? '…' : 'Subscribe'}
      </button>
      {status === 'error' && <span className="text-red-400 text-xs">Try again</span>}
    </form>
  )
}
