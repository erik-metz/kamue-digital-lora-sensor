import { env } from "@/env";
import {
  type WifiHotspot,
  VERIFIED_WIFI_HOTSPOTS,
} from "@/lib/infrastructureData";

export async function GET() {
  let hotspots: WifiHotspot[] = VERIFIED_WIFI_HOTSPOTS;
  let sourceMode = "verified_local_model";

  try {
    const backendUrl = new URL("/api/v1/infrastructure/wifi-hotspots", env.BACKEND_API_URL);
    const res = await fetch(backendUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        hotspots = data.map((w: any) => ({
          id: w.id,
          name: w.name,
          ssid: w.ssid,
          operator: w.operator,
          locationType: w.location_type,
          address: w.address,
          municipality: w.municipality,
          lat: w.latitude,
          lng: w.longitude,
          indoorOutdoor: w.indoor_outdoor,
          authMode: w.auth_mode,
          bandwidthMbps: w.bandwidth_mbps,
          isActive: w.is_active,
        }));
        sourceMode = "database_timescaledb";
      }
    }
  } catch {
    // Graceful fallback to verified local model
  }

  return Response.json(
    {
      generated_at: new Date().toISOString(),
      source_mode: sourceMode,
      summary: {
        total_hotspots: hotspots.length,
        free_ssids: Array.from(new Set(hotspots.map((h) => h.ssid))),
        municipalities: Array.from(new Set(hotspots.map((h) => h.municipality))),
      },
      hotspots,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
