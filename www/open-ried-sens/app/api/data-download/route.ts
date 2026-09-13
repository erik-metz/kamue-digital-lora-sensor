import { env } from "@/env";

// Quote strings and neutralize spreadsheet formulas; numeric negatives stay numeric.
function cell(value: string | number | null) {
  if (typeof value === "number") return String(value);
  let text = value ?? "";
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sensor = params.get("sensor_id");
  const metric = params.get("metric") || "";
  const sample = params.get("sample") === "1";
  const error = (message: string, status: number) => Response.json({ error: message }, { status });
  if (!sensor || sensor.length > 64 || metric.length > 64) return error("Bitte eine gültige Station und Messgröße wählen.", 400);
  const end = sample ? new Date() : new Date(`${params.get("end")}T23:59:59.999Z`);
  const start = sample ? new Date(end.getTime() - 30 * 86400000) : new Date(`${params.get("start")}T00:00:00.000Z`);
  if (!sample && ["start", "end"].some(key => {
    const value = params.get(key) || "";
    const date = new Date(`${value}T00:00:00Z`);
    return !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value;
  })) return error("Bitte gültige Datumsangaben wählen.", 400);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end || end.getTime() - start.getTime() > 31 * 86400000) {
    return error("Bitte einen Zeitraum von höchstens 31 Tagen wählen (Start vor Ende).", 400);
  }
  const url = new URL("/api/v1/telemetry/raw", env.BACKEND_API_URL);
  url.search = new URLSearchParams({ sensor_id: sensor, start_time: start.toISOString(), end_time: end.toISOString(), limit: sample ? "100" : "5000", ...(metric ? { metric } : {}) }).toString();
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("Backend unavailable");
    const rows: { timestamp: string; sensor_id: string; metric: string | null; value: number; unit: string }[] = await response.json();
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row.timestamp !== "string" || typeof row.sensor_id !== "string" || typeof row.unit !== "string" || (row.metric !== null && typeof row.metric !== "string") || typeof row.value !== "number" || !Number.isFinite(row.value))) throw new Error("Invalid readings");
    if (!rows.length) return error("Für diese Auswahl sind keine Messdaten vorhanden. Bitte eine andere Station oder einen anderen Zeitraum wählen.", 404);
    if (!sample && rows.length >= 5000) return error("Die Auswahl enthält zu viele Messwerte. Bitte den Zeitraum verkürzen oder eine Messgröße auswählen. Es wurde keine unvollständige Datei erstellt.", 422);
    const csv = "\uFEFFtimestamp,sensor_id,metric,value,unit\r\n" + rows.map(row => [row.timestamp, row.sensor_id, row.metric, row.value, row.unit].map(cell).join(",")).join("\r\n") + "\r\n";
    return new Response(csv, { headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="open-ried-sens-${sample ? "sample" : "data"}-${start.toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    } });
  } catch {
    return error("Messdaten konnten nicht geladen werden. Bitte später erneut versuchen.", 502);
  }
}
