import { env } from "@/env";
import {
  type EvChargingStation,
  VERIFIED_EV_CHARGERS,
} from "@/lib/infrastructureData";

export async function GET() {
  let stations: EvChargingStation[] = VERIFIED_EV_CHARGERS;
  let sourceMode = "verified_local_model";

  try {
    const backendUrl = new URL("/api/v1/infrastructure/ev-charging", env.BACKEND_API_URL);
    const res = await fetch(backendUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.stations) && data.stations.length > 0) {
        stations = data.stations.map((s: any) => ({
          id: s.id,
          bnetzaId: s.bnetza_id,
          name: s.name,
          operator: s.operator,
          address: s.address,
          municipality: s.municipality,
          district: s.district,
          lat: s.latitude,
          lng: s.longitude,
          totalPoints: s.total_points,
          maxPowerKw: s.max_power_kw,
          isFastCharger: s.is_fast_charger,
          connectorTypes: s.connector_types,
          isPublic: s.is_public,
          availablePoints: s.available_points,
          occupiedPoints: s.occupied_points,
          statusSource: s.status_source,
        }));
        sourceMode = "database_timescaledb";
      }
    }
  } catch {
    // Graceful fallback to verified local model
  }

  const totalPoints = stations.reduce((sum, s) => sum + s.totalPoints, 0);
  const availablePoints = stations.reduce((sum, s) => sum + s.availablePoints, 0);
  const fastChargers = stations.filter((s) => s.isFastCharger).length;

  return Response.json(
    {
      generated_at: new Date().toISOString(),
      source_mode: sourceMode,
      summary: {
        total_stations: stations.length,
        total_charge_points: totalPoints,
        available_charge_points: availablePoints,
        occupied_charge_points: totalPoints - availablePoints,
        fast_charging_stations: fastChargers,
      },
      stations,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
