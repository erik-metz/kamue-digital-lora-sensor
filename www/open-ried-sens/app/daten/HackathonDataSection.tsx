"use client";

import { useState } from "react";
import {
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Info,
  Layers,
  Sparkles,
  Table,
  Zap,
} from "lucide-react";

interface Station {
  id: string;
  friendly_name: string;
}

interface HackathonDataSectionProps {
  stations: Station[];
  unavailable: boolean;
}

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-400 text-sm";
const buttonClass =
  "rounded-xl px-5 py-3 font-semibold transition-all disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 text-sm flex items-center justify-center gap-2";

export default function HackathonDataSection({
  stations,
  unavailable,
}: HackathonDataSectionProps) {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);
  const [selectedStation, setSelectedStation] = useState(
    stations[0]?.id || ""
  );
  const [startDate, setStartDate] = useState("2026-09-01");
  const [endDate, setEndDate] = useState("2026-09-30");
  const [metricFilter, setMetricFilter] = useState("");

  // Handler for custom download or sample download
  async function handleDownload(isSample: boolean) {
    if (!stations.length && !isSample) return;
    const targetStation = selectedStation || stations[0]?.id || "kamue-buerstadt-01";

    setBusy(true);
    setStatusMessage("");

    const params = new URLSearchParams();
    params.set("sensor_id", targetStation);
    if (metricFilter.trim()) params.set("metric", metricFilter.trim());

    if (isSample) {
      params.set("sample", "1");
    } else {
      params.set("start", startDate);
      params.set("end", endDate);
    }

    try {
      const response = await fetch(`/api/data-download?${params.toString()}`, {
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Download fehlgeschlagen.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ||
        (isSample ? "open-ried-sens-sample.csv" : "open-ried-sens-export.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatusMessage(
        isSample
          ? "Stichprobe erfolgreich heruntergeladen (100 Messwerte)."
          : "CSV-Export erfolgreich heruntergeladen."
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error && error.name !== "TimeoutError"
          ? error.message
          : "Download fehlgeschlagen. Bitte erneut versuchen."
      );
    } finally {
      setBusy(false);
    }
  }

  // Quick preset selector
  const applyPreset = (
    preset: "last_month" | "april_2026" | "q3_2026" | "current_year"
  ) => {
    if (preset === "last_month") {
      setStartDate("2026-09-01");
      setEndDate("2026-09-30");
      setStatusMessage("Zeitraum auf 'Letzter Monat' (September 2026) gesetzt.");
    } else if (preset === "april_2026") {
      setStartDate("2026-04-01");
      setEndDate("2026-04-30");
      setStatusMessage("Zeitraum auf 'April 2026' gesetzt.");
    } else if (preset === "q3_2026") {
      setStartDate("2026-07-01");
      setEndDate("2026-07-31");
      setStatusMessage(
        "Zeitraum auf 'Quartal 3 (Juli 2026)' gesetzt. Für das vollständige 3-Monats-Paket nutze bitte die ZIP-Archive unten!"
      );
    } else if (preset === "current_year") {
      setStartDate("2026-01-01");
      setEndDate("2026-01-31");
      setStatusMessage(
        "Hinweis für das Gesamtjahr: Das interaktive Live-Formular filtert bis zu 31 Tage. Für das komplette Gesamtjahr nutze bitte das UploadThing-Jahresarchiv weiter unten!"
      );
    }
  };

  return (
    <section id="datasets" className="space-y-8">
      {/* HEADER CARD */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Hackathon-Datasets &amp; CSV
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Messdaten &amp; Datensätze für Hackathons &amp; Analysen
            </h2>
            <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
              Für Data Science, maschinelles Lernen, Stadtplanung und Hackathon-Projekte: Lade dir
              sofort eine Test-Stichprobe herunter, wähle feste Zeiträume (wie den Vormonat,
              April 2026 oder Quartale) oder lade komplette komprimierte Jahresarchive ohne Zeilenbegrenzung.
            </p>
          </div>

          {/* Quick Action: Instant Sample */}
          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-3">
            <button
              onClick={() => void handleDownload(true)}
              disabled={busy || unavailable}
              className={`${buttonClass} bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 font-bold hover:brightness-110 shadow-lg shadow-emerald-500/10`}
            >
              <Download className="w-4 h-4" />
              Stichprobe herunterladen (CSV)
            </button>
            <span className="text-[11px] text-slate-400 text-center">
              100 aktuelle Messwerte · Sofort bereit
            </span>
          </div>
        </div>

        {/* DATA STRUCTURE SCHEMA PREVIEW */}
        <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Table className="w-3.5 h-3.5 text-emerald-400" />
              Aufbau der CSV-Dateien (Schema)
            </span>
            <span className="text-xs text-slate-500 font-mono">
              UTF-8 · Komma-separiert · Dezimalpunkt
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-sans text-[11px] uppercase">
                  <th className="pb-2 font-semibold">timestamp (UTC)</th>
                  <th className="pb-2 font-semibold">sensor_id</th>
                  <th className="pb-2 font-semibold">metric</th>
                  <th className="pb-2 font-semibold">value</th>
                  <th className="pb-2 font-semibold">unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                <tr>
                  <td className="py-1.5 text-slate-400">2026-09-30T14:30:00.000Z</td>
                  <td className="py-1.5 text-emerald-300">kamue-buerstadt-01</td>
                  <td className="py-1.5 text-teal-300">temperature</td>
                  <td className="py-1.5 font-bold text-slate-100">21.4</td>
                  <td className="py-1.5 text-slate-400">celsius</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-400">2026-09-30T14:30:00.000Z</td>
                  <td className="py-1.5 text-emerald-300">kamue-buerstadt-01</td>
                  <td className="py-1.5 text-teal-300">humidity</td>
                  <td className="py-1.5 font-bold text-slate-100">58.2</td>
                  <td className="py-1.5 text-slate-400">percent</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-400">2026-09-30T14:30:00.000Z</td>
                  <td className="py-1.5 text-emerald-300">kamue-buerstadt-01</td>
                  <td className="py-1.5 text-teal-300">pm2_5</td>
                  <td className="py-1.5 font-bold text-slate-100">7.8</td>
                  <td className="py-1.5 text-slate-400">ug/m3</td>
                </tr>
                <tr>
                  <td className="py-1.5 text-slate-400">2026-09-30T14:30:00.000Z</td>
                  <td className="py-1.5 text-emerald-300">kamue-buerstadt-01</td>
                  <td className="py-1.5 text-teal-300">noise_level</td>
                  <td className="py-1.5 font-bold text-slate-100">46.5</td>
                  <td className="py-1.5 text-slate-400">db</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* TIME PERIOD PRESETS & QUICK ACCESS */}
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            Feste Zeiträume &amp; Schnellauswahl (Monat, Quartal, Jahr)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => applyPreset("last_month")}
              className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-emerald-400">Monat</span>
                <Calendar className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </div>
              <p className="font-bold text-slate-100 text-sm">Letzter Monat (09/2026)</p>
              <p className="text-xs text-slate-400 mt-1">
                Vollständige Monats-Telemetrie aller aktiven Stationen.
              </p>
            </button>

            <button
              onClick={() => applyPreset("april_2026")}
              className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-teal-400">Frühjahr</span>
                <Calendar className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
              </div>
              <p className="font-bold text-slate-100 text-sm">April 2026</p>
              <p className="text-xs text-slate-400 mt-1">
                Spargel-Saison, Pollenflug &amp; Frühlingstemperaturen.
              </p>
            </button>

            <button
              onClick={() => applyPreset("q3_2026")}
              className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900 transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-purple-400">Quartal</span>
                <Layers className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
              </div>
              <p className="font-bold text-slate-100 text-sm">Q3 / 2026 (Sommer)</p>
              <p className="text-xs text-slate-400 mt-1">
                3-Monats-Paket (Juli, August, September).
              </p>
            </button>

            <a
              href="#monatsarchive"
              className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition-all text-left group block"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-blue-400">Gesamtjahr</span>
                <HardDrive className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
              </div>
              <p className="font-bold text-slate-100 text-sm">Ganzes Jahr 2026</p>
              <p className="text-xs text-slate-400 mt-1">
                Zu den komprimierten UploadThing-Jahresarchiven ↓
              </p>
            </a>
          </div>
        </div>

        {/* CALCULATION & UPLOADTHING INSIGHTS ACCORDION */}
        <div className="border border-emerald-500/20 bg-emerald-950/10 rounded-2xl p-4 sm:p-5 space-y-3">
          <button
            onClick={() => setShowCalculationDetails(!showCalculationDetails)}
            className="w-full flex items-center justify-between text-left focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-bold text-emerald-300 text-sm sm:text-base">
                Datenvolumen der gesamten Datenbank &amp; Machbarkeit auf UploadThing (1 Jahr)
              </span>
            </div>
            {showCalculationDetails ? (
              <ChevronUp className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
          </button>

          <p className="text-xs text-slate-300 leading-relaxed">
            In der Datenbank von Open Ried Sens fließen <strong>alle Datenströme der Region</strong> zusammen:
            neben den LoRaWAN-Klimasensoren auch hochfrequente ÖPNV-Busverkehre (VRN), Nextbike-Bikesharing,
            ZAKB-Müllfahrzeug-GPS, Bahnübergangs-Schließungen, Seismik (Raspberry Shake), Pegelstände,
            Biogas-/Solarerzeugung sowie amtliche Zensus-, Haushalts-, BORIS- und Wahldaten.
          </p>

          {showCalculationDetails && (
            <div className="pt-2 space-y-4 text-xs text-slate-300 border-t border-emerald-500/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Gesamtzeilen / Tag
                  </span>
                  <p className="text-base font-bold text-emerald-400 font-mono">~125.000 Zeilen</p>
                  <p className="text-[11px] text-slate-400">
                    Über alle Tabellen (Busse, Bikes, Sensoren, Müll-GPS, Bahn).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    1 Monat (Alle DB-Daten)
                  </span>
                  <p className="text-base font-bold text-teal-400 font-mono">~30–45 MB (ZIP)</p>
                  <p className="text-[11px] text-slate-400">
                    ca. 3,8 Mio. Zeilen (~280 MB CSV). Sofort per Klick herunterladbar.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    1 ganzes Jahr (Alle DB-Daten)
                  </span>
                  <p className="text-base font-bold text-blue-400 font-mono">~350–450 MB (ZIP)</p>
                  <p className="text-[11px] text-slate-400">
                    ca. 45–50 Mio. Zeilen (~3,5–4,0 GB CSV). Als ZIP/Parquet ideal handhabbar.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    UploadThing Machbarkeit
                  </span>
                  <p className="text-base font-bold text-purple-400 font-mono">100 % Machbar (ZIP)</p>
                  <p className="text-[11px] text-slate-400">
                    Passt als komprimiertes ZIP oder Parquet perfekt ins 512-MB-Limit!
                  </p>
                </div>
              </div>

              {/* TABLE BREAKDOWN ACROSS DB DOMAINS */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
                <h4 className="font-semibold text-slate-200 flex items-center justify-between text-xs">
                  <span>Aufschlüsselung der Datenmengen nach Fachbereichen (1 ganzes Jahr):</span>
                  <span className="text-[10px] text-slate-400 font-normal">ca. 45–50 Mio. Zeilen gesamt</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-[11px] text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-sans text-[10px] uppercase">
                        <th className="pb-1.5 font-semibold">Bereich &amp; Tabellen</th>
                        <th className="pb-1.5 font-semibold">Taktung / Intervall</th>
                        <th className="pb-1.5 font-semibold">Zeilen / Jahr</th>
                        <th className="pb-1.5 font-semibold">Roh-CSV</th>
                        <th className="pb-1.5 font-semibold">Komprimiert (ZIP / Parquet)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      <tr>
                        <td className="py-1 text-slate-200 font-sans">
                          🚌 <strong>ÖPNV-Busse (VRN)</strong> <span className="text-slate-500 font-mono text-[10px]">bus_positions, movement_*</span>
                        </td>
                        <td className="py-1 text-slate-400 font-sans">alle 15–30 Sek. (Echtzeit)</td>
                        <td className="py-1 text-emerald-400">ca. 16,4 Mio.</td>
                        <td className="py-1 text-slate-300">~1,3 GB</td>
                        <td className="py-1 font-bold text-emerald-300">~130 MB</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-200 font-sans">
                          🚲 <strong>Nextbike Bikesharing</strong> <span className="text-slate-500 font-mono text-[10px]">nextbike_observations, trips</span>
                        </td>
                        <td className="py-1 text-slate-400 font-sans">alle 60–120 Sek.</td>
                        <td className="py-1 text-emerald-400">ca. 18,2 Mio.</td>
                        <td className="py-1 text-slate-300">~1,2 GB</td>
                        <td className="py-1 font-bold text-emerald-300">~110 MB</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-200 font-sans">
                          🚛 <strong>ZAKB Müllfahrzeuge</strong> <span className="text-slate-500 font-mono text-[10px]">waste_truck_positions, events</span>
                        </td>
                        <td className="py-1 text-slate-400 font-sans">alle 15–30 Sek. (Werktags)</td>
                        <td className="py-1 text-emerald-400">ca. 3,9 Mio.</td>
                        <td className="py-1 text-slate-300">~320 MB</td>
                        <td className="py-1 font-bold text-emerald-300">~35 MB</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-200 font-sans">
                          🌡️ <strong>LoRaWAN Sensoren &amp; Shake</strong> <span className="text-slate-500 font-mono text-[10px]">sensor_data (Klima, VOC, Lärm, Seismik)</span>
                        </td>
                        <td className="py-1 text-slate-400 font-sans">alle 5–15 Min. + Erdbeben</td>
                        <td className="py-1 text-emerald-400">ca. 4,4 Mio.</td>
                        <td className="py-1 text-slate-300">~280 MB</td>
                        <td className="py-1 font-bold text-emerald-300">~35 MB</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-200 font-sans">
                          🚦 <strong>Bahnübergänge &amp; Verkehr</strong> <span className="text-slate-500 font-mono text-[10px]">rail_crossings, traffic_incidents</span>
                        </td>
                        <td className="py-1 text-slate-400 font-sans">Ereignisbasiert + 5 Min.</td>
                        <td className="py-1 text-emerald-400">ca. 1,5 Mio.</td>
                        <td className="py-1 text-slate-300">~120 MB</td>
                        <td className="py-1 font-bold text-emerald-300">~15 MB</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-200 font-sans">
                          ⚡ <strong>Energie &amp; Hydrologie</strong> <span className="text-slate-500 font-mono text-[10px]">energy_production, flood_gauges, groundwater</span>
                        </td>
                        <td className="py-1 text-slate-400 font-sans">alle 15–60 Min.</td>
                        <td className="py-1 text-emerald-400">ca. 360.000</td>
                        <td className="py-1 text-slate-300">~30 MB</td>
                        <td className="py-1 font-bold text-emerald-300">~4 MB</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-slate-200 font-sans">
                          🏛️ <strong>Register &amp; Kommunalstatistik</strong> <span className="text-slate-500 font-mono text-[10px]">demographics, boris, budgets, wahlen</span>
                        </td>
                        <td className="py-1 text-slate-400 font-sans">Jährlich / Stichtage</td>
                        <td className="py-1 text-emerald-400">ca. 150.000</td>
                        <td className="py-1 text-slate-300">~45 MB</td>
                        <td className="py-1 font-bold text-emerald-300">~6 MB</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HACKATHON TOOLS & UPLOADTHING STRATEGY */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" />
                  UploadThing-Strategie &amp; Werkzeuge für Hackathon-Teams
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-300">
                  <li>
                    <strong>UploadThing Speicher-Logik:</strong> Ein unkomprimiertes 4-GB-CSV in einer
                    einzigen Datei würde das 512-MB-Uploadlimit der meisten Cloud-Konten überschreiten.
                    <strong> Aber:</strong> Als <strong>ZIP-Archiv oder im modernen Apache-Parquet-Format</strong>{" "}
                    schrumpft der gesamte Jahresdatensatz aller Tabellen auf <strong>nur ca. 350–450 MB</strong>{" "}
                    zusammen und passt damit <em>vollständig und bequem</em> auf UploadThing!
                  </li>
                  <li>
                    <strong>Thematische Fach-Bundles (Best Practice):</strong> Hackathon-Teilnehmende
                    profitieren am meisten von thematisch getrennten Jahres-Paketen (z. B.{" "}
                    <em>Mobilität &amp; Verkehr</em> mit ~240 MB ZIP oder <em>Klima &amp; Umwelt</em> mit ~50 MB ZIP),
                    anstatt ein riesiges unstrukturiertes Sammel-CSV laden zu müssen.
                  </li>
                  <li>
                    <strong>Monats-Gesamtexport:</strong> Ein ganzer Monat über <em>alle</em> DB-Daten
                    hat komprimiert nur <strong>~30–45 MB</strong> und lädt in 1–2 Sekunden herunter.
                  </li>
                  <li>
                    <strong>Wichtiger Excel-Hinweis:</strong> Microsoft Excel besitzt ein hartes Limit
                    von <strong>1.048.576 Zeilen</strong>. Die ~45 bis 50 Millionen Jahreszeilen der
                    Gesamtdatenbank sprengen Excel um das 40-fache! Hackathon-Teams nutzen dafür
                    <strong> Python (Pandas / Polars / PyArrow), DuckDB, R oder SQLite</strong>.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* CUSTOM TIME RANGE EXPORT FORM */}
        <div className="border-t border-slate-800 pt-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-200">
            Benutzerdefinierter CSV-Export
          </h3>
          <p className="text-xs text-slate-400">
            Wähle eine konkrete Station, einen individuellen Zeitraum (maximal 31 Tage) und optional
            eine bestimmte Messgröße.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleDownload(false);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="text-xs font-medium text-slate-300">
                Station
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  disabled={busy || unavailable || !stations.length}
                  className={inputClass}
                >
                  {stations.length ? (
                    stations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.friendly_name || st.id}
                      </option>
                    ))
                  ) : (
                    <option value="">Keine Stationen verfügbar</option>
                  )}
                </select>
              </label>

              <label className="text-xs font-medium text-slate-300">
                Messgröße (optional)
                <input
                  type="text"
                  placeholder="z. B. temperature, pm2_5"
                  value={metricFilter}
                  onChange={(e) => setMetricFilter(e.target.value)}
                  disabled={busy}
                  className={inputClass}
                />
              </label>

              <label className="text-xs font-medium text-slate-300">
                Von (UTC)
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={busy}
                  required
                  className={inputClass}
                />
              </label>

              <label className="text-xs font-medium text-slate-300">
                Bis (UTC)
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={busy}
                  required
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={busy || unavailable || !stations.length}
                className={`${buttonClass} bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300`}
              >
                <Download className="w-4 h-4" />
                Auswahl als CSV herunterladen
              </button>

              <button
                type="button"
                onClick={() => void handleDownload(true)}
                disabled={busy || unavailable || !stations.length}
                className={`${buttonClass} border border-slate-700 text-slate-200 hover:bg-slate-800`}
              >
                Stichprobe (100 Zeilen)
              </button>
            </div>

            {statusMessage && (
              <p
                role="status"
                aria-live="polite"
                className="text-xs font-medium text-emerald-400 pt-1"
              >
                {statusMessage}
              </p>
            )}

            {busy && (
              <p className="text-xs text-slate-400 animate-pulse">
                Messdaten werden aus der Zeitreihen-Datenbank geladen …
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
