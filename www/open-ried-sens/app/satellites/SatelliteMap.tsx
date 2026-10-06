"use client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { SatellitePosition } from "./SatelliteTracker";

export default function SatelliteMap({ positions, trail, selected, onSelect }: {
  positions: SatellitePosition[]; trail: SatellitePosition[]; selected: number | null; onSelect: (id: number) => void;
}) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const group = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<number, L.CircleMarker>());
  const select = useRef(onSelect);
  useEffect(() => { select.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, { center: [30, 8], zoom: 2, minZoom: 1, maxZoom: 8 });
    map.current = instance;
    // Public base tiles, satellite data always comes from our backend.
    const tiles = L.tileLayer("/api/satellites/tiles/{z}/{x}/{y}.png", { maxZoom: 8,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
    tiles.on("tileerror", () => setTilesFailed(true));
    const markerRegistry = markers.current;
    group.current = L.layerGroup().addTo(instance);
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(container.current);
    return () => { resize.disconnect(); instance.remove(); map.current = null; group.current = null; markerRegistry.clear(); };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const present = new Set(positions.map(p => p.norad_id));
    for (const [id, marker] of markers.current) if (!present.has(id)) { marker.remove(); markers.current.delete(id); }
    const motions: { marker: L.CircleMarker; from: L.LatLng; to: L.LatLng }[] = [];
    for (const p of positions) {
      let marker = markers.current.get(p.norad_id);
      if (!marker) {
        marker = L.circleMarker([p.latitude, p.longitude], { radius: 7 }).addTo(map.current);
        marker.on("click", () => select.current(p.norad_id));
        markers.current.set(p.norad_id, marker);
      }
      const from = marker.getLatLng(), to = L.latLng(p.latitude, p.longitude);
      if (Math.abs(from.lng-to.lng) < 180) motions.push({ marker, from, to });
      else marker.setLatLng(to);
      marker.setStyle({ color: p.norad_id === selected ? "#f59e0b" : "#2563eb", fillOpacity: .8 });
      const label = document.createElement("span");
      label.textContent = `${p.name ?? p.norad_id} · ${p.altitude_km.toFixed(0)} km · berechnet`;
      marker.unbindTooltip().bindTooltip(label);
    }
    const started = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now-started)/900);
      for (const { marker, from, to } of motions) marker.setLatLng([
        from.lat + (to.lat-from.lat)*progress, from.lng + (to.lng-from.lng)*progress,
      ]);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    if (motions.length) frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [positions, selected]);
  useEffect(() => {
    if (!group.current) return;
    group.current.clearLayers();
    // Split at the dateline so the orbit never draws across the entire map.
    let segment: L.LatLngTuple[] = [];
    for (const p of trail) {
      if (segment.length && Math.abs(segment[segment.length-1][1]-p.longitude)>180) {
        L.polyline(segment, { color: "#f59e0b" }).addTo(group.current); segment = [];
      }
      segment.push([p.latitude, p.longitude]);
    }
    if (segment.length) L.polyline(segment, { color: "#f59e0b" }).addTo(group.current);
  }, [trail]);
  return <div>{tilesFailed ? <p role="status">Die Basiskarte ist derzeit nicht verfügbar.</p> : null}<div ref={container} aria-label="Weltkarte mit berechneten Satellitenpositionen" className="h-[55vh] min-h-80 rounded border" /></div>;
}
