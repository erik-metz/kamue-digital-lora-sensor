import { env } from "@/env";
import { fetchMapData } from "@/lib/mapBackend";
import { PITCH_CATEGORIES, pitchStationCategory, pitchCrossingCategory, presentationStart, rawReadingsInWindow, selectPitchStations, type PitchWindowResult } from "@/lib/pitchWindow";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const end = Date.now();
  const start = presentationStart(params.get("start"), end);
  const headers = { "Cache-Control": "no-store" };
  if (start === null) return Response.json({ error: "Der Vortragsbeginn muss innerhalb der letzten zwei Stunden liegen." }, { status: 400, headers });
  try {
    const { nodes } = await fetchMapData();
    const requested = params.get("stations");
    const ids = requested ? requested.split(",") : null;
    if (ids && (ids.length > 8 || ids.some((id) => !id || id.length > 64))) return Response.json({ error: "Ungültige Stationsauswahl." }, { status: 400, headers });
    const stations = ids ? nodes.filter((node) => ids.includes(node.id)) : selectPitchStations(nodes);
    if (ids && stations.length !== new Set(ids).size) throw new Error("Station inventory changed");
    const crossingPromise = fetch(new URL("/api/v1/movements/latest", env.BACKEND_API_URL), {
      cache: "no-store", signal: AbortSignal.timeout(12000),
    }).then(async (response) => pitchCrossingCategory(response.ok ? await response.json() : null, start, end))
      .catch(() => pitchCrossingCategory(null, start, end));
    const results = await Promise.all(stations.map(async (station) => {
      const base = { id: station.id, name: station.name, category: pitchStationCategory(station) };
      const url = new URL("/api/v1/telemetry/raw", env.BACKEND_API_URL);
      url.search = new URLSearchParams({ sensor_id: station.id, start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString(), limit: "1000" }).toString();
      try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error("Raw data unavailable");
        const payload: unknown = await response.json();
        const rows = rawReadingsInWindow(payload, station.id, start, end);
        return { ...base, rows, count: rows.length, unavailable: false, truncated: Array.isArray(payload) && payload.length >= 1000 };
      } catch {
        return { ...base, rows: [], count: 0, unavailable: true, truncated: false };
      }
    }));
    const crossing = await crossingPromise;
    if (results.every((result) => result.unavailable) && crossing.unavailable) return Response.json({ error: "Rohdaten konnten aktuell nicht abgefragt werden." }, { status: 503, headers });
    const categories = PITCH_CATEGORIES.map((category) => {
      if (category.id === "crossings") return crossing;
      const entries = results.filter((station) => station.category === category.id);
      const rows = entries.flatMap((station) => station.rows.map((row) => ({ ...row, station: station.name })))
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
      return { ...category, count: entries.reduce((sum, station) => sum + station.count, 0),
        unavailable: !entries.length || entries.some((station) => station.unavailable),
        truncated: entries.some((station) => station.truncated), model: false, sample: rows.find((row) => ({
          parking: ["parking_free", "parking_occupied"], bikes: ["bike_available"],
          weather: ["temperature", "relative_humidity"], air: ["PM10", "PM25", "PM2.5", "NO2"],
          water: ["water_level", "river_level", "river_water_level", "groundwater_level"],
        }[category.id].includes(row.metric ?? ""))) ?? rows[0] };
    });
    const body: PitchWindowResult = {
      startedAt: new Date(start).toISOString(), checkedAt: new Date(end).toISOString(),
      count: results.reduce((total, station) => total + station.count, 0),
      stations: results.map((station) => ({ id: station.id, name: station.name, count: station.count, unavailable: station.unavailable, truncated: station.truncated })),
      categories,
      samples: categories.flatMap((category) => category.sample && !category.model ? [category.sample] : []),
    };
    return Response.json(body, { headers });
  } catch {
    return Response.json({ error: "Die Datenbasis ist derzeit nicht erreichbar." }, { status: 503, headers });
  }
}
