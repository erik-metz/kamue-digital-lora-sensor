import { fetchMapData } from "@/lib/mapBackend";
import { CORE_TEAM_MEMBERS } from "@/lib/pitchData";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  AudioWaveform,
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  CarFront,
  CircleParking,
  CloudSun,
  Code2,
  Coins,
  Compass,
  Cpu,
  Database,
  Droplets,
  FileText,
  Hammer,
  HeartHandshake,
  Layers,
  Map,
  MapPin,
  Radio,
  Sparkles,
  Sprout,
  Users,
  Volume2,
  Wifi,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import BroadbandTrackerWidget from "./components/BroadbandTrackerWidget";
import CleanEnergyWidget from "./components/CleanEnergyWidget";
import DashboardClient from "./components/DashboardClient.tsx";
import EnvironmentAgricultureWidget from "./components/EnvironmentAgricultureWidget";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Open Ried | Das offene Daten- & Smart-Region-Portal für das Hessische Ried",
  description:
    "Zentrales Regional- und Datenportal für Bürstadt, Lampertheim & das Hessische Ried: Echtzeit-Umweltsensorik, vernetzte Mobilität, Demografie, Kommunalhaushalt, Bauen, Wohnen & freie Open-Data-APIs.",
};

async function fetchSensors() {
  try {
    return await fetchMapData();
  } catch {
    return null;
  }
}

