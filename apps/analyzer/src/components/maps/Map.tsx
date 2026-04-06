"use client";

import { Map as GoogleMap, MapProps as GoogleMapProps, AdvancedMarker } from "@vis.gl/react-google-maps";

export interface MapProps extends GoogleMapProps {
  markers?: { lat: number; lng: number; title?: string }[];
}

export function Map({ markers, ...props }: MapProps) {
  return (
    <GoogleMap
      defaultZoom={10}
      defaultCenter={{ lat: 39.8283, lng: -98.5795 }} // Center of US
      mapId="DEMO_MAP_ID" // Required for AdvancedMarker
      disableDefaultUI={true}
      {...props}
    >
      {markers?.map((marker, index) => (
        <AdvancedMarker
          key={index}
          position={{ lat: marker.lat, lng: marker.lng }}
          title={marker.title}
        />
      ))}
    </GoogleMap>
  );
}
