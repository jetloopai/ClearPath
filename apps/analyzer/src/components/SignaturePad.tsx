"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface SignaturePadHandle {
  /** Returns a base64 PNG data URL, or null if nothing has been drawn/typed. */
  getDataUrl: () => Promise<string | null>;
  clear: () => void;
}

interface SignaturePadProps {
  onChange?: (hasSignature: boolean) => void;
  className?: string;
}

// Three distinct script styles loaded globally via next/font in layout.tsx
// (see --font-dancing-script / --font-great-vibes / --font-sacramento).
const CURSIVE_FONTS = [
  { id: "dancing", label: "Dancing Script", family: "var(--font-dancing-script)" },
  { id: "vibes", label: "Great Vibes", family: "var(--font-great-vibes)" },
  { id: "sacramento", label: "Sacramento", family: "var(--font-sacramento)" },
] as const;

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ onChange, className }, ref) {
    const [mode, setMode] = useState<"draw" | "type">("draw");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const hasDrawnRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    const [typedName, setTypedName] = useState("");
    const [fontChoice, setFontChoice] = useState<(typeof CURSIVE_FONTS)[number]["id"]>(CURSIVE_FONTS[0].id);

    // ── Canvas setup + resize handling ──────────────────────────────────────
    const setupCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return; // not laid out yet
      const dpr = window.devicePixelRatio || 1;
      // Preserve existing ink across a resize by snapshotting first.
      const prev = hasDrawnRef.current ? canvas.toDataURL("image/png") : null;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1e2333";
      if (prev) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
        img.src = prev;
      }
    };

    useEffect(() => {
      if (mode !== "draw") return;
      setupCanvas();
      const ro = new ResizeObserver(() => setupCanvas());
      if (canvasRef.current) ro.observe(canvasRef.current);
      window.addEventListener("resize", setupCanvas);
      return () => {
        ro.disconnect();
        window.removeEventListener("resize", setupCanvas);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    // ── Drawing (native touch + mouse listeners — more reliable across
    // devices than relying solely on unified Pointer Events for canvas) ──────
    const getPointFromClient = (clientX: number, clientY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const beginStroke = (x: number, y: number) => {
      drawingRef.current = true;
      lastPointRef.current = { x, y };
    };

    const drawTo = (x: number, y: number) => {
      if (!drawingRef.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      const from = lastPointRef.current;
      if (!ctx || !from) return;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastPointRef.current = { x, y };
      if (!hasDrawnRef.current) {
        hasDrawnRef.current = true;
        setIsEmpty(false);
        onChange?.(true);
      }
    };

    const endStroke = () => {
      drawingRef.current = false;
      lastPointRef.current = null;
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || mode !== "draw") return;

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        const p = getPointFromClient(t.clientX, t.clientY);
        beginStroke(p.x, p.y);
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        const p = getPointFromClient(t.clientX, t.clientY);
        drawTo(p.x, p.y);
      };
      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        endStroke();
      };
      const onMouseDown = (e: MouseEvent) => {
        const p = getPointFromClient(e.clientX, e.clientY);
        beginStroke(p.x, p.y);
      };
      const onMouseMove = (e: MouseEvent) => {
        const p = getPointFromClient(e.clientX, e.clientY);
        drawTo(p.x, p.y);
      };
      const onMouseUp = () => endStroke();

      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd, { passive: false });
      canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });
      canvas.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);

      return () => {
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("touchend", onTouchEnd);
        canvas.removeEventListener("touchcancel", onTouchEnd);
        canvas.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

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

    // Canvas's `font` property can't resolve a CSS custom property like
    // `var(--font-dancing-script)` — it needs the literal generated font-family
    // name next/font produces. Resolve it via a probe element's computed style.
    const resolveFontFamily = (cssVarValue: string): string => {
      const probe = document.createElement("span");
      probe.style.position = "absolute";
      probe.style.visibility = "hidden";
      probe.style.fontFamily = cssVarValue;
      document.body.appendChild(probe);
      const resolved = getComputedStyle(probe).fontFamily;
      document.body.removeChild(probe);
      return resolved;
    };

    // ── Typed signature → rendered to an offscreen canvas as a PNG, so
    // downstream storage/PDF-embedding is identical regardless of mode. Must
    // wait for the actual font file to finish loading — canvas fillText
    // silently falls back to a default font with no error otherwise. ────────
    const renderTypedSignature = async (): Promise<string | null> => {
      const name = typedName.trim();
      if (!name) return null;
      const font = CURSIVE_FONTS.find((f) => f.id === fontChoice) ?? CURSIVE_FONTS[0];
      const resolvedFamily = resolveFontFamily(font.family);
      try {
        await document.fonts.load(`56px ${resolvedFamily}`);
        await document.fonts.ready;
      } catch {
        // proceed with whatever is available — better than a blank signature
      }

      const canvas = document.createElement("canvas");
      const dpr = window.devicePixelRatio || 1;
      const width = 500, height = 140;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#1e2333";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let fontSize = 56;
      ctx.font = `${fontSize}px ${resolvedFamily}`;
      // Shrink to fit if the name is long.
      while (ctx.measureText(name).width > width - 40 && fontSize > 20) {
        fontSize -= 2;
        ctx.font = `${fontSize}px ${resolvedFamily}`;
      }
      ctx.fillText(name, width / 2, height / 2);
      return canvas.toDataURL("image/png");
    };

    useImperativeHandle(ref, () => ({
      getDataUrl: async () => {
        if (mode === "type") return renderTypedSignature();
        return hasDrawnRef.current && canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;
      },
      clear: () => {
        if (mode === "draw") clear();
        else setTypedName("");
      },
    }));

    useEffect(() => {
      if (mode === "type") onChange?.(typedName.trim().length > 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, typedName]);

    const activeFont = CURSIVE_FONTS.find((f) => f.id === fontChoice) ?? CURSIVE_FONTS[0];

    return (
      <div className={className}>
        <div className="flex gap-1 mb-2 p-0.5 rounded-lg bg-white/[0.04] w-fit">
          {(["draw", "type"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === m ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {m === "draw" ? "Draw" : "Type"}
            </button>
          ))}
        </div>

        {mode === "draw" ? (
          <>
            <div className="relative rounded-xl border border-white/[0.08] bg-white overflow-hidden">
              <canvas ref={canvasRef} className="w-full h-40 cursor-crosshair block" style={{ touchAction: "none" }} />
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
          </>
        ) : (
          <>
            <input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="Type your full name"
              className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-3 px-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/40 transition-colors mb-2"
            />
            <div className="rounded-xl border border-white/[0.08] bg-white h-24 flex items-center justify-center overflow-hidden px-4">
              <span
                className="text-3xl text-[#1e2333] truncate max-w-full"
                style={{ fontFamily: activeFont.family }}
              >
                {typedName.trim() || "Your signature preview"}
              </span>
            </div>
            <div className="flex gap-2 mt-2">
              {CURSIVE_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFontChoice(f.id)}
                  className={`flex-1 py-2 rounded-lg border text-center transition-colors ${
                    fontChoice === f.id ? "border-indigo-500/50 bg-indigo-500/10" : "border-white/[0.08] hover:border-white/[0.15]"
                  }`}
                >
                  <span className="text-lg text-white" style={{ fontFamily: f.family }}>
                    {typedName.trim().slice(0, 12) || "Abcde"}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }
);
