import { proxyBackend } from "@/lib/collectedBackend";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export const dynamic = "force-dynamic";
export const metadata = { title: "Datenquellen & Erfassungsstatus | Open Ried Sens" };
type Source = { source_id: string; source_url: string | null; enabled: boolean | null; interval_seconds: number | null; received_at: string | null; status: string; last_success_at: string | null };
const labels: Record<string, string> = { success: "Erfasst", failed: "Fehlgeschlagen", received: "Empfangen, Verarbeitung noch nicht bestätigt", partial: "Teilweise erfasst", not_configured: "Quelle noch nicht angebunden", pending: "Noch kein Abruf" };
function timestamp(value: string | null) { return value ? new Date(value).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "–"; }

export default async function SourcesPage() {
  let sources: Source[] | null = null;
  const response = await proxyBackend("collection/status", 30);
  if (response.ok) sources = (await response.json()).sources;
  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <SiteHeader />
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <h1 className="text-3xl font-bold">Datenquellen & Erfassungsstatus</h1>
      <p className="text-slate-300">Die Erfassungsdienste laden Quelldaten in die Datenbank. Die Website liest gespeicherte Veröffentlichungen über das Backend. Fehlende oder abgelaufene Daten werden als nicht verfügbar angezeigt.</p>
      <p className="text-slate-400">Bewegungsprognosen werden gemeinsam für alle Besucher berechnet und gespeichert. Ihre Kennzeichnung unterscheidet Fahrplanprognosen von gemeldeten Positionen. Statistische Veröffentlichungen behalten ihren ursprünglichen Berichtszeitraum.</p>
      {!sources ? <p role="status">Der gespeicherte Erfassungsstatus ist aktuell nicht erreichbar.</p> : sources.length === 0 ? <p>Noch keine Erfassungen registriert.</p> :
        <div className="overflow-x-auto rounded-xl border border-slate-800"><table className="w-full text-left text-sm">
          <thead><tr className="border-b border-slate-800"><th className="p-3">Quelle</th><th className="p-3">Status</th><th className="p-3">Abrufintervall</th><th className="p-3">Letzter Versuch</th><th className="p-3">Letzter Erfolg</th></tr></thead>
          <tbody>{sources.map(source => <tr key={source.source_id} className="border-b border-slate-800">
            <td className="p-3">{source.source_url ? <a className="text-emerald-400 underline" href={source.source_url}>{source.source_id}</a> : source.source_id}</td>
            <td className="p-3">{labels[source.status] ?? "Unbekannter Status"}{source.enabled === false && " (deaktiviert)"}</td>
            <td className="p-3">{source.interval_seconds ? `${source.interval_seconds.toLocaleString("de-DE")} Sekunden` : "–"}</td>
            <td className="p-3">{timestamp(source.received_at)}</td><td className="p-3">{timestamp(source.last_success_at)}</td>
          </tr>)}</tbody>
        </table></div>}
      <p className="text-sm text-slate-400">Der letzte erfolgreiche Abruf ist kein Nachweis für eine aktuelle Messung. Maßgeblich sind Quellenzeit und Gültigkeit der einzelnen Veröffentlichung.</p>
    </main>
    <SiteFooter />
  </div>;
}
