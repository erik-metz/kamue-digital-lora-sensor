import { fetchMapData } from "@/lib/mapBackend";
import {
  Activity,
  ArrowRight,
  AudioWaveform,
  BarChart3,
  Briefcase,
  Building2,
  CarFront,
  CheckCircle2,
  CircleParking,
  CloudSun,
  Coins,
  Database,
  Droplets,
  FileText,
  HeartHandshake,
  Layers,
  Radio,
  Sprout,
  Users,
  Volume2,
  Wifi,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import DashboardClient from "./components/DashboardClient.tsx";
import SiteHeader from "./components/SiteHeader";
import CleanEnergyWidget from "./components/CleanEnergyWidget";
import BroadbandTrackerWidget from "./components/BroadbandTrackerWidget";
import EnvironmentAgricultureWidget from "./components/EnvironmentAgricultureWidget";
import SiteFooter from "./components/SiteFooter";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open Ried | Das offene Daten- & Smart-Region-Portal für das Hessische Ried",
  description:
    "Zentrales Regional- und Datenportal für Bürstadt, Lampertheim & das Hessische Ried: Echtzeit-Umweltsensorik, vernetzte Mobilität, Demografie, Kommunalhaushalt, Bauen, Wohnen & freie Open-Data-APIs.",
};

async function fetchSensors() {
  try { return await fetchMapData(); }
  catch { return null; }
}

