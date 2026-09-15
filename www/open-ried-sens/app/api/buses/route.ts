import { env } from "@/env";
import {
  calculateBusMobility,
  RIED_BUS_STOPS,
  VRN_BUS_TOURS,
  type LiveBus,
} from "@/lib/busMobility";

interface DbBusPosition {
  timestamp: string;
  vehicle_id: string;
  trip_id: string;
  line: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed_kmh: number;
  status: "moving" | "stopped";
  stop_id?: string;
  is_school_bus: boolean;
  delay_sec?: number;
  position_basis: string;
}

export async function GET() {
  const localMobility = calculateBusMobility(Date.now());
  let liveBuses: LiveBus[] = localMobility.buses;
  let sourceMode = "local_model";

  // If backend database API is configured, attempt to merge recorded positions
  try {
    const backendUrl = new URL("/api/v1/buses/positions/latest", env.BACKEND_API_URL);
    const res = await fetch(backendUrl, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const dbPositions = (await res.json()) as DbBusPosition[];
      if (Array.isArray(dbPositions) && dbPositions.length > 0) {
        liveBuses = localMobility.buses.map((bus) => {
          const dbPos = dbPositions.find((p) => p.line === bus.line || p.vehicle_id === bus.id);
          if (dbPos) {
            return {
              ...bus,
              lat: dbPos.latitude,
              lng: dbPos.longitude,
              heading: dbPos.heading ?? bus.heading,
              speedKmh: dbPos.speed_kmh,
              status: dbPos.status,
              isSchoolBus: dbPos.is_school_bus ?? bus.isSchoolBus,
              delaySec: dbPos.delay_sec ?? bus.delaySec,
              delayMinutes: Math.round((dbPos.delay_sec ?? bus.delaySec) / 60),
            };
          }
          return bus;
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
        name: "Verkehrsverbund Rhein-Neckar (VRN GmbH)",
        network: "VRN Verbundgebiet Kreis Bergstraße (Hessisches Ried)",
        lines: ["641", "642", "644", "652"],
        gtfs_feed: "VRN GTFS-RT (opendata.oepnv.de / Open Data ÖPNV)",
        website: "https://www.vrn.de",
      },
      buses: liveBuses,
      stops: RIED_BUS_STOPS,
      tours: VRN_BUS_TOURS.map((t) => ({
        id: t.id,
        line: t.line,
        lineCode: t.lineCode,
        operator: t.operator,
        origin: t.origin,
        destination: t.destination,
        isSchoolLine: !!t.isSchoolLine,
        stopsCount: t.waypoints.length,
      })),
      school_stops: RIED_BUS_STOPS.filter((s) => s.isSchoolStop),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
