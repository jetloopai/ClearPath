"use client";

import { useState } from "react";
import type { ScopeItem } from "@/lib/imageAnalysis";

interface PhotoAnnotationsProps {
  images: string[];
  scopeOfWork: ScopeItem[];
}

export function PhotoAnnotations({ images, scopeOfWork }: PhotoAnnotationsProps) {
  const imagesWithIssues = images
    .map((src, index) => ({ src, index }))
    .filter(({ index }) => scopeOfWork.some((item) => item.imageIndex === index));

  const [activeIndex, setActiveIndex] = useState(imagesWithIssues[0]?.index ?? 0);
  const [activeItem, setActiveItem] = useState<number | null>(null);

  if (images.length === 0) return null;

  const itemsForActive = scopeOfWork.filter((item) => item.imageIndex === activeIndex);

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-black/40 border border-white/[0.07]">
        <img
          src={images[activeIndex]}
          alt={`Property photo ${activeIndex + 1}`}
          className="w-full h-auto max-h-[420px] object-contain mx-auto"
        />

        {itemsForActive.map((item, i) => {
          const x = Math.min(96, Math.max(4, item.region?.x ?? 50));
          const y = Math.min(92, Math.max(4, item.region?.y ?? 50));
          const isActive = activeItem === i;
          // Flip label to the left when the pin sits on the right half, so the label stays on-image
          const labelOnLeft = x > 55;

          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <button
                type="button"
                onClick={() => setActiveItem(isActive ? null : i)}
                className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg transition-transform ${
                  isActive ? "bg-indigo-400 scale-125" : "bg-red-500 hover:scale-110"
                }`}
                aria-label={item.category}
              />
              <div
                className={`absolute top-1/2 ${labelOnLeft ? "right-full mr-2" : "left-full ml-2"} -translate-y-1/2 whitespace-nowrap px-2.5 py-1 rounded-lg bg-black/85 border border-white/10 text-[11px] font-medium text-white shadow-xl pointer-events-none transition-opacity ${
                  isActive ? "opacity-100" : "opacity-90"
                }`}
              >
                {item.category}
                {item.estimatedCost ? <span className="text-zinc-400 ml-1.5">{item.estimatedCost}</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      {activeItem !== null && itemsForActive[activeItem] && (
        <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-zinc-400">
          {itemsForActive[activeItem].issue}
        </div>
      )}

      {imagesWithIssues.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {imagesWithIssues.map(({ src, index }) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                setActiveItem(null);
              }}
              className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                index === activeIndex ? "border-indigo-500" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={src} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
