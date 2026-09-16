import { NextRequest } from "next/server";
import { env } from "@/env";
import {
  filterClosures,
  isClosureActive,
  type StreetClosure,
  VERIFIED_RIED_STREET_CLOSURES,
} from "@/lib/streetClosures";

interface BackendStreetClosure {
  id: string;
  municipality: string;
  district?: string | null;
  street_name: string;
  location_from?: string | null;
  location_to?: string | null;
  closure_type: "full" | "partial" | "lane_restriction";
  status: "active" | "scheduled" | "extended" | "completed" | "cancelled";
  start_time: string;
  end_time?: string | null;
  is_active: boolean;
  is_currently_active: boolean;
  reason?: string | null;
  description?: string | null;
  detour?: string | null;
  coordinates?: [number, number] | [number, number][] | null;
  source: string;
  source_url?: string | null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const statusParam = searchParams.get("status") || "all";
  const municipalityParam = searchParams.get("municipality") || "all";
  const search = searchParams.get("q") || "";

  let closures: StreetClosure[] = VERIFIED_RIED_STREET_CLOSURES;
  let sourceMode = "verified_ried_model";

  // Attempt to query live VPS TimescaleDB backend API if configured
  try {
    const backendUrl = new URL("/api/v1/street-closures", env.BACKEND_API_URL);
    if (statusParam !== "all") {
      backendUrl.searchParams.set("status", statusParam);
    }
    if (municipalityParam !== "all") {
      backendUrl.searchParams.set("municipality", municipalityParam);
    }

    const res = await fetch(backendUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });

    if (res.ok) {
      const dbClosures = (await res.json()) as BackendStreetClosure[];
      if (Array.isArray(dbClosures) && dbClosures.length > 0) {
        closures = dbClosures.map((db) => {
          let coords: [number, number] = [49.596, 8.471];
          let segment: [number, number][] | undefined = undefined;

          if (Array.isArray(db.coordinates)) {
            if (
              db.coordinates.length === 2 &&
              typeof db.coordinates[0] === "number" &&
              typeof db.coordinates[1] === "number"
            ) {
              coords = [db.coordinates[0], db.coordinates[1]];
            } else if (
              db.coordinates.length > 0 &&
              Array.isArray(db.coordinates[0])
            ) {
              segment = db.coordinates as [number, number][];
              const mid = Math.floor(segment.length / 2);
              coords = segment[mid];
            }
          }

          return {
            id: db.id,
            municipality: db.municipality,
            district: db.district || "Kernort",
            streetName: db.street_name,
            locationFrom: db.location_from || "",
            locationTo: db.location_to || "",
            closureType: db.closure_type || "full",
            status: db.status || "active",
            startTime: db.start_time,
            endTime: db.end_time || null,
            isActive: db.is_active,
            isCurrentlyActive: db.is_currently_active,
            reason: db.reason || "Straßenbauarbeiten",
            description: db.description || "",
            detour: db.detour || null,
            coordinates: coords,
            segmentGeometry: segment,
            source: db.source,
            sourceUrl: db.source_url || null,
          };
        });
        sourceMode = "database_timescaledb";
      }
    }
  } catch {
    // Graceful fallback to verified local open data model
  }

  const nowMs = Date.now();
  const filtered = filterClosures(
    closures,
    {
      status: statusParam as "all" | "active" | "scheduled",
      municipality: municipalityParam,
      search: search || undefined,
    },
    nowMs
  );

  const activeCount = closures.filter((c) => isClosureActive(c, nowMs)).length;
  const scheduledCount = closures.filter((c) => c.isActive && Date.parse(c.startTime) > nowMs).length;

  return Response.json(
    {
      generated_at: new Date().toISOString(),
      source_mode: sourceMode,
      coverage: "Hessisches Ried (Lampertheim, Rosengarten, Wehrzollhaus, Hofheim, Nordheim, Wattenheim, Biblis, Groß-Rohrheim, Bobstadt, Bürstadt)",
      summary: {
        total: closures.length,
        active: activeCount,
        scheduled: scheduledCount,
        filtered: filtered.length,
      },
      closures: filtered,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
