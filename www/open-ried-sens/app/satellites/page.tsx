import Link from "next/link";
import SatelliteTracker from "./SatelliteTracker";

export const metadata = { title: "Satelliten · Open-Ried-Sens" };
export default function SatellitesPage() {
  return <main className="mx-auto max-w-7xl space-y-4 p-4">
    <Link className="underline" href="/">Zurück zur Ried-Karte</Link>
    <h1 className="text-2xl font-semibold">Satelliten live und historisch</h1>
    <p>Berechnete Positionen aus Space-Track-Bahnelementen · SGP4. Die Anzeige wird sekündlich aktualisiert.</p>
    <SatelliteTracker />
  </main>;
}
