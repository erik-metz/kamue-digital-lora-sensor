"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./map.css";
import { metricLabel } from "@/lib/telemetryData";
import { createClusterContent, createMarkerContent, createTempPinContent } from "@/lib/mapMarker";
import { CATEGORIES, markerCategory, observationLabel, parkingSummary, primaryReading, readingFreshness, temperatureColor, valueLabel, type Category, type MapMode, type SensorNode } from "@/lib/mapData";
import { TemperatureHeatmapLayer, type TemperaturePoint } from "@/lib/temperatureHeatmap";
import { useEffect, useRef, useState } from "react";
export type { SensorNode } from "@/lib/mapData";

type ColoredMarker = L.Marker & {
  categoryColor: string;
  isParking?: boolean;
  parkingFree?: number;
  parkingCapacity?: number;
};
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
  const tempPinsGroupRef = useRef<L.LayerGroup | null>(null);
  const heatmapRef = useRef<TemperatureHeatmapLayer | null>(null);
  const prevModeRef = useRef<MapMode | null>(null);
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
        iconCreateFunction: cluster => {
          const childMarkers = cluster.getAllChildMarkers() as ColoredMarker[];
          const allParking = childMarkers.length > 0 && childMarkers.every(m => m.isParking);
          let labelText: string | undefined;
          if (allParking) {
            let totalFree = 0;
            let totalCap = 0;
            let hasValid = false;
            for (const m of childMarkers) {
              if (m.parkingFree !== undefined && m.parkingCapacity !== undefined) {
                totalFree += m.parkingFree;
                totalCap += m.parkingCapacity;
                hasValid = true;
              }
            }
            if (hasValid && totalCap > 0) labelText = `${totalFree}/${totalCap}`;
          }
          return L.divIcon({
            html: createClusterContent(childMarkers.map(m => m.categoryColor), cluster.getChildCount(), labelText),
            className: "map-cluster-icon", iconSize: [44, 44], iconAnchor: [22, 22],
          });
        },
      });
      const tempGroup = L.layerGroup();
      const heatmap = new TemperatureHeatmapLayer([]);
      heatmapRef.current = heatmap;
      tempPinsGroupRef.current = tempGroup;

      if (mode === "temperature") {
        map.addLayer(heatmap);
        map.addLayer(tempGroup);
      } else {
        map.addLayer(group);
      }
      prevModeRef.current = mode;

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
      tempPinsGroupRef.current = null;
      heatmapRef.current = null;
      currentMarkers.clear();
    };
  }, []);

  // Reconcile only changed inventory/icons. Selecting a station does not rebuild layers.
  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    const tempGroup = tempPinsGroupRef.current;
    const heatmap = heatmapRef.current;
    if (!ready || !map || !group || !tempGroup || !heatmap) return;

    const isTempMode = mode === "temperature";
    const modeChanged = prevModeRef.current !== mode;
    if (modeChanged) {
      if (isTempMode) {
        group.clearLayers();
        if (map.hasLayer(group)) map.removeLayer(group);
        if (!map.hasLayer(heatmap)) map.addLayer(heatmap);
        if (!map.hasLayer(tempGroup)) map.addLayer(tempGroup);
      } else {
        tempGroup.clearLayers();
        if (map.hasLayer(heatmap)) map.removeLayer(heatmap);
        if (map.hasLayer(tempGroup)) map.removeLayer(tempGroup);
        if (!map.hasLayer(group)) map.addLayer(group);
      }
      prevModeRef.current = mode;
    }

    const ids = new Set(nodes.map(n => n.id));
    for (const [id, marker] of markers.current) {
      if (!ids.has(id)) {
        group.removeLayer(marker);
        tempGroup.removeLayer(marker);
        markers.current.delete(id);
      }
    }

    const tempPoints: TemperaturePoint[] = [];
    const groupToAdd: ColoredMarker[] = [];
    const tempGroupToAdd: ColoredMarker[] = [];

    for (const node of nodes) {
      const category = markerCategory(node, categories);
      const reading = primaryReading(node, category, mode);
      const state = readingFreshness(reading, now);
      const muted = state === "stale" || state === "unknown";
      const color = isTempMode ? muted ? "#94a3b8" : temperatureColor(reading!.value) : CATEGORIES[category].color;

      if (isTempMode && reading && Number.isFinite(reading.value) && state === "fresh") {
        tempPoints.push({ lat: node.lat, lng: node.lng, temp: reading.value });
      }

      const icon = isTempMode
        ? L.divIcon({
            html: createTempPinContent(color, muted, zoom >= 15 ? valueLabel(reading, node.readings) : ""),
            className: `map-sensor-icon${node.id === selectedRef.current ? " map-sensor-selected" : ""}`,
            iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -10],
          })
        : L.divIcon({
            html: createMarkerContent(category, color, muted, zoom >= 16 ? valueLabel(reading, node.readings) : ""),
            className: `map-sensor-icon${node.id === selectedRef.current ? " map-sensor-selected" : ""}`,
            iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -20],
          });

      let marker = markers.current.get(node.id);
      if (!marker) {
        marker = L.marker([node.lat, node.lng], { icon, title: node.name, alt: node.name, keyboard: true }) as ColoredMarker;
        marker.on("click", () => onSelectRef.current(node.id));
        markers.current.set(node.id, marker);
      } else {
        marker.setIcon(icon);
        if (!marker.getLatLng().equals([node.lat, node.lng])) marker.setLatLng([node.lat, node.lng]);
      }

      marker.categoryColor = isTempMode ? "#94a3b8" : CATEGORIES[category].color;
      marker.isParking = category === "parking";
      if (category === "parking") {
        const free = node.readings.find(r => r.metric === "parking_free");
        const cap = node.readings.find(r => r.metric === "parking_capacity");
        const occ = node.readings.find(r => r.metric === "parking_occupied");
        const total = cap?.value ?? (free && occ ? free.value + occ.value : undefined);
        marker.parkingFree = free?.value;
        marker.parkingCapacity = total;
      }

      const tooltip = document.createElement("span");
      const label = valueLabel(reading, node.readings);
      tooltip.textContent = label ? `${node.name} · ${label}` : node.name;
      if (marker.getTooltip()) marker.setTooltipContent(tooltip);
      else marker.bindTooltip(tooltip, { direction: "top", offset: isTempMode ? [0, -10] : [0, -16] });

      const popup = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = node.name;
      const tags = document.createElement("p"); tags.textContent = node.categories.map(c => CATEGORIES[c].label).join(" · ");
      const value = document.createElement("p"); value.textContent = valueLabel(reading, node.readings) || "Keine Messdaten";
      value.className = "map-popup-value";
      const time = document.createElement("p"); time.textContent = observationLabel(reading, now);
      const parking = parkingSummary(node.readings);
      popup.append(title, tags);
      if (reading?.metric.startsWith("traffic_")) {
        const label = document.createElement("p");
        label.textContent = metricLabel(reading);
        popup.append(label);
      }
      if (!parking || !reading?.metric.startsWith("parking_")) popup.append(value, time);
      if (parking) {
        const summary = document.createElement("p");
        summary.className = "map-popup-value";
        summary.textContent = parking.summary;
        popup.append(summary);
        for (const detail of parking.details) {
          const line = document.createElement("p");
          line.textContent = detail;
          popup.append(line);
        }
        const labels: Record<string, string> = { parking_free: "Freie Plätze", parking_occupied: "Belegte Plätze", parking_capacity: "Gesamtzahl" };
        const sameTime = new Set(parking.observations.map(r => Date.parse(r.timestamp))).size === 1;
        for (const observation of sameTime ? parking.observations.slice(0, 1) : parking.observations) {
          const line = document.createElement("p");
          line.textContent = sameTime ? observationLabel(observation, now) :
            `${labels[observation.metric]}: ${observation.value.toLocaleString("de-DE")} · ${observationLabel(observation, now)}`;
          popup.append(line);
        }
      }
      if (marker.getPopup()) marker.setPopupContent(popup);
      else marker.bindPopup(popup, { autoPanPaddingTopLeft: L.point(15, 65), autoPanPaddingBottomRight: L.point(15, 15), maxHeight: 300 });

      if (isTempMode) {
        if (!tempGroup.hasLayer(marker)) tempGroupToAdd.push(marker);
      } else {
        if (!group.hasLayer(marker)) groupToAdd.push(marker);
      }
    }

    if (isTempMode) {
      heatmap.setPoints(tempPoints);
      for (const m of tempGroupToAdd) tempGroup.addLayer(m);
    } else {
      heatmap.setPoints([]);
      if (groupToAdd.length > 0) group.addLayers(groupToAdd);
      group.refreshClusters();
    }
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
      if (mode === "category") {
        groupRef.current?.zoomToShowLayer(marker, () => {
          if (selectedRef.current !== selectedNodeId) return;
          marker.getElement()?.classList.add("map-sensor-selected");
          marker.openPopup();
        });
      } else {
        mapRef.current?.panTo(marker.getLatLng());
        marker.getElement()?.classList.add("map-sensor-selected");
        marker.openPopup();
      }
    }
  }, [selectedNodeId, ready, mode]);


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
