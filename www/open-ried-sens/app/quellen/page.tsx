import Link from "next/link";
import { proxyBackend } from "@/lib/collectedBackend";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";
import { SOURCE_INFO, type SourceItem } from "./sourceInfo";
import { getSourceLogo } from "./SourceLogos";
import { ExternalLink, Database, Activity } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Datenquellen & Erfassungsstatus | Open Ried Sens",
  description:
    "Transparenz über alle angebundenen Datenquellen, Sensoren, Abrufintervalle und Datenvolumina für Bürstadt, Lampertheim, Biblis und Groß-Rohrheim.",
};

type Source = SourceItem;

const labels: Record<string, string> = {
  success: "Erfasst",
  failed: "Fehlgeschlagen",
  received: "Empfangen, Verarbeitung noch nicht bestätigt",
  partial: "Teilweise erfasst",
  not_configured: "Quelle noch nicht angebunden",
  pending: "Noch kein Abruf",
};

function timestamp(value: string | null) {
  return value
    ? new Date(value).toLocaleString("de-DE", {
        timeZone: "Europe/Berlin",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "–";
}

export default async function SourcesPage() {
  let sources: Source[] | null = null;
  let sensorCount = 0;

  // Fetch live collection status and sensor fleet count in parallel
  const [statusRes, sensorsRes] = await Promise.all([
    proxyBackend("collection/status", 30).catch(() => null),
    proxyBackend("sensors", 60).catch(() => null),
  ]);

  if (statusRes?.ok) {
    try {
      const data = await statusRes.json();
      sources = data.sources;
    } catch {
      sources = null;
    }
  }

  if (sensorsRes?.ok) {
    try {
      const sensorsData = await sensorsRes.json();
      if (Array.isArray(sensorsData)) {
        sensorCount = sensorsData.length;
      }
    } catch {
      sensorCount = 0;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <SiteHeader sensorCount={sensorCount > 0 ? sensorCount : undefined} />

      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 flex-1">
        {/* Top Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>Herkunft &amp; Aktualität</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight">
            Datenquellen &amp; Erfassungsstatus
          </h1>
          <p className="text-slate-300 text-base sm:text-lg max-w-3xl leading-relaxed">
            Woher stammen die Daten im Ried? Hier findest du die Originalquellen und ihren letzten erfolgreichen Abruf.
          </p>
          <Link href="/daten" className="inline-block text-sm text-emerald-300 hover:underline">Zu Downloads &amp; API →</Link>
        </div>

        {/* Error State if Backend Status Unavailable */}
        {!sources ? (
          <div
            role="status"
            className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm flex items-center gap-3"
          >
            <Activity className="w-5 h-5 shrink-0 text-rose-400" />
            <span>
              Der Erfassungsstatus ist momentan <strong>nicht erreichbar</strong>. Bitte später erneut versuchen.
            </span>
          </div>
        ) : sources.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400">
            Noch keine Erfassungen registriert.
          </div>
        ) : (
          <section aria-labelledby="source-details-title" className="space-y-4 rounded-2xl border border-slate-800 p-5">
            <div className="space-y-1">
              <h2 id="source-details-title" className="text-lg font-bold text-slate-200">
                Technische Übersicht der Datenquellen
              </h2>
              <p className="text-xs text-slate-400">
                Anbieter, Themen, Aktivierung, Abrufintervalle und Zeitstempel je Quelle. Der Status beschreibt den letzten Abrufversuch; Fehlermeldungen stehen direkt bei der Quelle. Alle Zeiten gelten für Europe/Berlin.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 shadow-inner">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold">
                    <th className="p-3.5">Quelle &amp; Identifikator</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Aktivierung</th>
                    <th className="p-3.5">Abrufintervall</th>
                    <th className="p-3.5">Letzter Versuch</th>
                    <th className="p-3.5">Letzter Erfolg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {sources.map((source) => (
                    <tr
                      key={source.source_id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          {getSourceLogo(source.source_id, "w-6 h-6")}
                          {source.source_url ? (
                            <a
                              className="text-emerald-400 hover:text-emerald-300 underline font-medium inline-flex items-center gap-1"
                              href={source.source_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.source_id}
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <span className="font-mono text-slate-300">{source.source_id}</span>
                          )}
                        </div>
                        {SOURCE_INFO[source.source_id] && (
                          <div className="mt-2 space-y-1 text-xs pl-8">
                            <p className="text-slate-200">{SOURCE_INFO[source.source_id].title}</p>
                            <p className="text-slate-400">{SOURCE_INFO[source.source_id].provider} · {SOURCE_INFO[source.source_id].domain}</p>
                          </div>
                        )}
                        {!source.source_url && <p className="mt-1 pl-8 text-xs text-slate-500">Kein Quellenlink hinterlegt.</p>}
                        {source.error && (
                          <div className="text-[11px] text-amber-400/90 mt-1 pl-8">
                            {source.error}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            source.status === "success"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                              : source.status === "partial"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/25"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                        >
                          {labels[source.status] ?? "Unbekannter Status"}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-slate-300">
                        {source.enabled === true ? "Aktiv" : source.enabled === false ? "Deaktiviert" : "Nicht hinterlegt"}
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-slate-300">
                        {source.interval_seconds
                          ? `${source.interval_seconds.toLocaleString("de-DE")} Sekunden`
                          : "–"}
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-slate-400">
                        {timestamp(source.received_at)}
                      </td>
                      <td className="p-3.5 whitespace-nowrap text-emerald-400/90 font-medium">
                        {timestamp(source.last_success_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Disclaimer / Notice */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 leading-relaxed space-y-1">
          <p>
            <strong>Wichtiger Hinweis zur Datenaktualität:</strong> Der letzte erfolgreiche Abruf ist kein Nachweis für
            eine aktuelle Messung. Maßgeblich sind Quellenzeit und Gültigkeit der einzelnen Veröffentlichung.
          </p>
          <p>
            Alle Schnittstellen unterliegen den Nutzungsbedingungen und Lizenzen der jeweiligen Urheber (Open Data
            Commons, CC BY, GeoNutzV bzw. Datenlizenz Deutschland).
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
