"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";

interface OfferSignFormProps {
  offerId: string;
  initialSignerName?: string;
}

export function OfferSignForm({ offerId, initialSignerName }: OfferSignFormProps) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState(initialSignerName ?? "");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = hasSignature && signerName.trim().length > 0 && agreed && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const signatureDataUrl = await padRef.current?.getDataUrl();
    if (!signatureDataUrl) {
      setError("Please draw or type your signature first.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/offers/${offerId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureDataUrl, signerName: signerName.trim(), agreed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to submit signature");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Your Signature</label>
        <SignaturePad ref={padRef} onChange={setHasSignature} />
      </div>

      <div>
        <label className="text-xs uppercase tracking-widest text-zinc-500 mb-2 block">Your Full Name</label>
        <input
          type="text"
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Type your full name"
          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-3 px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/40 transition-colors"
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 w-4 h-4 shrink-0 accent-indigo-500"
        />
        <span className="text-sm text-zinc-400">
          I am the Owner of Record (or authorized to act on their behalf) and I agree to the terms of this offer as stated above.
        </span>
      </label>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full py-4 rounded-full bg-foreground text-background font-medium text-sm hover:bg-zinc-200 transition-colors disabled:opacity-40"
      >
        {submitting ? "Submitting…" : "Sign & Accept Offer"}
      </button>
    </form>
  );
}
