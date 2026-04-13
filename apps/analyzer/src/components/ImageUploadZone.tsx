"use client";

import React, { useRef, useState } from "react";
import { X, Camera, Plus } from "lucide-react";

interface ImageUploadZoneProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  compact?: boolean;
}

export function ImageUploadZone({ images, onChange, maxImages = 10, compact = false }: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const readFiles = (files: FileList | null) => {
    if (!files) return;
    const remaining = maxImages - images.length;
    const toRead = Array.from(files).slice(0, remaining);
    if (toRead.length === 0) return;

    const promises = toRead.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );

    Promise.all(promises).then((results) => {
      onChange([...images, ...results]);
    });
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    readFiles(e.dataTransfer.files);
  };

  const cols = compact ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-3 sm:grid-cols-5";
  const thumbSize = compact ? "h-16 sm:h-20" : "h-20 sm:h-24";
  const canAdd = images.length < maxImages;

  return (
    <div className="space-y-2">
      <div className={`grid ${cols} gap-2`}>
        {images.map((src, i) => (
          <div key={i} className={`relative ${thumbSize} rounded-xl overflow-hidden bg-white/[0.03] group`}>
            <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`${thumbSize} rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors ${
              dragging
                ? "border-indigo-500/60 bg-indigo-500/10"
                : "border-white/[0.08] hover:border-white/[0.15] bg-white/[0.02] hover:bg-white/[0.04]"
            }`}
          >
            {images.length === 0 ? (
              <>
                <Camera className="w-5 h-5 text-zinc-600" />
                {!compact && <span className="text-[10px] text-zinc-600">Add photos</span>}
              </>
            ) : (
              <Plus className="w-4 h-4 text-zinc-600" />
            )}
          </button>
        )}
      </div>

      {images.length > 0 && (
        <div className="text-[10px] text-zinc-600 text-right">
          {images.length} / {maxImages} photos
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => readFiles(e.target.files)}
      />
    </div>
  );
}
