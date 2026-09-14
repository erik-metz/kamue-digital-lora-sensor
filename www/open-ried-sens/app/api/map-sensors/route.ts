import { fetchMapData } from "@/lib/mapBackend";

export async function GET() {
  try {
    return Response.json(await fetchMapData(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Kartendaten konnten nicht geladen werden." }, { status: 502 });
  }
}
