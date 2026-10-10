"use client";

import { useEffect } from "react";
import L from "leaflet";
import { isCurrentObservation } from "@/lib/currentObservation";

type Mode = "rgb" | "ndvi" | "ecostress" | "firms";
type Scene = { id: string; date?: string; acquired_at?: string; raster?: { method: string; stats?: { valid_pixels: number } } | null };
type Detection = { latitude: number; longitude: number; acquired_at: string; confidence: "l" | "n" | "h"; frp_mw: number };
const colors = { l: "#facc15", n: "#f97316", h: "#dc2626" };

export default function MapEarthObservationLayer({ map, mode }: { map: L.Map; mode: Mode }) {
  useEffect(() => {
    const group = L.layerGroup().addTo(map);
    const legend = new L.Control({ position: "bottomleft" });
    legend.onAdd = () => {
      const element = L.DomUtil.create("div", "rounded bg-slate-950 p-2 text-xs text-white");
      element.textContent = mode === "ecostress" ? "Oberflächentemperatur: −10 °C dunkelblau · 20 °C gelb · 60 °C dunkelrot"
        : mode === "firms" ? "Thermische Auffälligkeiten: gelb niedrige · orange nominale · rot hohe Konfidenz. Keine bestätigten Brände."
        : mode === "ndvi" ? "Vegetationskontrast (NDVI): −1 niedrig · +1 hoch" : "Echtfarben · Copernicus Sentinel-2";
      return element;
    };
    let disposed = false;
    let controller: AbortController | undefined;
    async function refresh() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      group.clearLayers();
      legend.remove();
      try {
        const endpoint = mode === "firms" ? "/api/firms?days=1" : mode === "ecostress" ? "/api/ecostress/scenes" : "/api/satellite/scenes";
        const response = await fetch(endpoint, { signal: request.signal, cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (disposed || request.signal.aborted) return;
        const now = Date.now();
        if (mode === "firms") {
          if (data.status !== "success" || !Array.isArray(data.detections)) return;
          const fetched = Date.parse(data.last_successful_fetch_at ?? "");
          if (!Number.isFinite(fetched) || fetched > now || now - fetched > 2 * 60 * 60 * 1000) return;
          for (const point of data.detections as Detection[]) {
            if (!isCurrentObservation(point.acquired_at, now) || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || !colors[point.confidence]) continue;
            const label = document.createElement("span");
            label.textContent = `Thermische Auffälligkeit · FRP ${point.frp_mw} MW · keine bestätigte Brandmeldung`;
            L.circleMarker([point.latitude, point.longitude], { radius: 6, color: colors[point.confidence], fillOpacity: 0.8 }).bindPopup(label).addTo(group);
          }
        } else {
          if (!Array.isArray(data.scenes)) return;
          // Select the newest current acquisition first. Never fall back to an older raster.
          const scenes = (data.scenes as Scene[]).filter(scene => isCurrentObservation(scene.acquired_at ?? scene.date, now))
            .sort((a, b) => Date.parse(b.acquired_at ?? b.date ?? "") - Date.parse(a.acquired_at ?? a.date ?? ""));
          const latest = scenes[0];
          if (!latest) return;
          const acquisition = latest.acquired_at ?? latest.date;
          for (const scene of scenes.filter(item => (item.acquired_at ?? item.date) === acquisition)) {
            const valid = mode === "ecostress" ? scene.raster?.method === "ecostress-v003-clear-land70-v1" && (scene.raster.stats?.valid_pixels ?? 0) > 0 : scene.raster?.method === "sentinel-c1-scl20-v1";
            if (!valid) continue;
            const id = encodeURIComponent(scene.id);
            const url = mode === "ecostress" ? `/api/ecostress/tiles/${id}/{z}/{x}/{y}` : `/api/satellite/tiles/${id}/{z}/{x}/{y}.png?layer=${mode}`;
            const tiles = L.tileLayer(url, { maxZoom: 19, opacity: mode === "rgb" ? 1 : 0.82, attribution: mode === "ecostress" ? "NASA ECOSTRESS" : "ESA / Copernicus Sentinel-2" });
            tiles.on("tileerror", () => { group.removeLayer(tiles); if (!group.getLayers().length) legend.remove(); });
            tiles.addTo(group);
          }
        }
        if (group.getLayers().length) legend.addTo(map);
      } catch {
        // No current data means no overlay, including after a failed refresh.
      }
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    return () => { disposed = true; controller?.abort(); window.clearInterval(timer); legend.remove(); group.remove(); };
  }, [map, mode]);
  return null;
}
