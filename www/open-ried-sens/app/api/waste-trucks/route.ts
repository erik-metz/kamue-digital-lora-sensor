import { env } from "@/env";
import {
  calculateWasteTruckMobility,
  ZAKB_DEPOTS,
  ZAKB_TOURS,
  WASTE_FRACTIONS,
  type LiveWasteTruck,
} from "@/lib/wasteTruckMobility";

interface DbWasteTruckPosition {
  timestamp: string;
  truck_id: string;
  tour_code: string;
  fraction: string;
  latitude: float;
  longitude: float;
  heading?: number;
  speed_kmh: number;
  status: "collecting" | "bin_emptying" | "transit" | "depot";
  current_street?: string;
  next_street?: string;
  load_percent?: number;
  empty_countdown_sec?: number;
  position_basis: string;
}

type float = number;

export async function GET() {
  const localMobility = calculateWasteTruckMobility(Date.now());
  let liveTrucks: LiveWasteTruck[] = localMobility.trucks;
  let sourceMode = "local_model";

  // If the backend database API is configured and accessible, attempt to read recorded positions
  try {
    const backendUrl = new URL("/api/v1/waste-trucks/positions/latest", env.BACKEND_API_URL);
    const res = await fetch(backendUrl, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const dbPositions = (await res.json()) as DbWasteTruckPosition[];
      if (Array.isArray(dbPositions) && dbPositions.length > 0) {
        liveTrucks = localMobility.trucks.map((truck) => {
          const dbPos = dbPositions.find((p) => p.truck_id === truck.id);
          if (dbPos) {
            return {
              ...truck,
              lat: dbPos.latitude,
              lng: dbPos.longitude,
              heading: dbPos.heading ?? truck.heading,
              speedKmh: dbPos.speed_kmh,
              status: dbPos.status === "depot" ? "transit" : dbPos.status,
              currentStreet: dbPos.current_street ?? truck.currentStreet,
              nextStreet: dbPos.next_street ?? truck.nextStreet,
              loadPercent: dbPos.load_percent ?? truck.loadPercent,
              emptyCountdownSec: dbPos.empty_countdown_sec ?? truck.emptyCountdownSec,
              predictionBasis: `Datenbank-Tracking (${dbPos.position_basis})`,
            };
          }
          return truck;
        });
        sourceMode = "database_timescaledb";
      }
    }
  } catch {
    // Graceful fallback to deterministic local simulation
  }

  return Response.json(
    {
      generated_at: new Date().toISOString(),
      source_mode: sourceMode,
      operator: {
        name: "Zweckverband Abfallwirtschaft Kreis Bergstraße (ZAKB)",
        headquarters: "Heidenfahrt 1, 68623 Lampertheim-Hüttenfeld",
        coverage: ["Bürstadt", "Lampertheim", "Hofheim (Ried)", "Biblis", "Kreis Bergstraße"],
        website: "https://www.zakb.de",
      },
      fractions: Object.values(WASTE_FRACTIONS),
      trucks: liveTrucks,
      tours: ZAKB_TOURS.map((t) => ({
        id: t.id,
        tourCode: t.tourCode,
        name: t.name,
        municipality: t.municipality,
        fraction: t.fraction,
        licensePlate: t.licensePlate,
        vehicleModel: t.vehicleModel,
        waypointsCount: t.waypoints.length,
        waypoints: t.waypoints,
      })),
      depots: ZAKB_DEPOTS,
      disclaimer:
        "Position estimates based on ZAKB Abfuhrkalender schedule and municipal routing models (no public GPS feed available).",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
