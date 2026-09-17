import { env } from "@/env";
import {
  calculateLiveEnergyGeneration,
  type LiveEnergySummary,
} from "@/lib/infrastructureData";

export async function GET() {
  let energyData: LiveEnergySummary = calculateLiveEnergyGeneration(Date.now());
  let sourceMode = "verified_local_model";

  try {
    const backendUrl = new URL("/api/v1/infrastructure/energy/summary", env.BACKEND_API_URL);
    const res = await fetch(backendUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const dbData = await res.json();
      if (Array.isArray(dbData.facilities) && dbData.facilities.length > 0) {
        energyData = {
          timestamp: dbData.timestamp,
          totalInstalledCapacityKw: dbData.total_installed_capacity_kw,
          currentTotalPowerKw: dbData.current_total_power_kw,
          currentTotalPowerMw: dbData.current_total_power_mw,
          todayTotalEnergyKwh: dbData.today_total_energy_kwh,
          todayCo2AvoidedKg: dbData.today_co2_avoided_kg,
          byTypeKw: dbData.by_type_kw,
          facilities: dbData.facilities.map((f: any) => ({
            id: f.id,
            name: f.name,
            facilityType: f.facility_type,
            operator: f.operator,
            municipality: f.municipality,
            address: f.address || "",
            lat: f.latitude,
            lng: f.longitude,
            installedCapacityKw: f.installed_capacity_kw,
            annualGenerationMwhEst: f.annual_generation_mwh_est,
            commissionedDate: f.commissioned_date,
            mastrId: f.mastr_id,
            description: f.description || "",
            currentPowerKw: f.current_power_kw || 0,
            todayYieldKwh: f.today_yield_kwh || 0,
          })),
        };
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
      ...energyData,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
