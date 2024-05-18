"use client";

import React, { useEffect, useRef, useState } from "react";
import { lineString } from "@turf/helpers";
import { getCoordinatesDownriver } from "@/utils/riverUtils";
import { geocodeAddress } from "@/utils/getRawLocation";
import mapboxgl from "mapbox-gl";
import along from "@turf/along";
import length from "@turf/length";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;
const apiKey = process.env.NEXT_PUBLIC_MAPS_KEY as string;

export default function Dashboard() {
  const mapContainer = useRef(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<
    [number, number] | null
  >(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-74.328, 40.487],
      zoom: 9,
    });

    map.current.on("click", async (event: mapboxgl.MapMouseEvent) => {
      const { lngLat } = event;
      setSelectedLocation([lngLat.lng, lngLat.lat]);

      try {
        const distance = 9999;
        const result = await getCoordinatesDownriver(
          lngLat.lat,
          lngLat.lng,
          distance
        );
        const downriverCoordinates = result.downstreamCoordinates;
        const flattenedCoordinates = downriverCoordinates.flat();
        const lineFeature = lineString(flattenedCoordinates);

        if (map.current?.getSource("river")) {
          (map.current?.getSource("river") as mapboxgl.GeoJSONSource).setData(
            lineFeature
          );
        } else {
          map.current?.addSource("river", {
            type: "geojson",
            data: lineFeature,
          });

          map.current?.addLayer({
            id: "river",
            type: "line",
            source: "river",
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": "#ff0000",
              "line-width": 5,
            },
          });
        }

        const bounds = new mapboxgl.LngLatBounds();
        flattenedCoordinates.forEach((coord: any) => {
          bounds.extend(coord as [number, number]);
        });
        map.current?.fitBounds(bounds, { padding: 150 });

        const lineDistance = length(lineFeature);
        const duration = lineDistance * 30;
        const numPoints = 100;
        const segmentDistance = lineDistance / numPoints;

        const distances = Array.from(
          { length: numPoints },
          (_, i) => i * segmentDistance
        );

        const interpolatedPoints = distances.map(
          (distance) => along(lineFeature, distance).geometry.coordinates
        );

        const easing = (t: number) => t * (2 - t);

        let start: number | null = null;
        let pointIndex = 0;

        const frame = (time: number) => {
          if (!start) start = time;
          const progress = (time - start) / duration;

          if (progress > 1) return; // animation continued

          const currentIndex = Math.floor(progress * (numPoints - 1));

          if (currentIndex !== pointIndex) {
            const currentPoint = interpolatedPoints[currentIndex];

            if (currentPoint.length === 2) {
              map.current?.flyTo({
                center: currentPoint as [number, number],
                easing: easing,
              });
              pointIndex = currentIndex;
            } else {
              console.error(
                "Invalid coordinates for camera center:",
                currentPoint
              );
            }
          }

          window.requestAnimationFrame(frame);
        };

        window.requestAnimationFrame(frame);
      } catch (error) {
        console.error("Error:", error);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedLocation && map.current) {
      const marker = new mapboxgl.Marker()
        .setLngLat(selectedLocation)
        .addTo(map.current);

      map.current.flyTo({
        center: selectedLocation,
        zoom: 14,
      });

      return () => {
        marker.remove();
      };
    }
  }, [selectedLocation]);

  return <div ref={mapContainer} style={{ width: "100%", height: "100vh" }} />;
}
