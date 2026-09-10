"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

export interface SensorNode {
  id: string;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  status: "online" | "warning" | "offline";
  batteryPct: number;
  rssi: number;
  snr: number;
  temp: number;
  humidity: number;
  rainMm: number;
  uvIndex: number;
  vocIndex: number;
  noxIndex: number;
  pm25: number;
  noiseDb: number;
  noiseLabel: "Fahrzeugverkehr" | "Passanten/Sprache" | "Wind/Natur" | "Ruhig";
  lastSeen: string;
}

interface MapProps {
  nodes: SensorNode[];
  selectedNodeId: string;
  onSelectNode: (id: string) => void;
}

export default function MapComponent({ nodes, selectedNodeId, onSelectNode }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center map around Bürstadt / Lampertheim (Hessisches Ried)
      const map = L.map(mapContainerRef.current, {
        center: [49.620, 8.460],
        zoom: 12,
        zoomControl: true,
      });

      // Standard free OpenStreetMap tile server (no API key required)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
      const color = node.status === "online" ? "#10b981" : node.status === "warning" ? "#f59e0b" : "#ef4444";
      const ringColor = isSelected ? "#3b82f6" : "transparent";

      const html = `
        <div style="
          position: relative;
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            position: absolute;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: ${ringColor};
            opacity: 0.7;
            animation: ${isSelected ? "pulse 2s infinite" : "none"};
          "></div>
          <div style="
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #0f172a;
            border: 3px solid ${color};
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 11px;
            font-weight: bold;
          ">
            ${node.id.split("-")[1] || node.id}
          </div>
        </div>
      `;

      return L.divIcon({
        html,
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

      const popupContent = `
          <div style="font-family: system-ui, sans-serif; color: #e2e8f0; min-width: 200px; padding: 4px;">
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px; color: #0284c7;">
              ${node.name}
            </div>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">
              📍 ${node.locationName}
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; margin-bottom: 8px; background: #2d3748; padding: 6px; border-radius: 6px;">
              <div>🌡️ Temp: <b>${node.temp.toFixed(1)} °C</b></div>
              <div>💧 Feuchte: <b>${node.humidity}%</b></div>
              <div>🔊 Lärm: <b>${node.noiseDb} dB</b></div>
              <div>🏷️ Typ: <b>${node.noiseLabel}</b></div>
              <div>🌫️ PM2.5: <b>${node.pm25} µg</b></div>
              <div>🔋 Akku: <b>${node.batteryPct}%</b></div>
            </div>

            <div style="font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between;">
              <span>LoRa RSSI: ${node.rssi} dBm</span>
              <span>Letztes Signal: ${node.lastSeen}</span>
            </div>
          </div>
        `;

      marker.bindPopup(popupContent);

      marker.on("click", () => {
        onSelectNode(node.id);
      });

      markersRef.current[node.id] = marker;
    });

    // Center map to selected node if changed
    const targetNode = nodes.find((n) => n.id === selectedNodeId);
    if (targetNode) {
      map.panTo([targetNode.lat, targetNode.lng]);
      markersRef.current[targetNode.id]?.openPopup();
    }

  }, [nodes, selectedNodeId, onSelectNode]);

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
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.25); opacity: 0.3; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .leaflet-tile-pane {
          filter: brightness(0.6) invert(1) contrast(3) hue-rotate(200deg) saturate(0.3);
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
