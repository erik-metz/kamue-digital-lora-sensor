"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "./map.css";
import { metricLabel } from "@/lib/telemetryData";
import { createClusterContent, createMarkerContent, createTempPinContent, createTrainMarkerContent, createLevelCrossingMarkerContent, createWasteTruckMarkerContent, createTrafficIncidentMarkerContent } from "@/lib/mapMarker";
import { CATEGORIES, markerCategory, observationLabel, parkingSummary, bikeSummary, educationSummary, primaryReading, readingFreshness, temperatureColor, valueLabel, type Category, type MapMode, type SensorNode } from "@/lib/mapData";
import { TemperatureHeatmapLayer, type TemperaturePoint } from "@/lib/temperatureHeatmap";
import { RIEDBAHN_TRACK, NIBELUNGENBAHN_TRACK, calculateRiedMobility } from "@/lib/railMobility";
import { calculateWasteTruckMobility } from "@/lib/wasteTruckMobility";
import { calculateBusMobility, getBusStopDepartures, RIED_BUS_STOPS, type LiveBus, type BusStop } from "@/lib/busMobility";
import { createBusMarkerContent, createBusStopMarkerContent } from "@/lib/mapMarker";
import { BUS_ROUTE_OVERLAYS, WASTE_TRUCK_ROUTE_OVERLAYS } from "@/lib/roadRoutes";
import { calculateLocalTraffic, type TrafficCorridor, type TrafficIncident } from "@/lib/trafficData";
import {
  type StreetClosure,
  formatClosureDateRange,
  getClosureColor,
  isClosureActive,
  VERIFIED_RIED_STREET_CLOSURES,
} from "@/lib/streetClosures";
import {
  createEvChargingMarkerContent,
  createEnergyFacilityMarkerContent,
  createWifiMarkerContent,
  createCompanyMarkerContent,
} from "@/lib/mapMarker";
import { Company, BASELINE_COMPANIES } from "@/lib/economyData";

import {
  VERIFIED_ROAD_SEGMENTS,
  getRoadConditionColor,
  getRoadConditionLabel,
  calculateLiveEnergyGeneration,
  VERIFIED_EV_CHARGERS,
  VERIFIED_WIFI_HOTSPOTS,
  VERIFIED_BROADBAND_AREAS,
  type RoadSegment,
  type LiveEnergyFacility,
  type EvChargingStation,
  type WifiHotspot,
  type BroadbandArea,
} from "@/lib/infrastructureData";
import {
  DEFAULT_PROTECTED_AREAS,
  DEFAULT_CROP_ZONES,
  DEFAULT_FLOOD_GAUGES,
} from "@/lib/environmentData";
import {
  BASELINE_BORIS_ZONES,
  BASELINE_DEVELOPMENT_PLANS,
  getBorisZoneColor,
  formatEuro,
} from "@/lib/realestateData";
import { BASELINE_DISTRICTS_GEOJSON } from "@/lib/electionsData";
import {
  type MapLayerId,
  DEFAULT_MAP_LAYERS,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from "@/lib/urlState";
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
  initialCenter?: [number, number];
  initialZoom?: number;
  layers?: Record<MapLayerId, boolean>;
  onViewportChange?: (center: [number, number], zoom: number) => void;
  onLayerToggle?: (layerId: MapLayerId, enabled: boolean) => void;
}

