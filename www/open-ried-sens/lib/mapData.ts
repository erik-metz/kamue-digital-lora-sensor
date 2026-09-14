export const CATEGORIES = {
  weather: { label: "Wetter & Klima", color: "#f59e0b", path: "M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0Z M12 9v8" },
  soil: { label: "Boden & Bewässerung", color: "#84cc16", path: "M20 4C9 3 3 7 5 14c2 7 14 6 15-10Z M4 21l11-11" },
  water: { label: "Wasserstände", color: "#38bdf8", path: "M2 7q3-4 6 0t6 0t6 0 M2 12q3-4 6 0t6 0t6 0 M2 17q3-4 6 0t6 0t6 0" },
  air: { label: "Luftqualität", color: "#2dd4bf", path: "M3 8h12a3 3 0 1 0-3-3 M2 12h17a3 3 0 1 1-3 3 M4 16h5a3 3 0 1 1-3 3" },
  parking: { label: "Parken", color: "#a78bfa", path: "M8 20V4h5a5 5 0 0 1 0 10H8" },
  seismic: { label: "Erschütterungen", color: "#f472b6", path: "M2 12h4l3-8 5 16 3-8h5" },
  other: { label: "Weitere Sensoren", color: "#94a3b8", path: "M12 3v3 M12 18v3 M3 12h3 M18 12h3 M8 8h8v8H8Z" },
} as const;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as Category[];
export type Reading = { metric: string; value: number; unit: string; timestamp: string };
export type MapMode = "category" | "temperature";
export type Freshness = "fresh" | "stale" | "unknown" | "state";
export type ApiMapSensor = {
  id: string; friendly_name: string; latitude: number | null; longitude: number | null;
  description?: string | null; is_hidden?: boolean; entity_type?: string | null;
  source_entity_id?: string | null; readings?: Reading[];
};
export interface SensorNode {
  id: string; name: string; locationName: string; address: string; lat: number; lng: number;
  categories: Category[]; readings: Reading[];
}

export function categoriesFor(sensor: ApiMapSensor): Category[] {
  const categories = new Set<Category>();
  const type = sensor.entity_type ?? sensor.description?.match(/urn:ngsi-ld:([A-Za-z]+):/)?.[1];
  const soil = type === "GreenspaceRecord" || /bodentemperatur/i.test(sensor.friendly_name);
  for (const r of sensor.readings ?? []) {
    if (["temperature", "soil_temperature", "humidity", "relative_humidity", "precipitation"].includes(r.metric))
      categories.add(r.metric === "soil_temperature" || (r.metric === "temperature" && soil) ? "soil" : "weather");
    if (["water_surface_distance", "soil_moisture"].includes(r.metric)) categories.add("soil");
    if (["water_level_delta", "water_level"].includes(r.metric)) categories.add("water");
    if (["air_quality_index", "NO2", "PM10", "PM25", "O3"].includes(r.metric)) categories.add("air");
    if (r.metric.startsWith("parking_")) categories.add("parking");
    if (["pgv", "rms", "waveform"].includes(r.metric)) categories.add("seismic");
    if (r.metric === "value" && ["°C", "celsius", "CEL"].includes(r.unit)) categories.add(soil ? "soil" : "weather");
  }
  if (!categories.size) {
    if (sensor.id.startsWith("shake-")) categories.add("seismic");
    else if (type === "WeatherObserved") categories.add(soil ? "soil" : "weather");
    else if (type === "GreenspaceRecord") categories.add("soil");
    else if (type === "FloodMonitoring") categories.add("water");
    else if (type === "AirQualityObserved") categories.add("air");
    else if (type?.startsWith("Parking")) categories.add("parking");
    else categories.add("other");
  }
  return CATEGORY_IDS.filter(id => categories.has(id));
}

