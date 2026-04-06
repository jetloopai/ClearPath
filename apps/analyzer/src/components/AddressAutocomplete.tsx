"use client";

import React, { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google: typeof google;
    initGoogleMapsAutocomplete?: () => void;
  }
}

interface AddressAutocompleteProps {
  onSelect: (address: string, county: string) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({ onSelect, placeholder, className }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;

    // If already loaded, initialize directly
    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    // Avoid adding the script twice
    if (document.querySelector('script[data-gmaps]')) return;

    window.initGoogleMapsAutocomplete = () => setLoaded(true);

    const script = document.createElement("script");
    script.setAttribute("data-gmaps", "true");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsAutocomplete`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      window.initGoogleMapsAutocomplete = undefined;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !inputRef.current) return;

    // Bias toward the continental US — lets Google rank closer matches higher
    const usBounds = new window.google.maps.LatLngBounds(
      new window.google.maps.LatLng(24.396308, -125.0),
      new window.google.maps.LatLng(49.384358, -66.93457)
    );

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "address_components"],
      bounds: usBounds,
      types: ["address"],
    });

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      const formattedAddress = place.formatted_address ?? inputRef.current?.value ?? "";

      const countyComponent = place.address_components?.find((c) =>
        c.types.includes("administrative_area_level_2")
      );
      const county = countyComponent?.long_name ?? "";

      onSelect(formattedAddress, county);
    });
  }, [loaded, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      className={className}
    />
  );
}
