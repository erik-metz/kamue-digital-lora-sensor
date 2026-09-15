import { getBusStopDepartures, RIED_BUS_STOPS } from "@/lib/busMobility";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ stopId: string }> }
) {
  const { stopId } = await params;
  const stop = RIED_BUS_STOPS.find((s) => s.id === stopId);

  if (!stop) {
    return Response.json(
      { error: `Bus stop '${stopId}' not found in Ried registry` },
      { status: 404 }
    );
  }

  const departures = getBusStopDepartures(stopId, Date.now());

  return Response.json(
    {
      generated_at: new Date().toISOString(),
      stop,
      departures,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
