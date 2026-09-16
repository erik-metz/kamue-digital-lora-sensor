import { env } from "@/env";
import {
  Activity,
  ArrowLeft,
  Code2,
  Database,
  ExternalLink,
  Globe,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import HeaderLogo from "../components/HeaderLogo";
import DataDownload from "./DataDownload";
import ArchiveDownloads from "./ArchiveDownloads";
import { Suspense } from "react";

const API_DOCS_URL = "https://open-ried-sens.duckdns.org/docs";

export default async function DataDocsPage() {
  let stations: { id: string; friendly_name: string }[] = [];
  let stationsError = false;
  try {
    const response = await fetch(new URL("/api/v1/sensors", env.BACKEND_API_URL), {
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Stations unavailable");
    stations = await response.json();
  } catch {
    stationsError = true;
  }
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <HeaderLogo />

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Sensor-Karte</span>
            </Link>
            <Link
              href="/demografie"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <Users className="w-4 h-4 text-teal-400" />
              <span className="hidden sm:inline">Demografie</span>
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
              <Code2 className="w-3.5 h-3.5" /> Offene Programmierschnittstelle
              (Open REST API)
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight">
              Freie Umweltdaten für{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Hackathons, Apps & Forschung
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              Das Projekt <strong>Open Ried Sens</strong> stellt alle erfassten
              Umwelt- und Klimaparameter des Bürstädter und Lampertheimer
              Sensornetzwerks als <strong>Open Data</strong> zur Verfügung. Die
              Daten können ohne Zugangsbeschränkungen oder Registrierung
              abgefragt werden.
            </p>

            <div className="space-y-3 pt-2">
              <a
                href={API_DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
              >
                API im Browser ausprobieren
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only"> (öffnet in einem neuen Tab)</span>
              </a>
              <p className="text-sm text-slate-400 leading-relaxed">
                Die interaktive FastAPI-Dokumentation zeigt die verfügbaren
                Abfragen und ihre Parameter. Zum Einstieg den GET-Endpunkt
                /api/v1/sensors öffnen, „Try it out“ und dann „Execute“ wählen.
                Die Antwort enthält die verfügbaren Stationen für weitere
                Messdaten-Abfragen – direkt im Browser, ohne eigenen Code.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-300">
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" /> Öffentlich zugänglich
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-400" /> CSV für eigene Analysen
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Keine
                API-Keys für Lesezugriff
              </span>
            </div>
          </div>
        </section>

        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <h2 className="text-2xl font-bold">Messdaten als CSV herunterladen</h2>
          <p className="text-slate-400">
            Für Excel, LibreOffice oder eigene Analysen: Station und Zeitraum
            auswählen oder mit einer kleinen Stichprobe starten.
          </p>
          <DataDownload stations={stations} unavailable={stationsError} />
          <p className="text-sm text-slate-400">
            Jede Zeile enthält Zeitpunkt (UTC), Stations-ID, Messgröße, Wert und
            Einheit. CSV-Format: UTF-8, Komma als Trennzeichen, Dezimalpunkt.
            Die Stichprobe enthält bis zu 100 der neuesten Messwerte aus den
            letzten 30 Tagen. Zeitraum-Downloads enthalten alle passenden
            Messwerte bis maximal 4.999 Zeilen. Bei größeren Datenmengen bitte
            den Zeitraum verkürzen oder eine Messgröße auswählen.
          </p>
        </section>

        <Suspense fallback={<p className="text-slate-400">Monatsarchive werden geladen …</p>}>
          <ArchiveDownloads />
        </Suspense>

        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
          <h2 className="text-2xl font-bold">In Postman oder Insomnia starten</h2>
          <p className="text-slate-400">
            Eine Datei für beide Tools: Die OpenAPI-Definition enthält alle
            öffentlichen Stations- und Messdaten-Abfragen mit Parametern und
            Antwortformaten. Die öffentliche Serveradresse ist bereits
            hinterlegt. Ein API-Key ist nicht erforderlich.
          </p>
          <a
            href="/api/public-openapi"
            download="open-ried-sens-public.openapi.json"
            className="inline-flex rounded-xl border border-slate-700 px-5 py-3 font-semibold text-emerald-300 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400"
          >
            OpenAPI für Postman &amp; Insomnia herunterladen
          </a>
          <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-300">
            <li>In Postman „Import“ wählen und die Datei als Collection importieren. In Insomnia „Import“ → „File“ wählen und die Datei importieren.</li>
            <li>Zuerst GET /api/v1/sensors ausführen und eine Stations-ID aus dem Feld „id“ kopieren.</li>
            <li>Diese ID bei weiteren Abfragen als „sensor_id“ bzw. „id“ einsetzen. Für historische Daten zusätzlich „start_time“ im ISO-8601-Format angeben, z. B. 2026-09-13T00:00:00Z.</li>
          </ol>
          <p className="text-xs text-slate-400">
            Die Datei wird beim Download aus der aktuellen API-Definition erzeugt.
            Bei API-Änderungen erneut herunterladen und importieren.
          </p>
        </section>

        {/* DEMOGRAPHICS & SOCIAL DATA SECTION */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                Demografie, Pendlerströme & Bildungsdaten (HSL / BA)
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Offene sozio-ökonomische Daten und Geokoordinaten für Bürstadt, Lampertheim, Biblis, Groß-Rohrheim und Hofheim.
              </p>
            </div>
            <Link
              href="/demografie"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors shrink-0"
            >
              Visualisierter Sozialatlas <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">Gemeinde-Scorecards</span>
              <p className="text-emerald-400 font-bold">GET /api/v1/demographics/summary</p>
              <p className="text-slate-400 font-sans text-xs">Einwohnerzahlen, Dichte, Alterskohorten, Ausländeranteile und Wanderungssalden.</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">Pendleratlas</span>
              <p className="text-emerald-400 font-bold">GET /api/v1/demographics/&#123;id&#125;/commuters</p>
              <p className="text-slate-400 font-sans text-xs">Ein- und Auspendler nach Arbeitsorten (Mannheim, Worms, BASF, Frankfurt, etc.).</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">Schulen & Kitas</span>
              <p className="text-emerald-400 font-bold">GET /api/v1/demographics/facilities</p>
              <p className="text-slate-400 font-sans text-xs">Standorte, Kapazitäten, aktuelle Schülerzahlen, Träger und Betreuungsquoten.</p>
            </div>
          </div>
        </section>

        {/* SENSOR PARAMETERS GLOSSARY */}
        <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" /> Erfasste
              Umweltparameter & Einheiten
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Übersicht über die physikalischen Größen der
              Multisensor-Stationen.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                Klima
              </span>
              <h4 className="font-bold text-slate-200">Temperatur</h4>
              <p className="text-xs text-slate-400">Einheit: °C (celsius)</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                Klima
              </span>
              <h4 className="font-bold text-slate-200">Luftfeuchtigkeit</h4>
              <p className="text-xs text-slate-400">
                Einheit: % r.F. (percent)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                Niederschlag
              </span>
              <h4 className="font-bold text-slate-200">Regenmenge</h4>
              <p className="text-xs text-slate-400">Einheit: mm (mm)</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                Sonne
              </span>
              <h4 className="font-bold text-slate-200">UV-Index</h4>
              <p className="text-xs text-slate-400">
                Index: 0 - 11+ (uv_index)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                Luftqualität
              </span>
              <h4 className="font-bold text-slate-200">VOC-Index</h4>
              <p className="text-xs text-slate-400">
                Index: 0 - 500 (voc_index)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                Luftqualität
              </span>
              <h4 className="font-bold text-slate-200">NOx-Index</h4>
              <p className="text-xs text-slate-400">
                Index: 0 - 500 (nox_index)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                Partikel
              </span>
              <h4 className="font-bold text-slate-200">Feinstaub PM2.5</h4>
              <p className="text-xs text-slate-400">Einheit: µg/m³ (ug/m3)</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                Akustik
              </span>
              <h4 className="font-bold text-slate-200">Schallpegel</h4>
              <p className="text-xs text-slate-400">Einheit: dB (db)</p>
            </div>
          </div>
        </section>

        {/* OPEN DATA LICENSE */}
        <section className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-200">
              Open-Data Lizenz & Namensnennung
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Die Telemetriedaten werden unter den Bedingungen der{" "}
              <strong>
                Creative Commons Attribution 4.0 International (CC BY 4.0)
              </strong>{" "}
              Lizenz bereitgestellt. Bei Verwendung in Projekten bitten wir um
              die Quellenangabe:{" "}
              <em>„Daten: Open Ried Sens / KAMÜ Kulturzentrum Bürstadt“</em>.
            </p>
          </div>
          <a
            href="https://creativecommons.org/licenses/by/4.0/deed.de"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-emerald-400 transition-colors shrink-0"
          >
            CC BY 4.0 Lizenztext
          </a>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Open Ried Sens</strong> – Eine private Bürgerinitiative
              mit dem Kulturzentrum{" "}
              <a
                href="https://kamue.me"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline font-medium hover:text-emerald-300"
              >
                KAMÜ
              </a>{" "}
              in Bürstadt.
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link href="/" className="hover:text-emerald-400 transition-colors">
              Dashboard
            </Link>
            <span>•</span>
            <Link
              href="/admin"
              className="hover:text-emerald-400 transition-colors"
            >
              Admin-Bereich
            </Link>
            <span>•</span>
            <a
              href="https://github.com/erik-metz/kamue-digital-lora-sensor"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
