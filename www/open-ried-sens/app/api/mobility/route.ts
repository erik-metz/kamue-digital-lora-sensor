import { calculateRiedMobility, RIED_STATIONS } from "@/lib/railMobility";

export async function GET() {
  const mobility = calculateRiedMobility(Date.now());
  return Response.json(
    {
      generated_at: new Date().toISOString(),
      trains: mobility.trains,
      crossings: mobility.crossings,
      stations: RIED_STATIONS,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
