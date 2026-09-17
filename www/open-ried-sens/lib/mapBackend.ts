import { env } from "@/env";
import { toStationNodes, mergeDefaultCrossings, mergeDefaultEducation, mergeDefaultFacilities, type ApiMapSensor } from "./mapData";

export async function fetchMapData() {
  const response = await fetch(new URL("/api/v1/map/sensors", env.BACKEND_API_URL), {
    cache: "no-store", signal: AbortSignal.timeout(10_000),
  });
  if (response.status === 404) {
    // Rolling deploy: keep the new map usable until the backend is updated.
    const legacy = await fetch(new URL("/api/v1/sensors", env.BACKEND_API_URL), {
      cache: "no-store", signal: AbortSignal.timeout(10_000),
    });
    if (!legacy.ok) throw new Error("Map inventory unavailable");
    const sensors: ApiMapSensor[] = await legacy.json();
    return { nodes: mergeDefaultFacilities(mergeDefaultEducation(mergeDefaultCrossings(toStationNodes(sensors)))), readingsAvailable: false };
  }
  if (!response.ok) throw new Error("Map data unavailable");
  const body: { sensors: ApiMapSensor[] } = await response.json();
  return { nodes: mergeDefaultFacilities(mergeDefaultEducation(mergeDefaultCrossings(toStationNodes(body.sensors)))), readingsAvailable: true };
}

export async function fetchProtectedAreas() {
  try {
    const response = await fetch(new URL("/api/v1/environment/protected-areas", env.BACKEND_API_URL), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Unavailable");
    return await response.json();
  } catch {
    const { DEFAULT_PROTECTED_AREAS } = await import("./environmentData");
    return DEFAULT_PROTECTED_AREAS;
  }
}

export async function fetchAgricultureStats() {
  try {
    const response = await fetch(new URL("/api/v1/environment/agriculture/stats", env.BACKEND_API_URL), {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Unavailable");
    return await response.json();
  } catch {
    const { DEFAULT_AGRICULTURE_STATS } = await import("./environmentData");
    return DEFAULT_AGRICULTURE_STATS;
  }
}

export async function fetchFloodGauges() {
  try {
    const response = await fetch(new URL("/api/v1/environment/flood/gauges", env.BACKEND_API_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("Unavailable");
    return await response.json();
  } catch {
    const { DEFAULT_FLOOD_GAUGES } = await import("./environmentData");
    return DEFAULT_FLOOD_GAUGES;
  }
}