export default async function Home() {
  const sensors = await fetchSensors();
  const nodes = sensors?.nodes ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header / Navigation Bar */}
      <SiteHeader sensorCount={nodes.length} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* HERO SECTION */}
        <section
          id="projekt"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl"
        >
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
              <HeartHandshake className="w-3.5 h-3.5" /> Bürgerinitiative &amp; Open Data für das Ried
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight tracking-tight">
              Das offene Datenportal für{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Bürstadt, Lampertheim &amp; das Hessische Ried
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              <strong>Open Ried</strong> ist das unabhängige Smart-Region- und
              Open-Data-Portal für das Hessische Ried – initiiert als bürgerschaftliches
              Mitmach-Projekt in Kooperation mit dem Kulturzentrum{" "}
              <a
                href="https://kamue.me"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline font-medium hover:text-emerald-300 transition-colors"
              >
                KAMÜ
              </a>{" "}
              in Bürstadt. Wir verknüpfen kontinuierliche Live-Sensorik (Klima,
              Luftqualität, Lärm, Pegel und Bodenfeuchte) und vernetzte Mobilität
              (ÖPNV-Echtzeit, Bikesharing, Bahnübergänge, Baustellen) mit
              transparenten Kommunaldaten wie Demografie, Haushalten, Wirtschaft und
              Bauen – vollkommen frei zugänglich über interaktive Karten und offene REST-APIs.
            </p>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#dashboard"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/10"
              >
                <Radio className="w-4 h-4" /> Zur interaktiven Regionalkarte
              </a>
              <a
                href="#themen"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-colors border border-slate-700"
              >
                <Layers className="w-4 h-4" /> Themenportale entdecken
              </a>
              <Link
                href="/daten"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-slate-400 hover:text-emerald-400 font-medium text-sm transition-colors"
              >
                <Database className="w-4 h-4" /> Offene Daten &amp; API
              </Link>
            </div>

            {/* Feature Highlights Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Wifi className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    Echtzeit-Sensorik &amp; IoT
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    LoRaWAN-Sensoren, Seismometer, Wetter, Feinstaub, Pegel &amp; Bodenfeuchte.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <CarFront className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    Mobilität &amp; Infrastruktur
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Fahrpläne, Positionsprognosen, VRNnextbike, Straßensperrungen &amp; Parkraum.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Database className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    Offene Kommunaldaten
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Demografie, Haushalte, Gewerbe, Bauen &amp; standardisierte REST-APIs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* THEMEN & BEREICHE DER PLATTFORM */}
        <section id="themen" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                <Layers className="size-3.5" /> Regionales Daten-Ökosystem
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
                Themenbereiche &amp; Fachportale
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Erkunde alle Facetten unserer Region – von Echtzeit-Messwerten bis zu amtlichen Statistiken.
              </p>
            </div>
            <Link
              href="/quellen"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors shrink-0"
            >
              <FileText className="size-3.5" /> Datenquellen und Erfassungsstatus ansehen &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Sensorik & Umwelt */}
            <a
              href="#sensorik"
              className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition-colors flex items-center justify-between">
                  <span>Sensorik &amp; Umwelt</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Live-Wetter, Feinstaub, Ozon, Lärm, Erschütterungen, Bodenfeuchte und Pegelstände im Hessischen Ried.
                </p>
              </div>
              <span className="text-[11px] font-medium text-emerald-400/80 pt-2 border-t border-slate-800/60">
                Echtzeit-Messung &bull; 9 Parameter
              </span>
            </a>

            {/* Card 2: Mobilität & Verkehr */}
            <a
              href="#dashboard"
              className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CarFront className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition-colors flex items-center justify-between">
                  <span>Mobilität &amp; Verkehr</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Echtzeit-ÖPNV, Bahnübergangsmonitoring, VRNnextbike, ZAKB-Touren, Baustellen und Parkplatzbelegung.
                </p>
              </div>
              <span className="text-[11px] font-medium text-cyan-400/80 pt-2 border-t border-slate-800/60">
                Fahrplanprognosen &bull; Kartenebenen
              </span>
            </a>

            {/* Card 3: Bauen & Wohnen */}
            <Link
              href="/bauen-wohnen"
              className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-amber-300 transition-colors flex items-center justify-between">
                  <span>Bauen &amp; Wohnen</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Bodenrichtwertzonen (BORIS Hessen), Baugenehmigungen, Wohnungsbestand und Bebauungspläne.
                </p>
              </div>
              <span className="text-[11px] font-medium text-amber-400/80 pt-2 border-t border-slate-800/60">
                Immobilienmarkt &bull; Bauland
              </span>
            </Link>

            {/* Card 4: Demografie & Soziales */}
            <Link
              href="/demografie"
              className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-purple-300 transition-colors flex items-center justify-between">
                  <span>Demografie &amp; Bildung</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Einwohnerentwicklung, Altersstruktur, Wanderungssalden sowie Kita- und Schulstandorte.
                </p>
              </div>
              <span className="text-[11px] font-medium text-purple-400/80 pt-2 border-t border-slate-800/60">
                Bevölkerung &bull; Infrastruktur
              </span>
            </Link>

            {/* Card 5: Finanzen & Haushalt */}
            <Link
              href="/haushalt"
              className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Coins className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-300 transition-colors flex items-center justify-between">
                  <span>Finanzen &amp; Haushalt</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Kommunalhaushalte von Bürstadt und Lampertheim, Hebesätze, Einnahmen, Ausgaben und Schuldenentwicklung.
                </p>
              </div>
              <span className="text-[11px] font-medium text-emerald-400/80 pt-2 border-t border-slate-800/60">
                Haushaltstransparenz &bull; Hebesätze
              </span>
            </Link>

            {/* Card 6: Wirtschaft & Gewerbe */}
            <Link
              href="/wirtschaft"
              className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-blue-300 transition-colors flex items-center justify-between">
                  <span>Wirtschaft &amp; Gewerbe</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Gewerbebetriebe, Industriezonen, Beschäftigungszahlen und wirtschaftliche Eckdaten der Ried-Kommunen.
                </p>
              </div>
              <span className="text-[11px] font-medium text-blue-400/80 pt-2 border-t border-slate-800/60">
                Gewerbe &bull; Arbeitsplätze
              </span>
            </Link>

            {/* Card 7: Regionalstatistik & Kultur */}
            <Link
              href="/statistik"
              className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-pink-500/50 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-pink-300 transition-colors flex items-center justify-between">
                  <span>Statistik &amp; Kultur</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Vereinsleben, Abfallmengen, Wertstoffhöfe, Kulturveranstaltungen und Events des Kulturzentrums KAMÜ.
                </p>
              </div>
              <span className="text-[11px] font-medium text-pink-400/80 pt-2 border-t border-slate-800/60">
                Gemeinwesen &bull; Kulturkalender
              </span>
            </Link>

            {/* Card 8: Offene Daten & API */}
            <Link
              href="/daten"
              className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/50 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-teal-300 transition-colors flex items-center justify-between">
                  <span>Offene Daten &amp; API</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Freie CSV- und JSON-Exporte aller Daten sowie offene REST-Programmierschnittstelle für Entwickler.
                </p>
              </div>
              <span className="text-[11px] font-medium text-teal-400/80 pt-2 border-t border-slate-800/60">
                REST-API &bull; Downloads
              </span>
            </Link>
          </div>
        </section>

        {/* MULTISENSORIK & SMART-CITY SPEZIFIKATIONEN SECTION */}
        <section id="sensorik" className="space-y-6">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Echtzeit-Telemetrie &amp; Smarte Sensorik
            </h2>
            <p className="text-base text-slate-400">
              Unser offenes Netzwerk bündelt kontinuierliche Umwelt-, Mobilitäts-, Boden- und Geodaten aus
              Multisensor-Stationen, Smart-City-Systemen, Pegelsonden und Seismometern.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Sensor 1: Klima & Wetter */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <CloudSun className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Klima & Wetter
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Präzise Erfassung von Temperatur, relativer Luftfeuchtigkeit,
                  Niederschlagsmenge (Regen), UV-Index und barometrischem Luftdruck.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">°C (Temperatur)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">% r.F. (Luftfeuchte)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">mm (Niederschlag)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">UV-Index</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">hPa (Luftdruck)</span>
                </div>
              </div>
            </div>

            {/* Sensor 2: Gase & Luftqualität */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Gase & Luftqualität
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Messung von flüchtigen organischen Verbindungen (VOC), Stickoxiden (NOx),
                  Stickstoffdioxid (NO₂), Ozon (O₃) und CO₂ für gesunde Außenluft.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">VOC-Index</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">NOx-Index</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">ppm (CO₂)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">µg/m³ (NO₂, O₃)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">AQI (Index)</span>
                </div>
              </div>
            </div>

            {/* Sensor 3: Feinstaub */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Feinstaub (PM1.0 – PM10)
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Optische Lasermessung zur kontinuierlichen Analyse von Schwebstaub- und
                  Partikelbelastungen in Wohngebieten und an Verkehrsknoten.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-emerald-300/90 font-mono">PM2.5 (µg/m³)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-emerald-300/90 font-mono">PM10 (µg/m³)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-emerald-300/90 font-mono">PM1.0 / PM4.0</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-emerald-300/90 font-mono">Partikel/cm³</span>
                </div>
              </div>
            </div>

            {/* Sensor 4: Akustik & Lärm */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Volume2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Akustische Lärmanalyse
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Digitales Messmikrofon mit intelligenter On-Device-Klassifikation zur
                  Echtzeit-Unterscheidung lokaler Schall- und Lärmquellen.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-purple-300/90 font-mono">dB / dB(A) (Pegel)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-purple-300/90 font-mono">Kfz-Verkehr</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-purple-300/90 font-mono">Passanten / Sprache</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-purple-300/90 font-mono">Wind & Natur</span>
                </div>
              </div>
            </div>

            {/* Sensor 5: Erschütterungen & Seismik (Raspberry Shake) */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center">
                  <AudioWaveform className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Erschütterungen & Seismik
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Raspberry-Shake-Seismometer zur Erfassung von Mikroseismik, Erdbeben,
                  Bodenerschütterungen und Hintergrund-Vibrationsrauschen.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-pink-300/90 font-mono">µm/s (PGV Vibration)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-pink-300/90 font-mono">µm/s (RMS-Tremor)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-pink-300/90 font-mono">Counts (Wellenform)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-pink-300/90 font-mono">100 Hz MiniSEED</span>
                </div>
              </div>
            </div>

            {/* Sensor 6: Parkraum & Stellplätze */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                  <CircleParking className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Parkraum & Stellplätze
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Smart-City-Überwachung von Parkplätzen und Parkierungszonen in Bürstadt und
                  Lampertheim zur Reduzierung des Parksuchverkehrs.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-violet-300/90 font-mono">Freie Plätze (Anzahl)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-violet-300/90 font-mono">Belegte Plätze (Anzahl)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-violet-300/90 font-mono">Gesamtkapazität</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-violet-300/90 font-mono">Auslastungsgrad (%)</span>
                </div>
              </div>
            </div>

            {/* Sensor 7: Verkehrsfluss & Mobilität */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                  <CarFront className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Verkehrsfluss & Mobilität
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Automatisierte Zählung und Kategorisierung des Verkehrsaufkommens nach
                  Fahrzeugarten, Radfahrern und Passanten an Hauptverkehrsachsen.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">PKW & LKW (Counts)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">Busse & Motorräder</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">Fahrräder (Counts)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">Passanten (Counts)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">Stunden- & Tagessummen</span>
                </div>
              </div>
            </div>

            {/* Sensor 8: Bodenfeuchte & Bewässerung */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-lime-500/10 border border-lime-500/20 text-lime-400 flex items-center justify-center">
                  <Sprout className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Boden & Bewässerung
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Tiefengestaffelte Bodenfeuchte- und Saugspannungsmessung für bedarfsgerechte
                  Stadtgrün- und Baumbewässerung sowie landwirtschaftliche Analysen.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-lime-300/90 font-mono">Bodenfeuchte 30/60cm (%)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-lime-300/90 font-mono">% nFK (Feldkapazität)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-lime-300/90 font-mono">kPa (Saugspannung)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-lime-300/90 font-mono">°C (Bodentemperatur)</span>
                </div>
              </div>
            </div>

            {/* Sensor 9: Pegel & Wasserstände */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Droplets className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  Pegel & Wasserstände
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Kontinuierliche Pegelüberwachung an Gewässern, Entwässerungsgräben und
                  Rückhaltebecken zur Früherkennung von Starkregen- und Hochwasserrisiken.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Erfasste Einheiten & Größen</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-sky-300/90 font-mono">m (Pegel-Delta)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-sky-300/90 font-mono">m (Wasserstand)</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-sky-300/90 font-mono">cm (Wasseroberflächenabstand)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* DASHBOARD & KARTEN SECTION */}
        <section id="dashboard" className="space-y-8">
          <DashboardClient nodes={nodes} loadFailed={sensors === null} readingsAvailable={sensors?.readingsAvailable ?? false} />
        </section>

        {/* UMWELT, GRUNDWASSER & LANDWIRTSCHAFT */}
        <section id="umwelt" className="space-y-8">
          <EnvironmentAgricultureWidget />
        </section>

        {/* REGIONALE ÖKOSTROM- & BIOGASERZEUGUNG */}
        <section id="energie" className="space-y-8">
          <CleanEnergyWidget />
        </section>

        {/* VERNETZTE INFRASTRUKTUR & MOBILITÄT */}
        <section id="infrastruktur" className="space-y-8">
          <BroadbandTrackerWidget />
        </section>

        {/* OPEN DATA & MITMACHEN SECTION */}
        <section
          id="mitmachen"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-10 space-y-6 shadow-xl"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <HeartHandshake className="size-3.5" /> Gemeinwohl, Open Source &amp; Partizipation
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-100">
                Offene Daten &amp; Transparenz für die Bürgerschaft
              </h3>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Open Ried ist ein ehrenamtliches Projekt mit klarem Gemeinwohlfokus in Partnerschaft mit dem Kulturzentrum KAMÜ in Bürstadt. Alle
                gesammelten Messwerte, statistischen Aggregationen, Hardware-Baupläne
                und Programmquelltexte stehen als Open Data und Open Source der gesamten
                Öffentlichkeit frei zur Verfügung – für Bürgerinnen und Bürger, Kommunen,
                Schulen, regionale Hackathons und wissenschaftliche Forschung.
              </p>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto shrink-0">
              <Link
                href="/daten"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors shadow-lg shadow-emerald-500/10"
              >
                <Database className="size-4" /> Open Data API
              </Link>
              <Link
                href="/quellen"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors border border-slate-700"
              >
                <FileText className="size-4" /> Datenquellen &amp; Takte
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
