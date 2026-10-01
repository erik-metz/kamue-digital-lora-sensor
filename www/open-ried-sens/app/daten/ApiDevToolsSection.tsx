"use client";

import { useState } from "react";
import {
  Code2,
  ExternalLink,
  Download,
  Terminal,
  Check,
  Copy,
  Zap,
  BookOpen,
  Send,
  Boxes,
} from "lucide-react";

const CODE_SNIPPETS = {
  curl: `# 1. Liste aller verfügbaren Messstationen abrufen
curl -X GET "https://open-ried-sens.duckdns.org/api/v1/sensors" \\
     -H "accept: application/json"

# 2. Neueste Telemetrie-Messwerte für eine Station abfragen
curl -X GET "https://open-ried-sens.duckdns.org/api/v1/telemetry/raw?sensor_id=kamue-buerstadt-01&limit=100" \\
     -H "accept: application/json"`,

  python: `import requests
import pandas as pd

BASE_URL = "https://open-ried-sens.duckdns.org/api/v1"

# 1. Stationen abrufen
sensors = requests.get(f"{BASE_URL}/sensors").json()
print(f"Gefundene Stationen: {len(sensors)}")

# 2. Messwerte abrufen und direkt in ein Pandas DataFrame laden
response = requests.get(f"{BASE_URL}/telemetry/raw", params={
    "sensor_id": sensors[0]["id"],
    "limit": 500
})

df = pd.DataFrame(response.json())
df["timestamp"] = pd.to_datetime(df["timestamp"])
print("Geladene Messdaten:")
print(df.head())`,

  javascript: `// Direkter Aufruf der Open-Ried-Sens REST-API im Browser oder Node.js
const BASE_URL = "https://open-ried-sens.duckdns.org/api/v1";

async function fetchRiedData() {
  // 1. Stationen abrufen
  const sensorsRes = await fetch(\`\${BASE_URL}/sensors\`);
  const sensors = await sensorsRes.json();
  console.log("Aktive Stationen:", sensors);

  if (sensors.length > 0) {
    // 2. Neueste Telemetriewerte laden
    const dataRes = await fetch(
      \`\${BASE_URL}/telemetry/raw?sensor_id=\${sensors[0].id}&limit=100\`
    );
    const readings = await dataRes.json();
    console.log("Neueste 100 Messwerte:", readings);
  }
}

fetchRiedData();`,
};

