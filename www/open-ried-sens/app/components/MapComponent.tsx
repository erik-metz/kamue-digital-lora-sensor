"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { createMarkerContent, createClusterContent } from "@/lib/mapMarker";
import "./map.css";
import { motionPoint, nextMotion, MOVEMENT_POLL_MS, type MarkerMotion } from "@/lib/mapMotion";
import { detailCard, featureCard, mapSymbol, placeMarker } from "@/lib/mapPresentation";
import { useEffect, useRef, useState } from "react";
import type { GeoJsonObject } from "geojson";
import { CATEGORIES, markerCategory, readingFreshness, primaryReading, valueLabel, observationLabel, type Category, type MapMode, type SensorNode } from "@/lib/mapData";
import { TemperatureHeatmapLayer } from "@/lib/temperatureHeatmap";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, DEFAULT_MAP_LAYERS, type MapLayerId } from "@/lib/urlState";

export type { SensorNode } from "@/lib/mapData";
interface MapProps {
  nodes: SensorNode[];
  selectedNodeId: string | undefined;
  onSelectNode: (id: string) => void;
  categories: Category[];
  mode: MapMode;
  now: number;
  initialCenter?: [number, number];
  initialZoom?: number;
  layers?: Record<MapLayerId, boolean>;
  onViewportChange?: (center: [number, number], zoom: number) => void;
  onLayerToggle?: (layerId: MapLayerId, enabled: boolean) => void;
  onOpenLayersDrawer?: () => void;
  onActiveClosuresCountChange?: (count: number) => void;
}
interface Position {
  id: string; kind: "bus" | "train" | "waste"; latitude: number; longitude: number;
  timestamp: string; valid_until: string; basis: "observed" | "schedule_prediction";
  line?: string; destination?: string; speed_kmh?: number; geometry_basis?: string; delay_basis?: string; delay_seconds?: number;
}
interface LayerPublication {
  layers: Partial<Record<MapLayerId, GeoJsonObject>>;
  unavailable: string[];
}

function textPopup(lines: string[]) {
  return detailCard(lines[0] ?? "Details", lines[1] ?? "", lines.slice(2));
}

