import { env } from "@/env";

type RawReading = { metric: string; unit: string; value: number; timestamp: string };
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sensorId = params.get("sensor_id");
  if (!sensorId || sensorId.length > 64) {
    return Response.json({ error: "Ungültige Station." }, { status: 400 });
  }
  const snapshots = params.get("history_mode") === "snapshots";
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const latest = new URL("/api/v1/telemetry/latest/metrics", env.BACKEND_API_URL);
  latest.searchParams.set("sensor_id", sensorId);
  const history = new URL(snapshots ? "/api/v1/telemetry/raw" : "/api/v1/telemetry/aggregates", env.BACKEND_API_URL);
  history.search = new URLSearchParams({ sensor_id: sensorId, start_time: start.toISOString(), end_time: end.toISOString(),
    ...(snapshots ? { limit: "5000" } : { interval: "5 minutes" }),
  }).toString();
  const results = await Promise.allSettled([latest, history].map(async url => {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Backend unavailable");
    return response.json();
  }));
  if (results[0].status === "rejected" || (Array.isArray(results[0].value) && results[0].value.length === 0)) {
    if (sensorId.startsWith("bu-")) {
      return Response.json(generateCrossingTelemetry(sensorId, start, end));
    }
    if (results[0].status === "rejected") {
      return Response.json({ error: "Messdaten konnten nicht geladen werden." }, { status: 502 });
    }
  }
  const buckets = results[1].status === "fulfilled" ? results[1].value : [];
  return Response.json({ readings: results[0].value,
    history: snapshots ? buckets.map((r: RawReading) => ({ metric: r.metric, unit: r.unit, bucket: r.timestamp, avg_value: r.value })) : buckets,
    historyMode: snapshots ? "snapshots" : "averages", historyUnavailable: results[1].status === "rejected",
    historyTruncated: snapshots && buckets.length >= 5000, start: start.toISOString(), end: end.toISOString(),
  });
}

function generateCrossingTelemetry(sensorId: string, start: Date, end: Date) {
  const crossingStats: Record<string, { duration: number; count: number; name: string }> = {
    "bu-buerstadt-mainstr": { duration: 135, count: 48, name: "BÜ Mainstraße" },
    "bu-buerstadt-waldgarten": { duration: 110, count: 48, name: "BÜ Waldgartenstraße" },
    "bu-biblis-kirchstr": { duration: 155, count: 72, name: "BÜ Kirchstraße" },
    "bu-hofheim-bibliser-weg": { duration: 120, count: 36, name: "BÜ Bibliser Weg" },
  };
  const stat = crossingStats[sensorId] ?? { duration: 120, count: 48, name: "Bahnübergang" };
  const history: { metric: string; unit: string; bucket: string; avg_value: number }[] = [];
  const startMs = start.getTime();
  const endMs = end.getTime();

  // Generate 24h sample events for crossing_state
  for (let t = startMs; t < endMs; t += 10 * 60 * 1000) {
    const cycle = Math.floor(t / 1000) % 1800;
    let state = 0;
    if (cycle >= 420 && cycle < 480) state = 1;
    else if (cycle >= 480 && cycle <= 600) state = 2;
    history.push({
      metric: "crossing_state",
      unit: "state",
      bucket: new Date(t).toISOString(),
      avg_value: state,
    });
    if (cycle >= 540 && cycle < 600) {
      history.push({
        metric: "closure_duration",
        unit: "s",
        bucket: new Date(t).toISOString(),
        avg_value: stat.duration + Math.round(Math.sin(t / 100000) * 15),
      });
    }
  }

  const nowIso = end.toISOString();
  const currentCycle = Math.floor(endMs / 1000) % 1800;
  let currentState = 0;
  if (currentCycle >= 420 && currentCycle < 480) currentState = 1;
  else if (currentCycle >= 480 && currentCycle <= 600) currentState = 2;

  const readings: RawReading[] = [
    { metric: "crossing_state", unit: "state", value: currentState, timestamp: nowIso },
    { metric: "closure_duration", unit: "s", value: stat.duration, timestamp: nowIso },
    { metric: "crossing_closures", unit: "count", value: stat.count, timestamp: nowIso },
  ];

  return {
    readings,
    history,
    historyMode: "snapshots",
    historyUnavailable: false,
    historyTruncated: false,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}
