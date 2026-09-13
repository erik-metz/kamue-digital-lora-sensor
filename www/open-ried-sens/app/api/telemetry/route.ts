import { env } from "@/env";

export async function GET(request: Request) {
  const sensorId = new URL(request.url).searchParams.get("sensor_id");
  if (!sensorId || sensorId.length > 64) {
    return Response.json({ error: "Ungültige Station." }, { status: 400 });
  }
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const latest = new URL("/api/v1/telemetry/latest/metrics", env.BACKEND_API_URL);
  latest.searchParams.set("sensor_id", sensorId);
  const history = new URL("/api/v1/telemetry/aggregates", env.BACKEND_API_URL);
  history.search = new URLSearchParams({ sensor_id: sensorId, interval: "5 minutes", start_time: start.toISOString(), end_time: end.toISOString() }).toString();
  try {
    const responses = await Promise.all([latest, history].map(url => fetch(url, {
      cache: "no-store", signal: AbortSignal.timeout(15000),
    })));
    if (responses.some(response => !response.ok)) throw new Error("Backend unavailable");
    const [readings, buckets] = await Promise.all(responses.map(response => response.json()));
    return Response.json({ readings, history: buckets, start: start.toISOString(), end: end.toISOString() });
  } catch {
    return Response.json({ error: "Messdaten konnten nicht geladen werden." }, { status: 502 });
  }
}
