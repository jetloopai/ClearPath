"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import { ReactNode } from "react";

export function MapProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

  if (!apiKey) {
    console.warn("Google Maps API key is missing. The map will not load correctly.");
  }

  return (
    <APIProvider 
      apiKey={apiKey} 
      libraries={["places", "geocoding"]}
      onLoad={() => {}}
    >
      {children}
    </APIProvider>
  );
}
