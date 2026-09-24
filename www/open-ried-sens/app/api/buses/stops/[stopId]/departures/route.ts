import { proxyBackend } from "@/lib/collectedBackend";
export async function GET(_request: Request, { params }: { params: Promise<{stopId:string}> }) {
 const {stopId} = await params;
 return proxyBackend(`transport/stops/${encodeURIComponent(stopId)}/departures`,30);
}