export default async function Home() {
  const sensors = await fetchSensors();
  const nodes = sensors?.nodes ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header / Navigation Bar */}
      <SiteHeader sensorCount={nodes.length} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-20">
        {/* ================================================================= */}
        {/* 1. HERO SECTION                                                   */}
        {/* ================================================================= */}
        <section
          id="hero"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl"
        >
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-semibold">
              <HeartHandshake className="w-4 h-4" /> Bürgerinitiative &amp; Open
              Data in Partnerschaft mit dem Kulturzentrum KAMÜ
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-100 leading-[1.15] tracking-tight">
              Das offene Datenportal für{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300">
                Bürstadt, Lampertheim &amp; das Hessische Ried
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-3xl">
              <strong>
                Vom Rohdaten-Schatz zu echten Lösungen für die Region:
              </strong>{" "}
              Wir verknüpfen kontinuierliche <strong>Live-Sensorik</strong>{" "}
              (Klima, Feinstaub, Lärm, Seismik, Pegelstände) und vernetzte
              Mobilität mit transparenten <strong>Kommunaldaten</strong>{" "}
              (Haushalte, Demografie, Wirtschaft, Bauen). Initiiert als
              ehrenamtliche Bürgerinitiative im Kulturzentrum{" "}
              <a
                href="https://kamue.me"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline font-medium hover:text-emerald-300 transition-colors"
              >
                KAMÜ
              </a>{" "}
              in Bürstadt – 100 % unabhängig, gemeinwohlorientiert und frei
              zugänglich.
            </p>

            {/* Quick Action Navigation Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#karte"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Radio className="w-4 h-4 animate-pulse" /> Zur Live-Sensorkarte
              </a>
              <a
                href="#uebersicht"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-colors border border-slate-700"
              >
                <Compass className="w-4 h-4 text-cyan-400" /> Wo findet man was?
                (Wegweiser)
              </a>
              <a
                href="#projekt"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-colors border border-slate-700"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" /> Das Projekt
                &amp; Hackathon
              </a>
              <Link
                href="/sensor-bauen"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-slate-300 hover:text-emerald-400 font-medium text-sm transition-colors"
              >
                <Wrench className="w-4 h-4 text-amber-400" /> Sensor selber
                bauen &rarr;
              </Link>
            </div>

            {/* 3 Core Trust Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <Wifi className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    Dichte Bürger-Sensorik
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    LoRaWAN-Funknetz, Citizen-Science-Kits, Feinstaub, Pegel,
                    Bodenfeuchte &amp; Seismik.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <Calendar className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    48h Ried-Hackathon
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gemeinsam im Kulturzentrum KAMÜ reale Werkzeuge für Schulen,
                    Kommunen &amp; Bürger entwickeln.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <Database className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    100 % Open Source &amp; 0 €
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Keine Lizenzkosten, freie REST-APIs, offene Daten und kein
                    Eingriff in Kommunalhaushalte.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 2. PROJEKTVORSTELLUNG: WORUM GEHT ES? (DIE 2 SÄULEN AUS /pitch)   */}
        {/* ================================================================= */}
        <section id="projekt" className="space-y-10">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Die Vision der Initiative
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              Daten-Silos aufbrechen &amp; gemeinsam Neues für das Hessische
              Ried erarbeiten
            </h2>
            <p className="text-base text-slate-300 leading-relaxed">
              Unmengen an Daten existieren bereits in unserer Region – von
              Smart-City-Messungen bis zu Wetterdiensten und Verkehrsverbünden
              –, doch sie schlummern oft in isolierten Silos. Gleichzeitig
              klaffen im Riedkern erhebliche Daten-Blindflecke bei Feinstaub,
              Lärm und LoRaWAN-Empfang. Unsere Initiative steht auf zwei sich
              gegenseitig verstärkenden Säulen:
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Pillar 1: Citizen Science & Sensorbau */}
            <div className="rounded-3xl bg-slate-900/70 border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all shadow-xl group">
              <div className="relative h-56 sm:h-64 w-full bg-slate-950 overflow-hidden">
                <Image
                  src="/pitch/sensor-hardware-kit.jpg"
                  alt="Open Ried LoRaWAN Sensor-Hardware Kit und Löt-Workshop"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <Cpu className="w-3.5 h-3.5" /> Säule 1 · Citizen Science
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-100">
                    Dichte Sensor-Messnetze &amp; Selberbauen
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Wir überwinden weiße Flecken im Ried durch offene,
                    kostengünstige Multisensor-Stationen. Ob Feinstaub
                    (PM2.5/PM10), akustischer Lärmpegel, Bodenfeuchte für
                    Baumbewässerung oder Raspberry-Shake-Seismometer:
                    Bürgerinnen, Schüler und Vereine können ihre eigenen
                    Sensoren in unseren Workshops im KAMÜ löten und ins freie
                    LoRaWAN-Netz einbinden.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                      LoRaWAN &amp; TTN
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      Feinstaub PM2.5/PM10
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      Raspberry Shake Seismik
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      Pegel- &amp; Bodenfeuchte
                    </span>
                  </div>

                  <Link
                    href="/sensor-bauen"
                    className="inline-flex items-center gap-2 text-sm font-bold text-emerald-400 hover:text-emerald-300 group-hover:translate-x-1 transition-transform"
                  >
                    Bauanleitungen, Bauteilliste (BOM) &amp; Workshops entdecken
                    &rarr;
                  </Link>
                </div>
              </div>
            </div>

            {/* Pillar 2: 48h Ried-Hackathon im KAMÜ */}
            <div className="rounded-3xl bg-slate-900/70 border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-slate-700 transition-all shadow-xl group">
              <div className="relative h-56 sm:h-64 w-full bg-slate-950 overflow-hidden">
                <Image
                  src="/pitch/hackathon-kamue-community.jpg"
                  alt="48h Ried-Hackathon im Kulturzentrum KAMÜ in Bürstadt"
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent" />
                <div className="absolute top-4 left-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-cyan-400 text-xs font-bold">
                  <Code2 className="w-3.5 h-3.5" /> Säule 2 · Regionale
                  Innovation
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-100">
                    Der 48h Ried-Hackathon im Kulturzentrum KAMÜ
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Rohdaten allein verändern noch nichts. Beim regionalen
                    Bürger-Hackathon im historischen Getreidespeicher KAMÜ
                    tüfteln Programmierer, Schüler, Bürgerinnen und
                    Verwaltungsvertreter ein Wochenende lang an echten
                    Werkzeugen: z. B. Schranken-Countdown-Bots für die Riedbahn,
                    Lärm-Ampeln für Schulwege oder hitzebasierte
                    Baumbewässerungs-Apps.
                  </p>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-800">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-medium">
                      Kulturzentrum KAMÜ
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      Schulen &amp; Jugend Hackt
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      Riedbahn-Echtzeitbot
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      Gemeinwohl-Lösungen
                    </span>
                  </div>

                  <Link
                    href="/pitch"
                    className="inline-flex items-center gap-2 text-sm font-bold text-cyan-400 hover:text-cyan-300 group-hover:translate-x-1 transition-transform"
                  >
                    Stakeholder-Pitches &amp; Projektkonzepte einsehen &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 3. ORIENTIERUNGS-GUIDE: WO FINDET MAN WAS?                       */}
        {/* ================================================================= */}
        <section
          id="uebersicht"
          className="rounded-3xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 p-6 sm:p-10 space-y-8 shadow-xl"
        >
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" /> Portal-Wegweiser
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Wo findet man was? Deine Navigation durch Open Ried
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Damit du schnell genau die Informationen, Karten oder Werkzeuge
              findest, die du suchst, ist die Plattform in vier klare
              Themenbereiche gegliedert:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Guide Box 1: Live-Karten & Sensorik */}
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-4 hover:border-emerald-500/40 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  1
                </div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Map className="w-4 h-4 text-emerald-400" /> Live-Karten &amp;
                  Telemetrie
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  <strong>Direkt als Nächstes auf dieser Seite:</strong>{" "}
                  Interaktive Regionalkarte mit LoRaWAN-Umweltsensoren,
                  Linienbussen in Echtzeit, VRNnextbike-Stationen, Pegelständen,
                  Baustellen und BORIS-Bodenrichtwerten.
                </p>
              </div>
              <a
                href="#karte"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 pt-2 border-t border-slate-800/80"
              >
                <ArrowDown className="w-3.5 h-3.5" /> Direkt zur Live-Karte
                springen
              </a>
            </div>

            {/* Guide Box 2: Fachportale */}
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-4 hover:border-cyan-500/40 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  2
                </div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" /> Themen- &amp;
                  Fachportale
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Vertiefende Daten-Dashboards: Kommunalhaushalt Bürstadt &amp;
                  Lampertheim (
                  <Link
                    href="/haushalt"
                    className="text-cyan-400 hover:underline"
                  >
                    /haushalt
                  </Link>
                  ), Bauen &amp; Wohnen (
                  <Link
                    href="/bauen-wohnen"
                    className="text-cyan-400 hover:underline"
                  >
                    /bauen-wohnen
                  </Link>
                  ), Demografie (
                  <Link
                    href="/demografie"
                    className="text-cyan-400 hover:underline"
                  >
                    /demografie
                  </Link>
                  ), Wirtschaft (
                  <Link
                    href="/wirtschaft"
                    className="text-cyan-400 hover:underline"
                  >
                    /wirtschaft
                  </Link>
                  ) &amp; der Regionalatlas.
                </p>
              </div>
              <a
                href="#themen"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 pt-2 border-t border-slate-800/80"
              >
                Zu den 8 Fachportalen &rarr;
              </a>
            </div>

            {/* Guide Box 3: Open Data & API */}
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-4 hover:border-teal-500/40 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold">
                  3
                </div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-400" /> Open Data &amp;
                  REST-API
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Für Entwickler, Wissenschaft und Hackathon-Teams: Alle
                  Telemetriedaten und Statistiken kostenfrei als JSON/CSV
                  herunterladen, offene REST-APIs abfragen und Code-Snippets
                  (Python, JS, cURL) nutzen.
                </p>
              </div>
              <Link
                href="/daten"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-400 hover:text-teal-300 pt-2 border-t border-slate-800/80"
              >
                Zum Open Data Katalog &amp; API &rarr;
              </Link>
            </div>

            {/* Guide Box 4: Mitmachen & Sensorbau */}
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between space-y-4 hover:border-amber-500/40 transition-colors">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  4
                </div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Hammer className="w-4 h-4 text-amber-400" /> Werkstatt &amp;
                  Bildung
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Selbst mitmachen: Vollständige Bauanleitungen, Stücklisten
                  (BOM) und 3D-Druckvorlagen für Bürger-Sensoren sowie Anmeldung
                  zu kostenlosen Löt-Workshops im KAMÜ (
                  <Link
                    href="/sensor-bauen"
                    className="text-amber-400 hover:underline"
                  >
                    /sensor-bauen
                  </Link>
                  ).
                </p>
              </div>
              <Link
                href="/sensor-bauen"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 pt-2 border-t border-slate-800/80"
              >
                Bauanleitung &amp; Workshop-Anmeldung &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 4. DIE LIVE-REGIONALSENSORKARTE & DASHBOARD (NACH OBEN GEZOGEN)   */}
        {/* ================================================================= */}
        <section id="karte" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
                <Radio className="size-3.5 animate-pulse" /> Live-Telemetrie
                &amp; Regionalkarte
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
                Interaktive Live-Sensorkarte des Hessischen Rieds
              </h2>
              <p className="mt-1 text-sm sm:text-base text-slate-400 max-w-2xl">
                Echtzeit-Messungen unserer Bürger- und Multisensorstationen
                kombiniert mit ÖPNV-Fahrzeugpositionen, Bikesharing,
                Pegelständen, Baustellen und Bodenrichtwerten.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
              <span>{nodes.length} aktive Sensor-Stationen online</span>
            </div>
          </div>

          {/* Interactive Map Component */}
          <div id="dashboard" className="w-full">
            <DashboardClient
              nodes={nodes}
              loadFailed={sensors === null}
              readingsAvailable={sensors?.readingsAvailable ?? false}
            />
          </div>
        </section>

        {/* ================================================================= */}
        {/* 5. THEMENBEREICHE & FACHPORTALE DER PLATTFORM                     */}
        {/* ================================================================= */}
        <section id="themen" className="space-y-6 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                <Layers className="size-3.5" /> Regionales Daten-Ökosystem
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
                Themenbereiche &amp; Fachportale
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Erkunde alle Facetten unserer Region – von Echtzeit-Messwerten
                bis zu amtlichen Statistiken.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/regionalatlas"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all shadow-sm"
              >
                <Layers className="size-3.5 text-emerald-400" /> Regionalatlas
                öffnen &rarr;
              </Link>
              <Link
                href="/quellen"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
              >
                <FileText className="size-3.5" /> Quellen &rarr;
              </Link>
            </div>
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
                  Live-Wetter, Feinstaub, Ozon, Lärm, Erschütterungen,
                  Bodenfeuchte und Pegelstände im Hessischen Ried.
                </p>
              </div>
              <span className="text-[11px] font-medium text-emerald-400/80 pt-2 border-t border-slate-800/60">
                Echtzeit-Messung &bull; 9 Parameter
              </span>
            </a>

            {/* Card 2: Mobilität & Verkehr */}
            <a
              href="#karte"
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
                  Echtzeit-ÖPNV, Bahnübergangsmonitoring, VRNnextbike,
                  ZAKB-Touren, Baustellen und Parkplatzbelegung.
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
                  Bodenrichtwertzonen (BORIS Hessen), Baugenehmigungen,
                  Wohnungsbestand und Bebauungspläne.
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
                  Einwohnerentwicklung, Altersstruktur, Wanderungssalden sowie
                  Kita- und Schulstandorte.
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
                  Kommunalhaushalte von Bürstadt und Lampertheim, Hebesätze,
                  Einnahmen, Ausgaben und Schuldenentwicklung.
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
                  Gewerbebetriebe, Industriezonen, Beschäftigungszahlen und
                  wirtschaftliche Eckdaten der Ried-Kommunen.
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
                  Vereinsleben, Abfallmengen, Wertstoffhöfe,
                  Kulturveranstaltungen und Events des Kulturzentrums KAMÜ.
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
                  Freie CSV- und JSON-Exporte aller Daten sowie offene
                  REST-Programmierschnittstelle für Entwickler.
                </p>
              </div>
              <span className="text-[11px] font-medium text-teal-400/80 pt-2 border-t border-slate-800/60">
                REST-API &bull; Downloads
              </span>
            </Link>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 6. MULTISENSORIK & SMART-CITY SPEZIFIKATIONEN SECTION             */}
        {/* ================================================================= */}
        <section id="sensorik" className="space-y-6 scroll-mt-20">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Echtzeit-Telemetrie &amp; Smarte Sensorik
            </h2>
            <p className="text-base text-slate-400">
              Unser offenes Netzwerk bündelt kontinuierliche Umwelt-,
              Mobilitäts-, Boden- und Geodaten aus Multisensor-Stationen,
              Smart-City-Systemen, Pegelsonden und Seismometern.
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
                  Klima &amp; Wetter
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Präzise Erfassung von Temperatur, relativer Luftfeuchtigkeit,
                  Niederschlagsmenge (Regen), UV-Index und barometrischem
                  Luftdruck.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">
                    °C (Temperatur)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">
                    % r.F. (Luftfeuchte)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">
                    mm (Niederschlag)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">
                    UV-Index
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-amber-300/90 font-mono">
                    hPa (Luftdruck)
                  </span>
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
                  Gase &amp; Luftqualität
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Messung von flüchtigen organischen Verbindungen (VOC),
                  Stickoxiden (NOx), Stickstoffdioxid (NO₂), Ozon (O₃) und CO₂
                  für gesunde Außenluft.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">
                    VOC-Index
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">
                    NOx-Index
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">
                    ppm (CO₂)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">
                    µg/m³ (NO₂, O₃)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-cyan-300/90 font-mono">
                    AQI (Index)
                  </span>
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
                  Optische Lasermessung zur kontinuierlichen Analyse von
                  Schwebstaub- und Partikelbelastungen in Wohngebieten und an
                  Verkehrsknoten.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-emerald-300/90 font-mono">
                    PM2.5 (µg/m³)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-emerald-300/90 font-mono">
                    PM10 (µg/m³)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-emerald-300/90 font-mono">
                    PM1.0 / PM4.0
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-emerald-300/90 font-mono">
                    Partikel/cm³
                  </span>
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
                  Digitales Messmikrofon mit intelligenter
                  On-Device-Klassifikation zur Echtzeit-Unterscheidung lokaler
                  Schall- und Lärmquellen.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-purple-300/90 font-mono">
                    dB / dB(A) (Pegel)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-purple-300/90 font-mono">
                    Kfz-Verkehr
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-purple-300/90 font-mono">
                    Passanten / Sprache
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-purple-300/90 font-mono">
                    Wind &amp; Natur
                  </span>
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
                  Erschütterungen &amp; Seismik
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Raspberry-Shake-Seismometer zur Erfassung von Mikroseismik,
                  Erdbeben, Bodenerschütterungen und
                  Hintergrund-Vibrationsrauschen im Oberrheingraben.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-pink-300/90 font-mono">
                    µm/s (PGV Vibration)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-pink-300/90 font-mono">
                    µm/s (RMS-Tremor)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-pink-300/90 font-mono">
                    Counts (Wellenform)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-pink-300/90 font-mono">
                    100 Hz MiniSEED
                  </span>
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
                  Parkraum &amp; Stellplätze
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Smart-City-Überwachung von Parkplätzen und Parkierungszonen in
                  Bürstadt und Lampertheim zur Reduzierung des Parksuchverkehrs.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-violet-300/90 font-mono">
                    Freie Plätze (Anzahl)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-violet-300/90 font-mono">
                    Belegte Plätze (Anzahl)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-violet-300/90 font-mono">
                    Gesamtkapazität
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-violet-300/90 font-mono">
                    Auslastungsgrad (%)
                  </span>
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
                  Verkehrsfluss &amp; Mobilität
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Automatisierte Zählung und Kategorisierung des
                  Verkehrsaufkommens nach Fahrzeugarten, Radfahrern und
                  Passanten an Hauptverkehrsachsen.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">
                    PKW &amp; LKW (Counts)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">
                    Busse &amp; Motorräder
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">
                    Fahrräder (Counts)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">
                    Passanten (Counts)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-orange-300/90 font-mono">
                    Stunden- &amp; Tagessummen
                  </span>
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
                  Boden &amp; Bewässerung
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Tiefengestaffelte Bodenfeuchte- und Saugspannungsmessung für
                  bedarfsgerechte Stadtgrün- und Baumbewässerung sowie
                  landwirtschaftliche Analysen.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-lime-300/90 font-mono">
                    Bodenfeuchte 30/60cm (%)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-lime-300/90 font-mono">
                    % nFK (Feldkapazität)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-lime-300/90 font-mono">
                    kPa (Saugspannung)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-lime-300/90 font-mono">
                    °C (Bodentemperatur)
                  </span>
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
                  Pegel &amp; Wasserstände
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Kontinuierliche Pegelüberwachung an Gewässern,
                  Entwässerungsgräben und Rückhaltebecken zur Früherkennung von
                  Starkregen- und Hochwasserrisiken.
                </p>
              </div>
              <div className="pt-3 border-t border-slate-800/60 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Erfasste Einheiten &amp; Größen
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-sky-300/90 font-mono">
                    m (Pegel-Delta)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-sky-300/90 font-mono">
                    m (Wasserstand)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-xs text-sky-300/90 font-mono">
                    cm (Wasseroberflächenabstand)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* 7. REGIONALE LIVE-WIDGETS (UMWELT, ENERGIE, INFRASTRUKTUR)        */}
        {/* ================================================================= */}
        <section id="umwelt" className="space-y-8 scroll-mt-20">
          <EnvironmentAgricultureWidget />
        </section>

        <section id="energie" className="space-y-8 scroll-mt-20">
          <CleanEnergyWidget />
        </section>

        <section id="infrastruktur" className="space-y-8 scroll-mt-20">
          <BroadbandTrackerWidget />
        </section>

        {/* ================================================================= */}
        {/* 8. TEAM & PARTNERSCHAFT: DAS BÜRGERSCHAFTLICHE TEAM                */}
        {/* ================================================================= */}
        <section id="team" className="space-y-8 scroll-mt-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                <HeartHandshake className="size-3.5" /> Bürgerengagement &amp;
                Partner
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
                Die Köpfe hinter der Bürgerinitiative
              </h2>
              <p className="mt-1 text-sm text-slate-400 max-w-2xl">
                Open Ried ist ein zu 100 % ehrenamtliches, parteiunabhängiges
                Gemeinwohl-Projekt in Partnerschaft mit dem Kulturzentrum KAMÜ
                und der Bürgerstiftung Bürstadt.
              </p>
            </div>
            {/* <Link
              href="/pitch"
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
            >
              <Presentation className="w-3.5 h-3.5" /> Zu den Pitch-Decks &amp;
              Konzepten &rarr;
            </Link> */}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CORE_TEAM_MEMBERS.map((member) => (
              <div
                key={member.name}
                className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 flex flex-col justify-between space-y-5 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                      <Image
                        src={member.imageSrc}
                        alt={member.name}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100">
                        {member.name}
                      </h3>
                      <div className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {member.location}
                      </div>
                      <div className="text-xs text-slate-400 font-medium mt-0.5 line-clamp-1">
                        {member.role}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {member.bio}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                  {member.highlights.map((highlight, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 font-medium"
                    >
                      {highlight}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================================================================= */}
        {/* 9. CALL TO ACTION & MITMACHEN SECTION                             */}
        {/* ================================================================= */}
        <section
          id="mitmachen"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 space-y-6 shadow-2xl"
        >
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <HeartHandshake className="size-3.5" /> Gemeinwohl, Open Source
                &amp; Partizipation
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-slate-100">
                Sei beim nächsten Ried-Hackathon &amp; Workshop im KAMÜ dabei!
              </h3>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Ob Schüler, IT-Profi, Bastler oder neugieriger Bürger: Alle
                Messwerte, Baupläne und Quelltexte sind 100 % Open Data und Open
                Source. Baue deinen eigenen Umweltsensor, bring deine Ideen für
                das Ried ein oder entwickle mit uns nützliche Tools für unsere
                Heimat.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full lg:w-auto shrink-0">
              <Link
                href="/sensor-bauen"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02]"
              >
                <Hammer className="size-4" /> Sensor-Workshop anmelden
              </Link>
              <Link
                href="/daten"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-colors border border-slate-700"
              >
                <Database className="size-4" /> Open Data API
              </Link>
              <Link
                href="/pitch"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm transition-colors border border-slate-700"
              >
                <BookOpen className="size-4" /> Pitch-Decks
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
