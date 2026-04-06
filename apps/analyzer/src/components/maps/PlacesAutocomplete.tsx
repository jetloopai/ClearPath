"use client";

import React, { useEffect, useRef, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";

interface PlacesAutocompleteProps {
  onSelect: (address: string, county: string) => void;
  placeholder?: string;
  className?: string;
}

export function PlacesAutocomplete({ onSelect, placeholder, className }: PlacesAutocompleteProps) {
  const [placeAutocomplete, setPlaceAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary("places");

  useEffect(() => {
    if (!placesLib || !inputRef.current) return;

    const options = {
      componentRestrictions: { country: "us" },
      fields: ["formatted_address", "address_components"],
    };

    setPlaceAutocomplete(new placesLib.Autocomplete(inputRef.current, options));
  }, [placesLib]);

  useEffect(() => {
    if (!placeAutocomplete) return;

    placeAutocomplete.addListener("place_changed", () => {
      const place = placeAutocomplete.getPlace();
      const formattedAddress = place.formatted_address ?? inputRef.current?.value ?? "";

      const countyComponent = place.address_components?.find((c) =>
        c.types.includes("administrative_area_level_2")
      );
      const county = countyComponent?.long_name ?? "";

      onSelect(formattedAddress, county);
    });
  }, [placeAutocomplete, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      className={className}
    />
  );
}
