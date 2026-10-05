import { env } from "@/env";

const TOPICS = new Set(["all", "temperature", "mobility", "roadworks"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sample = params.get("sample") === "1";
  const topic = params.get("topic") || "all";
  const error = (message: string, status: number) => Response.json({ error: message }, { status });
  if (!TOPICS.has(topic)) return error("Bitte ein gültiges Thema auswählen.", 400);
  const query = new URLSearchParams({ topic, sample: String(sample) });
  if (!sample) {
    for (const key of ["start", "end"]) {
      const value = params.get(key) || "";
      const date = new Date(`${value}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        return error("Bitte gültige Datumsangaben wählen.", 400);
      }
      query.set(key, value);
    }
    const days = (Date.parse(query.get("end")!) - Date.parse(query.get("start")!)) / 86400000;
    if (days < 0 || days >= 31) return error("Bitte einen Zeitraum von höchstens 31 Tagen wählen (Start vor Ende).", 400);
  }
  try {
    const url = new URL("/api/v1/downloads", env.BACKEND_API_URL);
    url.search = query.toString();
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(45000) });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      return error(typeof body?.detail === "string" ? body.detail : "Daten konnten nicht geladen werden. Bitte später erneut versuchen.", response.status);
    }
    if (!response.headers.get("Content-Type")?.startsWith("application/zip")) throw new Error("Invalid download format");
    // Stream the bounded backend ZIP instead of buffering a second copy here.
    return new Response(response.body, { headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="open-ried-sens-${sample ? "sample" : `${topic}-${query.get("start")}-${query.get("end")}`}.zip"`,
      "Cache-Control": "no-store",
    } });
  } catch {
    return error("Der Datenexport ist momentan nicht erreichbar. Bitte später erneut versuchen.", 502);
  }
}
