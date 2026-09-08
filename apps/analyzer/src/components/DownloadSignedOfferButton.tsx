"use client";

import React, { useState } from "react";

interface DownloadSignedOfferButtonProps {
  reportPayload: Record<string, unknown>;
  addressSlug: string;
}

export function DownloadSignedOfferButton({ reportPayload, addressSlug }: DownloadSignedOfferButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reportPayload, reportType: "offer_letter", mode: "print" }),
      });
      if (!res.ok) throw new Error("Report failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ClearPath-Signed-Offer-${addressSlug}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — the signed record still exists in the DB regardless
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className="px-5 py-2.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
    >
      {downloading ? "Building PDF…" : "Download Signed PDF"}
    </button>
  );
}
