import { env } from "@/env";
import {
  calculateLocalTraffic,
  RIED_CORRIDOR_METADATA,
  type TrafficCorridor,
  type TrafficIncident,
} from "@/lib/trafficData";

interface DbTrafficIncident {
  id: string;
  road_name: string;
  direction: string;
  location_from: string;
  location_to: string;
  start_time: string;
  end_time?: string | null;
  last_seen_at: string;
  is_active: boolean;
  delay_seconds: number;
  delay_minutes: number;
  length_meters: number;
  length_km: number;
  severity: "minor" | "moderate" | "major" | "standstill";
  cause_type: "congestion" | "accident" | "roadwork" | "closure";
  description?: string;
  coordinates?: [number, number][];
  source: string;
}

interface DbCorridorStatus {
  corridor_id: string;
  road_name: string;
  name: string;
  status: "clear" | "sluggish" | "congestion" | "closure";
  delay_seconds: number;
  delay_minutes: number;
  active_incidents_count: number;
  description: string;
}

export async function GET() {
  const localTraffic = calculateLocalTraffic(Date.now());
  let incidents: TrafficIncident[] = localTraffic.incidents;
  let corridors: TrafficCorridor[] = localTraffic.corridors;
  let sourceMode = "local_open_data_model";

  // Try to query VPS TimescaleDB backend API if configured
  try {
    const backendIncidentsUrl = new URL("/api/v1/traffic/incidents", env.BACKEND_API_URL);
    const backendCorridorsUrl = new URL("/api/v1/traffic/corridors", env.BACKEND_API_URL);

    const [incidentsRes, corridorsRes] = await Promise.all([
      fetch(backendIncidentsUrl, { cache: "no-store", signal: AbortSignal.timeout(2000) }),
      fetch(backendCorridorsUrl, { cache: "no-store", signal: AbortSignal.timeout(2000) }),
    ]);

    if (incidentsRes.ok && corridorsRes.ok) {
      const dbIncidents = (await incidentsRes.json()) as DbTrafficIncident[];
      const dbCorridors = (await corridorsRes.json()) as DbCorridorStatus[];

      if (Array.isArray(dbIncidents) && dbIncidents.length > 0) {
        incidents = dbIncidents.map((i) => ({
          id: i.id,
          roadName: i.road_name,
          direction: i.direction,
          locationFrom: i.location_from,
          locationTo: i.location_to,
          startTime: i.start_time,
          endTime: i.end_time,
          lastSeenAt: i.last_seen_at,
          isActive: i.is_active,
          delaySeconds: i.delay_seconds,
          delayMinutes: i.delay_minutes,
          lengthMeters: i.length_meters,
          lengthKm: i.length_km,
          severity: i.severity,
          causeType: i.cause_type,
          description: i.description,
          coordinates: i.coordinates,
          source: i.source,
        }));

        corridors = RIED_CORRIDOR_METADATA.map((meta) => {
          const dbC = dbCorridors.find((c) => c.road_name.toUpperCase() === meta.roadName.toUpperCase());
          return {
            ...meta,
            status: dbC ? dbC.status : "clear",
            delayMinutes: dbC ? dbC.delay_minutes : 0,
            activeIncidentsCount: dbC ? dbC.active_incidents_count : 0,
            description: dbC ? dbC.description : "Freie Fahrt",
          };
        });

        sourceMode = "database_timescaledb";
      }
    }
  } catch {
    // Graceful fallback to deterministic local model
  }

  return Response.json(
    {
      generated_at: new Date().toISOString(),
      source_mode: sourceMode,
      network: "Ried Corridors (A67, B47, B44, A5, A6)",
      summary: {
        total_incidents: incidents.length,
        congested_corridors: corridors.filter((c) => c.status !== "clear").length,
      },
      corridors,
      incidents,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