export default function MapComponent(props: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const vehicleGroup = useRef<L.LayerGroup | null>(null);
  const vehicleMotions = useRef(new Map<string, MarkerMotion>());
  const vehicleIcons = useRef(new Map<string, string>());
  const vehicleMarkers = useRef(new Map<string, L.Marker>());
  const callbacks = useRef(props);
  useEffect(() => { callbacks.current = props; });
  const [ready, setReady] = useState(false);
  const [clusteringReady, setClusteringReady] = useState(false);
  const freshnessMinute = Math.floor(props.now / 60000);
  useEffect(() => {
    let active = true;
    (window as typeof window & { L: typeof L }).L = L;
    void import("leaflet.markercluster").then(() => { if (active) setClusteringReady(true); });
    return () => { active = false; };
  }, []);
  const [positions, setPositions] = useState<Position[]>([]);
  const [publication, setPublication] = useState<LayerPublication>({ layers: {}, unavailable: [] });
  const [movementFailed, setMovementFailed] = useState(false);
  const [layersFailed, setLayersFailed] = useState(false);
  const [tilesMissing, setTilesMissing] = useState(false);
  const layers = props.layers ?? DEFAULT_MAP_LAYERS;

  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current, {
      center: callbacks.current.initialCenter ?? DEFAULT_MAP_CENTER,
      zoom: callbacks.current.initialZoom ?? DEFAULT_MAP_ZOOM,
      minZoom: 8, maxBounds: [[49.40, 8.10], [49.95, 8.85]], maxBoundsViscosity: .5,
    });
    map.current = instance;
    const base = L.tileLayer("/api/map-tiles/base/{z}/{x}/{y}.png", {
      maxZoom: 19, maxNativeZoom: 14, minZoom: 8, bounds: [[49.55, 8.30], [49.80, 8.65]],
      attribution: '© <a href="https://www.bkg.bund.de">BKG</a> · <a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a> · <a href="https://sgx.geodatenzentrum.de/web_public/Datenquellen_TopPlus_Open.pdf">Datenquellen</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>',
    }).addTo(instance);
    base.on("tileerror", () => setTilesMissing(true));
    instance.on("moveend", () => {
      const center = instance.getCenter();
      callbacks.current.onViewportChange?.([center.lat, center.lng], instance.getZoom());
    });
    setReady(true);
    return () => { instance.remove(); map.current = null; };
  }, []);

  // One batch for all vehicles, no browser simulator and no per-vehicle requests.
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!document.hidden) {
        try {
          const response = await fetch("/api/mobility", { signal: controller.signal });
          if (!response.ok) throw new Error("Unavailable");
          const body = await response.json();
          if (!Array.isArray(body.positions)) throw new Error("Invalid response");
          if (!controller.signal.aborted) { setPositions(body.positions); setMovementFailed(false); }
        } catch {
          if (!controller.signal.aborted) { setPositions([]); setMovementFailed(true); }
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, MOVEMENT_POLL_MS);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (!document.hidden) {
        try {
          const response = await fetch("/api/map-layers", { signal: controller.signal });
          if (!response.ok) throw new Error("Unavailable");
          const body = await response.json();
          if (!body.layers || !Array.isArray(body.unavailable)) throw new Error("Invalid response");
          if (!controller.signal.aborted) { setPublication(body); setLayersFailed(false); }
        } catch {
          if (!controller.signal.aborted) { setPublication({ layers: {}, unavailable: [] }); setLayersFailed(true); }
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 60000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;
    const group = L.layerGroup().addTo(instance);
    const cluster = clusteringReady ? L.markerClusterGroup({ maxClusterRadius: 55, showCoverageOnHover: false,
      iconCreateFunction: item => L.divIcon({ html: createClusterContent(item.getAllChildMarkers().map(marker => (marker.options as L.MarkerOptions & { categoryColor?: string }).categoryColor ?? "#94a3b8"), item.getChildCount()), className: "map-cluster-icon", iconSize: [44, 44] }),
    }).addTo(group) : group;
    const points: { lat: number; lng: number; temp: number }[] = [];
    for (const node of props.nodes) {
      const category = markerCategory(node, props.categories);
      if (!category || !props.categories.includes(category)) continue;
      const reading = primaryReading(node, category, props.mode);
      const fresh = readingFreshness(reading, freshnessMinute * 60000) === "fresh";
      if (props.mode === "temperature") {
        if (!reading || !["temperature", "soil_temperature"].includes(reading.metric)) continue;
        if (fresh) points.push({ lat: node.lat, lng: node.lng, temp: reading.value });
      }
      const marker = L.marker([node.lat, node.lng], {
        title: node.name, alt: node.name, keyboard: true,
        ...{ categoryColor: CATEGORIES[category].color },
        icon: L.divIcon({ html: createMarkerContent(category, CATEGORIES[category].color, !fresh),
          className: `map-sensor-icon${node.id === props.selectedNodeId ? " map-sensor-selected" : ""}`,
          iconSize: [32,32], iconAnchor: [16,16] }),
      }).addTo(cluster);
      marker.bindTooltip(textPopup([node.name, ...(reading ? [valueLabel(reading, node.readings)] : ["Keine Messwerte"])]));
      marker.bindPopup(detailCard(node.name, node.categories.map(id => CATEGORIES[id].label).join(" · "), [
        ...(node.address ? [node.address] : []),
        ...node.readings.map(item => `${valueLabel(item, node.readings)} · ${observationLabel(item, freshnessMinute * 60000)}`),
        ...(!node.readings.length ? ["Keine Messwerte verfügbar."] : []),
      ]), { maxHeight: 260, maxWidth: 260, autoPanPadding: L.point(20, 40) });
      marker.on("click", () => callbacks.current.onSelectNode(node.id));
      if (node.id === props.selectedNodeId) marker.openPopup();
    }
    const heatmap = props.mode === "temperature" ? new TemperatureHeatmapLayer().addTo(instance) : null;
    heatmap?.setPoints(points);
    return () => { group.remove(); heatmap?.remove(); };
  }, [ready, clusteringReady, props.nodes, props.categories, props.mode, props.selectedNodeId, freshnessMinute]);

  useEffect(() => {
    if (!ready || !map.current) return;
    const group = clusteringReady ? L.markerClusterGroup({ maxClusterRadius: 35, disableClusteringAtZoom: 14, showCoverageOnHover: false,
      iconCreateFunction: cluster => L.divIcon({ html: placeMarker("vehicles", String(cluster.getChildCount())), className: "map-vehicle-icon", iconSize: [36, 36] }),
    }) : L.layerGroup();
    group.addTo(map.current);
    vehicleGroup.current = group;
    const markers = vehicleMarkers.current;
    const motions = vehicleMotions.current;
    const icons = vehicleIcons.current;
    return () => { group.remove(); markers.clear(); motions.clear(); icons.clear(); vehicleGroup.current = null; };
  }, [ready, clusteringReady]);

  // Retain marker instances and open dialogs across backend snapshots.
  // Animate only between received coordinates; never extrapolate a route in the browser.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    const retained = new Set<string>();
    const motions = vehicleMotions.current;
    const icons = vehicleIcons.current;
    const receivedAt = performance.now();
    for (const position of positions) {
      const enabled = layers[position.kind === "bus" ? "buses" : position.kind === "train" ? "trains" : "waste"];
      if (!enabled || !(Date.parse(position.valid_until) > Date.now()) ||
          !Number.isFinite(Date.parse(position.timestamp)) || !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) continue;
      const key = `${position.kind}:${position.id}`;
      retained.add(key);
      const predicted = position.basis === "schedule_prediction";
      const style = mapSymbol(position.kind);
      const title = `${style.label} ${position.line ?? ""}${position.destination ? ` → ${position.destination}` : ""}`.trim();
      const target = L.latLng(position.latitude, position.longitude);
      let marker = vehicleMarkers.current.get(key);
      const iconKey = `${position.kind}:${position.line ?? ""}:${predicted}`;
      const icon = () => L.divIcon({ html: placeMarker(position.kind, position.line || style.label, predicted),
        className: "map-vehicle-icon", iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -22] });
      if (!marker) {
        marker = L.marker(target, { icon: icon(), title, alt: title, keyboard: true, zIndexOffset: 500 }).addTo(vehicleGroup.current ?? instance);
        vehicleMarkers.current.set(key, marker);
      } else {
        if (icons.get(key) !== iconKey) marker.setIcon(icon());
      }
      icons.set(key, iconKey);
      motions.set(key, nextMotion(motions.get(key), target, Date.parse(position.timestamp), receivedAt));
      const popup = detailCard(`${style.symbol} ${title}`, predicted ? "Fahrplanprognose · keine GPS-Messung" : "Beobachtete Position", [
        ...(position.kind === "waste" && predicted ? ["Modell aus Abfuhrtagen: Straßenstichprobe, angenommene Reihenfolge und Zeiten (07–17 Uhr). Kein identifiziertes Müllfahrzeug."] : []),
        ...(typeof position.speed_kmh === "number" ? [`${predicted ? "Modellierte Geschwindigkeit" : "Geschwindigkeit"}: ${Math.round(position.speed_kmh)} km/h`] : []),
        ...(position.delay_basis === "next_reported_stop_approximation" ? [`Gemeldete Haltestellenverspätung: ${Math.round((position.delay_seconds ?? 0) / 60)} Min. (auf die Fahrt angenähert)`] : []),
        "Darstellung geglättet zwischen empfangenen Positionen (leicht zeitversetzt).",
        `Stand: ${new Date(position.timestamp).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`,
        ...(position.geometry_basis === "stop_to_stop" ? ["Geradlinige Näherung zwischen Haltestellen; keine Streckengeometrie verfügbar."] : []),
      ]);
      if (marker.getPopup()) marker.setPopupContent(popup);
      else marker.bindPopup(popup, { maxHeight: 260, maxWidth: 260, autoPanPadding: L.point(20, 40) });
      const tooltip = detailCard(title, predicted ? "Prognose" : "Beobachtet", []);
      if (marker.getTooltip()) marker.setTooltipContent(tooltip);
      else marker.bindTooltip(tooltip, { direction: "top", offset: [0, -22] });
    }
    for (const [key, marker] of vehicleMarkers.current) {
      if (!retained.has(key)) { vehicleGroup.current?.removeLayer(marker); vehicleMarkers.current.delete(key); motions.delete(key); icons.delete(key); }
    }
    let frame = 0;
    let lastFrame = -Infinity;
    let lastClusterFrame = -Infinity;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    function animate(time: number) {
      if (document.hidden) return;
      if (time - lastFrame < 1000 / 30) { frame = requestAnimationFrame(animate); return; }
      lastFrame = time;
      let moving = false;
      const refreshClusters = time - lastClusterFrame >= 1000;
      const bounds = instance!.getBounds().pad(.1);
      for (const [key, motion] of motions) {
        const marker = vehicleMarkers.current.get(key);
        if (!marker) continue;
        const complete = reducedMotion.matches || time >= motion.startedAt + motion.duration;
        moving ||= !complete;
        // Clustered/offscreen markers need only coarse updates; visible vehicles get 30 fps.
        if (!complete && !refreshClusters && (!marker.getElement() || !bounds.contains(marker.getLatLng()))) continue;
        const point = complete ? motion.to : motionPoint(motion, time);
        if (!marker.getLatLng().equals(point)) marker.setLatLng(point);
      }
      if (refreshClusters) lastClusterFrame = time;
      if (moving) frame = requestAnimationFrame(animate);
    }
    function resume() { cancelAnimationFrame(frame); if (!document.hidden) frame = requestAnimationFrame(animate); }
    resume();
    document.addEventListener("visibilitychange", resume);
    reducedMotion.addEventListener("change", resume);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", resume);
      reducedMotion.removeEventListener("change", resume);
    };
  }, [ready, clusteringReady, positions, layers]);

  useEffect(() => {
    for (const position of positions) {
      if (!(Date.parse(position.valid_until) > props.now)) {
        const key = `${position.kind}:${position.id}`;
        const marker = vehicleMarkers.current.get(key);
        if (marker) vehicleGroup.current?.removeLayer(marker);
        vehicleMarkers.current.delete(key);
        vehicleMotions.current.delete(key);
        vehicleIcons.current.delete(key);
      }
    }
  }, [positions, props.now]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    const group = L.layerGroup().addTo(instance);
    let closures = 0;
    const requests = new Set<AbortController>();
    for (const [id, geometry] of Object.entries(publication.layers)) {
      if (!layers[id as MapLayerId]) continue;
      const pointGroup = clusteringReady ? L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 16, showCoverageOnHover: false,
        iconCreateFunction: cluster => L.divIcon({ html: placeMarker(id, String(cluster.getChildCount())), className: "map-place-icon", iconSize: [36, 36] }),
      }).addTo(group) : group;
      L.geoJSON(geometry as GeoJsonObject, {
        style: { color: mapSymbol(id).color, weight: 3, fillOpacity: .15 },
        pointToLayer: (feature, latlng) => L.marker(latlng, {
          title: String(feature.properties?.name ?? mapSymbol(id).label),
          keyboard: true,
          icon: L.divIcon({ html: placeMarker(id), className: "map-place-icon", iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20] }),
        }),
        onEachFeature: (feature, layer) => {
          const values = feature.properties ?? {};
          if (id === "stops" && typeof values.stop_id === "string" && typeof values.source_id === "string") {
            layer.bindPopup(textPopup([String(values.name ?? "Haltestelle"), "Abfahrten werden geladen …"]));
            let pending: AbortController | undefined;
            layer.on("popupopen", async () => {
              pending?.abort();
              const controller = new AbortController();
              pending = controller;
              requests.add(controller);
              try {
                const response = await fetch(`/api/buses/stops/${encodeURIComponent(values.stop_id)}/departures?source=${encodeURIComponent(values.source_id)}`, { signal: controller.signal });
                if (!response.ok) throw new Error("Unavailable");
                const body = await response.json();
                if (!Array.isArray(body.departures)) throw new Error("Invalid departures");
                if (!controller.signal.aborted) layer.setPopupContent(textPopup([
                  String(values.name ?? "Haltestelle"), "Gespeicherter Fahrplan / gemeldete Verspätungen",
                  ...body.departures.map((departure: { line: string; destination: string; expected_at: string; delay_basis: string }) =>
                    `${new Date(departure.expected_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} · ${departure.line} → ${departure.destination}${departure.delay_basis === "schedule_only" ? " (Fahrplan)" : " (Prognose)"}`),
                  ...(body.departures.length ? [] : ["Keine bevorstehenden Abfahrten im gespeicherten Fahrplan."]),
                ]));
              } catch {
                if (!controller.signal.aborted) layer.setPopupContent(textPopup([String(values.name ?? "Haltestelle"), "Abfahrten nicht verfügbar."]));
              } finally { requests.delete(controller); }
            });
            layer.on("popupclose", () => pending?.abort());
            return;
          }
          layer.bindPopup(featureCard(id, values), { maxHeight: 260, maxWidth: 260, autoPanPadding: L.point(20, 40) });
          layer.bindTooltip(detailCard(String(values.name ?? values.title ?? mapSymbol(id).label), mapSymbol(id).label, []));
          if (id === "closures") closures++;
        },
      }).addTo(pointGroup);
    }
    if (layers.starkregen) L.tileLayer("/api/map-tiles/rain/{z}/{x}/{y}.png", { opacity: .5 }).addTo(group);
    callbacks.current.onActiveClosuresCountChange?.(closures);
    return () => { requests.forEach(controller => controller.abort()); group.remove(); };
  }, [ready, clusteringReady, publication, layers]);

  const missing = publication.unavailable.filter(id => layers[id as MapLayerId]);
  return <div className="relative h-full min-h-[500px] w-full">
    <div ref={container} className="sensor-map h-full min-h-[500px] w-full" aria-label="Karte mit gespeicherten Quelldaten" />
    <div className="absolute bottom-5 left-3 z-[500] max-w-sm rounded bg-slate-950/90 p-3 text-xs text-slate-200">
      <details><summary className="cursor-pointer font-semibold">Symbole & Hinweise</summary>
      <p className="mt-1">🚌 Bus · 🚆 Zug · 🚛 Abfallsammlung</p>
      <p>Ⓗ Haltestelle · ⚡ Ladestation</p>
      <p className="mt-1">Symbol anklicken für Details und Abfahrten.</p>
      <p className="mt-1 text-slate-400">Gestrichelter Rand: Prognose · Durchgehend: beobachtet (Fahrzeuge)</p>
      </details>
      {movementFailed && <p role="status">Bewegungsdaten nicht verfügbar.</p>}
      {(layersFailed || missing.length > 0) && <p role="status">Einige Kartenebenen sind noch nicht verfügbar.</p>}
      {tilesMissing && <p role="status">Hintergrundkarten sind noch nicht verfügbar.</p>}
      <button className="mt-2 underline" onClick={() => callbacks.current.onOpenLayersDrawer?.()}>Kartenebenen</button>
    </div>
  </div>;
}
