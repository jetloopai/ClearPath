"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface SignaturePadHandle {
  /** Returns a base64 PNG data URL, or null if nothing has been drawn. */
  getDataUrl: () => string | null;
  clear: () => void;
}

interface SignaturePadProps {
  onChange?: (hasSignature: boolean) => void;
  className?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ onChange, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const hasDrawnRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    // Match the canvas's backing resolution to its displayed size (and device
    // pixel ratio) so strokes stay crisp and coordinates line up correctly.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(dpr, dpr);
          ctx.lineWidth = 2.2;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.strokeStyle = "#1e2333";
        }
      };
      resize();
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }, []);

    const getPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      canvasRef.current?.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastPointRef.current = getPoint(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      const from = lastPointRef.current;
      const to = getPoint(e);
      if (!ctx || !from) return;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      lastPointRef.current = to;
      if (!hasDrawnRef.current) {
        hasDrawnRef.current = true;
        setIsEmpty(false);
        onChange?.(true);
      }
    };

    const stopDrawing = () => {
      drawingRef.current = false;
      lastPointRef.current = null;
    };

    const clear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      }
      hasDrawnRef.current = false;
      setIsEmpty(true);
      onChange?.(false);
    };

    useImperativeHandle(ref, () => ({
      getDataUrl: () => (hasDrawnRef.current && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null),
      clear,
    }));

    return (
      <div className={className}>
        <div className="relative rounded-xl border border-white/[0.08] bg-white overflow-hidden" style={{ touchAction: "none" }}>
          <canvas
            ref={canvasRef}
            className="w-full h-40 cursor-crosshair"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
          />
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-sm text-zinc-400">Draw your signature here</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={isEmpty}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-40 disabled:hover:text-zinc-500"
        >
          Clear signature
        </button>
      </div>
    );
  }
);