export function toMapNodes(sensors: ApiMapSensor[]): SensorNode[] {
  return sensors.filter(s => !s.is_hidden && s.latitude != null && s.longitude != null &&
    Number.isFinite(s.latitude) && Number.isFinite(s.longitude) && Math.abs(s.latitude) <= 90 && Math.abs(s.longitude) <= 180)
    .map(s => ({ id: s.id, name: s.friendly_name, locationName: s.friendly_name,
      address: s.description ?? "", lat: s.latitude!, lng: s.longitude!, categories: categoriesFor(s),
      readings: (s.readings ?? []).filter(r => Number.isFinite(r.value) && Number.isFinite(Date.parse(r.timestamp))),
    }));
}

export function readingFreshness(reading: Reading | undefined, now: number): Freshness {
  if (!reading) return "unknown";
  const age = now - Date.parse(reading.timestamp);
  if (!Number.isFinite(age) || age < -300_000) return "unknown";
  if (reading.metric.startsWith("parking_")) return "state"; // Event-driven, not an online indicator.
  const threshold = ["pgv", "rms"].includes(reading.metric) ? 120_000 :
    reading.metric.startsWith("soil_") || reading.metric === "water_surface_distance" ? 6 * 3600_000 :
    reading.metric === "air_quality_index" ? 3 * 3600_000 : 2 * 3600_000;
  return age <= threshold ? "fresh" : "stale";
}

export function temperatureReading(node: SensorNode) {
  return node.readings.find(r => ["temperature", "soil_temperature", "value"].includes(r.metric) && ["°C", "celsius", "CEL"].includes(r.unit));
}
export function primaryReading(node: SensorNode, category: Category, mode: MapMode): Reading | undefined {
  if (mode === "temperature") return temperatureReading(node);
  const preferred: Record<Category, string[]> = {
    weather: ["temperature", "relative_humidity", "humidity", "precipitation", "value"],
    soil: ["soil_temperature", "temperature", "water_surface_distance", "soil_moisture"],
    water: ["water_level_delta", "water_level"], air: ["air_quality_index", "PM25", "PM10", "NO2"],
    parking: ["parking_free", "parking_occupied", "parking_capacity"], seismic: ["pgv", "rms"], other: [],
  };
  return preferred[category].map(m => node.readings.find(r => r.metric === m)).find(Boolean) ?? node.readings[0];
}
export function visibleNodes(nodes: SensorNode[], categories: Category[], mode: MapMode) {
  return nodes.filter(n => n.categories.some(c => categories.includes(c)) && (mode !== "temperature" || temperatureReading(n)));
}
export function markerCategory(node: SensorNode, selected: Category[]) {
  return node.categories.find(c => selected.includes(c)) ?? node.categories[0];
}
export function temperatureColor(value: number) {
  return value < 0 ? "#818cf8" : value < 10 ? "#38bdf8" : value < 20 ? "#2dd4bf" : value < 30 ? "#fbbf24" : "#fb7185";
}
export function valueLabel(reading: Reading | undefined) {
  if (!reading) return "";
  const value = reading.value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  return reading.metric === "parking_free" ? `${value} frei` : reading.metric === "parking_occupied" ? `${value} belegt` :
    `${value} ${["celsius", "CEL"].includes(reading.unit) ? "°C" : reading.unit}`;
}
export function observationLabel(reading: Reading | undefined, now: number) {
  if (!reading) return "Keine Messdaten";
  const label = { fresh: "Aktueller Messwert", stale: "Älterer Messwert", state: "Zuletzt gemeldeter Zustand", unknown: "Zeitpunkt unbekannt" }[readingFreshness(reading, now)];
  return `${label} · ${new Date(reading.timestamp).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}`;
}

export function parseStoredCategories(raw: string | null): Category[] {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (Array.isArray(value) && value.every(v => CATEGORY_IDS.includes(v as Category))) return [...new Set(value)] as Category[];
  } catch { /* Unavailable or old preferences use the default. */ }
  return CATEGORY_IDS;
}
