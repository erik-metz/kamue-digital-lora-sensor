"use client";

import L from "leaflet";
import { createMarkerContent } from "@/lib/mapMarker";
import { useEffect, useRef } from "react";

export interface SensorNode {
  id: string;
  name: string;
  locationName: string;
  address: string;
  lat: number;
  lng: number;
  status: "online" | "warning" | "offline";

}

interface MapProps {
  nodes: SensorNode[];
  selectedNodeId: string | undefined;
  onSelectNode: (id: string) => void;
}

export default function MapComponent({
  nodes,
  selectedNodeId,
  onSelectNode,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const previousSelectionRef = useRef<string | undefined>(undefined);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center map around Bürstadt / Lampertheim (Hessisches Ried)
      const map = L.map(mapContainerRef.current, {
        center: [49.62, 8.46],
        zoom: 12,
        zoomControl: true,
      });

      // Standard free OpenStreetMap tile server (no API key required)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Remove existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    // Custom Icon SVG generator
    const createCustomIcon = (node: SensorNode, isSelected: boolean) => {
      const color =
        node.status === "online"
          ? "#10b981"
          : node.status === "warning"
          ? "#f59e0b"
          : "#ef4444";
      const ringColor = isSelected ? "#3b82f6" : "transparent";

      const content = createMarkerContent(node.id, color, ringColor, isSelected);

      return L.divIcon({
        html: content,
        className: "custom-leaflet-marker",
        iconSize: [38, 38],
        iconAnchor: [19, 19],
        popupAnchor: [0, -20],
      });
    };

    nodes.forEach((node) => {
      const isSelected = node.id === selectedNodeId;
      const marker = L.marker([node.lat, node.lng], {
        icon: createCustomIcon(node, isSelected),
      }).addTo(map);

      const popupContent = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = node.name;
      const description = document.createElement("p");
      description.textContent = node.address;
      const hint = document.createElement("p");
      hint.textContent = "Messwerte und Zeitverlauf unter der Karte";
      popupContent.append(title, description, hint);
      marker.bindPopup(popupContent);

      marker.on("click", () => {
        onSelectNode(node.id);
      });

      markersRef.current[node.id] = marker;
    });

    // Center map to selected node if changed
    const targetNode = nodes.find((n) => n.id === selectedNodeId);
    if (previousSelectionRef.current === undefined && nodes.length > 0) {
      map.fitBounds(L.latLngBounds(nodes.map((node) => [node.lat, node.lng])), {
        padding: [30, 30],
        maxZoom: 12,
      });
    } else if (targetNode && previousSelectionRef.current !== selectedNodeId) {
      map.panTo([targetNode.lat, targetNode.lng]);
      markersRef.current[targetNode.id]?.openPopup();
    }
    previousSelectionRef.current = selectedNodeId;
  }, [nodes, selectedNodeId, onSelectNode]);

  useEffect(() => () => {
    mapInstanceRef.current?.remove();
    mapInstanceRef.current = null;
    markersRef.current = {};
    previousSelectionRef.current = undefined;
  }, []);

  return (
    <div className="relative w-full h-[420px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(0.95);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.25);
            opacity: 0.3;
          }
          100% {
            transform: scale(0.95);
            opacity: 0.8;
          }
        }
        .leaflet-tile-pane {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg)
            saturate(0.3);
        }
        .leaflet-popup-content-wrapper {
          background: #1e293b !important;
          color: #e2e8f0 !important;
          border-radius: 12px !important;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6) !important;
          border: 1px solid #334155 !important;
        }
        .leaflet-popup-content {
          color: #e2e8f0 !important;
          margin: 12px !important;
        }
        .leaflet-popup-tip {
          background: #1e293b !important;
        }
        .leaflet-popup-close-button {
          color: #94a3b8 !important;
        }
        .leaflet-popup-close-button:hover {
          color: #e2e8f0 !important;
          background: transparent !important;
        }
      `}</style>
    </div>
  );
}
