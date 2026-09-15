"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./map.css";
import { metricLabel } from "@/lib/telemetryData";
import { createClusterContent, createMarkerContent, createTempPinContent, createTrainMarkerContent, createLevelCrossingMarkerContent, createWasteTruckMarkerContent } from "@/lib/mapMarker";
import { CATEGORIES, markerCategory, observationLabel, parkingSummary, primaryReading, readingFreshness, temperatureColor, valueLabel, type Category, type MapMode, type SensorNode } from "@/lib/mapData";
import { TemperatureHeatmapLayer, type TemperaturePoint } from "@/lib/temperatureHeatmap";
import { RIEDBAHN_TRACK, NIBELUNGENBAHN_TRACK, calculateRiedMobility } from "@/lib/railMobility";
import { calculateWasteTruckMobility } from "@/lib/wasteTruckMobility";
import { calculateBusMobility, getBusStopDepartures, RIED_BUS_STOPS, type LiveBus, type BusStop } from "@/lib/busMobility";
import { createBusMarkerContent, createBusStopMarkerContent } from "@/lib/mapMarker";
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
  const [showRailMobility, setShowRailMobility] = useState(true);
  const [showWasteTrucks, setShowWasteTrucks] = useState(true);
  const [showBuses, setShowBuses] = useState(true);
  const [showBusStops, setShowBusStops] = useState(true);
  const railTracksGroupRef = useRef<L.LayerGroup | null>(null);
  const trainsGroupRef = useRef<L.LayerGroup | null>(null);
  const crossingsGroupRef = useRef<L.LayerGroup | null>(null);
  const wasteTrucksGroupRef = useRef<L.LayerGroup | null>(null);
  const busesGroupRef = useRef<L.LayerGroup | null>(null);
  const busStopsGroupRef = useRef<L.LayerGroup | null>(null);
  const trainMarkers = useRef(new Map<string, L.Marker>());
  const crossingMarkers = useRef(new Map<string, L.Marker>());
  const wasteTruckMarkers = useRef(new Map<string, L.Marker>());
  const wasteDepotMarkers = useRef(new Map<string, L.Marker>());
  const busMarkers = useRef(new Map<string, L.Marker>());
  const busStopMarkers = useRef(new Map<string, L.Marker>());
  useEffect(() => { onSelectRef.current = onSelectNode; }, [onSelectNode]);


  useEffect(() => {
    let cancelled = false;
    const currentMarkers = markers.current;
    const currentTrainMarkers = trainMarkers.current;
    const currentCrossingMarkers = crossingMarkers.current;
    const currentWasteTruckMarkers = wasteTruckMarkers.current;
    const currentWasteDepotMarkers = wasteDepotMarkers.current;
    const currentBusMarkers = busMarkers.current;
    const currentBusStopMarkers = busStopMarkers.current;
    async function initialize() {
      // MarkerCluster extends the global Leaflet instance. Load only in the browser.
      (window as typeof window & { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelled || !container.current) return;
      const map = L.map(container.current, { center: [49.62, 8.46], zoom: 12, maxZoom: 19 });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
      }).addTo(map);

      // Add Railway tracks in the Ried
      const railTracksGroup = L.layerGroup();
      const riedTrackBg = L.polyline(RIEDBAHN_TRACK, { color: "#334155", weight: 4, opacity: 0.8 });
      const riedTrackDash = L.polyline(RIEDBAHN_TRACK, { color: "#94a3b8", weight: 2, dashArray: "6, 8", opacity: 0.9 });
      const nibTrackBg = L.polyline(NIBELUNGENBAHN_TRACK, { color: "#334155", weight: 4, opacity: 0.8 });
      const nibTrackDash = L.polyline(NIBELUNGENBAHN_TRACK, { color: "#94a3b8", weight: 2, dashArray: "6, 8", opacity: 0.9 });
      railTracksGroup.addLayer(riedTrackBg);
      railTracksGroup.addLayer(riedTrackDash);
      railTracksGroup.addLayer(nibTrackBg);
      railTracksGroup.addLayer(nibTrackDash);

      const trainsGroup = L.layerGroup();
      const crossingsGroup = L.layerGroup();
      const wasteTrucksGroup = L.layerGroup();
      const busesGroup = L.layerGroup();
      const busStopsGroup = L.layerGroup();

      railTracksGroupRef.current = railTracksGroup;
      trainsGroupRef.current = trainsGroup;
      crossingsGroupRef.current = crossingsGroup;
      wasteTrucksGroupRef.current = wasteTrucksGroup;
      busesGroupRef.current = busesGroup;
      busStopsGroupRef.current = busStopsGroup;

      map.addLayer(railTracksGroup);
      map.addLayer(crossingsGroup);
      map.addLayer(trainsGroup);
      map.addLayer(wasteTrucksGroup);
      map.addLayer(busesGroup);
      // Bus stops become visible at zoom >= 13
      if (map.getZoom() >= 13) {
        map.addLayer(busStopsGroup);
      }

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
      railTracksGroupRef.current = null;
      trainsGroupRef.current = null;
      crossingsGroupRef.current = null;
      wasteTrucksGroupRef.current = null;
      busesGroupRef.current = null;
      busStopsGroupRef.current = null;
      currentTrainMarkers.clear();
      currentCrossingMarkers.clear();
      currentWasteTruckMarkers.clear();
      currentWasteDepotMarkers.clear();
      currentBusMarkers.clear();
      currentBusStopMarkers.clear();
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

  // Toggle rail mobility layer visibility
  useEffect(() => {
    const map = mapRef.current;
    const tracks = railTracksGroupRef.current;
    const trains = trainsGroupRef.current;
    const crossings = crossingsGroupRef.current;
    if (!ready || !map || !tracks || !trains || !crossings) return;
    if (showRailMobility) {
      if (!map.hasLayer(tracks)) map.addLayer(tracks);
      if (!map.hasLayer(crossings)) map.addLayer(crossings);
      if (!map.hasLayer(trains)) map.addLayer(trains);
    } else {
      if (map.hasLayer(tracks)) map.removeLayer(tracks);
      if (map.hasLayer(crossings)) map.removeLayer(crossings);
      if (map.hasLayer(trains)) map.removeLayer(trains);
    }
  }, [showRailMobility, ready]);

  // Toggle waste trucks layer visibility
  useEffect(() => {
    const map = mapRef.current;
    const wasteTrucks = wasteTrucksGroupRef.current;
    if (!ready || !map || !wasteTrucks) return;
    if (showWasteTrucks) {
      if (!map.hasLayer(wasteTrucks)) map.addLayer(wasteTrucks);
    } else {
      if (map.hasLayer(wasteTrucks)) map.removeLayer(wasteTrucks);
    }
  }, [showWasteTrucks, ready]);

  // Toggle VRN buses layer visibility
  useEffect(() => {
    const map = mapRef.current;
    const buses = busesGroupRef.current;
    if (!ready || !map || !buses) return;
    if (showBuses) {
      if (!map.hasLayer(buses)) map.addLayer(buses);
    } else {
      if (map.hasLayer(buses)) map.removeLayer(buses);
    }
  }, [showBuses, ready]);

  // Toggle bus stops layer visibility (only visible at zoom >= 13)
  useEffect(() => {
    const map = mapRef.current;
    const busStops = busStopsGroupRef.current;
    if (!ready || !map || !busStops) return;
    const shouldShow = showBusStops && zoom >= 13;
    if (shouldShow) {
      if (!map.hasLayer(busStops)) map.addLayer(busStops);
    } else {
      if (map.hasLayer(busStops)) map.removeLayer(busStops);
    }
  }, [showBusStops, zoom, ready]);

  // Real-time animation loop for trains and crossings in the Ried
  useEffect(() => {
    if (!ready || !showRailMobility) return;

    function updateMobility() {
      const trainsGroup = trainsGroupRef.current;
      const crossingsGroup = crossingsGroupRef.current;
      if (!trainsGroup || !crossingsGroup) return;

      const { trains, crossings } = calculateRiedMobility(Date.now());

      // 1. Update trains in the Ried corridor
      const currentTrainIds = new Set(trains.map(t => t.id));
      for (const [id, marker] of trainMarkers.current) {
        if (!currentTrainIds.has(id)) {
          trainsGroup.removeLayer(marker);
          trainMarkers.current.delete(id);
        }
      }

      for (const train of trains) {
        const icon = L.divIcon({
          html: createTrainMarkerContent({
            line: train.line,
            destination: train.destination,
            status: train.status,
            speedKmh: train.speedKmh,
            currentStationName: train.currentStationName,
            dwellTimeRemainingSec: train.dwellTimeRemainingSec,
            dwellProgress: train.dwellProgress,
          }),
          className: "map-train-icon",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -22],
        });

        let marker = trainMarkers.current.get(train.id);
        if (!marker) {
          marker = L.marker([train.lat, train.lng], { icon, zIndexOffset: 500 });
          marker.bindPopup(() => {
            const container = document.createElement("div");
            container.className = "train-popup-details";
            container.innerHTML = `
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px;">🚅 ${train.line} nach ${train.destination}</div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">Von: ${train.origin} · Strecke: ${train.corridor}</div>
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px; color: ${train.status === 'stopped' ? '#f59e0b' : '#38bdf8'};">
                ${train.status === 'stopped' ? `🚉 Halt am Bahnsteig ${train.currentStationName} (Abfahrt in ${train.dwellTimeRemainingSec ?? 0}s)` : `⚡ In Fahrt (${train.speedKmh} km/h)`}
              </div>
              ${train.approachingCrossingName ? `<div style="font-size: 12px; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 4px 6px; border-radius: 4px; margin-top: 6px;">⚠️ Nähert sich <strong>${train.approachingCrossingName}</strong></div>` : ''}
            `;
            return container;
          });
          trainsGroup.addLayer(marker);
          trainMarkers.current.set(train.id, marker);
        } else {
          marker.setIcon(icon);
          marker.setLatLng([train.lat, train.lng]);
        }
      }

      // 2. Update level crossings
      for (const crossing of crossings) {
        const icon = L.divIcon({
          html: createLevelCrossingMarkerContent({
            name: crossing.name,
            street: crossing.street,
            status: crossing.status,
            nextTrainLine: crossing.nextTrainLine,
            secondsUntilClosure: crossing.secondsUntilClosure,
            secondsUntilClearance: crossing.secondsUntilClearance,
          }),
          className: "map-crossing-icon",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -20],
        });

        let marker = crossingMarkers.current.get(crossing.id);
        if (!marker) {
          marker = L.marker([crossing.lat, crossing.lng], { icon, zIndexOffset: 400 });
          marker.on("click", () => {
            onSelectRef.current(crossing.id);
          });
          marker.bindPopup(() => {
            const container = document.createElement("div");
            const statusText = crossing.status === 'closed'
              ? `<span style="color: #ef4444; font-weight: 700;">🔴 GESCHLOSSEN (Zugdurchfahrt)</span>`
              : crossing.status === 'closing_soon'
              ? `<span style="color: #f59e0b; font-weight: 700;">🟡 SCHLIESST IN ${crossing.secondsUntilClosure ?? 60}s</span>`
              : `<span style="color: #10b981; font-weight: 700;">🟢 OFFEN (Freie Durchfahrt)</span>`;

            container.innerHTML = `
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">🛑 ${crossing.name}</div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${crossing.street} · ${crossing.line}</div>
              <div style="font-size: 13px; margin-bottom: 6px;">${statusText}</div>
              ${crossing.nextTrainLine ? `<div style="font-size: 12px; margin-bottom: 6px;">Nächster Zug: <strong>${crossing.nextTrainLine}</strong> nach <strong>${crossing.nextTrainDestination}</strong></div>` : ''}
              <div style="font-size: 11px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 6px; margin-top: 6px;">
                📊 Statistik: Ø ${crossing.dailyClosureCountAvg} Schließungen/Tag · Ø Schließdauer: ${crossing.avgClosureDurationSec}s<br/>
                ℹ️ ${crossing.note}
              </div>
              <div style="margin-top: 8px;">
                <a href="#messwerte" style="display: block; text-align: center; font-size: 11px; background: #0284c7; color: #fff; padding: 5px 8px; border-radius: 6px; text-decoration: none; font-weight: 600;">📊 Schließungshistorie in Messwerte anzeigen</a>
              </div>
            `;
            return container;
          });
          crossingsGroup.addLayer(marker);
          crossingMarkers.current.set(crossing.id, marker);
        } else {
          marker.setIcon(icon);
        }
      }
    }

    updateMobility();
    const interval = setInterval(updateMobility, 1000);
    return () => clearInterval(interval);
  }, [ready, showRailMobility]);

  // Real-time animation loop for ZAKB waste collection trucks in the Ried
  useEffect(() => {
    if (!ready || !showWasteTrucks) return;

    function updateWasteTrucks() {
      const wasteTrucksGroup = wasteTrucksGroupRef.current;
      if (!wasteTrucksGroup) return;

      const { trucks, depots } = calculateWasteTruckMobility(Date.now());

      // 1. Ensure ZAKB depots are on the map
      for (const depot of depots) {
        if (!wasteDepotMarkers.current.has(depot.id)) {
          const depotIcon = L.divIcon({
            html: `<div class="waste-depot-marker" title="${depot.name}">♻️</div>`,
            className: "map-depot-icon",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
            popupAnchor: [0, -16],
          });
          const marker = L.marker([depot.lat, depot.lng], { icon: depotIcon, zIndexOffset: 300 });
          marker.bindPopup(() => {
            const container = document.createElement("div");
            container.className = "depot-popup-details";
            container.innerHTML = `
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px;">♻️ ${depot.name}</div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${depot.address}</div>
              <div style="font-size: 12px; color: #34d399; margin-bottom: 4px;">Zweckverband Abfallwirtschaft Kreis Bergstraße (ZAKB)</div>
              <div style="font-size: 11px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 4px; margin-top: 4px;">
                ${depot.type === "headquarters_depot" ? "Zentrale Betriebsleitung, Fuhrpark-Stützpunkt & Biomassezentrum" : "Wertstoffhof, Grünschnittannahme & Problemabfall-Sammelstelle"}
              </div>
            `;
            return container;
          });
          wasteTrucksGroup.addLayer(marker);
          wasteDepotMarkers.current.set(depot.id, marker);
        }
      }

      // 2. Update moving waste trucks
      const currentTruckIds = new Set(trucks.map(t => t.id));
      for (const [id, marker] of wasteTruckMarkers.current) {
        if (!currentTruckIds.has(id)) {
          wasteTrucksGroup.removeLayer(marker);
          wasteTruckMarkers.current.delete(id);
        }
      }

      for (const truck of trucks) {
        const icon = L.divIcon({
          html: createWasteTruckMarkerContent({
            fraction: truck.fraction,
            fractionLabel: truck.fractionLabel,
            binColor: truck.binColor,
            accentColor: truck.accentColor,
            licensePlate: truck.licensePlate,
            status: truck.status,
            speedKmh: truck.speedKmh,
            currentStreet: truck.currentStreet,
            nextStreet: truck.nextStreet,
            expectedTimeWindow: truck.expectedTimeWindow,
            loadPercent: truck.loadPercent,
            emptyCountdownSec: truck.emptyCountdownSec,
            emptyProgress: truck.emptyProgress,
          }),
          className: "map-waste-truck-icon",
          iconSize: [38, 38],
          iconAnchor: [19, 19],
          popupAnchor: [0, -22],
        });

        let marker = wasteTruckMarkers.current.get(truck.id);
        if (!marker) {
          marker = L.marker([truck.lat, truck.lng], { icon, zIndexOffset: 450 });
          marker.bindPopup(() => {
            const container = document.createElement("div");
            container.className = "waste-truck-popup-details";
            const statusBadge = truck.status === "bin_emptying"
              ? `<span style="color: #f59e0b; font-weight: 700;">🟡 Leerung / Schüttung aktiv (${truck.emptyCountdownSec ?? 0}s verbleibend)</span>`
              : truck.status === "transit"
              ? `<span style="color: #38bdf8; font-weight: 700;">🔵 Überführung (${truck.speedKmh} km/h)</span>`
              : `<span style="color: #10b981; font-weight: 700;">🟢 Sammelfahrt (${truck.speedKmh} km/h)</span>`;

            container.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <div style="font-weight: 700; font-size: 14px;">🚛 ${truck.name}</div>
                <span style="font-size: 11px; background: #334155; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #f8fafc;">${truck.licensePlate}</span>
              </div>
              <div style="font-size: 12px; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                <span style="background: ${truck.binColor}; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 9999px;">${truck.fractionLabel}</span>
                <span style="color: #94a3b8;">${truck.vehicleModel}</span>
              </div>
              <div style="font-size: 13px; margin-bottom: 6px;">${statusBadge}</div>
              <div style="font-size: 12px; margin-bottom: 3px;">📍 Aktuell: <strong>${truck.currentStreet}</strong></div>
              <div style="font-size: 12px; margin-bottom: 3px;">⏭️ Nächste Station: <strong>${truck.nextStreet}</strong></div>
              <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 8px;">⏰ Erwartetes Zeitfenster: <strong>${truck.expectedTimeWindow}</strong></div>
              
              <div style="background: #1e293b; border-radius: 6px; padding: 6px; margin-bottom: 6px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px;">
                  <span style="color: #94a3b8;">Ladekapazität</span>
                  <span style="font-weight: 700; color: #f8fafc;">${truck.loadPercent}% voll</span>
                </div>
                <div style="width: 100%; height: 6px; background: #334155; border-radius: 3px; overflow: hidden;">
                  <div style="width: ${truck.loadPercent}%; height: 100%; background: ${truck.binColor}; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
              </div>

              <div style="font-size: 11px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 6px; margin-top: 6px;">
                ℹ️ ${truck.predictionBasis}<br/>
                Zweckverband Abfallwirtschaft Kreis Bergstraße (ZAKB)
              </div>
            `;
            return container;
          });
          wasteTrucksGroup.addLayer(marker);
          wasteTruckMarkers.current.set(truck.id, marker);
        } else {
          marker.setIcon(icon);
          marker.setLatLng([truck.lat, truck.lng]);
        }
      }
    }

    updateWasteTrucks();
    const interval = setInterval(updateWasteTrucks, 1000);
    return () => clearInterval(interval);
  }, [ready, showWasteTrucks]);

  // Initialize and populate bus stops in the Ried
  useEffect(() => {
    if (!ready) return;
    const busStopsGroup = busStopsGroupRef.current;
    if (!busStopsGroup) return;

    for (const stop of RIED_BUS_STOPS) {
      if (!busStopMarkers.current.has(stop.id)) {
        const icon = L.divIcon({
          html: createBusStopMarkerContent({
            name: stop.name,
            lines: stop.lines,
            isSchoolStop: stop.isSchoolStop,
            isTrainHub: stop.isTrainHub,
          }),
          className: "map-bus-stop-icon",
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          popupAnchor: [0, -14],
        });

        const marker = L.marker([stop.lat, stop.lng], { icon, zIndexOffset: 200 });
        const tooltip = document.createElement("span");
        tooltip.textContent = stop.isSchoolStop ? `🎒 ${stop.name} (Schulbushaltestelle)` : `🚏 ${stop.name}`;
        marker.bindTooltip(tooltip, { direction: "top", offset: [0, -12] });

        marker.bindPopup(() => {
          const container = document.createElement("div");
          container.className = "bus-stop-popup-details";
          const departures = getBusStopDepartures(stop.id, Date.now());

          let departureRowsHtml = "";
          if (departures.length === 0) {
            departureRowsHtml = `<tr><td colspan="4" style="text-align: center; color: #94a3b8; padding: 8px;">Keine anstehenden Abfahrten</td></tr>`;
          } else {
            for (const dep of departures) {
              const lineClass = dep.isSchoolBus ? "bus-line-pill bus-line-pill-school" : "bus-line-pill";
              departureRowsHtml += `
                <tr>
                  <td style="font-weight: 700; white-space: nowrap;">${dep.scheduledTime}</td>
                  <td><span class="${lineClass}">${dep.isSchoolBus ? "🎒 " : ""}${dep.line}</span></td>
                  <td style="max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${dep.destination}</td>
                  <td style="white-space: nowrap; font-weight: 600; color: ${dep.estimatedTime.includes("Jetzt") || dep.estimatedTime.includes("in ") ? "#38bdf8" : "#94a3b8"};">${dep.estimatedTime}</td>
                </tr>
              `;
            }
          }

          container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 18px;">🚏</span>
              <div>
                <div style="font-weight: 700; font-size: 14px; color: #f8fafc;">${stop.name}</div>
                <div style="font-size: 11px; color: #94a3b8;">${stop.municipality} · ${stop.platforms?.join(", ") ?? "Haltestelle"}</div>
              </div>
            </div>

            ${stop.isSchoolStop ? `
              <div style="font-size: 11px; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 4px 6px; border-radius: 4px; margin-bottom: 6px; color: #fbbf24;">
                🎒 <strong>Schulbushaltestelle</strong> für ${stop.nearbySchoolName ?? "Schulzentrum"}
              </div>
            ` : ""}

            ${stop.isTrainHub ? `
              <div style="font-size: 11px; background: rgba(2, 132, 199, 0.15); border: 1px solid #0284c7; padding: 4px 6px; border-radius: 4px; margin-bottom: 6px; color: #38bdf8;">
                🚉 <strong>Umsteigeknoten Bahn ↔ Bus</strong> (Riedbahn & Nibelungenbahn)
              </div>
            ` : ""}

            <div style="font-size: 11px; font-weight: 600; color: #cbd5e1; margin-top: 4px;">
              Bediente Linien: ${stop.lines.map(l => `<span class="bus-line-pill" style="margin-right: 4px; font-size: 10px;">${l}</span>`).join("")}
            </div>

            <div style="margin-top: 8px; border-top: 1px solid #334155; padding-top: 6px;">
              <div style="font-size: 12px; font-weight: 700; color: #e2e8f0; margin-bottom: 4px;">Abfahrtsmonitor (Echtzeit):</div>
              <table class="bus-departure-table">
                <thead>
                  <tr>
                    <th>Abfahrt</th>
                    <th>Linie</th>
                    <th>Richtung</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${departureRowsHtml}
                </tbody>
              </table>
            </div>
          `;
          return container;
        });

        busStopsGroup.addLayer(marker);
        busStopMarkers.current.set(stop.id, marker);
      }
    }
  }, [ready]);

  // Real-time animation loop for VRN buses in the Ried
  useEffect(() => {
    if (!ready || !showBuses) return;

    function updateBuses() {
      const busesGroup = busesGroupRef.current;
      if (!busesGroup) return;

      const { buses } = calculateBusMobility(Date.now());

      // 1. Remove markers of buses no longer active
      const currentBusIds = new Set(buses.map(b => b.id));
      for (const [id, marker] of busMarkers.current) {
        if (!currentBusIds.has(id)) {
          busesGroup.removeLayer(marker);
          busMarkers.current.delete(id);
        }
      }

      // 2. Update active buses
      for (const bus of buses) {
        const icon = L.divIcon({
          html: createBusMarkerContent({
            line: bus.line,
            destination: bus.destination,
            status: bus.status,
            speedKmh: bus.speedKmh,
            currentStopName: bus.currentStopName,
            dwellTimeRemainingSec: bus.dwellTimeRemainingSec,
            dwellProgress: bus.dwellProgress,
            isSchoolBus: bus.isSchoolBus,
            delayMinutes: bus.delayMinutes,
            wheelchairAccessible: bus.wheelchairAccessible,
          }),
          className: "map-bus-icon",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        let marker = busMarkers.current.get(bus.id);
        if (!marker) {
          marker = L.marker([bus.lat, bus.lng], { icon, zIndexOffset: 450 });
          marker.bindPopup(() => {
            const container = document.createElement("div");
            container.className = "bus-popup-details";
            container.innerHTML = `
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: ${bus.isSchoolBus ? "#fbbf24" : "#38bdf8"};">
                🚌 ${bus.isSchoolBus ? "🎒 Schulbus " : "Linie "}${bus.line} nach ${bus.destination}
              </div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
                Start: ${bus.origin} · Betreiber: ${bus.operator}
              </div>

              ${bus.isSchoolBus && bus.schoolBusReason ? `
                <div style="font-size: 12px; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 4px 6px; border-radius: 4px; margin-bottom: 6px; color: #fbbf24;">
                  🎒 <strong>${bus.schoolBusReason}</strong>
                </div>
              ` : ""}

              <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px; color: ${bus.status === 'stopped' ? '#f59e0b' : '#38bdf8'};">
                ${bus.status === 'stopped'
                  ? `🚏 Halt an Haltestelle <strong>${bus.currentStopName}</strong> (Abfahrt in ${bus.dwellTimeRemainingSec ?? 0}s)`
                  : `⚡ In Fahrt (${bus.speedKmh} km/h) → Nächster Halt: ${bus.nextStopName ?? "Planmäßig"}`}
              </div>

              <div style="font-size: 12px; margin-top: 4px; margin-bottom: 4px;">
                Pünktlichkeit: ${bus.delayMinutes > 0
                  ? `<span style="color: #ef4444; font-weight: 700;">⚠️ +${bus.delayMinutes} Min Verspätung</span>`
                  : `<span style="color: #10b981; font-weight: 700;">✅ Pünktlich nach Fahrplan</span>`}
                · ♿ Niederflur (barrierefrei)
              </div>

              ${bus.approachingCrossingWarning ? `
                <div style="font-size: 12px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; padding: 4px 6px; border-radius: 4px; margin-top: 6px; color: #fca5a5;">
                  ${bus.approachingCrossingWarning}
                </div>
              ` : ""}

              ${bus.intermodalConnectionInfo ? `
                <div style="font-size: 12px; background: rgba(2, 132, 199, 0.15); border: 1px solid #0284c7; padding: 4px 6px; border-radius: 4px; margin-top: 6px; color: #38bdf8;">
                  ${bus.intermodalConnectionInfo}
                </div>
              ` : ""}
            `;
            return container;
          });
          busesGroup.addLayer(marker);
          busMarkers.current.set(bus.id, marker);
        } else {
          marker.setIcon(icon);
          marker.setLatLng([bus.lat, bus.lng]);
        }
      }
    }

    updateBuses();
    const interval = setInterval(updateBuses, 1000);
    return () => clearInterval(interval);
  }, [ready, showBuses]);

  return <div className="sensor-map relative w-full h-[480px] sm:h-[560px] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
    <div ref={container} className="w-full h-full z-0" aria-label="Sensorstandorte, gruppiert nach Nähe" />
    {failed ? <p role="alert" className="absolute inset-0 bg-slate-900 p-8">Die Karte konnte nicht geladen werden. Bitte lade die Seite erneut.</p> : null}
    <div className="absolute top-3 right-3 z-[400] flex flex-wrap justify-end gap-2">
      <button
        type="button"
        className={`map-control ${showBuses ? "border-sky-500 text-sky-300 font-semibold" : "opacity-60"}`}
        onClick={() => setShowBuses(prev => !prev)}
        title="VRN Busse im Ried ein-/ausblenden"
      >
        🚌 Busse {showBuses ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showBusStops && zoom >= 13 ? "border-amber-500 text-amber-300 font-semibold" : "opacity-60"}`}
        onClick={() => setShowBusStops(prev => !prev)}
        title={zoom < 13 ? "Haltestellen ab Zoomstufe 13 sichtbar (aktuell: Zoom " + zoom + ")" : "VRN Haltestellen ein-/ausblenden"}
      >
        🚏 Haltestellen {showBusStops ? (zoom >= 13 ? "An" : "Zoom ≥13") : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showWasteTrucks ? "border-emerald-500 text-emerald-300 font-semibold" : "opacity-60"}`}
        onClick={() => setShowWasteTrucks(prev => !prev)}
        title="ZAKB Müllabfuhr im Ried ein-/ausblenden"
      >
        🚛 Müllabfuhr {showWasteTrucks ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showRailMobility ? "border-sky-500 text-sky-300 font-semibold" : "opacity-60"}`}
        onClick={() => setShowRailMobility(prev => !prev)}
        title="Züge und Bahnübergänge im Ried ein-/ausblenden"
      >
        🚅 Züge & BÜ {showRailMobility ? "An" : "Aus"}
      </button>
      <button type="button" className="map-control" onClick={() => mapRef.current?.setView([49.62, 8.46], 12)}>Ried</button>
      <button type="button" className="map-control" disabled={!nodes.length} onClick={() => {
        if (nodes.length) mapRef.current?.fitBounds(L.latLngBounds(nodes.map(n => [n.lat, n.lng])), { padding: [45, 45], maxZoom: 15 });
      }}>Alle Standorte</button>
    </div>
    {!nodes.length && ready ? <p className="absolute bottom-8 left-3 right-3 z-[400] rounded-xl bg-slate-950/95 p-4 text-sm text-slate-200">Keine Standorte für diese Auswahl. Wähle eine weitere Gruppe oder „Alle“.</p> : null}
  </div>;
}

