import { calculateWasteTruckMobility, ZAKB_DEPOTS, ZAKB_TOURS, WASTE_FRACTIONS } from "@/lib/wasteTruckMobility";

export async function GET() {
  const mobility = calculateWasteTruckMobility(Date.now());
  return Response.json(
    {
      generated_at: new Date().toISOString(),
      operator: {
        name: "Zweckverband Abfallwirtschaft Kreis Bergstraße (ZAKB)",
        headquarters: "Heidenfahrt 1, 68623 Lampertheim-Hüttenfeld",
        coverage: ["Bürstadt", "Lampertheim", "Hofheim (Ried)", "Biblis", "Kreis Bergstraße"],
        website: "https://www.zakb.de",
      },
      fractions: Object.values(WASTE_FRACTIONS),
      trucks: mobility.trucks,
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
      disclaimer: "Positions estimates based on ZAKB Abfuhrkalender schedule and municipal routing models (no public GPS feed available).",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
