import { NextRequest } from "next/server";
import { env } from "@/env";
import {
  type RoadSegment,
  VERIFIED_ROAD_SEGMENTS,
} from "@/lib/infrastructureData";

export async function GET(request: NextRequest) {
  const municipalityParam = request.nextUrl.searchParams.get("municipality");
  let segments: RoadSegment[] = VERIFIED_ROAD_SEGMENTS;
  let sourceMode = "verified_local_model";

  try {
    const backendUrl = new URL("/api/v1/infrastructure/road-conditions", env.BACKEND_API_URL);
    if (municipalityParam) {
      backendUrl.searchParams.set("municipality", municipalityParam);
    }
    const res = await fetch(backendUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.segments) && data.segments.length > 0) {
        segments = data.segments.map((s: any) => ({
          id: s.id,
          roadName: s.road_name,
          roadClass: s.road_class,
          municipality: s.municipality,
          district: s.district || "",
          conditionGrade: s.condition_grade,
          conditionCategory: s.condition_category,
          potholesCount: s.potholes_count,
          crackingSeverity: s.cracking_severity,
          surfaceType: s.surface_type,
          lastInspectedAt: s.last_inspected_at,
          inspectedBy: s.inspected_by,
          coordinates: s.coordinates,
        }));
        sourceMode = "database_timescaledb";
      }
    }
  } catch {
    // Graceful fallback to verified local model
  }

  if (municipalityParam && sourceMode === "verified_local_model") {
    segments = segments.filter(
      (s) => s.municipality.toLowerCase() === municipalityParam.toLowerCase()
    );
  }

  const total = segments.length;
  const avgGrade = total > 0 ? segments.reduce((sum, s) => sum + s.conditionGrade, 0) / total : 2.0;
  const goodPct = total > 0 ? (segments.filter((s) => s.conditionGrade <= 2.5).length / total) * 100 : 0;
  const critPct = total > 0 ? (segments.filter((s) => s.conditionGrade >= 4.0).length / total) * 100 : 0;

  return Response.json(
    {
      generated_at: new Date().toISOString(),
      source_mode: sourceMode,
      summary: {
        total_segments: total,
        average_condition_grade: Math.round(avgGrade * 100) / 100,
        good_condition_pct: Math.round(goodPct * 10) / 10,
        critical_condition_pct: Math.round(critPct * 10) / 10,
        inspection_system: "KI-basiertes Straßenzustandsmonitoring Kreis Bergstraße & ZAKB-Flotte",
      },
      segments,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
