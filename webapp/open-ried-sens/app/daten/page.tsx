import { getBackendUrl } from "@/lib/adminAuth";
import {
  Activity,
  ArrowLeft,
  Code2,
  Database,
  ExternalLink,
  Globe,
  Radio,
  Server,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import InteractiveCodeNippets from "./InteractiveCodeNippets";

export default function DataDocsPage() {
  const backendUrl = getBackendUrl();
  const now = new Date();
  const todayUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
  const codeSnippets = {
    curl: `# 1. Alle aktiven Stationen auflisten
    curl -X GET "${new URL("/api/v1/sensors", backendUrl)}" \\
        -H "Accept: application/json"

    # 2. Neuesten Messwert für Station 'ried-01' abrufen
    curl -X GET "${new URL(
      "/api/v1/telemetry/latest?sensor_id=ried-01",
      backendUrl
    )}"

    # 3. 1-Stunden-Durchschnittswerte der letzten 24 Stunden abrufen
    curl -X GET "${new URL(
      "/api/v1/telemetry/aggregates?sensor_id=ried-01&interval=1%20hour&start_time=" +
        todayUtcMidnight,
      backendUrl
    )}"`,

    python: `import requests
    import pandas as pd

    BASE_URL = "${new URL("/api/v1", backendUrl)}"

    # 1. Alle Sensoren abrufen
    sensors_res = requests.get(f"{BASE_URL}/sensors")
    sensors = sensors_res.json()
    print("Verfügbare Stationen:", [s["friendly_name"] for s in sensors])

    # 2. Zeitreihen-Rohdaten laden
    params = {
        "sensor_id": "ried-01",
        "start_time": "2026-09-10T00:00:00Z",
        "limit": 500
    }
    telemetry_res = requests.get(f"{BASE_URL}/telemetry/raw", params=params)
    data = telemetry_res.json()

    # In Pandas DataFrame umwandeln für Analysen & Plots
    df = pd.DataFrame(data)
    if not df.empty:
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        print(df.head())
    `,

    javascript: `// Mit Javascript (Node.js oder Browser) Sensordaten abfragen
    const BASE_URL = "${new URL("/api/v1", backendUrl)}";

    async function fetchSensorData() {
      try {
        // 1. Alle Stationen laden
        const sensorsResponse = await fetch(\`\${BASE_URL}/sensors\`);
        const stations = await sensorsResponse.json();
        console.log("Aktive Stationen:", stations);

        // 2. Neuesten Messwert abfragen
        const latestResponse = await fetch(\`\${BASE_URL}/telemetry/latest?sensor_id=ried-01\`);
        const latestData = await latestResponse.json();
        console.log("Aktueller Wert:", latestData.value, latestData.unit);
      } catch (error) {
        console.error("Fehler beim Datenabruf:", error);
      }
    }

    fetchSensorData();`,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform"
            >
              <Radio className="w-6 h-6 font-bold" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="font-bold text-lg text-slate-100 tracking-tight hover:text-emerald-400 transition-colors"
                >
                  Open Ried Sens
                </Link>
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Open Data & API
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Zurück zum Dashboard</span>
            </Link>
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Admin-Login</span>
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

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-300">
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" /> CORS
                aktiviert (Browser-Ready)
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-400" /> TimescaleDB
                Hypertable
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Keine
                API-Keys für Lesezugriff
              </span>
            </div>
          </div>
        </section>

        {/* INTERACTIVE CODE SNIPPETS */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <InteractiveCodeNippets codeSnippets={codeSnippets} />
        </section>

        {/* API ENDPOINTS DIRECTORY */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                <Server className="w-6 h-6 text-emerald-400" />{" "}
                Endpunkt-Referenz (v1)
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Alle Abfragen unterstützen JSON und standardisierte ISO-8601
                Zeitformate.
              </p>
            </div>

            <a
              href="http://localhost:8080/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl hover:bg-emerald-500/20 transition-all w-fit"
            >
              <span>Interaktive Swagger UI öffnen</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {/* Endpoint 1: Sensors List */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/20">
                    GET
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold text-slate-200">
                    /api/v1/sensors
                  </span>
                </div>
                <span className="text-xs text-slate-500">Öffentlich</span>
              </div>
              <p className="text-sm text-slate-300">
                Liefert die Liste aller öffentlich sichtbaren Messstationen
                inklusive Name, GPS-Koordinaten (Breite/Länge) und Beschreibung.
              </p>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-400 overflow-x-auto">
                {`[
  {
    "sensor_id": "ried-01",
    "friendly_name": "Station 1: Bürstadt Mitte",
    "latitude": 49.6425,
    "longitude": 8.456,
    "is_hidden": false,
    "description": "KAMÜ Kulturzentrum Industriestr. 11",
    "created_at": "2026-09-11T12:00:00Z"
  }
]`}
              </div>
            </div>

            {/* Endpoint 2: Latest Telemetry */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/20">
                    GET
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold text-slate-200">
                    /api/v1/telemetry/latest
                  </span>
                </div>
                <span className="text-xs text-slate-500">Öffentlich</span>
              </div>
              <p className="text-sm text-slate-300">
                Ruft den zuletzt empfangenen Einzelwert für eine angegebene
                Station ab.
              </p>
              <div className="text-xs text-slate-400 space-y-1">
                <strong>Parameter:</strong>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>
                    <code className="text-emerald-400 font-mono">
                      sensor_id
                    </code>{" "}
                    (string, erforderlich): Die ID der Station, z.B.{" "}
                    <code>ried-01</code>.
                  </li>
                </ul>
              </div>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-400 overflow-x-auto">
                {`{
  "sensor_id": "ried-01",
  "timestamp": "2026-09-11T19:42:00Z",
  "value": 21.4,
  "unit": "celsius"
}`}
              </div>
            </div>

            {/* Endpoint 3: Raw Telemetry */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/20">
                    GET
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold text-slate-200">
                    /api/v1/telemetry/raw
                  </span>
                </div>
                <span className="text-xs text-slate-500">Öffentlich</span>
              </div>
              <p className="text-sm text-slate-300">
                Liefert die historischen Rohdatenpunkte einer Station innerhalb
                eines definierten Zeitintervalls.
              </p>
              <div className="text-xs text-slate-400 space-y-1">
                <strong>Parameter:</strong>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>
                    <code className="text-emerald-400 font-mono">
                      sensor_id
                    </code>{" "}
                    (string, erforderlich): ID der Station.
                  </li>
                  <li>
                    <code className="text-emerald-400 font-mono">
                      start_time
                    </code>{" "}
                    (ISO-8601, erforderlich): Startzeitpunkt.
                  </li>
                  <li>
                    <code className="text-emerald-400 font-mono">end_time</code>{" "}
                    (ISO-8601, optional): Endzeitpunkt (Standard: jetzt).
                  </li>
                  <li>
                    <code className="text-emerald-400 font-mono">limit</code>{" "}
                    (int, optional): Max. Punkte (Standard 100, max. 5000).
                  </li>
                </ul>
              </div>
            </div>

            {/* Endpoint 4: Aggregates */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 hover:border-slate-700 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/20">
                    GET
                  </span>
                  <span className="font-mono text-sm sm:text-base font-bold text-slate-200">
                    /api/v1/telemetry/aggregates
                  </span>
                </div>
                <span className="text-xs text-slate-500">Öffentlich</span>
              </div>
              <p className="text-sm text-slate-300">
                Berechnet direkt über TimescaleDBs{" "}
                <code className="font-mono text-emerald-400">
                  time_bucket()
                </code>{" "}
                statistische Kennzahlen (Durchschnitt, Min, Max, Anzahl
                Messungen) über reguläre Zeitintervalle. Ideal für Diagramme und
                Dashboards!
              </p>
              <div className="text-xs text-slate-400 space-y-1">
                <strong>Erlaubte Intervalle:</strong>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    "5 minutes",
                    "15 minutes",
                    "30 minutes",
                    "1 hour",
                    "3 hours",
                    "6 hours",
                    "12 hours",
                    "1 day",
                    "7 days",
                    "1 month",
                  ].map((iv) => (
                    <span
                      key={iv}
                      className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300"
                    >
                      {iv}
                    </span>
                  ))}
                </div>
              </div>
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
