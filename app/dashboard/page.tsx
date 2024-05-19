"use client";

import React, { useEffect, useRef, useState } from "react";
import { lineString } from "@turf/helpers";
import { getCoordinatesDownriver } from "@/utils/riverUtils";
import { geocodeAddress } from "@/utils/getRawLocation";
import { nearestRecyclingCenter } from "@/utils/getNearRecyclingCenter";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import axios from "axios";

import along from "@turf/along";
import length from "@turf/length";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { nearestLandfill } from "@/utils/getNearLandfill";
import { reverseGeocodeCoordinates } from "@/utils/reverseGeocode";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;
const apiKey = process.env.NEXT_PUBLIC_MAPS_KEY as string;
let distanceCounter = 0;
let recyclingCenterAddress: string | null = null;

export default function Dashboard() {
  const [item, setItem] = useState("");
  const [materials, setMaterials] = useState("");
  const [recyclable, setRecyclable] = useState("");
  const [loading, setLoading] = useState(false);
  const [newItemsLoading, setNewItemsLoading] = useState(false);
  const [newItems, setNewItems] = useState<String[]>([]);
  const [selectedItem, setSelectedItem] = useState("");
  const { toast } = useToast();
  let marker: mapboxgl.Marker | null = null;

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedItem && !item) {
      toast({
        variant: "destructive",
        title: "No item inputted ",
        description:
          "Please input an item into the textbox and select a location on the map, then try again.",
      });
      setLoading(false);
      return null;
    }

    if (!selectedLocation) {
      toast({
        variant: "destructive",
        title: "No location selected",
        description: "Please select a location on the map, then try again.",
      });
      setLoading(false);
      return null;
    }
    setLoading(true);

    try {
      const response = await axios.get(
        `/api/getMaterials?item=${selectedItem || item}`
      );
      setMaterials(response.data);
    } catch (error) {
      console.error(error);
      setMaterials("An error occurred :(");
    }

    try {
      const response = await axios.get(`/api/isRecyclable?items=${materials}`);
      setRecyclable(response.data);
    } catch (error) {
      console.error(error);
      setMaterials("An error occurred :(");
    }

    setLoading(false);
  };

  const generateNewItems = async () => {
    setNewItemsLoading(true);
    const matArray = materials.split("and");
    const boolStrings = recyclable.toLowerCase().split(" ");
    const isRecyclable = [boolStrings[0] === "true", boolStrings[1] === "true"];

    const newItemsPromises = matArray.map((material, index) => {
      if (isRecyclable[index]) {
        return axios.get(`/api/generateNewItems?items=${material}`);
      }
      return Promise.resolve({ data: "" });
    });

    try {
      const responses = await Promise.all(newItemsPromises);
      const newItemsData = responses.map((response) => response.data);
      setNewItems(newItemsData);

      if (selectedLocation) {
        const address = await reverseGeocodeCoordinates(
          selectedLocation[1],
          selectedLocation[0],
          apiKey
        );
        // console.log(address);

        if (address) {
          if (recyclable[0] || recyclable[1]) {
            recyclingCenterAddress = await nearestRecyclingCenter(address);
            recyclingCenterAddress = recyclingCenterAddress.replace('"g', "");
            console.log(recyclingCenterAddress);
            const recyclingCenter = await geocodeAddress(
              recyclingCenterAddress,
              apiKey
            );
            const randomPoints = [];
            while (randomPoints.length < 4) {
              const lat = selectedLocation[1] + (Math.random() * 6 - 2.5);
              const lng = selectedLocation[0] + (Math.random() * 5 - 2.5);
              const pointAddress = await reverseGeocodeCoordinates(
                lat,
                lng,
                apiKey
              );

              if (
                pointAddress &&
                !pointAddress.includes("Ocean") &&
                !pointAddress.includes("Sea")
              ) {
                randomPoints.push([lng, lat]);
              }
            }
            // console.log(randomPoints);

            const coordinates = [
              selectedLocation,
              [recyclingCenter.longitude, recyclingCenter.latitude],
              ...randomPoints,
            ];
            // console.log(coordinates[0]);
            // console.log(coordinates[1]);
            // console.log(coordintaes[2]);

            const lineFeature = lineString(coordinates);
            console.log(
              "Line feature coordinates:",
              lineFeature.geometry.coordinates
            );

            if (map.current?.getSource("lines")) {
              (
                map.current?.getSource("lines") as mapboxgl.GeoJSONSource
              ).setData(lineFeature);
            } else {
              map.current?.addSource("lines", {
                type: "geojson",
                data: lineFeature,
              });

              map.current?.addLayer({
                id: "lines",
                type: "line",
                source: "lines",
                layout: {
                  "line-join": "round",
                  "line-cap": "round",
                },
                paint: {
                  "line-color": "#33781e",
                  "line-width": 4,
                },
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
    }

    setNewItemsLoading(false);
  };

  const handleItemSelect = (item: string) => {
    setSelectedItem(item);
    setNewItems([]);
    setMaterials("");
    setRecyclable("");
    setItem("");
  };

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
      zoom: 8,
    });

    map.current.on("click", async (event: mapboxgl.MapMouseEvent) => {
      const { lngLat } = event;
      // let marker : mapboxgl = null;
      // if(marker!=null){
      //   marker.remove();
      // }
      if (map.current) {
        marker = new mapboxgl.Marker()
          .setLngLat([lngLat.lng, lngLat.lat])
          .addTo(map.current);
      }
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
              "line-color": "#2E4C48",
              "line-width": 5,
            },
          });
        }

        const bounds = new mapboxgl.LngLatBounds();
        flattenedCoordinates.forEach((coord: any) => {
          bounds.extend(coord as [number, number]);
        });
        map.current?.fitBounds(bounds, { padding: 150 });

        const lineDistance = length(lineFeature).valueOf();
        distanceCounter += lineDistance;
        const duration = Math.pow(lineDistance, 0.85) * 7.0;
        const numPoints = Math.ceil(500000.0 / lineDistance);
        const segmentDistance = lineDistance / (numPoints - 1);

        const distances = Array.from(
          { length: numPoints },
          (_, i) => i * segmentDistance
        );

        const interpolatedPoints = distances.map(
          (distance) => along(lineFeature, distance).geometry.coordinates
        );

        const easing = (t: number) => t * (0.75 - t);

        let start: number | null = null;
        let pointIndex = 0;
        let lastUpdateTime = 0;
        const throttleInterval = 10;

        const frame = (time: number) => {
          if (time - lastUpdateTime < throttleInterval) {
            window.requestAnimationFrame(frame);
            return;
          }
          lastUpdateTime = time;

          if (!start) start = time;
          const progress = (time - start) / duration;

          if (progress > 1) {
            return marker?.remove();
          } // animation continued

          const currentIndex = Math.floor(progress * (numPoints - 1));
          const nextIndex = Math.min(currentIndex + 1, numPoints - 1);
          const currentPoint = interpolatedPoints[currentIndex];
          const nextPoint = interpolatedPoints[nextIndex];
          const t =
            (progress - lastUpdateTime) / ((numPoints - 1) * (numPoints - 1));

          const lerpedPoint = [
            currentPoint[0] + (nextPoint[0] - currentPoint[0]) * progress,
            currentPoint[1] + (nextPoint[1] - currentPoint[1]) * progress,
          ];

          if (lerpedPoint.length === 2) {
            map.current?.flyTo({
              center: lerpedPoint as [number, number],
              easing: easing,
            });
          } else {
            console.error(
              "Invalid coordinates for camera center:",
              lerpedPoint
            );
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
        zoom: 8,
      });

      return () => {
        marker.remove();
      };
    }
  }, [selectedLocation]);

  return (
    <>
      <main className="flex justify-between bg-[#DAF5FF] text-[#2E4C48]">
        <div className="flex justify-center flex-col items-center m-24 gap-10">
          <div>
            <Card className="w-[350px]  bg-[#D4FCD1] ">
              <CardHeader>
                <CardTitle>Map your item's journey</CardTitle>
                <CardDescription className="text-xs">
                  Can your item make it across the entire nation?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit}>
                  <div className="grid w-full items-center gap-4">
                    <div className="flex flex-col space-y-1.5">
                      <Input
                        id="name"
                        type="text"
                        value={selectedItem || item}
                        onChange={(e) => setItem(e.target.value)}
                        placeholder="Enter an item"
                      />
                    </div>
                  </div>
                  <CardFooter className="flex justify-center mb-0 mt-8 p-0">
                    <Button disabled={loading} className="w-full bg-[#2E4C48]">
                      {" "}
                      {loading ? "Loading..." : "Submit"}
                    </Button>
                  </CardFooter>
                </form>
              </CardContent>
            </Card>
          </div>
          <div className="w-full p-6 bg-[#D4FCD1]">
            <p>Total Distance: {distanceCounter.toFixed(2)}</p>
          </div>

          {loading ? (
            <p>Generating...</p>
          ) : (
            materials && (
              <Card className="w-full bg-[#D4FCD1] p-10">
                <CardContent>
                  <CardTitle className="text-lg">Materials</CardTitle>
                  <CardDescription>{materials}</CardDescription>
                  <CardTitle className="text-lg">Recyclable</CardTitle>
                  <CardDescription>{recyclable}</CardDescription>
                  <Button
                    onClick={generateNewItems}
                    disabled={newItemsLoading}
                    className="w-full bg-[#2E4C48] pt-2 pb-2"
                  >
                    {newItemsLoading ? "Generating..." : "Generate New Items"}
                  </Button>
                  {newItems.length > 0 && (
                    <div>
                      <CardTitle className="text-lg">
                        Nearest Recycling Center:
                      </CardTitle>
                      <CardDescription>
                        {recyclingCenterAddress}
                      </CardDescription>
                      <CardTitle className="text-lg">New Items:</CardTitle>
                      {newItems.map((item, index) => (
                        <ul
                          key={index}
                          onClick={() => handleItemSelect(item.toString())}
                        >
                          {item.split(":").map((x) => (
                            <li className="bg-[#D4FCD1]">{x}</li>
                          ))}
                        </ul>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          )}
        </div>
        <div
          ref={mapContainer}
          style={{ width: "100%", height: "100vh" }}
          className="sticky top-0"
        />
      </main>
    </>
  );
}
