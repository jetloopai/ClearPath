"use client";

import React from "react";
import { Map as GoogleMap, AdvancedMarker, InfoWindow, useAdvancedMarkerRef } from "@vis.gl/react-google-maps";

interface Comp {
  address?: string;
  price: number;
  distanceMiles: number;
  latitude?: number | null;
  longitude?: number | null;
}

interface CompsMapProps {
  subjectLat: number;
  subjectLng: number;
  subjectAddress: string;
  comps: Comp[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

function CompMarker({ comp, index }: { comp: Comp; index: number }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = React.useState(false);

  if (!comp.latitude || !comp.longitude) return null;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: comp.latitude, lng: comp.longitude }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-6 h-6 rounded-full bg-indigo-500 border-2 border-white shadow-lg flex items-center justify-center text-[10px] text-white font-bold cursor-pointer hover:scale-110 transition-transform">
          {index + 1}
        </div>
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onClose={() => setOpen(false)}>
          <div className="text-xs p-1 min-w-[140px]">
            <div className="font-semibold text-zinc-800 mb-0.5">{fmt(comp.price)}</div>
            <div className="text-zinc-500">{comp.distanceMiles.toFixed(2)} mi away</div>
            {comp.address && (
              <div className="text-zinc-600 mt-0.5 text-[11px] leading-snug">{comp.address}</div>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function CompsMap({ subjectLat, subjectLng, subjectAddress, comps }: CompsMapProps) {
  const [subjectMarkerRef, subjectMarker] = useAdvancedMarkerRef();
  const [subjectOpen, setSubjectOpen] = React.useState(false);

  const validComps = comps.filter(c => c.latitude && c.longitude);

  return (
    <div className="w-full h-56 rounded-2xl overflow-hidden border border-white/[0.06]">
      <GoogleMap
        defaultZoom={14}
        defaultCenter={{ lat: subjectLat, lng: subjectLng }}
        mapId="clearpath_comps_map"
        disableDefaultUI
        gestureHandling="cooperative"
        style={{ width: "100%", height: "100%" }}
      >
        {/* Subject property — star marker */}
        <AdvancedMarker
          ref={subjectMarkerRef}
          position={{ lat: subjectLat, lng: subjectLng }}
          onClick={() => setSubjectOpen(o => !o)}
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-sm cursor-pointer hover:scale-110 transition-transform">
            ★
          </div>
        </AdvancedMarker>
        {subjectOpen && subjectMarker && (
          <InfoWindow anchor={subjectMarker} onClose={() => setSubjectOpen(false)}>
            <div className="text-xs p-1">
              <div className="font-semibold text-zinc-800 mb-0.5">Subject Property</div>
              <div className="text-zinc-600 text-[11px] leading-snug">{subjectAddress}</div>
            </div>
          </InfoWindow>
        )}

        {/* Comp markers */}
        {validComps.map((comp, i) => (
          <CompMarker key={i} comp={comp} index={i} />
        ))}
      </GoogleMap>
    </div>
  );
}
