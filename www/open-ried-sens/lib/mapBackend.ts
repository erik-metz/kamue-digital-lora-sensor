import { env } from "@/env";
import { toStationNodes, mergeDefaultCrossings, mergeDefaultEducation, type ApiMapSensor } from "./mapData";

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
    return { nodes: mergeDefaultEducation(mergeDefaultCrossings(toStationNodes(sensors))), readingsAvailable: false };
  }
  if (!response.ok) throw new Error("Map data unavailable");
  const body: { sensors: ApiMapSensor[] } = await response.json();
  return { nodes: mergeDefaultEducation(mergeDefaultCrossings(toStationNodes(body.sensors))), readingsAvailable: true };
}
