import type { StationNode } from "./mapData";

export interface PitchRawReading {
  sensor_id: string;
  timestamp: string;
  metric: string | null;
  value: number;
  unit: string;
}

export function presentationStart(value: string | null, now: number): number | null {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= now && time >= now - 2 * 60 * 60 * 1000 ? time : null;
}

export const PITCH_CATEGORIES = [
  { id: "crossings", label: "Bahnübergänge" },
  { id: "parking", label: "Parkplätze" },
  { id: "bikes", label: "Leihräder" },
  { id: "weather", label: "Wetter" },
  { id: "air", label: "Luftqualität" },
  { id: "water", label: "Wasserstände" },
] as const;
export type PitchCategoryId = typeof PITCH_CATEGORIES[number]["id"];

export function pitchStationCategory(node: StationNode): PitchCategoryId | undefined {
  return PITCH_CATEGORIES.find(({ id }) => id !== "crossings" && node.categories.includes(id))?.id;
}

export function selectPitchStations(nodes: StationNode[]): StationNode[] {
  const candidates = nodes.filter((node) => !node.isAggregate &&
    !/^(bu-|crossing:|movement:|forecast-|model-)|forecast|prediction/i.test(node.id) &&
    !node.categories.includes("seismic") && pitchStationCategory(node) &&
    node.readings.some((reading) => Number.isFinite(Date.parse(reading.timestamp))));
  candidates.sort((a, b) => Math.max(...b.readings.map((reading) => Date.parse(reading.timestamp) || 0)) - Math.max(...a.readings.map((reading) => Date.parse(reading.timestamp) || 0)));
  const selected: StationNode[] = [];
  for (const { id } of PITCH_CATEGORIES) {
    const station = candidates.find((node) => pitchStationCategory(node) === id);
    if (station) selected.push(station);
  }
  for (const node of candidates) {
    if (selected.length >= 8) break;
    if (!selected.some((entry) => entry.id === node.id)) selected.push(node);
  }
  return selected;
}

export interface PitchCategoryResult {
  id: PitchCategoryId;
  label: string;
  count: number | null;
  unavailable: boolean;
  truncated: boolean;
  sample?: PitchRawReading & { station: string };
  model: boolean;
}

/** Crossing states are current model estimates, never measured raw telemetry. */
export function pitchCrossingCategory(payload: unknown, start: number, end: number): PitchCategoryResult {
  const base = { ...PITCH_CATEGORIES[0], count: null, truncated: false, model: true };
  if (!payload || typeof payload !== "object" || !("crossings" in payload) || !Array.isArray(payload.crossings)) {
    return { ...base, unavailable: true };
  }
  const samples = payload.crossings.flatMap((crossing) => {
    if (!crossing || crossing.basis !== "model" || typeof crossing.entity_id !== "string" ||
        typeof crossing.name !== "string" || typeof crossing.timestamp !== "string" ||
        !(Date.parse(crossing.timestamp) > start && Date.parse(crossing.timestamp) <= end) ||
        !(Date.parse(crossing.valid_until) > end)) return [];
    const states: Record<string, number> = { open: 0, closing_soon: 1, closed: 2 };
    const value = states[crossing.status];
    return typeof value !== "number" ? [] : [{ sensor_id: crossing.entity_id, station: crossing.name,
      metric: "crossing_state", value, unit: "state", timestamp: crossing.timestamp }];
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return { ...base, unavailable: !("crossings_available" in payload && payload.crossings_available === true), sample: samples[0] };
}

/** Preserve zeroes, reject malformed responses, and count each raw row only once. */
export function rawReadingsInWindow(payload: unknown, sensorId: string, start: number, end: number): PitchRawReading[] {
  if (!Array.isArray(payload)) throw new Error("Invalid raw response");
  const rows: PitchRawReading[] = [];
  const seen = new Set<string>();
  for (const entry of payload) {
    if (!entry || typeof entry !== "object" || entry.sensor_id !== sensorId ||
        typeof entry.timestamp !== "string" || !Number.isFinite(Date.parse(entry.timestamp)) ||
        typeof entry.value !== "number" || !Number.isFinite(entry.value) || typeof entry.unit !== "string" ||
        !(typeof entry.metric === "string" || entry.metric === null)) throw new Error("Invalid raw reading");
    const timestamp = Date.parse(entry.timestamp);
    if (timestamp <= start || timestamp > end) continue;
    const key = JSON.stringify([entry.sensor_id, timestamp, entry.metric, entry.unit]);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(entry);
  }
  return rows.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export interface PitchWindowResult {
  startedAt: string;
  checkedAt: string;
  count: number;
  stations: { id: string; name: string; count: number; unavailable: boolean; truncated: boolean }[];
  samples: (PitchRawReading & { station: string })[];
  categories: PitchCategoryResult[];
}
