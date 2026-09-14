"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./map.css";
import { createClusterContent, createMarkerContent } from "@/lib/mapMarker";
import { CATEGORIES, markerCategory, observationLabel, primaryReading, readingFreshness, temperatureColor, valueLabel, type Category, type MapMode, type SensorNode } from "@/lib/mapData";
import { useEffect, useRef, useState } from "react";
export type { SensorNode } from "@/lib/mapData";

type ColoredMarker = L.Marker & { categoryColor: string };
interface MapProps {
  nodes: SensorNode[];
  selectedNodeId: string | undefined;
  onSelectNode: (id: string) => void;
  categories: Category[];
  mode: MapMode;
  now: number;
}

export default function MapComponent({ nodes, selectedNodeId, onSelectNode, categories, mode, now }: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const markers = useRef(new Map<string, ColoredMarker>());
  const selectedRef = useRef<string | undefined>(undefined);
  const onSelectRef = useRef(onSelectNode);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(12);
  const [failed, setFailed] = useState(false);
  useEffect(() => { onSelectRef.current = onSelectNode; }, [onSelectNode]);

  useEffect(() => {
    let cancelled = false;
    const currentMarkers = markers.current;
    async function initialize() {
      // MarkerCluster extends the global Leaflet instance. Load only in the browser.
      (window as typeof window & { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { center: [49.62, 8.46], zoom: 12, maxZoom: 19 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
      }).addTo(map);
      const group = L.markerClusterGroup({
        maxClusterRadius: 55, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        iconCreateFunction: cluster => L.divIcon({
          html: createClusterContent(cluster.getAllChildMarkers().map(m => (m as ColoredMarker).categoryColor), cluster.getChildCount()),
          className: "map-cluster-icon", iconSize: [44, 44], iconAnchor: [22, 22],
        }),
      });
      map.addLayer(group);
      map.on("zoomend", () => setZoom(map.getZoom()));
      mapRef.current = map;
      groupRef.current = group;
      setReady(true);
    }
    void initialize().catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      groupRef.current = null;
      currentMarkers.clear();
    };
  }, []);

  // Reconcile only changed inventory/icons. Selecting a station does not rebuild layers.
  useEffect(() => {
    const group = groupRef.current;
    if (!ready || !group) return;
    const ids = new Set(nodes.map(n => n.id));
    for (const [id, marker] of markers.current) {
      if (!ids.has(id)) { group.removeLayer(marker); markers.current.delete(id); }
    }
    const added: ColoredMarker[] = [];
    for (const node of nodes) {
      const category = markerCategory(node, categories);
      const reading = primaryReading(node, category, mode);
      const state = readingFreshness(reading, now);
      const muted = state === "stale" || state === "unknown";
      const color = mode === "temperature" ? muted ? "#94a3b8" : temperatureColor(reading!.value) : CATEGORIES[category].color;
      const icon = L.divIcon({
        html: createMarkerContent(category, color, muted, zoom >= 16 ? valueLabel(reading) : ""),
        className: `map-sensor-icon${node.id === selectedRef.current ? " map-sensor-selected" : ""}`,
        iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -20],
      });
      let marker = markers.current.get(node.id);
      if (!marker) {
        marker = L.marker([node.lat, node.lng], { icon, title: node.name, alt: node.name, keyboard: true }) as ColoredMarker;
        marker.on("click", () => onSelectRef.current(node.id));
        markers.current.set(node.id, marker);
        added.push(marker);
      } else {
        marker.setIcon(icon);
        if (!marker.getLatLng().equals([node.lat, node.lng])) marker.setLatLng([node.lat, node.lng]);
      }
      marker.categoryColor = mode === "temperature" ? "#94a3b8" : CATEGORIES[category].color;
      const tooltip = document.createElement("span");
      tooltip.textContent = node.name;
      if (marker.getTooltip()) marker.setTooltipContent(tooltip);
      else marker.bindTooltip(tooltip, { direction: "top", offset: [0, -16] });
      const popup = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = node.name;
      const tags = document.createElement("p"); tags.textContent = node.categories.map(c => CATEGORIES[c].label).join(" · ");
      const value = document.createElement("p"); value.textContent = valueLabel(reading) || "Keine Messdaten";
      value.className = "map-popup-value";
      const time = document.createElement("p"); time.textContent = observationLabel(reading, now);
      const hint = document.createElement("p"); hint.textContent = "Alle Messwerte und Stationsdetails unter der Karte";
      popup.append(title, tags, value, time, hint);
      if (marker.getPopup()) marker.setPopupContent(popup);
      else marker.bindPopup(popup);
    }
    group.addLayers(added);
    group.refreshClusters();
  }, [nodes, categories, mode, now, ready, zoom]);

  useEffect(() => {
    if (!ready) return;
    if (selectedRef.current === selectedNodeId) return;
    const previous = selectedRef.current && markers.current.get(selectedRef.current);
    if (previous) {
      previous.getElement()?.classList.remove("map-sensor-selected");
      previous.closePopup();
    }
    selectedRef.current = selectedNodeId;
    const marker = selectedNodeId && markers.current.get(selectedNodeId);
    if (marker) {
      groupRef.current?.zoomToShowLayer(marker, () => {
        if (selectedRef.current !== selectedNodeId) return;
        marker.getElement()?.classList.add("map-sensor-selected");
        marker.openPopup();
      });
    }
  }, [selectedNodeId, ready]);

  return <div className="sensor-map relative w-full h-[480px] sm:h-[560px] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
    <div ref={container} className="w-full h-full z-0" aria-label="Sensorstandorte, gruppiert nach Nähe" />
    {failed ? <p role="alert" className="absolute inset-0 bg-slate-900 p-8">Die Karte konnte nicht geladen werden. Bitte lade die Seite erneut.</p> : null}
    <div className="absolute top-3 right-3 z-[400] flex gap-2">
      <button type="button" className="map-control" onClick={() => mapRef.current?.setView([49.62, 8.46], 12)}>Ried</button>
      <button type="button" className="map-control" disabled={!nodes.length} onClick={() => {
        if (nodes.length) mapRef.current?.fitBounds(L.latLngBounds(nodes.map(n => [n.lat, n.lng])), { padding: [45, 45], maxZoom: 15 });
      }}>Alle Standorte</button>
    </div>
    {!nodes.length && ready ? <p className="absolute bottom-8 left-3 right-3 z-[400] rounded-xl bg-slate-950/95 p-4 text-sm text-slate-200">Keine Standorte für diese Auswahl. Wähle eine weitere Gruppe oder „Alle“.</p> : null}
  </div>;
}