export default function ApiDevToolsSection() {
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "python" | "javascript">("curl");
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const copyToClipboard = (text: string, tabKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tabKey);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <section id="api-tools" className="space-y-8">
      {/* SECTION HEADER */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <Code2 className="w-3.5 h-3.5" /> Entwickler-Tools &amp; REST-API
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          FastAPI, Postman &amp; Insomnia Integration
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
          Alle Schnittstellen folgen dem modernen <strong>OpenAPI 3.1</strong> Standard. Du kannst
          die API interaktiv im Browser testen oder die offizielle API-Definition mit einem Klick in
          Postman oder Insomnia importieren.
        </p>
      </div>

      {/* FASTAPI & SWAGGER SHOWCASE CARD */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 font-mono text-xs font-bold">
                FastAPI · Python 3.11+
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                Swagger UI &amp; ReDoc
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-100">
              Interaktive FastAPI-Dokumentation
            </h3>

            <p className="text-sm text-slate-300 leading-relaxed">
              <strong>Was ist FastAPI?</strong> FastAPI ist ein modernes, extrem schnelles
              Web-Framework für Python. Es validiert jede Anfrage automatisch per Typdefinitionen
              (Pydantic) und generiert in Echtzeit eine interaktive, visuelle
              Dokumentation (Swagger UI).
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">Was kann die Open-Ried-Sens API?</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
                <li className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Echtzeit-Telemetrie aller Sensorstationen (Klima, Feinstaub, Lärm)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Historische Zeitreihen mit flexiblen Zeitfenstern und Metrik-Filtern</span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>100 % öffentlich: <strong>Keine API-Keys, keine Registrierung</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Standardisierte Formate: JSON, GeoJSON &amp; UTF-8 CSV</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Direct CTA */}
          <div className="shrink-0 flex flex-col gap-3 w-full lg:w-auto">
            <a
              href="https://open-ried-sens.duckdns.org/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 py-3.5 font-bold text-slate-950 transition-all hover:bg-emerald-300 hover:scale-[1.02] shadow-lg shadow-emerald-500/10 text-sm"
            >
              <span>Swagger UI öffnen</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href="https://open-ried-sens.duckdns.org/redoc"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-6 py-2.5 font-semibold text-slate-300 hover:text-emerald-300 hover:bg-slate-900 transition-colors text-xs"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Alternative ReDoc-Ansicht</span>
            </a>
            <span className="text-[11px] text-slate-400 text-center">
              Tipp: Endpunkt anklicken → &quot;Try it out&quot; → &quot;Execute&quot;
            </span>
          </div>
        </div>

        {/* How to test in browser guide */}
        <div className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Produktions-API aktiv unter:</span>
            <code className="text-emerald-300 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              https://open-ried-sens.duckdns.org/api/v1
            </code>
          </div>
          <span className="text-slate-500">Direkt im Browser aufrufbar · CORS aktiviert</span>
        </div>
      </div>

      {/* POSTMAN & INSOMNIA INTEGRATION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* POSTMAN & INSOMNIA IMPORT GUIDE */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-emerald-400" />
              <h3 className="text-xl font-bold text-slate-100">
                In Postman &amp; Insomnia importieren
              </h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Eine einzige Datei für alle Tools: Lade dir unsere automatisch generierte
              OpenAPI-Definition herunter. Sie enthält alle Routen, Abfrage-Parameter, Schemas und
              die Live-Server-Adresse.
            </p>

            <ol className="list-decimal pl-5 space-y-2 text-xs sm:text-sm text-slate-300">
              <li>
                <strong>Postman:</strong> Klicke oben links auf <em>„Import“</em> und wähle die
                heruntergeladene Datei aus. Sie wird sofort als fertige Collection angelegt.
              </li>
              <li>
                <strong>Insomnia:</strong> Klicke auf <em>„Create“ → „Import / Export“ → „Import Data“</em>{" "}
                und wähle die Datei aus.
              </li>
              <li>
                <strong>Loslegen:</strong> Führe zuerst <code className="text-emerald-300 font-mono">GET /api/v1/sensors</code> aus,
                kopiere eine Stations-ID und nutze sie in <code className="text-emerald-300 font-mono">/api/v1/telemetry/raw</code>.
              </li>
            </ol>
          </div>

          <div className="pt-2">
            <a
              href="/api/public-openapi"
              download="open-ried-sens-public.openapi.json"
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-5 py-3 font-semibold text-emerald-300 transition-colors text-sm shadow-md"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              OpenAPI Collection herunterladen (.json)
            </a>
          </div>
        </div>

        {/* INTERACTIVE CODE SNIPPETS QUICKSTART */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" /> Schnelleinstieg in Code
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Kopiere den Starter-Code für dein bevorzugtes Tool.
              </p>
            </div>

            {/* Language Selector */}
            <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs shrink-0 self-start sm:self-auto">
              <button
                onClick={() => setActiveCodeTab("curl")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                  activeCodeTab === "curl"
                    ? "bg-slate-800 text-emerald-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setActiveCodeTab("python")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                  activeCodeTab === "python"
                    ? "bg-slate-800 text-emerald-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Python
              </button>
              <button
                onClick={() => setActiveCodeTab("javascript")}
                className={`px-3 py-1.5 rounded-lg transition-colors font-semibold ${
                  activeCodeTab === "javascript"
                    ? "bg-slate-800 text-emerald-400 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                JavaScript
              </button>
            </div>
          </div>

          {/* Code Box */}
          <div className="relative group">
            <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto leading-relaxed h-52">
              <code>{CODE_SNIPPETS[activeCodeTab]}</code>
            </pre>
            <button
              onClick={() => copyToClipboard(CODE_SNIPPETS[activeCodeTab], activeCodeTab)}
              className="absolute top-3 right-3 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-all flex items-center gap-1.5 shadow-lg"
              title="Code kopieren"
            >
              {copiedTab === activeCodeTab ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kopiert!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kopieren</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