export default function MapComponent({
  nodes,
  selectedNodeId,
  onSelectNode,
  categories,
  mode,
  now,
  initialCenter,
  initialZoom,
  layers,
  onViewportChange,
  onLayerToggle,
}: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);
  const tempPinsGroupRef = useRef<L.LayerGroup | null>(null);
  const heatmapRef = useRef<TemperatureHeatmapLayer | null>(null);
  const prevModeRef = useRef<MapMode | null>(null);
  const markers = useRef(new Map<string, ColoredMarker>());
  const selectedRef = useRef<string | undefined>(undefined);
  const onSelectRef = useRef(onSelectNode);
  const onViewportChangeRef = useRef(onViewportChange);
  const onLayerToggleRef = useRef(onLayerToggle);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(initialZoom ?? DEFAULT_MAP_ZOOM);
  const [failed, setFailed] = useState(false);

  const initialL = layers ?? DEFAULT_MAP_LAYERS;
  const [showRailMobility, setShowRailMobility] = useState(initialL.trains);
  const [showWasteTrucks, setShowWasteTrucks] = useState(initialL.waste);
  const [showBuses, setShowBuses] = useState(initialL.buses);
  const [showBusStops, setShowBusStops] = useState(initialL.stops);
  const [showTraffic, setShowTraffic] = useState(initialL.traffic);
  const [trafficCorridors, setTrafficCorridors] = useState<TrafficCorridor[]>([]);
  const [showClosures, setShowClosures] = useState(initialL.closures);
  const [streetClosures, setStreetClosures] = useState<StreetClosure[]>([]);
  const [showEvCharging, setShowEvCharging] = useState(initialL.charging);
  const [showEnergyFacilities, setShowEnergyFacilities] = useState(initialL.energy);
  const [showWifiHotspots, setShowWifiHotspots] = useState(initialL.wifi);
  const [showRoadConditions, setShowRoadConditions] = useState(initialL.road);
  const [showBroadband, setShowBroadband] = useState(initialL.broadband);
  const [evChargers, setEvChargers] = useState<EvChargingStation[]>(VERIFIED_EV_CHARGERS);
  const [energyFacilities, setEnergyFacilities] = useState<LiveEnergyFacility[]>([]);
  const [wifiHotspots, setWifiHotspots] = useState<WifiHotspot[]>(VERIFIED_WIFI_HOTSPOTS);
  const [roadSegments, setRoadSegments] = useState<RoadSegment[]>(VERIFIED_ROAD_SEGMENTS);
  const [broadbandAreas, setBroadbandAreas] = useState<BroadbandArea[]>(VERIFIED_BROADBAND_AREAS);
  const [showNatureAreas, setShowNatureAreas] = useState(initialL.nature);
  const [showCropZones, setShowCropZones] = useState(initialL.crops);
  const [showFloodGauges, setShowFloodGauges] = useState(initialL.floods);
  const [showStarkregenWMS, setShowStarkregenWMS] = useState(initialL.starkregen);
  const [showBoris, setShowBoris] = useState(initialL.boris);
  const [showDevPlans, setShowDevPlans] = useState(initialL.devplans);
  const [showWahlbezirke, setShowWahlbezirke] = useState(initialL.elections);
  const [showCompanies, setShowCompanies] = useState(initialL.companies);
  const [companies, setCompanies] = useState<Company[]>(BASELINE_COMPANIES);

  useEffect(() => { onSelectRef.current = onSelectNode; }, [onSelectNode]);
  useEffect(() => { onViewportChangeRef.current = onViewportChange; }, [onViewportChange]);
  useEffect(() => { onLayerToggleRef.current = onLayerToggle; }, [onLayerToggle]);

  useEffect(() => {
    if (!layers) return;
    setShowNatureAreas(layers.nature);
    setShowCropZones(layers.crops);
    setShowFloodGauges(layers.floods);
    setShowStarkregenWMS(layers.starkregen);
    setShowEvCharging(layers.charging);
    setShowEnergyFacilities(layers.energy);
    setShowRoadConditions(layers.road);
    setShowWifiHotspots(layers.wifi);
    setShowBroadband(layers.broadband);
    setShowBoris(layers.boris);
    setShowDevPlans(layers.devplans);
    setShowWahlbezirke(layers.elections);
    setShowCompanies(layers.companies);
    setShowClosures(layers.closures);
    setShowTraffic(layers.traffic);
    setShowBuses(layers.buses);
    setShowBusStops(layers.stops);
    setShowWasteTrucks(layers.waste);
    setShowRailMobility(layers.trains);
  }, [layers]);

  const toggleLayer = (
    id: MapLayerId,
    current: boolean,
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    const next = !current;
    setter(next);
    onLayerToggleRef.current?.(id, next);
  };

  const railTracksGroupRef = useRef<L.LayerGroup | null>(null);
  const trainsGroupRef = useRef<L.LayerGroup | null>(null);
  const crossingsGroupRef = useRef<L.LayerGroup | null>(null);
  const wasteTrucksGroupRef = useRef<L.LayerGroup | null>(null);
  const wasteRoutesGroupRef = useRef<L.LayerGroup | null>(null);
  const busesGroupRef = useRef<L.LayerGroup | null>(null);
  const busRoutesGroupRef = useRef<L.LayerGroup | null>(null);
  const busStopsGroupRef = useRef<L.LayerGroup | null>(null);
  const trafficRoutesGroupRef = useRef<L.LayerGroup | null>(null);
  const trafficIncidentsGroupRef = useRef<L.LayerGroup | null>(null);
  const closuresGroupRef = useRef<L.LayerGroup | null>(null);
  const evChargingGroupRef = useRef<L.LayerGroup | null>(null);
  const energyFacilitiesGroupRef = useRef<L.LayerGroup | null>(null);
  const wifiGroupRef = useRef<L.LayerGroup | null>(null);
  const roadConditionsGroupRef = useRef<L.LayerGroup | null>(null);
  const broadbandGroupRef = useRef<L.LayerGroup | null>(null);
  const natureGroupRef = useRef<L.LayerGroup | null>(null);
  const cropZonesGroupRef = useRef<L.LayerGroup | null>(null);
  const floodGaugesGroupRef = useRef<L.LayerGroup | null>(null);
  const starkregenWmsRef = useRef<L.TileLayer.WMS | null>(null);
  const borisGroupRef = useRef<L.LayerGroup | null>(null);
  const devPlansGroupRef = useRef<L.LayerGroup | null>(null);
  const wahlbezirkeGroupRef = useRef<L.LayerGroup | null>(null);
  const companiesGroupRef = useRef<L.LayerGroup | null>(null);

  const trainMarkers = useRef(new Map<string, L.Marker>());
  const crossingMarkers = useRef(new Map<string, L.Marker>());
  const wasteTruckMarkers = useRef(new Map<string, L.Marker>());
  const wasteDepotMarkers = useRef(new Map<string, L.Marker>());
  const busMarkers = useRef(new Map<string, L.Marker>());
  const busStopMarkers = useRef(new Map<string, L.Marker>());
  const trafficMarkers = useRef(new Map<string, L.Marker>());
  const trafficCorridorPolylines = useRef(new Map<string, { bg: L.Polyline; fg: L.Polyline }>());
  const closureLayers = useRef(new Map<string, { marker: L.Marker; polyline?: L.Polyline }>());
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
    const currentTrafficMarkers = trafficMarkers.current;
    const currentTrafficCorridorPolylines = trafficCorridorPolylines.current;
    async function initialize() {
      // MarkerCluster extends the global Leaflet instance. Load only in the browser.
      (window as typeof window & { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (cancelled || !container.current) return;
      const map = L.map(container.current, {
        center: initialCenter ?? DEFAULT_MAP_CENTER,
        zoom: initialZoom ?? DEFAULT_MAP_ZOOM,
        maxZoom: 19,
      });
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

      // Add Bus Road Routes in the Ried
      const busRoutesGroup = L.layerGroup();
      for (const overlay of BUS_ROUTE_OVERLAYS) {
        const bgLine = L.polyline(overlay.track, {
          color: "#0f172a",
          weight: overlay.weight + 2,
          opacity: 0.45,
        });
        const fgLine = L.polyline(overlay.track, {
          color: overlay.color,
          weight: overlay.weight,
          opacity: overlay.opacity,
          dashArray: overlay.dashArray,
        });
        fgLine.bindTooltip(`🚌 ${overlay.name}`, { sticky: true, className: "route-line-tooltip" });
        busRoutesGroup.addLayer(bgLine);
        busRoutesGroup.addLayer(fgLine);
      }

      // Add Waste Collection Road Routes in the Ried
      const wasteRoutesGroup = L.layerGroup();
      for (const overlay of WASTE_TRUCK_ROUTE_OVERLAYS) {
        const bgLine = L.polyline(overlay.track, {
          color: "#0f172a",
          weight: overlay.weight + 2,
          opacity: 0.4,
        });
        const fgLine = L.polyline(overlay.track, {
          color: overlay.color,
          weight: overlay.weight,
          opacity: overlay.opacity,
          dashArray: overlay.dashArray,
        });
        fgLine.bindTooltip(`🚛 ${overlay.name}`, { sticky: true, className: "route-line-tooltip" });
        wasteRoutesGroup.addLayer(bgLine);
        wasteRoutesGroup.addLayer(fgLine);
      }

      const trainsGroup = L.layerGroup();
      const crossingsGroup = L.layerGroup();
      const wasteTrucksGroup = L.layerGroup();
      const busesGroup = L.layerGroup();
      const busStopsGroup = L.layerGroup();
      const trafficRoutesGroup = L.layerGroup();
      const trafficIncidentsGroup = L.layerGroup();
      const closuresGroup = L.layerGroup();

      railTracksGroupRef.current = railTracksGroup;
      trainsGroupRef.current = trainsGroup;
      crossingsGroupRef.current = crossingsGroup;
      wasteRoutesGroupRef.current = wasteRoutesGroup;
      wasteTrucksGroupRef.current = wasteTrucksGroup;
      busRoutesGroupRef.current = busRoutesGroup;
      busesGroupRef.current = busesGroup;
      busStopsGroupRef.current = busStopsGroup;
      trafficRoutesGroupRef.current = trafficRoutesGroup;
      trafficIncidentsGroupRef.current = trafficIncidentsGroup;
      closuresGroupRef.current = closuresGroup;

      const evChargingGroup = L.layerGroup();
      const energyFacilitiesGroup = L.layerGroup();
      const wifiGroup = L.layerGroup();
      const roadConditionsGroup = L.layerGroup();
      const broadbandGroup = L.layerGroup();
      const natureGroup = L.layerGroup();
      const cropZonesGroup = L.layerGroup();
      const floodGaugesGroup = L.layerGroup();
      const borisGroup = L.layerGroup();
      const devPlansGroup = L.layerGroup();
      const wahlbezirkeGroup = L.layerGroup();
      const companiesGroup = L.layerGroup();

      evChargingGroupRef.current = evChargingGroup;
      energyFacilitiesGroupRef.current = energyFacilitiesGroup;
      wifiGroupRef.current = wifiGroup;
      roadConditionsGroupRef.current = roadConditionsGroup;
      broadbandGroupRef.current = broadbandGroup;
      natureGroupRef.current = natureGroup;
      cropZonesGroupRef.current = cropZonesGroup;
      floodGaugesGroupRef.current = floodGaugesGroup;
      borisGroupRef.current = borisGroup;
      devPlansGroupRef.current = devPlansGroup;
      wahlbezirkeGroupRef.current = wahlbezirkeGroup;
      companiesGroupRef.current = companiesGroup;


      const starkregenWms = L.tileLayer.wms("https://sgx.geodatenzentrum.de/wms_starkregen", {
        layers: "tiefe_extrem",
        format: "image/png",
        transparent: true,
        opacity: 0.65,
        attribution: "© BKG / Bund Geodatenzentrum",
        maxZoom: 19,
      });
      starkregenWmsRef.current = starkregenWms;

      map.addLayer(railTracksGroup);
      map.addLayer(crossingsGroup);
      map.addLayer(trainsGroup);
      map.addLayer(wasteRoutesGroup);
      map.addLayer(wasteTrucksGroup);
      map.addLayer(busRoutesGroup);
      map.addLayer(busesGroup);
      map.addLayer(trafficRoutesGroup);
      map.addLayer(trafficIncidentsGroup);
      map.addLayer(closuresGroup);
      map.addLayer(evChargingGroup);
      map.addLayer(energyFacilitiesGroup);
      map.addLayer(wifiGroup);
      map.addLayer(roadConditionsGroup);
      map.addLayer(natureGroup);
      map.addLayer(floodGaugesGroup);
      map.addLayer(companiesGroup);


      // Bus stops & crop zones become visible at zoom >= 13
      if (map.getZoom() >= 13) {
        map.addLayer(busStopsGroup);
        map.addLayer(cropZonesGroup);
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

      const handleViewport = () => {
        const z = map.getZoom();
        setZoom(z);
        const c = map.getCenter();
        onViewportChangeRef.current?.([c.lat, c.lng], z);
      };
      map.on("zoomend", handleViewport);
      map.on("moveend", handleViewport);
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
      wasteRoutesGroupRef.current = null;
      wasteTrucksGroupRef.current = null;
      busRoutesGroupRef.current = null;
      busesGroupRef.current = null;
      busStopsGroupRef.current = null;
      trafficRoutesGroupRef.current = null;
      trafficIncidentsGroupRef.current = null;
      closuresGroupRef.current = null;
      natureGroupRef.current = null;
      cropZonesGroupRef.current = null;
      floodGaugesGroupRef.current = null;
      starkregenWmsRef.current = null;
      borisGroupRef.current = null;
      devPlansGroupRef.current = null;
      wahlbezirkeGroupRef.current = null;
      currentTrainMarkers.clear();
      currentCrossingMarkers.clear();
      currentWasteTruckMarkers.clear();
      currentWasteDepotMarkers.clear();
      currentBusMarkers.clear();
      currentBusStopMarkers.clear();
      currentTrafficMarkers.clear();
      currentTrafficCorridorPolylines.clear();
      closureLayers.current.clear();
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
      const bikes = bikeSummary(node.readings);
      const education = educationSummary(node.readings);
      popup.append(title, tags);
      if (node.address) {
        const addr = document.createElement("p");
        addr.className = "text-xs text-slate-400";
        addr.textContent = node.address;
        popup.append(addr);
      }
      if (reading?.metric.startsWith("traffic_")) {
        const label = document.createElement("p");
        label.textContent = metricLabel(reading);
        popup.append(label);
      }
      const isCustomSummary = (parking && reading?.metric.startsWith("parking_")) ||
        (bikes && reading?.metric.startsWith("bike_")) ||
        (education && node.categories.includes("education"));
      if (!isCustomSummary) popup.append(value, time);
      if (education && node.categories.includes("education")) {
        const summary = document.createElement("p");
        summary.className = "map-popup-value";
        summary.textContent = education.summary;
        popup.append(summary);
        for (const detail of education.details) {
          const line = document.createElement("p");
          line.textContent = detail;
          popup.append(line);
        }
      }
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
      if (bikes) {
        const summary = document.createElement("p");
        summary.className = "map-popup-value";
        summary.textContent = bikes.summary;
        popup.append(summary);
        for (const detail of bikes.details) {
          const line = document.createElement("p");
          line.textContent = detail;
          popup.append(line);
        }
        const sameTime = new Set(bikes.observations.map(r => Date.parse(r.timestamp))).size === 1;
        for (const observation of sameTime ? bikes.observations.slice(0, 1) : bikes.observations) {
          const line = document.createElement("p");
          line.textContent = observationLabel(observation, now);
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
    const wasteRoutes = wasteRoutesGroupRef.current;
    if (!ready || !map || !wasteTrucks) return;
    if (showWasteTrucks) {
      if (wasteRoutes && !map.hasLayer(wasteRoutes)) map.addLayer(wasteRoutes);
      if (!map.hasLayer(wasteTrucks)) map.addLayer(wasteTrucks);
    } else {
      if (wasteRoutes && map.hasLayer(wasteRoutes)) map.removeLayer(wasteRoutes);
      if (map.hasLayer(wasteTrucks)) map.removeLayer(wasteTrucks);
    }
  }, [showWasteTrucks, ready]);

  // Toggle VRN buses layer visibility
  useEffect(() => {
    const map = mapRef.current;
    const buses = busesGroupRef.current;
    const busRoutes = busRoutesGroupRef.current;
    if (!ready || !map || !buses) return;
    if (showBuses) {
      if (busRoutes && !map.hasLayer(busRoutes)) map.addLayer(busRoutes);
      if (!map.hasLayer(buses)) map.addLayer(buses);
    } else {
      if (busRoutes && map.hasLayer(busRoutes)) map.removeLayer(busRoutes);
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
            directionLabel: stop.directionLabel,
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
        tooltip.textContent = stop.directionLabel
          ? `🚏 ${stop.name} (${stop.directionLabel})`
          : (stop.isSchoolStop ? `🎒 ${stop.name} (Schulbushaltestelle)` : `🚏 ${stop.name}`);
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
                ${stop.directionLabel ? `
                  <div style="font-size: 11px; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 4px; margin-top: 1px;">
                    <span>➔</span> <span>${stop.directionLabel}</span>
                  </div>
                ` : `
                  <div style="font-size: 11px; color: #94a3b8;">${stop.platforms?.join(", ") ?? "Haltestelle"}</div>
                `}
                <div style="font-size: 11px; color: #94a3b8;">${stop.municipality}</div>
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

  // Toggle traffic layers visibility
  useEffect(() => {
    const map = mapRef.current;
    const routesGroup = trafficRoutesGroupRef.current;
    const incidentsGroup = trafficIncidentsGroupRef.current;
    if (!map || !routesGroup || !incidentsGroup) return;

    if (showTraffic) {
      if (!map.hasLayer(routesGroup)) map.addLayer(routesGroup);
      if (!map.hasLayer(incidentsGroup)) map.addLayer(incidentsGroup);
    } else {
      if (map.hasLayer(routesGroup)) map.removeLayer(routesGroup);
      if (map.hasLayer(incidentsGroup)) map.removeLayer(incidentsGroup);
    }
  }, [showTraffic]);

  // Fetch and update traffic corridors and incidents
  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    async function updateTraffic() {
      const routesGroup = trafficRoutesGroupRef.current;
      const incidentsGroup = trafficIncidentsGroupRef.current;
      if (!routesGroup || !incidentsGroup || cancelled) return;

      let incidents: TrafficIncident[] = [];
      let corridors: TrafficCorridor[] = [];

      try {
        const res = await fetch("/api/traffic", { cache: "no-store", signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.incidents) && Array.isArray(data.corridors)) {
            incidents = data.incidents;
            corridors = data.corridors;
          }
        }
      } catch {
        // Fallback to local simulation
      }

      if (incidents.length === 0 && corridors.length === 0) {
        const fallback = calculateLocalTraffic(Date.now());
        incidents = fallback.incidents;
        corridors = fallback.corridors;
      }

      if (cancelled) return;
      setTrafficCorridors(corridors);

      // 1. Draw/update corridor tracks
      for (const c of corridors) {
        const existing = trafficCorridorPolylines.current.get(c.id);
        const color = c.status === "closure"
          ? "#b91c1c"
          : c.status === "congestion"
          ? "#ef4444"
          : c.status === "sluggish"
          ? "#f59e0b"
          : "#64748b";

        const weight = c.status === "clear" ? 3 : 5;
        const opacity = c.status === "clear" ? 0.6 : 0.9;
        const dashArray = c.status === "congestion" ? "8, 8" : c.status === "closure" ? "4, 6" : undefined;

        if (!existing) {
          const bg = L.polyline(c.track, {
            color: "#0f172a",
            weight: weight + 2,
            opacity: 0.5,
          });
          const fg = L.polyline(c.track, {
            color,
            weight,
            opacity,
            dashArray,
          });
          fg.bindTooltip(`🚗 <strong>${c.roadName}</strong>: ${c.description}`, { sticky: true, className: "route-line-tooltip" });
          routesGroup.addLayer(bg);
          routesGroup.addLayer(fg);
          trafficCorridorPolylines.current.set(c.id, { bg, fg });
        } else {
          existing.fg.setStyle({ color, weight, opacity, dashArray });
          existing.fg.setTooltipContent(`🚗 <strong>${c.roadName}</strong>: ${c.description}`);
        }
      }

      // 2. Remove cleared incident markers
      const currentIds = new Set(incidents.map(i => i.id));
      for (const [id, marker] of trafficMarkers.current) {
        if (!currentIds.has(id)) {
          incidentsGroup.removeLayer(marker);
          trafficMarkers.current.delete(id);
        }
      }

      // 3. Update/create incident markers
      for (const inc of incidents) {
        const coords = inc.coordinates && inc.coordinates.length > 0
          ? inc.coordinates[Math.floor(inc.coordinates.length / 2)]
          : null;
        if (!coords) continue;

        const icon = L.divIcon({
          html: createTrafficIncidentMarkerContent({
            roadName: inc.roadName,
            delayMinutes: inc.delayMinutes,
            lengthKm: inc.lengthKm,
            severity: inc.severity,
            causeType: inc.causeType,
          }),
          className: "map-traffic-icon",
          iconSize: [40, 24],
          iconAnchor: [20, 12],
          popupAnchor: [0, -14],
        });

        let marker = trafficMarkers.current.get(inc.id);
        if (!marker) {
          marker = L.marker([coords[0], coords[1]], { icon, zIndexOffset: 480 });
          marker.bindPopup(() => {
            const container = document.createElement("div");
            container.className = "traffic-popup-details";
            const isClosure = inc.causeType === "closure" || inc.severity === "standstill";
            const isSevere = inc.severity === "major" || inc.delayMinutes >= 10;
            const statusColor = isClosure ? "#ef4444" : isSevere ? "#f97316" : "#eab308";
            const delayText = inc.delayMinutes > 0 ? `+${inc.delayMinutes} Min. Verzögerung` : "Geringe Verzögerung";
            const lengthText = inc.lengthKm > 0 ? ` · ${inc.lengthKm} km Stau` : "";
            const formattedTime = new Date(inc.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            container.innerHTML = `
              <div style="font-weight: 700; font-size: 14px; margin-bottom: 2px; color: ${statusColor};">
                🚗 ${inc.roadName}: ${inc.direction}
              </div>
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">
                Von: <strong>${inc.locationFrom}</strong> ➔ Bis: <strong>${inc.locationTo}</strong>
              </div>
              <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px; color: ${statusColor};">
                ⚠️ ${delayText}${lengthText}
              </div>
              ${inc.description ? `
                <div style="font-size: 12px; background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; padding: 6px 8px; border-radius: 6px; margin: 6px 0; color: #e2e8f0; line-height: 1.4;">
                  ${inc.description}
                </div>
              ` : ""}
              <div style="font-size: 11px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 6px; margin-top: 6px; display: flex; justify-content: space-between;">
                <span>Aktiv seit: ${formattedTime} Uhr</span>
                <span>Quelle: ${inc.source === "autobahn_api" ? "Autobahn GmbH" : "Ried-Sens Traffic"}</span>
              </div>
            `;
            return container;
          });
          incidentsGroup.addLayer(marker);
          trafficMarkers.current.set(inc.id, marker);
        } else {
          marker.setIcon(icon);
          marker.setLatLng([coords[0], coords[1]]);
        }
      }
    }

    void updateTraffic();
    const interval = setInterval(updateTraffic, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready]);

  // Toggle street closures visibility
  useEffect(() => {
    const map = mapRef.current;
    const closuresGroup = closuresGroupRef.current;
    if (!map || !closuresGroup) return;

    if (showClosures) {
      if (!map.hasLayer(closuresGroup)) map.addLayer(closuresGroup);
    } else {
      if (map.hasLayer(closuresGroup)) map.removeLayer(closuresGroup);
    }
  }, [showClosures]);

  // Fetch and update street closures and baustellen
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    async function updateClosures() {
      const closuresGroup = closuresGroupRef.current;
      if (!closuresGroup || cancelled) return;

      let items: StreetClosure[] = [];
      try {
        const res = await fetch("/api/street-closures", {
          cache: "no-store",
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.closures)) {
            items = data.closures;
          }
        }
      } catch {
        // Graceful fallback
      }

      if (items.length === 0) {
        items = VERIFIED_RIED_STREET_CLOSURES;
      }

      if (cancelled) return;
      setStreetClosures(items);

      const nowMs = Date.now();
      const currentIds = new Set(items.map((c) => c.id));

      // 1. Remove deleted or expired closure layers
      for (const [id, entry] of closureLayers.current) {
        if (!currentIds.has(id)) {
          closuresGroup.removeLayer(entry.marker);
          if (entry.polyline) closuresGroup.removeLayer(entry.polyline);
          closureLayers.current.delete(id);
        }
      }

      // 2. Add or update closure markers & polylines
      for (const c of items) {
        const currentlyActive = isClosureActive(c, nowMs);
        const color = getClosureColor(c, nowMs);
        const iconChar = currentlyActive
          ? c.closureType === "full"
            ? "⛔"
            : "⚠️"
          : "🕒";
        const iconClass = currentlyActive
          ? c.closureType === "full"
            ? "active-full"
            : "active-partial"
          : "scheduled";

        const markerHtml = `
          <div class="street-closure-marker ${iconClass}">
            <span>${iconChar}</span>
            ${currentlyActive ? `<div class="street-closure-pulse"></div>` : ""}
          </div>
        `;

        const icon = L.divIcon({
          html: markerHtml,
          className: "map-closure-icon-wrapper",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        });

        const popupContent = () => {
          const div = document.createElement("div");
          div.className = "closure-popup-details";
          const statusBadge = currentlyActive
            ? c.closureType === "full"
              ? "🔴 Vollsperrung aktiv"
              : "🟡 Halbseitige Sperrung"
            : "🕒 Geplante Sperrung";
          const badgeClass = currentlyActive
            ? c.closureType === "full"
              ? "full"
              : "partial"
            : "scheduled";

          const dateRangeText = formatClosureDateRange(c.startTime, c.endTime);

          div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <span class="closure-header-badge ${badgeClass}">${statusBadge}</span>
              <span style="font-size: 10px; color: #94a3b8;">${c.municipality} · ${c.district}</span>
            </div>
            <div style="font-weight: 700; font-size: 14px; margin-bottom: 3px; color: ${color};">
              🚧 ${c.streetName}
            </div>
            ${c.locationFrom || c.locationTo ? `
              <div style="font-size: 11px; color: #cbd5e1; margin-bottom: 5px;">
                Bereich: <strong>${c.locationFrom}</strong> ➔ <strong>${c.locationTo}</strong>
              </div>
            ` : ""}
            <div class="closure-time-box">
              <span style="color: #94a3b8; font-size: 10px; display: block; text-transform: uppercase;">Zeitraum:</span>
              <strong style="color: #f8fafc;">${dateRangeText}</strong>
            </div>
            <div style="font-size: 12px; margin: 6px 0; color: #e2e8f0; line-height: 1.4;">
              ${c.description || c.reason}
            </div>
            ${c.detour ? `
              <div class="closure-detour-box">
                <strong>Umleitung:</strong> ${c.detour}
              </div>
            ` : ""}
            <div style="font-size: 10px; color: #94a3b8; border-top: 1px solid #334155; padding-top: 4px; margin-top: 6px; display: flex; justify-content: space-between;">
              <span>Quelle: ${c.source}</span>
              ${c.sourceUrl ? `<a href="${c.sourceUrl}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">Details</a>` : ""}
            </div>
          `;
          return div;
        };

        const existing = closureLayers.current.get(c.id);
        if (!existing) {
          const marker = L.marker([c.coordinates[0], c.coordinates[1]], {
            icon,
            zIndexOffset: 490,
          });
          marker.bindPopup(popupContent);
          closuresGroup.addLayer(marker);

          let polyline: L.Polyline | undefined = undefined;
          if (c.segmentGeometry && c.segmentGeometry.length >= 2) {
            polyline = L.polyline(c.segmentGeometry, {
              color,
              weight: 5,
              opacity: 0.85,
              dashArray: "6, 8",
            });
            polyline.bindTooltip(`⛔ <strong>${c.streetName}</strong> (${c.reason})`, {
              sticky: true,
              className: "route-line-tooltip",
            });
            closuresGroup.addLayer(polyline);
          }

          closureLayers.current.set(c.id, { marker, polyline });
        } else {
          existing.marker.setIcon(icon);
          existing.marker.setLatLng([c.coordinates[0], c.coordinates[1]]);
          if (existing.polyline && c.segmentGeometry) {
            existing.polyline.setStyle({ color });
          }
        }
      }
    }

    void updateClosures();
    const interval = setInterval(updateClosures, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ready]);

  // Toggle handlers for Infrastructure & Energy layers
  useEffect(() => {
    const map = mapRef.current;
    const group = evChargingGroupRef.current;
    if (!map || !group) return;
    if (showEvCharging) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showEvCharging]);

  useEffect(() => {
    const map = mapRef.current;
    const group = energyFacilitiesGroupRef.current;
    if (!map || !group) return;
    if (showEnergyFacilities) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showEnergyFacilities]);

  useEffect(() => {
    const map = mapRef.current;
    const group = wifiGroupRef.current;
    if (!map || !group) return;
    if (showWifiHotspots) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showWifiHotspots]);

  useEffect(() => {
    const map = mapRef.current;
    const group = roadConditionsGroupRef.current;
    if (!map || !group) return;
    if (showRoadConditions) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showRoadConditions]);

  useEffect(() => {
    const map = mapRef.current;
    const group = broadbandGroupRef.current;
    if (!map || !group) return;
    if (showBroadband) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showBroadband]);

  useEffect(() => {
    const map = mapRef.current;
    const group = natureGroupRef.current;
    if (!map || !group) return;
    if (showNatureAreas) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showNatureAreas]);

  useEffect(() => {
    const map = mapRef.current;
    const group = cropZonesGroupRef.current;
    if (!map || !group) return;
    const shouldShow = showCropZones && zoom >= 13;
    if (shouldShow && !map.hasLayer(group)) map.addLayer(group);
    else if (!shouldShow && map.hasLayer(group)) map.removeLayer(group);
  }, [showCropZones, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const group = floodGaugesGroupRef.current;
    if (!map || !group) return;
    if (showFloodGauges) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showFloodGauges]);

  useEffect(() => {
    const map = mapRef.current;
    const wms = starkregenWmsRef.current;
    if (!map || !wms) return;
    if (showStarkregenWMS) { if (!map.hasLayer(wms)) map.addLayer(wms); }
    else { if (map.hasLayer(wms)) map.removeLayer(wms); }
  }, [showStarkregenWMS]);

  useEffect(() => {
    const map = mapRef.current;
    const group = borisGroupRef.current;
    if (!map || !group) return;
    if (showBoris) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showBoris]);

  useEffect(() => {
    const map = mapRef.current;
    const group = devPlansGroupRef.current;
    if (!map || !group) return;
    if (showDevPlans) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showDevPlans]);

  useEffect(() => {
    const map = mapRef.current;
    const group = wahlbezirkeGroupRef.current;
    if (!map || !group) return;
    if (showWahlbezirke) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showWahlbezirke]);

  useEffect(() => {
    const map = mapRef.current;
    const group = companiesGroupRef.current;
    if (!map || !group) return;
    if (showCompanies) { if (!map.hasLayer(group)) map.addLayer(group); }
    else { if (map.hasLayer(group)) map.removeLayer(group); }
  }, [showCompanies]);


  // Populate Infrastructure & Energy Layers
  useEffect(() => {
    if (!ready) return;

    // 1. EV Charging
    const evGroup = evChargingGroupRef.current;
    if (evGroup) {
      evGroup.clearLayers();
      for (const ev of evChargers) {
        const icon = L.divIcon({
          html: createEvChargingMarkerContent({
            name: ev.name,
            availablePoints: ev.availablePoints,
            totalPoints: ev.totalPoints,
            maxPowerKw: ev.maxPowerKw,
            isFastCharger: ev.isFastCharger,
          }),
          className: "map-sensor-icon",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const marker = L.marker([ev.lat, ev.lng], { icon, zIndexOffset: 460 });
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #e2e8f0; min-width: 220px;">
            <div style="font-size: 11px; font-weight: bold; color: #38bdf8; text-transform: uppercase;">⚡ E-Ladesäule (${ev.isFastCharger ? "Schnelllader DC" : "Normallader AC"})</div>
            <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${ev.name}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${ev.address}</div>
            <div style="background: rgba(15,23,42,0.8); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px;">
              <div>Verfügbar: <strong style="color: ${ev.availablePoints > 0 ? "#10b981" : "#ef4444"};">${ev.availablePoints} von ${ev.totalPoints} frei</strong></div>
              <div>Max. Leistung: <strong>${ev.maxPowerKw} kW</strong></div>
              <div>Stecker: <strong>${ev.connectorTypes.join(", ")}</strong></div>
              <div>Betreiber: <strong>${ev.operator}</strong></div>
            </div>
          </div>
        `);
        evGroup.addLayer(marker);
      }
    }

    // 2. Renewable Energy
    const nrgGroup = energyFacilitiesGroupRef.current;
    if (nrgGroup) {
      nrgGroup.clearLayers();
      const liveGen = calculateLiveEnergyGeneration(now);
      setEnergyFacilities(liveGen.facilities);
      for (const fac of liveGen.facilities) {
        const icon = L.divIcon({
          html: createEnergyFacilityMarkerContent({
            name: fac.name,
            facilityType: fac.facilityType,
            currentPowerKw: fac.currentPowerKw,
            installedCapacityKw: fac.installedCapacityKw,
          }),
          className: "map-sensor-icon",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const marker = L.marker([fac.lat, fac.lng], { icon, zIndexOffset: 470 });
        const isBiogas = fac.facilityType === "biogas" || fac.facilityType === "landfill_gas";
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #e2e8f0; min-width: 240px;">
            <div style="font-size: 11px; font-weight: bold; color: ${isBiogas ? "#10b981" : "#f59e0b"}; text-transform: uppercase;">
              ${isBiogas ? "🌱 Erneuerbares Gas & Ökostrom" : "☀️ Solarpark & Photovoltaik"}
            </div>
            <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${fac.name}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${fac.address}</div>
            <div style="background: rgba(15,23,42,0.8); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px; line-height: 1.4;">
              <div>Aktuelle Leistung: <strong style="color: ${isBiogas ? "#10b981" : "#f59e0b"}; font-size: 13px;">${fac.currentPowerKw >= 1000 ? (fac.currentPowerKw / 1000).toFixed(2) + " MW" : Math.round(fac.currentPowerKw) + " kW"}</strong></div>
              <div>Installierte Leistung: <strong>${fac.installedCapacityKw >= 1000 ? (fac.installedCapacityKw / 1000).toFixed(1) + " MWp" : fac.installedCapacityKw + " kWp"}</strong></div>
              <div>Ertrag heute: <strong>~${Math.round(fac.todayYieldKwh).toLocaleString("de-DE")} kWh</strong></div>
              <div>Betreiber: <strong>${fac.operator}</strong></div>
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 5px;">${fac.description}</div>
          </div>
        `);
        nrgGroup.addLayer(marker);
      }
    }

    // 3. Public Wi-Fi Hotspots
    const wifiGroup = wifiGroupRef.current;
    if (wifiGroup) {
      wifiGroup.clearLayers();
      for (const w of wifiHotspots) {
        const icon = L.divIcon({
          html: createWifiMarkerContent({
            name: w.name,
            ssid: w.ssid,
            locationType: w.locationType,
          }),
          className: "map-sensor-icon",
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marker = L.marker([w.lat, w.lng], { icon, zIndexOffset: 450 });
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #e2e8f0; min-width: 220px;">
            <div style="font-size: 11px; font-weight: bold; color: #06b6d4; text-transform: uppercase;">📶 Öffentliches WLAN (Kostenlos)</div>
            <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${w.name}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${w.address}</div>
            <div style="background: rgba(15,23,42,0.8); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px;">
              <div>Netzwerk (SSID): <strong style="color: #38bdf8;">${w.ssid}</strong></div>
              <div>Zugang: <strong>${w.authMode}</strong></div>
              <div>Bandbreite: <strong>bis zu ${w.bandwidthMbps} Mbit/s</strong></div>
              <div>Betreiber: <strong>${w.operator}</strong></div>
            </div>
          </div>
        `);
        wifiGroup.addLayer(marker);
      }
    }

    // 4. AI Road Surface Conditions
    const roadGroup = roadConditionsGroupRef.current;
    if (roadGroup) {
      roadGroup.clearLayers();
      for (const seg of roadSegments) {
        const color = getRoadConditionColor(seg.conditionGrade);
        const polyline = L.polyline(seg.coordinates, {
          color,
          weight: 4,
          opacity: 0.85,
        });
        polyline.bindPopup(`
          <div style="font-family: sans-serif; color: #e2e8f0; min-width: 230px;">
            <div style="font-size: 11px; font-weight: bold; color: ${color}; text-transform: uppercase;">🛣️ Straßenzustandsmonitoring</div>
            <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${seg.roadName}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${seg.municipality} (${seg.district})</div>
            <div style="background: rgba(15,23,42,0.8); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px; line-height: 1.4;">
              <div>Zustandsnote: <strong style="color: ${color}; font-size: 13px;">${seg.conditionGrade.toFixed(1)} – ${getRoadConditionLabel(seg.conditionGrade)}</strong></div>
              <div>Schlaglöcher / Schäden: <strong>${seg.potholesCount > 0 ? `${seg.potholesCount} erfasst` : "Keine"}</strong></div>
              <div>Rissbildung: <strong>${seg.crackingSeverity}</strong></div>
              <div>Belag: <strong>${seg.surfaceType}</strong></div>
              <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Sensorik: ${seg.inspectedBy}</div>
            </div>
          </div>
        `);
        roadGroup.addLayer(polyline);
      }
    }

    // 5. Broadband & Fibre Rollout Areas
    const bbGroup = broadbandGroupRef.current;
    if (bbGroup) {
      bbGroup.clearLayers();
      for (const bb of broadbandAreas) {
        if (bb.coordinates && bb.coordinates.length >= 3) {
          const isFibre = bb.techType === "ftth_fibre";
          const isActive = bb.rolloutStatus === "active_available";
          const color = isFibre ? (isActive ? "#a855f7" : "#eab308") : "#64748b";
          const polygon = L.polygon(bb.coordinates, {
            color,
            fillColor: color,
            fillOpacity: 0.25,
            weight: 2,
          });
          polygon.bindTooltip(`🌐 <strong>${bb.areaName}</strong>: ${isFibre ? "FTTH Glasfaser (1 Gbit/s)" : "VDSL Vectoring"} – ${isActive ? "Verfügbar" : "Im Ausbau"}`, { sticky: true });
          bbGroup.addLayer(polygon);
        }
      }
    }

    // 6. Nature Protected Areas (NSG, FFH, Wasserschutz)
    const natGroup = natureGroupRef.current;
    if (natGroup) {
      natGroup.clearLayers();
      for (const n of DEFAULT_PROTECTED_AREAS) {
        if (n.geojson && n.geojson.coordinates && n.geojson.coordinates[0]) {
          const latLngs = n.geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
          const color = n.designation === "wsg" ? "#0284c7" : n.designation === "ffh" ? "#10b981" : "#059669";
          const poly = L.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity: 0.25,
            weight: 2,
            dashArray: n.designation === "wsg" ? "4, 4" : undefined,
          });
          poly.bindPopup(`
            <div style="font-family: sans-serif; color: #e2e8f0; min-width: 240px;">
              <div style="font-size: 11px; font-weight: bold; color: #34d399; text-transform: uppercase;">🌿 ${n.designation.toUpperCase()} · ${n.municipality}</div>
              <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${n.name}</div>
              <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px;">${n.conservation_aims || ""}</div>
              <div style="background: rgba(15,23,42,0.8); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px;">
                <div>Fläche: <strong>${n.area_hectares ? n.area_hectares + " ha" : "k.A."}</strong></div>
                <div>Verordnung: <strong>seit ${n.legal_ordinance_year || "k.A."}</strong></div>
                <div style="margin-top: 4px; color: #a7f3d0;">Regeln: Wegegebot, Leinenpflicht beachten</div>
              </div>
            </div>
          `);
          natGroup.addLayer(poly);
        }
      }
    }

    // 7. Agricultural Crop Zones (Spargel, Gemüse, Erdbeeren)
    const cropGroup = cropZonesGroupRef.current;
    if (cropGroup) {
      cropGroup.clearLayers();
      for (const c of DEFAULT_CROP_ZONES) {
        if (c.geojson && c.geojson.coordinates && c.geojson.coordinates[0]) {
          const latLngs = c.geojson.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng]);
          const color = c.crop_name === "Spargel" ? "#c084fc" : c.crop_family === "gemuese" ? "#4ade80" : c.crop_name === "Erdbeeren" ? "#fb7185" : "#facc15";
          const poly = L.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity: 0.35,
            weight: 1.5,
          });
          poly.bindPopup(`
            <div style="font-family: sans-serif; color: #e2e8f0; min-width: 220px;">
              <div style="font-size: 11px; font-weight: bold; color: ${color}; text-transform: uppercase;">🌾 Landwirtschaft · ${c.municipality}</div>
              <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${c.crop_name}</div>
              <div style="background: rgba(15,23,42,0.8); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px;">
                <div>Schlaggröße: <strong>${c.area_hectares} ha</strong></div>
                <div>Kulturfamilie: <strong>${c.crop_family}</strong></div>
                <div>Bewässerungsbedarf: <strong>${c.irrigation_demand_class === "high" ? "Sehr hoch (Beregnung)" : "Mäßig"}</strong></div>
                <div>Erntejahr: <strong>${c.year}</strong></div>
              </div>
            </div>
          `);
          cropGroup.addLayer(poly);
        }
      }
    }

    // 8. River Flood Gauges (Rheinpegel Worms, Weschnitzpegel Lorsch)
    const floodGrp = floodGaugesGroupRef.current;
    if (floodGrp) {
      floodGrp.clearLayers();
      for (const g of DEFAULT_FLOOD_GAUGES) {
        const isStage = g.status !== "normal";
        const badgeColor = isStage ? "#ef4444" : "#38bdf8";
        const iconHtml = `
          <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; background: #0f172a; border: 2px solid ${badgeColor}; box-shadow: 0 0 10px ${badgeColor}80; color: #fff; font-size: 16px;">
            🌊
          </div>
        `;
        const icon = L.divIcon({
          html: iconHtml,
          className: "map-sensor-icon",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const marker = L.marker([g.latitude, g.longitude], { icon, zIndexOffset: 480 });
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #e2e8f0; min-width: 220px;">
            <div style="font-size: 11px; font-weight: bold; color: ${badgeColor}; text-transform: uppercase;">🌊 Flusspegel (${g.water_body})</div>
            <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${g.name}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${g.municipality} · ${g.source}</div>
            <div style="background: rgba(15,23,42,0.8); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px;">
              <div>Aktueller Wasserstand: <strong style="font-size: 14px; color: ${badgeColor};">${g.current_level_m.toFixed(2)} m</strong></div>
              <div>Meldestufe 1 / 2 / 3: <strong>${g.alarm_level_1_m}m / ${g.alarm_level_2_m}m / ${g.alarm_level_3_m}m</strong></div>
              <div>Hochwasserstatus: <strong style="color: ${isStage ? "#ef4444" : "#10b981"};">${g.status === "normal" ? "Normal (kein Hochwasser)" : "Meldestufe aktiv!"}</strong></div>
            </div>
          </div>
        `);
        floodGrp.addLayer(marker);
      }
    }

    // 8. BORIS Hessen Bodenrichtwerte
    const borisGrp = borisGroupRef.current;
    if (borisGrp) {
      borisGrp.clearLayers();
      for (const b of BASELINE_BORIS_ZONES) {
        if (b.geometry?.coordinates?.[0]) {
          const latLngs = (b.geometry.coordinates[0] as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
          const color = getBorisZoneColor(b.land_value_eur_sqm, b.zone_type);
          const poly = L.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity: 0.28,
            weight: 2,
          });
          poly.bindPopup(`
            <div style="font-family: sans-serif; color: #e2e8f0; min-width: 240px;">
              <div style="font-size: 11px; font-weight: bold; color: ${color}; text-transform: uppercase;">🏡 BORIS Hessen · ${b.municipality}</div>
              <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${b.district ?? b.zone_code}</div>
              <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px;">Zone: ${b.zone_code} · ${b.zone_type}</div>
              <div style="background: rgba(15,23,42,0.85); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px;">
                <div>Bodenrichtwert: <strong style="font-size: 15px; color: #34d399;">${formatEuro(b.land_value_eur_sqm, true)}</strong></div>
                <div>Zustand: <strong>${b.development_status}</strong></div>
                ${b.floor_space_index ? `<div>WGFZ: <strong>${b.floor_space_index}</strong></div>` : ""}
                <div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">Stichtag ${b.stichtag} · dl-zero-de/2.0</div>
              </div>
            </div>
          `);
          borisGrp.addLayer(poly);
        }
      }
    }

    // 9. Active Development Plans (B-Pläne)
    const devGrp = devPlansGroupRef.current;
    if (devGrp) {
      devGrp.clearLayers();
      for (const d of BASELINE_DEVELOPMENT_PLANS) {
        if (d.geometry?.coordinates?.[0]) {
          const latLngs = (d.geometry.coordinates[0] as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
          const color = d.status === "rechtskraeftig" ? "#10b981" : d.status === "im_verfahren" ? "#f59e0b" : "#38bdf8";
          const poly = L.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity: 0.22,
            weight: 2,
            dashArray: "6, 4",
          });
          poly.bindPopup(`
            <div style="font-family: sans-serif; color: #e2e8f0; min-width: 240px;">
              <div style="font-size: 11px; font-weight: bold; color: ${color}; text-transform: uppercase;">🏗️ Bebauungsplan · ${d.municipality}</div>
              <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${d.plan_name}</div>
              <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px;">Nutzung: <strong>${d.target_use}</strong> · Plan-Nr: ${d.plan_number}</div>
              <div style="background: rgba(15,23,42,0.85); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px;">
                <div>Status: <strong style="color: ${color};">${d.status === "rechtskraeftig" ? "Rechtskräftig" : d.status === "im_verfahren" ? "Im Verfahren" : "In Aufstellung"}</strong></div>
                <div>Geltungsbereich: <strong>${d.area_hectares} ha</strong></div>
              </div>
            </div>
          `);
          devGrp.addLayer(poly);
        }
      }
    }

    // 10. Election Districts & Turnout Choropleth (Wahlbezirke)
    const wahlGrp = wahlbezirkeGroupRef.current;
    if (wahlGrp) {
      wahlGrp.clearLayers();
      for (const [, collection] of Object.entries(BASELINE_DISTRICTS_GEOJSON)) {
        for (const feat of collection.features) {
          if (feat.geometry?.type === "Polygon" && feat.geometry.coordinates?.[0]) {
            const coords = (feat.geometry.coordinates[0] as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
            const turnout = feat.properties.turnout_percent ?? 50;
            const color = turnout >= 52 ? "#10b981" : turnout >= 49 ? "#38bdf8" : "#f59e0b";
            const poly = L.polygon(coords, {
              color,
              fillColor: color,
              fillOpacity: 0.28,
              weight: 2,
              dashArray: "5, 4",
            });
            const partyRows = Object.entries(feat.properties.party_results ?? {})
              .map(([p, v]) => `<div>${p}: <strong>${v}</strong></div>`)
              .join("");
            poly.bindPopup(`
              <div style="font-family: sans-serif; color: #e2e8f0; min-width: 250px;">
                <div style="font-size: 11px; font-weight: bold; color: ${color}; text-transform: uppercase;">🗳️ Wahlbezirk · ${collection.municipality}</div>
                <div style="font-weight: bold; font-size: 14px; margin: 3px 0;">${feat.properties.name}</div>
                <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 6px;">Wahllokal: <strong>${feat.properties.polling_station_name ?? "Wahllokal"}</strong></div>
                <div style="background: rgba(15,23,42,0.85); padding: 6px 8px; border-radius: 6px; border: 1px solid #334155; font-size: 12px; margin-bottom: 6px;">
                  <div>Wahlbeteiligung: <strong style="color: ${color};">${turnout.toFixed(1)}%</strong></div>
                  <div>Wahlberechtigte: <strong>${feat.properties.eligible_voters?.toLocaleString("de-DE") ?? "–"}</strong></div>
                  <div>Gültige Stimmen: <strong>${feat.properties.valid_votes?.toLocaleString("de-DE") ?? "–"}</strong></div>
                  <div>Stärkste Kraft: <strong style="color: #60a5fa;">${feat.properties.winning_party ?? "–"}</strong></div>
                </div>
                ${partyRows ? `<div style="font-size: 11px; color: #94a3b8; display: grid; grid-template-columns: 1fr 1fr; gap: 2px;">${partyRows}</div>` : ""}
              </div>
            `);
            wahlGrp.addLayer(poly);
          }
        }
      }
    }

    // 11. Major Companies & Employers
    const compGroup = companiesGroupRef.current;
    if (compGroup) {
      compGroup.clearLayers();
      for (const comp of companies) {
        const icon = L.divIcon({
          html: createCompanyMarkerContent({
            name: comp.name,
            industry: comp.industry_sector,
            isHeadquarters: comp.is_headquarters,
          }),
          className: "map-sensor-icon",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        const marker = L.marker([comp.latitude, comp.longitude], { icon, zIndexOffset: 470 });
        marker.bindPopup(`
          <div style="font-family: sans-serif; color: #e2e8f0; min-width: 240px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <span style="font-size: 11px; font-weight: bold; color: #38bdf8; text-transform: uppercase;">🏢 Arbeitgeber & Standort</span>
              ${comp.is_headquarters ? '<span style="background: #f59e0b; color: #0f172a; font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 4px;">HAUPTSITZ</span>' : ''}
            </div>
            <div style="font-weight: bold; font-size: 15px; margin: 4px 0 2px;">${comp.name}</div>
            <div style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${comp.street_address}, ${comp.postal_code} ${comp.municipality_name ?? ""}${comp.district ? " (" + comp.district + ")" : ""}</div>
            <div style="background: rgba(15,23,42,0.85); padding: 8px 10px; border-radius: 6px; border: 1px solid #334155; font-size: 12px; display: flex; flex-direction: column; gap: 4px;">
              <div>Branche: <strong style="color: #f1f5f9;">${comp.industry_sector}</strong></div>
              <div>Beschäftigte: <strong style="color: #38bdf8;">${comp.employee_range}</strong></div>
              ${comp.turnover_estimated_range ? `<div>Umsatzklasse: <strong style="color: #10b981;">${comp.turnover_estimated_range}</strong></div>` : ""}
              ${comp.description ? `<div style="color: #cbd5e1; font-size: 11px; line-height: 1.35; margin-top: 2px;">${comp.description}</div>` : ""}
            </div>
            <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
              ${comp.website ? `<a href="${comp.website}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">Website ↗</a>` : '<span></span>'}
              <a href="/wirtschaft" style="color: #34d399; font-weight: 600;">Wirtschaftsportal →</a>
            </div>
          </div>
        `);
        compGroup.addLayer(marker);
      }
    }
  }, [ready, now, evChargers, wifiHotspots, roadSegments, broadbandAreas, companies]);


  return <div className="sensor-map relative w-full h-[480px] sm:h-[560px] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
    <div ref={container} className="w-full h-full z-0" aria-label="Sensorstandorte, gruppiert nach Nähe" />
    {failed ? <p role="alert" className="absolute inset-0 bg-slate-900 p-8">Die Karte konnte nicht geladen werden. Bitte lade die Seite erneut.</p> : null}

    {/* Commuter Corridor Quick Status Bar */}
    {trafficCorridors.length > 0 ? (
      <div className="absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-1 pointer-events-auto">
        <div className="commuter-corridor-bar">
          <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mr-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Ried-Korridore:
          </span>
          {trafficCorridors.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`corridor-pill corridor-pill-${c.status}`}
              title={`${c.name}: ${c.description} – Klick zum Fokussieren`}
              onClick={() => mapRef.current?.setView(c.center, c.zoom)}
            >
              <span className="font-bold">{c.roadName}</span>
              <span>
                {c.status === "clear" ? "🟢 Frei" : c.status === "sluggish" ? `🟡 +${c.delayMinutes}m` : `🔴 +${c.delayMinutes}m`}
              </span>
            </button>
          ))}
        </div>
      </div>
    ) : null}

    <div className="absolute top-3 right-3 z-[400] flex flex-wrap justify-end gap-2 max-w-[85%]">
      {/* Environment & Agriculture Layers */}
      <button
        type="button"
        className={`map-control ${showNatureAreas ? "border-emerald-500 text-emerald-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("nature", showNatureAreas, setShowNatureAreas)}
        title="Naturschutzgebiete & Schutzgebiete im Ried ein-/ausblenden"
      >
        🌿 Naturschutz {showNatureAreas ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showCropZones && zoom >= 13 ? "border-purple-400 text-purple-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("crops", showCropZones, setShowCropZones)}
        title={zoom < 13 ? "Landwirtschaftliche Kulturen ab Zoom 13 sichtbar" : "Kulturen & Spargelfelder ein-/ausblenden"}
      >
        🌾 Kulturen {showCropZones ? (zoom >= 13 ? "An" : "Zoom ≥13") : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showFloodGauges ? "border-sky-400 text-sky-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("floods", showFloodGauges, setShowFloodGauges)}
        title="Rhein- & Weschnitz-Pegel ein-/ausblenden"
      >
        🌊 Pegel {showFloodGauges ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showStarkregenWMS ? "border-blue-500 text-blue-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("starkregen", showStarkregenWMS, setShowStarkregenWMS)}
        title="Offizielle HLNUG Starkregengefahrenkarte Hessen ein-/ausblenden"
      >
        🌧️ Starkregen-WMS {showStarkregenWMS ? "An" : "Aus"}
      </button>

      {/* Infrastructure & Energy Layers */}
      <button
        type="button"
        className={`map-control ${showEvCharging ? "border-emerald-400 text-emerald-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("charging", showEvCharging, setShowEvCharging)}
        title="Elektro-Ladesäulen und Live-Belegung ein-/ausblenden"
      >
        ⚡ Ladesäulen {showEvCharging ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showEnergyFacilities ? "border-amber-400 text-amber-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("energy", showEnergyFacilities, setShowEnergyFacilities)}
        title="ZAKB Biogas & Solarparks im Ried ein-/ausblenden"
      >
        ☀️ Ökostrom {showEnergyFacilities ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showRoadConditions ? "border-lime-400 text-lime-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("road", showRoadConditions, setShowRoadConditions)}
        title="KI-Straßenzustandsbewertung (ZAKB-Flottensensoren) ein-/ausblenden"
      >
        🛣️ Straßen-KI {showRoadConditions ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showWifiHotspots ? "border-cyan-400 text-cyan-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("wifi", showWifiHotspots, setShowWifiHotspots)}
        title="Öffentliches WLAN (Hessen-WLAN & Freifunk) ein-/ausblenden"
      >
        📶 WLAN {showWifiHotspots ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showBroadband ? "border-purple-400 text-purple-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("broadband", showBroadband, setShowBroadband)}
        title="Glasfaser & Breitband-Gebietsabdeckung ein-/ausblenden"
      >
        🌐 Glasfaser {showBroadband ? "An" : "Aus"}
      </button>

      {/* Real Estate & Planning Layers */}
      <button
        type="button"
        className={`map-control ${showBoris ? "border-teal-400 text-teal-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("boris", showBoris, setShowBoris)}
        title="BORIS Hessen Bodenrichtwertzonen ein-/ausblenden"
      >
        🏡 Bodenrichtwerte {showBoris ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showDevPlans ? "border-amber-400 text-amber-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("devplans", showDevPlans, setShowDevPlans)}
        title="Bebauungspläne & Neubaugebiete (B-Pläne) ein-/ausblenden"
      >
        🏗️ B-Pläne {showDevPlans ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showWahlbezirke ? "border-purple-400 text-purple-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("elections", showWahlbezirke, setShowWahlbezirke)}
        title="Wahlbezirke & Wahlbeteiligung (Kommunalwahl) ein-/ausblenden"
      >
        🗳️ Wahlbezirke {showWahlbezirke ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showCompanies ? "border-sky-400 text-sky-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("companies", showCompanies, setShowCompanies)}
        title="Bedeutende Arbeitgeber & Gewerbestandorte ein-/ausblenden"
      >
        🏢 Arbeitgeber {showCompanies ? "An" : "Aus"}
      </button>


      {/* Mobility & Sensor Layers */}
      <button
        type="button"
        className={`map-control ${showClosures ? "border-red-500 text-red-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("closures", showClosures, setShowClosures)}
        title="Straßensperrungen und Baustellen im Ried ein-/ausblenden"
      >
        ⛔ Sperrungen ({streetClosures.filter((c) => isClosureActive(c, now)).length}) {showClosures ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showTraffic ? "border-amber-500 text-amber-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("traffic", showTraffic, setShowTraffic)}
        title="Verkehrslage und Staus im Ried ein-/ausblenden"
      >
        🚗 Verkehr {showTraffic ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showBuses ? "border-sky-500 text-sky-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("buses", showBuses, setShowBuses)}
        title="VRN Busse im Ried ein-/ausblenden"
      >
        🚌 Busse {showBuses ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showBusStops && zoom >= 13 ? "border-amber-500 text-amber-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("stops", showBusStops, setShowBusStops)}
        title={zoom < 13 ? "Haltestellen ab Zoomstufe 13 sichtbar (aktuell: Zoom " + zoom + ")" : "VRN Haltestellen ein-/ausblenden"}
      >
        🚏 Haltestellen {showBusStops ? (zoom >= 13 ? "An" : "Zoom ≥13") : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showWasteTrucks ? "border-emerald-500 text-emerald-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("waste", showWasteTrucks, setShowWasteTrucks)}
        title="ZAKB Müllabfuhr im Ried ein-/ausblenden"
      >
        🚛 Müllabfuhr {showWasteTrucks ? "An" : "Aus"}
      </button>
      <button
        type="button"
        className={`map-control ${showRailMobility ? "border-sky-500 text-sky-300 font-semibold" : "opacity-60"}`}
        onClick={() => toggleLayer("trains", showRailMobility, setShowRailMobility)}
        title="Züge und Bahnübergänge im Ried ein-/ausblenden"
      >
        🚅 Züge & BÜ {showRailMobility ? "An" : "Aus"}
      </button>
      <button type="button" className="map-control" onClick={() => {
        mapRef.current?.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
        onViewportChangeRef.current?.(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
      }}>Ried</button>
      <button type="button" className="map-control" disabled={!nodes.length} onClick={() => {
        if (nodes.length && mapRef.current) {
          const bounds = L.latLngBounds(nodes.map((n) => [n.lat, n.lng]));
          mapRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
          const c = mapRef.current.getCenter();
          const z = mapRef.current.getZoom();
          onViewportChangeRef.current?.([c.lat, c.lng], z);
        }
      }}>Alle Standorte</button>
    </div>
    {!nodes.length && ready ? <p className="absolute bottom-8 left-3 right-3 z-[400] rounded-xl bg-slate-950/95 p-4 text-sm text-slate-200">Keine Standorte für diese Auswahl. Wähle eine weitere Gruppe oder „Alle“.</p> : null}
  </div>;
}

