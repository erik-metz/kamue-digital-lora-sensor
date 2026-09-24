"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { createMarkerContent, createClusterContent } from "@/lib/mapMarker";
import "./map.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJsonObject } from "geojson";
import { CATEGORIES, markerCategory, readingFreshness, primaryReading, valueLabel, type Category, type MapMode, type SensorNode } from "@/lib/mapData";
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
  const element = document.createElement("div");
  for (const line of lines) {
    const row = document.createElement("div");
    row.textContent = line;
    element.append(row);
  }
  return element;
}

export default function MapComponent(props: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
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
      minZoom: 8, maxBounds: [[49.55, 8.30], [49.80, 8.65]], maxBoundsViscosity: 1,
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
      if (!controller.signal.aborted) timer = setTimeout(poll, 10000);
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
      iconCreateFunction: item => L.divIcon({ html: createClusterContent(["#34d399"], item.getChildCount()), className: "map-cluster-icon", iconSize: [44, 44] }),
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
        icon: L.divIcon({ html: createMarkerContent(category, CATEGORIES[category].color, !fresh),
          className: `map-sensor-icon${node.id === props.selectedNodeId ? " map-sensor-selected" : ""}`,
          iconSize: [32,32], iconAnchor: [16,16] }),
      }).addTo(cluster);
      marker.bindTooltip(textPopup([node.name, ...(reading ? [valueLabel(reading, node.readings)] : ["Keine Messwerte"])]));
      marker.on("click", () => callbacks.current.onSelectNode(node.id));
    }
    const heatmap = props.mode === "temperature" ? new TemperatureHeatmapLayer().addTo(instance) : null;
    heatmap?.setPoints(points);
    return () => { group.remove(); heatmap?.remove(); };
  }, [ready, clusteringReady, props.nodes, props.categories, props.mode, props.selectedNodeId, freshnessMinute]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    const group = L.layerGroup().addTo(instance);
    for (const position of positions) {
      const enabled = layers[position.kind === "bus" ? "buses" : position.kind === "train" ? "trains" : "waste"];
      if (!enabled || Date.parse(position.valid_until) <= props.now) continue;
      const predicted = position.basis === "schedule_prediction";
      L.circleMarker([position.latitude, position.longitude], {
        color: predicted ? "#fbbf24" : "#38bdf8", radius: 8, fillOpacity: .9,
        dashArray: predicted ? "3 2" : undefined,
      }).bindPopup(textPopup([
        `${position.kind === "bus" ? "Bus" : position.kind === "train" ? "Zug" : "Abfallsammlung"} ${position.line ?? ""} ${position.destination ?? ""}`,
        predicted ? (position.kind === "waste" ? "Modell aus Abfuhrtagen: Straßenstichprobe, angenommene Reihenfolge und Zeiten (07–17 Uhr). Kein identifiziertes Müllfahrzeug." : "Prognose aus gespeichertem Fahrplan – keine GPS-Messung") : "Beobachtete Position",
        ...(position.delay_basis === "next_reported_stop_approximation" ? [`Mit gemeldeter Haltestellenverspätung (${Math.round((position.delay_seconds ?? 0) / 60)} Min.), auf die Fahrt angenähert`] : []),
        `Stand: ${new Date(position.timestamp).toLocaleString("de-DE")}`,
        ...(position.geometry_basis === "stop_to_stop" ? ["Geradlinige Näherung zwischen Orten; keine Streckengeometrie verfügbar"] : []),
      ])).addTo(group);
    }
    return () => { group.remove(); };
  }, [ready, positions, layers, props.now]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    const group = L.layerGroup().addTo(instance);
    let closures = 0;
    const requests = new Set<AbortController>();
    for (const [id, geometry] of Object.entries(publication.layers)) {
      if (!layers[id as MapLayerId]) continue;
      L.geoJSON(geometry as GeoJsonObject, {
        pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { radius: 6, color: "#34d399" }),
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
          layer.bindPopup(textPopup(Object.entries(values).filter(([,v]) => typeof v === "string" || typeof v === "number")
            .map(([k,v]) => `${k}: ${v}`)));
          if (id === "closures") closures++;
        },
      }).addTo(group);
    }
    if (layers.starkregen) L.tileLayer("/api/map-tiles/rain/{z}/{x}/{y}.png", { opacity: .5 }).addTo(group);
    callbacks.current.onActiveClosuresCountChange?.(closures);
    return () => { requests.forEach(controller => controller.abort()); group.remove(); };
  }, [ready, publication, layers]);

  const missing = publication.unavailable.filter(id => layers[id as MapLayerId]);
  return <div className="relative h-full min-h-[500px] w-full">
    <div ref={container} className="h-full min-h-[500px] w-full" aria-label="Karte mit gespeicherten Quelldaten" />
    <div className="absolute bottom-5 left-3 z-[500] max-w-sm rounded bg-slate-950/90 p-3 text-xs text-slate-200">
      <p>Gelb gestrichelt: Fahrplanprognose · Blau: beobachtete Position</p>
      {movementFailed && <p role="status">Bewegungsdaten nicht verfügbar.</p>}
      {(layersFailed || missing.length > 0) && <p role="status">Einige Kartenebenen sind noch nicht verfügbar.</p>}
      {tilesMissing && <p role="status">Hintergrundkarten sind noch nicht verfügbar.</p>}
      <button className="mt-2 underline" onClick={() => callbacks.current.onOpenLayersDrawer?.()}>Kartenebenen</button>
    </div>
  </div>;
}
