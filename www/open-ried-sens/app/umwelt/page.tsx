import Link from "next/link";
import OfficialStatisticsPage from "../components/OfficialStatisticsPage";
export const dynamic = "force-dynamic";
export default function EnvironmentPage() {
  return <>
    <div className="max-w-7xl mx-auto w-full px-4 pt-4"><Link href="/umwelt/boden" className="text-emerald-300 underline">Boden, Verdunstung & Strahlung: Gemeindeprognosen</Link></div>
    <OfficialStatisticsPage domain="environment" title="Umwelt & Landwirtschaft" />
  </>;
}
