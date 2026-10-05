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

export function selectPitchStations(nodes: StationNode[]): StationNode[] {
  const candidates = nodes.filter((node) => !node.isAggregate &&
    !/^(bu-|forecast-|model-)|forecast|prediction/i.test(node.id) &&
    node.categories.some((category) => ["weather", "air", "water", "soil", "seismic"].includes(category)) &&
    node.readings.some((reading) => Number.isFinite(Date.parse(reading.timestamp))));
  candidates.sort((a, b) => Math.max(...b.readings.map((reading) => Date.parse(reading.timestamp) || 0)) - Math.max(...a.readings.map((reading) => Date.parse(reading.timestamp) || 0)));
  const selected: StationNode[] = [];
  const categories = new Set<string>();
  for (const node of candidates) {
    if (node.categories.some((category) => !categories.has(category))) {
      selected.push(node);
      node.categories.forEach((category) => categories.add(category));
    }
  }
  for (const node of candidates) {
    if (selected.length >= 8) break;
    if (!selected.some((entry) => entry.id === node.id)) selected.push(node);
  }
  return selected.slice(0, 8);
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
}
