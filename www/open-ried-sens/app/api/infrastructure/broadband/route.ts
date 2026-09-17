import { env } from "@/env";
import {
  type BroadbandArea,
  VERIFIED_BROADBAND_AREAS,
} from "@/lib/infrastructureData";

export async function GET() {
  let areas: BroadbandArea[] = VERIFIED_BROADBAND_AREAS;
  let sourceMode = "verified_local_model";

  try {
    const backendUrl = new URL("/api/v1/infrastructure/broadband", env.BACKEND_API_URL);
    const res = await fetch(backendUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.areas) && data.areas.length > 0) {
        areas = data.areas.map((a: any) => ({
          id: a.id,
          municipality: a.municipality,
          district: a.district,
          areaName: a.area_name,
          techType: a.tech_type,
          maxDownloadMbps: a.max_download_mbps,
          maxUploadMbps: a.max_upload_mbps,
          rolloutStatus: a.rollout_status,
          contractQuotaPct: a.contract_quota_pct,
          primaryProvider: a.primary_provider,
          completionTargetDate: a.completion_target_date,
          coordinates: a.coordinates,
        }));
        sourceMode = "database_timescaledb";
      }
    }
  } catch {
    // Graceful fallback to verified local model
  }

  const activeFibre = areas.filter((a) => a.techType === "ftth_fibre" && a.rolloutStatus === "active_available").length;
  const inConstruction = areas.filter((a) => a.rolloutStatus === "under_construction").length;

  return Response.json(
    {
      generated_at: new Date().toISOString(),
      source_mode: sourceMode,
      summary: {
        total_areas: areas.length,
        active_fibre_areas: activeFibre,
        in_construction_areas: inConstruction,
      },
      areas,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
