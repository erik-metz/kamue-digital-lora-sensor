"use client";

import L from "leaflet";
import { metricLabel } from "@/lib/telemetryData";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { createMarkerContent, createTempPinContent } from "@/lib/mapMarker";
import "./map.css";
import { motionPoint, nextMotion, MOVEMENT_POLL_MS, type MarkerMotion } from "@/lib/mapMotion";
import { detailCard, featureCard, featureKind, mapSymbol, placeMarker } from "@/lib/mapPresentation";
import { useEffect, useRef, useState } from "react";
import type { GeoJsonObject } from "geojson";
import { CATEGORIES, markerCategory, readingFreshness, primaryReading, valueLabel, observationLabel, temperatureColor, SENSOR_CATEGORY_MIN_ZOOM, type Category, type MapMode, type SensorNode } from "@/lib/mapData";
import { TemperatureHeatmapLayer } from "@/lib/temperatureHeatmap";
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, DEFAULT_MAP_LAYERS, type MapLayerId } from "@/lib/urlState";
import { LAYER_MIN_ZOOM } from "@/lib/mapPresets";

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
  satelliteMode?: "none" | "rgb" | "ndvi";
  satelliteSceneId?: string;
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
  const [zoom, setZoom] = useState(props.initialZoom ?? DEFAULT_MAP_ZOOM);
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
      minZoom: 8,
      maxBounds: [[49.45, 8.15], [49.90, 8.80]],
      maxBoundsViscosity: 0.8,
    });
    map.current = instance;
    const resize = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
    resize.observe(container.current);
    const base = L.tileLayer("/api/map-tiles/base/{z}/{x}/{y}.png", {
      maxZoom: 19, maxNativeZoom: 14, minZoom: 8, bounds: [[49.55, 8.30], [49.80, 8.65]],
      attribution: '© <a href="https://www.bkg.bund.de">BKG</a> · <a href="https://www.govdata.de/dl-de/by-2-0">dl-de/by-2-0</a> · <a href="https://sgx.geodatenzentrum.de/web_public/Datenquellen_TopPlus_Open.pdf">Datenquellen</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>',
    }).addTo(instance);
    base.on("tileerror", () => setTilesMissing(true));
    instance.on("moveend", () => {
      const center = instance.getCenter();
      callbacks.current.onViewportChange?.([center.lat, center.lng], instance.getZoom());
    });
    instance.on("zoomend", () => setZoom(instance.getZoom()));
    setReady(true);
    return () => { resize.disconnect(); instance.remove(); map.current = null; };
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
    // Keep rare categories visible instead of swallowing them in large soil clusters.
    const categoryGroups = new Map<Category, L.LayerGroup>();
    function groupFor(category: Category) {
      let target = categoryGroups.get(category);
      if (!target) {
        target = clusteringReady && props.mode !== "temperature" ? L.markerClusterGroup({
          maxClusterRadius: 38, disableClusteringAtZoom: 16, showCoverageOnHover: false,
          iconCreateFunction: item => L.divIcon({
            html: createMarkerContent(category, CATEGORIES[category].color, false, `${item.getChildCount()} ${CATEGORIES[category].label}`),
            className: "map-sensor-icon", iconSize: [32, 32],
          }),
        }).addTo(group) : group;
        categoryGroups.set(category, target);
      }
      return target;
    }
    const points: { lat: number; lng: number; temp: number }[] = [];
    const isSoleCategory = props.categories.length === 1;
    for (const node of props.nodes) {
      const category = markerCategory(node, props.categories);
      if (!category || !props.categories.includes(category)) continue;
      const reading = primaryReading(node, category, props.mode);
      const freshness = readingFreshness(reading, freshnessMinute * 60000);
      const fresh = freshness === "fresh";
      const muted = freshness === "stale" || freshness === "unknown";
      if (props.mode === "temperature") {
        if (!reading) continue;
        if (fresh) points.push({ lat: node.lat, lng: node.lng, temp: reading.value });
      }
      const minCategoryZoom = isSoleCategory ? 8 : (SENSOR_CATEGORY_MIN_ZOOM[category] ?? 8);
      if (props.mode !== "temperature" && zoom < minCategoryZoom && node.id !== props.selectedNodeId) {
        continue;
      }
      const color = props.mode === "temperature" && reading ? (muted ? "#94a3b8" : temperatureColor(reading.value)) : CATEGORIES[category].color;
      const label = zoom >= (props.mode === "temperature" ? 15 : 16) ? valueLabel(reading, node.readings) : "";
      const marker = L.marker([node.lat, node.lng], {
        title: node.name, alt: node.name, keyboard: true,
        ...{ categoryColor: CATEGORIES[category].color },
        icon: L.divIcon({ html: props.mode === "temperature" ? createTempPinContent(color, muted, label) : createMarkerContent(category, color, muted, label),
          className: `map-sensor-icon${node.id === props.selectedNodeId ? " map-sensor-selected" : ""}`,
          iconSize: props.mode === "temperature" ? [14,14] : [32,32], iconAnchor: props.mode === "temperature" ? [7,7] : [16,16], popupAnchor: [0,-18] }),
      }).addTo(groupFor(category));
      marker.bindTooltip(textPopup([node.name, ...(reading ? [valueLabel(reading, node.readings)] : ["Keine Messwerte"])]));
      marker.bindPopup(detailCard(node.name, node.categories.map(id => CATEGORIES[id].label).join(" · "), [
        ...(node.address ? [node.address] : []),
        ...node.readings.map(item => `${metricLabel(item)}: ${valueLabel(item, node.readings)} · ${observationLabel(item, freshnessMinute * 60000)}`),
        ...(!node.readings.length ? ["Keine Messwerte verfügbar."] : []),
      ]), { maxHeight: 260, maxWidth: 260, autoPanPadding: L.point(20, 40) });
      marker.on("click", () => callbacks.current.onSelectNode(node.id));
      if (node.id === props.selectedNodeId) marker.openPopup();
    }
    const heatmap = props.mode === "temperature" ? new TemperatureHeatmapLayer().addTo(instance) : null;
    heatmap?.setPoints(points);
    return () => { group.remove(); heatmap?.remove(); };
  }, [ready, clusteringReady, props.nodes, props.categories, props.mode, props.selectedNodeId, freshnessMinute, zoom]);

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
      const layerId = position.kind === "bus" ? "buses" : position.kind === "train" ? "trains" : "waste";
      const enabled = layers[layerId];
      const minZoom = LAYER_MIN_ZOOM[layerId] ?? 8;
      if (!enabled || zoom < minZoom || !(Date.parse(position.valid_until) > Date.now()) ||
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
  }, [ready, clusteringReady, positions, layers, zoom]);

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
      const layerId = id as MapLayerId;
      if (!layers[layerId]) continue;
      const minZoom = LAYER_MIN_ZOOM[layerId] ?? 8;
      if (zoom < minZoom) continue;
      const pointGroup = clusteringReady ? L.markerClusterGroup({ maxClusterRadius: 45, disableClusteringAtZoom: 16, showCoverageOnHover: false,
        iconCreateFunction: cluster => L.divIcon({ html: placeMarker(id, String(cluster.getChildCount())), className: "map-place-icon", iconSize: [36, 36] }),
      }).addTo(group) : group;
      L.geoJSON(geometry as GeoJsonObject, {
        style: (feature) => {
          if (id === "traffic") {
            const status = feature?.properties?.status;
            if (status === "congestion") return { color: "#ef4444", weight: 5, opacity: 0.9, dashArray: "8, 8" };
            if (status === "closure") return { color: "#b91c1c", weight: 5, opacity: 0.9, dashArray: "4, 6" };
            if (status === "sluggish") return { color: "#f59e0b", weight: 4.5, opacity: 0.85 };
            if (status === "clear") return { color: "#10b981", weight: 3.5, opacity: 0.75 };
          }
          if (id === "closures") {
            const closureType = feature?.properties?.closure_type;
            const causeType = feature?.properties?.cause_type;
            if (closureType === "full" || causeType === "closure") return { color: "#ef4444", weight: 5, opacity: 0.9 };
            return { color: "#f59e0b", weight: 4.5, opacity: 0.85 };
          }
          return { color: mapSymbol(id).color, weight: 3, fillOpacity: .15 };
        },
        pointToLayer: (feature, latlng) => {
          const props = feature.properties ?? {};
          const markerTitle = id === "energy" && (!props.name || props.name === "Energieanlage" || props.name === "Ökostrom / Solaranlage")
            ? (props.facility_type ? `Solaranlage (${props.facility_type})` : "Private Solaranlage / Photovoltaik")
            : String(props.name ?? mapSymbol(id).label);
          return L.marker(latlng, {
            title: markerTitle,
            keyboard: true,
            icon: L.divIcon({ html: placeMarker(featureKind(id, props)), className: "map-place-icon", iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20] }),
          });
        },
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
          const displayName = id === "energy" && (!values.name || values.name === "Energieanlage" || values.name === "Ökostrom / Solaranlage")
            ? (typeof values.facility_type === "string"
                ? `Solaranlage (${values.facility_type})`
                : "Private Solaranlage / Photovoltaik")
            : String(values.name ?? values.title ?? mapSymbol(id).label);
          const displaySubtitle = id === "energy"
            ? "Kartierte Solaranlage · keine Live-Messung"
            : mapSymbol(id).label;
          layer.bindPopup(featureCard(id, values), { maxHeight: 260, maxWidth: 260, autoPanPadding: L.point(20, 40) });
          layer.bindTooltip(detailCard(displayName, displaySubtitle, []));
          if (id === "closures") {
            closures++;
            if (feature.geometry?.type === "LineString" && Array.isArray((feature.geometry as unknown as { coordinates?: unknown }).coordinates)) {
              const coords = (feature.geometry as unknown as { coordinates: [number, number][] }).coordinates;
              if (coords.length > 0) {
                const mid = coords[Math.floor(coords.length / 2)];
                const midMarker = L.marker([mid[1], mid[0]], {
                  title: String(values.name ?? mapSymbol(id).label),
                  icon: L.divIcon({
                    html: placeMarker(featureKind(id, values)),
                    className: "map-place-icon",
                    iconSize: [36, 36],
                    iconAnchor: [18, 18],
                    popupAnchor: [0, -20],
                  }),
                });
                midMarker.bindPopup(featureCard(id, values), { maxHeight: 260, maxWidth: 260, autoPanPadding: L.point(20, 40) });
                midMarker.bindTooltip(detailCard(String(values.name ?? values.title ?? mapSymbol(id).label), mapSymbol(id).label, []));
                pointGroup.addLayer(midMarker);
              }
            }
          }
        },
      }).addTo(pointGroup);
    }
    const starkregenMinZoom = LAYER_MIN_ZOOM.starkregen ?? 12;
    if (layers.starkregen && zoom >= starkregenMinZoom) L.tileLayer("/api/map-tiles/rain/{z}/{x}/{y}.png", { opacity: .5 }).addTo(group);

    // Copernicus Sentinel-2 Satellite Raster Tile Layer (RGB or NDVI)
    if (props.satelliteMode && props.satelliteMode !== "none") {
      const scene = props.satelliteSceneId ? encodeURIComponent(props.satelliteSceneId) : "latest";
      L.tileLayer(`/api/satellite/tiles/${scene}/{z}/{x}/{y}.png?layer=${props.satelliteMode}`, {
        maxZoom: 18,
        minZoom: 8,
        bounds: [[49.50, 8.25], [49.85, 8.75]],
        opacity: props.satelliteMode === "ndvi" ? 0.75 : 0.9,
        attribution: '© <a href="https://dataspace.copernicus.eu" target="_blank" rel="noopener">Copernicus Sentinel-2</a> · ESA / EU',
      }).addTo(group);
    }

    callbacks.current.onActiveClosuresCountChange?.(closures);
    return () => { requests.forEach(controller => controller.abort()); group.remove(); };
  }, [ready, clusteringReady, publication, layers, zoom, props.satelliteMode, props.satelliteSceneId]);

  const trafficCorridors = (publication.layers.traffic && "features" in (publication.layers.traffic as unknown as { features?: unknown[] })
    ? ((publication.layers.traffic as unknown as { features: { properties?: { id?: string; road_name?: string; name?: string; status?: string; delay_minutes?: number; description?: string; kind?: string }; geometry?: { type: string; coordinates: [number, number][] } }[] }).features ?? [])
    : [])
    .filter(f => f.properties?.kind === "corridor")
    .map(f => f.properties as { id: string; road_name: string; name: string; status: string; delay_minutes: number; description: string });

  const missing = publication.unavailable.filter(id => layers[id as MapLayerId]);
  return <div className="relative h-full min-h-[500px] w-full">
    <div ref={container} className="sensor-map h-full min-h-[500px] w-full" aria-label="Karte mit gespeicherten Quelldaten" />
    {layers.traffic && trafficCorridors.length > 0 && (
      <div className="absolute top-3 left-14 z-[400] hidden sm:flex items-center gap-1 pointer-events-auto">
        <div className="commuter-corridor-bar">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mr-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Auslastung:
          </span>
          {trafficCorridors.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`corridor-pill corridor-pill-${c.status}`}
              title={`${c.name}: ${c.description} – Klick zum Fokussieren`}
              onClick={() => {
                const feature = (publication.layers.traffic as { features?: { properties?: { id?: string }; geometry?: { type: string; coordinates: [number, number][] } }[] })?.features?.find((f) => f.properties?.id === c.id);
                if (feature?.geometry?.type === "LineString") {
                  const pts = feature.geometry.coordinates.map((p) => [p[1], p[0]] as [number, number]);
                  map.current?.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 14 });
                }
              }}
            >
              <span className="font-bold">{c.road_name}</span>
              <span>
                {c.status === "clear"
                  ? "🟢 Frei"
                  : c.status === "sluggish"
                  ? `🟡 +${c.delay_minutes}m`
                  : c.status === "congestion"
                  ? `🔴 +${c.delay_minutes}m`
                  : "⛔ Gesperrt"}
              </span>
            </button>
          ))}
        </div>
      </div>
    )}
    <div className="absolute bottom-5 left-3 z-[500] max-w-sm rounded bg-slate-950/90 p-3 text-xs text-slate-200">
      <details><summary className="cursor-pointer font-semibold">Symbole & Hinweise</summary>
      <p className="mt-1">🚌 Bus · 🚆 Zug · 🚛 Abfallsammlung</p>
      <p>Ⓗ Haltestelle · ⚡ Ladestation</p>
      <p>⛔ Sperrung · 🚧 Baustelle · 🚗 Verkehrsachse</p>
      <p className="mt-1">Symbol anklicken für Details und Abfahrten.</p>
      <p className="mt-1 text-slate-400">Gestrichelter Rand: Prognose · Durchgehend: beobachtet (Fahrzeuge)</p>
      {(missing.length > 0) && <p>Ohne aktuelle Quelle: {missing.map(id => mapSymbol(id).label).join(", ")}.</p>}
      </details>
      {movementFailed && <p role="status">Bewegungsdaten nicht verfügbar.</p>}
      {(layersFailed || missing.length > 0) && <p role="status">{missing.length || "Einige"} Ebenen ohne aktuelle Quelldaten – siehe Hinweise.</p>}
      {tilesMissing && <p role="status">Hintergrundkarten sind noch nicht verfügbar.</p>}
      <button className="mt-2 mr-3 underline" onClick={() => {
        if (props.nodes.length) map.current?.fitBounds(L.latLngBounds(props.nodes.map(node => L.latLng(node.lat, node.lng))), { padding: [40, 40], maxZoom: 16 });
      }}>Sensoren im Überblick</button>
      <button className="mt-2 underline" onClick={() => callbacks.current.onOpenLayersDrawer?.()}>Kartenebenen</button>
    </div>
  </div>;
}
