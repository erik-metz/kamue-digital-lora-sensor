import {
  Activity,
  ArrowLeft,
  Building2,
  Cpu,
  Database,
  ExternalLink,
  Globe,
  Layers,
  RefreshCw,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import HeaderLogo from "../components/HeaderLogo";
import SiteFooter from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "Datenquellen, Takte & Pipeline-Architektur | Open Ried Sens",
  description:
    "Vollständige Übersicht aller Upstream-Datenquellen, Abruftakte, API-Frequenzen und täglich erfassten Datenzeilen von Open Ried Sens für das Hessische Ried.",
};

interface TelemetrySourceItem {
  id: string;
  category: string;
  name: string;
  provider: string;
  endpointUrl: string;
  protocol: "WebSocket" | "HTTPS REST" | "LoRaWAN / Webhook";
  pollIntervalSec: number | string;
  pollRateText: string;
  callsPerDay: number | string;
  metricsPerCycle: string;
  estimatedRowsPerDay: string;
  metrics: string[];
  notes: string;
  license: string;
}

const TELEMETRY_SOURCES: TelemetrySourceItem[] = [
  {
    id: "raspberry-shake",
    category: "Seismologie & Geodynamik",
    name: "Raspberry Shake Seismometer-Netzwerk",
    provider: "Raspberry Shake S.A. / CAPS Swarm",
    endpointUrl: "wss://data.raspberryshake.org/caps/",
    protocol: "WebSocket",
    pollIntervalSec: 5,
    pollRateText: "Dauerhafter Stream (5s Berechnungsfenster)",
    callsPerDay: "1 Dauerstream (10 Stationen)",
    metricsPerCycle: "2 Metriken (pgv, rms) je Station",
    estimatedRowsPerDay: "~345.600",
    metrics: [
      "pgv (Peak Ground Velocity in Counts)",
      "rms (Root Mean Square Erschütterungsintensität)",
      "Optional Roh-Wellenform (50 Hz / dezimiert)",
    ],
    notes:
      "10 Stationen in der Region (R498E, R82E7, R79F9, RB012, R021A, R5DFB, RC017, R2852, RB8D1, SC342). 12 Fenster/Min × 1.440 Min × 2 Metriken × 10 Stationen = 345.600 Zeilen/Tag.",
    license: "CC BY-SA 4.0 / Raspberry Shake Open Data",
  },
  {
    id: "smartcity-buerstadt",
    category: "Kommunale Smart City Sensorik",
    name: "Smart City System Bürstadt Dashboards",
    provider: "Smart City System GmbH / Stadt Bürstadt",
    endpointUrl: "https://dashboard-service.smartcity-system.de/dashboards/{id}",
    protocol: "HTTPS REST",
    pollIntervalSec: 60,
    pollRateText: "1 Abruf alle 60 Sek. je Dashboard (4 Dashboards)",
    callsPerDay: "5.760",
    metricsPerCycle: "ca. 50–75 Datenpunkte",
    estimatedRowsPerDay: "~75.000 – 110.000",
    metrics: [
      "Wetterstationen (Temperatur, Feuchte, Niederschlag)",
      "Bodenfeuchte & Bodenspannung (30 cm / 60 cm)",
      "Grundwasser- & Hochwassermonitoring (Pegeldelta)",
      "Parkscheinwerfer & Stellplatzbelegung (Frei / Belegt)",
      "Verkehrszählstellen (PKW, LKW, Rad, Fußgänger)",
    ],
    notes:
      "4 Dashboards parallel im 60s-Takt (86.400s / 60s × 4 = 5.760 Calls/Tag). Deltas und neue Beobachtungen werden transaktional dedupliziert.",
    license: "Open Data Kommunalportal Bürstadt",
  },
  {
    id: "nextbike-lampertheim",
    category: "Mikromobilität & Bikesharing",
    name: "VRNnextbike Lampertheim Flottendaten",
    provider: "Nextbike by Tier / VRN GmbH",
    endpointUrl: "https://maps.nextbike.net/maps/nextbike-live.json?city=559",
    protocol: "HTTPS REST",
    pollIntervalSec: 60,
    pollRateText: "1 Abruf alle 60 Sekunden",
    callsPerDay: "1.440",
    metricsPerCycle: "Stationen & Flotten-GPS",
    estimatedRowsPerDay: "~15.000 – 30.000",
    metrics: [
      "Stationskapazität & verfügbare Fahrräder",
      "Fahrrad-GPS-Standorte im freien Rückgaberaum",
      "Erkannte Fahrten & Stationswechsel (Movement Evidence)",
    ],
    notes:
      "Lampertheimer Stadtgebiet (City-ID 559). Filtert abgelaufene Fahrräder nach 900s und gleicht Stationsbestände transaktional ab.",
    license: "Open Data GBFS / Nextbike Data API",
  },
  {
    id: "autobahn-gmbh",
    category: "Fernstraßen & Verkehrsinfrastruktur",
    name: "Autobahn Verkehrsservice (A67, A5, A6)",
    provider: "Die Autobahn GmbH des Bundes",
    endpointUrl: "https://verkehr.autobahn.de/oapi/v1/autobahn/{road}/services/{category}",
    protocol: "HTTPS REST",
    pollIntervalSec: 180,
    pollRateText: "9 Abrufe alle 180 Sekunden (3 Minuten)",
    callsPerDay: "4.320",
    metricsPerCycle: "Echtzeit-Meldungen & Staus",
    estimatedRowsPerDay: "~2.500 – 5.000",
    metrics: [
      "Verkehrswarnungen & Staus (Länge, Verzögerung in Min)",
      "Aktive Baustellen (Fahrstreifensperrungen, Dauer)",
      "Vollsperrungen & temporäre Umleitungen",
    ],
    notes:
      "3 Autobahnen (A67, A5, A6) × 3 Kategorien (warning, roadworks, closure) = 9 Anfragen je Zyklus. 480 Zyklen/Tag = 4.320 Requests/Tag.",
    license: "Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0)",
  },
  {
    id: "lorawan-community",
    category: "Bürger-LoRaWAN & IoT-Hardware",
    name: "Open Ried Sens DIY Sensor-Stationen",
    provider: "The Things Network (TTN Community v3) & KAMÜ",
    endpointUrl: "https://open-ried-sens.duckdns.org/api/v1/telemetry/batch",
    protocol: "LoRaWAN / Webhook",
    pollIntervalSec: "30 – 60",
    pollRateText: "Ereignisgesteuerter Uplink alle 30–60 Sek.",
    callsPerDay: "~1.440 – 2.880 je Station",
    metricsPerCycle: "8 Umweltparameter",
    estimatedRowsPerDay: "~11.500 – 23.000 je Station",
    metrics: [
      "Temperatur (°C) & Relative Luftfeuchte (% r.F.)",
      "Luftdruck (hPa)",
      "Feinstaub PM2.5 (µg/m³)",
      "Luftqualität VOC-Index & NOx-Index (0–500)",
      "Schallpegel / Umgebungslärm (dB)",
      "UV-Index (Sonneneinstrahlung)",
    ],
    notes:
      "Stationen senden energieeffizient über 868 MHz LoRaWAN. TTN Webhook liefert JSON-Payload transaktional an das FastAPI Ingestion-Backend.",
    license: "Creative Commons Namensnennung 4.0 International (CC BY 4.0)",
  },
  {
    id: "pegelonline-worms",
    category: "Hydrologie & Binnengewässer",
    name: "Rheinpegel Worms (Pegelonline WSV)",
    provider: "Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV)",
    endpointUrl: "https://pegelonline.wsv.de/webservices/rest-api/v2/stations/WORMS/W.json",
    protocol: "HTTPS REST",
    pollIntervalSec: 300,
    pollRateText: "1 Abruf alle 300 Sekunden (5 Minuten)",
    callsPerDay: "288",
    metricsPerCycle: "1 Pegelwert & Tendenz",
    estimatedRowsPerDay: "~288",
    metrics: [
      "Wasserstand Rhein (cm bzw. Meter am Pegel Worms)",
      "Automatische Einstufung der Hochwasser-Meldestufen (1–3)",
    ],
    notes:
      "Pegel Worms (Rhein-km 443.4). Referenzpegel für das gesamte hessische Ried und den Lampertheimer Altrhein.",
    license: "Datenlizenz Deutschland – Zero – Version 2.0 (dl-zero-de/2.0)",
  },
  {
    id: "open-meteo-dwd",
    category: "Meteorologie & Wettermodell",
    name: "DWD ICON-D2 Wettermodell Ried",
    provider: "Deutscher Wetterdienst (DWD) via Open-Meteo",
    endpointUrl: "https://api.open-meteo.com/v1/dwd-icon?latitude=49.6425&longitude=8.4552",
    protocol: "HTTPS REST",
    pollIntervalSec: 300,
    pollRateText: "1 Abruf alle 300 Sekunden (5 Minuten)",
    callsPerDay: "288",
    metricsPerCycle: "3 Wetterparameter",
    estimatedRowsPerDay: "~864",
    metrics: [
      "Temperatur in 2m Höhe (°C)",
      "Relative Luftfeuchtigkeit (%)",
      "Aktueller Niederschlag (mm)",
    ],
    notes:
      "Punktgenaue Abfrage für das Hessische Ried (49.6425° N, 8.4552° O) basierend auf dem hochauflösenden ICON-D2 Modell des DWD.",
    license: "Open-Meteo / DWD Open Data Lizenz",
  },
];

interface DomainRegistryItem {
  domain: string;
  iconName: string;
  link: string;
  linkText: string;
  title: string;
  provider: string;
  updateCadence: string;
  datasetScope: string;
  parameters: string[];
  license: string;
  storageTarget: string;
}

const DOMAIN_REGISTRIES: DomainRegistryItem[] = [
  {
    domain: "Wirtschaft",
    iconName: "TrendingUp",
    link: "/wirtschaft",
    linkText: "Wirtschaft & Gewerbe öffnen",
    title: "Wirtschaftsstruktur, Gewerbesteuern & Top-Arbeitgeber",
    provider: "Hessisches Statistisches Landesamt (HSL), Bundesagentur für Arbeit (BA), IHK Darmstadt",
    updateCadence: "Jährlich / Quartalsweise",
    datasetScope: "Alle Ried-Kommunen (Bürstadt, Lampertheim, Biblis, Groß-Rohrheim)",
    parameters: [
      "Gewerbesteuer- & Grundsteuerhebesätze A/B (1995–2025)",
      "Gewerbeanzeigen: Neugründungen, Abmeldungen, Wanderungssaldo",
      "Sozialversicherungspflichtig Beschäftigte nach WZ 2008 Branchen",
      "Standorte & Mitarbeiterklassen führender Industrie- & Gewerbebetriebe",
    ],
    license: "dl-de/by-2-0 & amtliche Statistik",
    storageTarget: "Postgres-Tabellen: municipality_tax_rates, business_registrations, companies",
  },
  {
    domain: "Kommunalpolitik",
    iconName: "Building2",
    link: "/haushalt",
    linkText: "Finanzen & Haushalt öffnen",
    title: "Kommunalhaushalte, Ausgaben & Wahlergebnisse",
    provider: "Amtliche Haushaltspläne & Jahresabschlüsse der Kommunen, Votemanager Hessen",
    updateCadence: "Jährlich (Haushalt) / 4–5 Jahre (Wahlturnus)",
    datasetScope: "Bürstadt, Lampertheim, Biblis, Groß-Rohrheim",
    parameters: [
      "Ertrags- & Aufwandspläne, Jahresüberschüsse und Fehlbeträge",
      "Ausgaben gegliedert nach Produktbereichen (Kitas, Schulen, Straßen, Kultur)",
      "Pro-Kopf-Verschuldung und liquide Rücklagen",
      "Wahlergebnisse & Stimmbezirke (Kommunal-, Landtags-, Bundestags-, Europawahl)",
    ],
    license: "Amtliche Veröffentlichungen / Open Government",
    storageTarget: "Postgres-Tabellen: finance_budgets, finance_expenditures, election_results",
  },
  {
    domain: "Soziales & Leben",
    iconName: "Users",
    link: "/statistik",
    linkText: "Statistik & Leben öffnen",
    title: "Sozialatlas, Vereinsleben, Gesundheit & ZAKB-Abfallwirtschaft",
    provider: "Bundesagentur für Arbeit, Kassenärztliche Vereinigung Hessen (KVH), ZAKB Bergstraße",
    updateCadence: "Monatlich (BA) bis Jährlich (ZAKB, KVH)",
    datasetScope: "Kommunen im Hessischen Ried & Landkreis Bergstraße",
    parameters: [
      "SGB II / Bürgergeld-Quoten & Arbeitslosenstatistik",
      "Ärztedichte: Hausärzte, Fachärzte, Apotheken & Versorgungsgrad (%)",
      "Vereinsregister: Sportvereine, Kulturorganisationen, Jugendförderung",
      "ZAKB-Abfallbilanz: Restmüll, Biomüll, Wertstoffe, Papier (kg/Kopf & Recyclingquote)",
    ],
    license: "Offizielle Statistiken & Verbandsberichte",
    storageTarget: "Postgres-Tabellen: municipal_indicators, zakb_waste_stats, regional_facilities",
  },
  {
    domain: "Umwelt & Agrar",
    iconName: "Waves",
    link: "/",
    linkText: "Umwelt-Kartenlayer öffnen",
    title: "Grundwasser, Schutzgebiete & Sonderkulturen",
    provider: "HLNUG Hessen, InVeKoS Hessen (Agrardaten), BKG Bundesamt für Kartographie",
    updateCadence: "Halbjährlich bis Jährlich / WMS OGC Tile Services",
    datasetScope: "Hessisches Ried (Altrhein, Bürstädter Wald, Weschnitzinsel)",
    parameters: [
      "HLNUG Grundwassermessstellen mit Pegeltiefe (m) und Nitratgehalt (mg/l)",
      "Natur- & Landschaftsschutzgebiete (NSG Lampertheimer Altrhein, Biedensand, FFH Bürstadt)",
      "Agrarnutzung & Sonderkulturen: Spargelanbau, Freilandgemüse, Erdbeeren (Hektar & Quoten)",
      "Starkregengefahrenhinweiskarten & Hochwasserrisikogebiete (WMS)",
    ],
    license: "GeoData dl-de/by-2-0 & NATUREG Hessen",
    storageTarget: "Postgres-Tabelle: groundwater_stations, GeoJSON-Polygone & WMS-Server",
  },
  {
    domain: "Infrastruktur",
    iconName: "Zap",
    link: "/",
    linkText: "Infrastruktur-Kartenlayer öffnen",
    title: "Energie, Breitbandausbau, Ladesäulen & Straßenzustand",
    provider: "ZAKB Energie, Bundesnetzagentur (BNetzA), Breitbandatlas Hessen, Freifunk",
    updateCadence: "Wöchentlich / Monatlich / OCPI Live-Status",
    datasetScope: "Bürstadt, Lampertheim, Biblis, Groß-Rohrheim",
    parameters: [
      "ZAKB Energiepark Hüttenfeld & Bürstadt: Biogas-Leistung, Solarpark-Ertrag & CO₂-Ersparnis",
      "FTTH-Glasfaserausbauquoten nach Ortsteilen (Gigabit-Grundbuch)",
      "BNetzA Ladesäulenregister: Schnelllader, Normallader & Echtzeit-Belegung",
      "Öffentliche Wi-Fi Hotspots: Hessen-WLAN („Digitale Dorflinde“) & Freifunk",
      "KI-Straßenzustandsbewertung: Schadensnoten (1–5) über ZAKB-Fahrzeugkameras",
    ],
    license: "BNetzA Open Data, OpenStreetMap & Kommunalpartner",
    storageTarget: "Tabellen: road_conditions, energy_facilities, ev_chargers, wifi_hotspots",
  },
  {
    domain: "Bauen & Wohnen",
    iconName: "Home",
    link: "/bauen-wohnen",
    linkText: "Bauen & Wohnen öffnen",
    title: "Bodenrichtwerte BORIS, Gebäudezählung & Bebauungspläne",
    provider: "BORIS Hessen (Gutachterausschüsse), Zensus 2022 / HSL, Geoportal Hessen",
    updateCadence: "2-Jahres-Turnus (Bodenrichtwerte) / Jährlich (Wohnungsbestand)",
    datasetScope: "Wohn- und Gewerbezonen im Ried",
    parameters: [
      "BORIS Bodenrichtwerte (€/m²) für Wohn- und Mischbauflächen",
      "Gebäude- und Wohnungsbestand, Wohnfläche je Einwohner, Leerstandsquoten",
      "Rechtskräftige Bebauungspläne (B-Pläne) & genehmigte Wohnungsneubauten",
    ],
    license: "dl-zero-de/2.0 (BORIS Hessen) & Zensus Open Data",
    storageTarget: "Tabellen: boris_zones, housing_stock, development_plans",
  },
];

export default function SourcesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
              href="/daten"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Offene Daten &amp; API</span>
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
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" /> Datentransparenz &amp; Herkunftsnachweis
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight">
              Datenquellen, Taktraten &amp;{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Erfassungsvolumen
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              Woher stammen die Daten von <strong>Open Ried Sens</strong>, wie oft
              fragen unsere Kollektoren externe Schnittstellen ab und wie viele
              Zeilen werden täglich in der <strong>TimescaleDB Hypertable</strong>{" "}
              gespeichert? Hier dokumentieren wir alle Upstream-Endpunkte,
              Polling-Intervalle und amtlichen Fachregister im Detail.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-300">
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" /> 100% Open Data &amp; Open Source
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-400" /> TimescaleDB Hypertable
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-blue-400" /> CC BY 4.0 &amp; dl-de/by-2-0
              </span>
            </div>
          </div>
        </section>

        {/* TOP KPI CARDS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Erfasste Messzeilen / Tag</span>
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-100 font-mono">
              ~475.000
            </p>
            <p className="text-xs text-slate-400">
              Täglich aggregierte &amp; persistierte Messpunkte in TimescaleDB
            </p>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl" />
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Upstream-Abrufe / Tag</span>
              <RefreshCw className="w-5 h-5 text-teal-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-100 font-mono">
              &gt; 14.500
            </p>
            <p className="text-xs text-slate-400">
              HTTP-REST-Abfragen + 1 permanenter Seismik-Live-Stream
            </p>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-teal-500/5 rounded-full blur-xl" />
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Primäre Datenquellen</span>
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-100 font-mono">
              14+ Netze
            </p>
            <p className="text-xs text-slate-400">
              Kommune Bürstadt, Autobahn GmbH, DWD, WSV, Nextbike, LoRaWAN u. a.
            </p>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/5 rounded-full blur-xl" />
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Integrierte Fachdomänen</span>
              <Building2 className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-100 font-mono">
              6 Bereiche
            </p>
            <p className="text-xs text-slate-400">
              Wirtschaft, Haushalt, Soziales, Umwelt, Infrastruktur &amp; Bauen
            </p>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />
          </div>
        </section>

        {/* SECTION 1: ECHTZEIT- & INTERVALL-KOLLEKTOREN */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Cpu className="w-4 h-4" /> Pipeline Teil 1
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
                Echtzeit-Kollektoren &amp; Zeitreihen-Takte
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Autonome Dienste im Hintergrund-Cluster (VPS Docker), die periodisch
                Messwerte erfassen, normalisieren und dedupliziert speichern.
              </p>
            </div>
            <div className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0">
              Format: <code>X Abrufe pro Y → ~Z Zeilen / Tag</code>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {TELEMETRY_SOURCES.map((source) => (
              <div
                key={source.id}
                className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-5 hover:border-slate-700/80 transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-800 text-emerald-400">
                        {source.category}
                      </span>
                      <h3 className="text-lg font-bold text-slate-100 mt-2">
                        {source.name}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Anbieter: <strong className="text-slate-300">{source.provider}</strong>
                      </p>
                    </div>

                    <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold shrink-0">
                      {source.protocol}
                    </span>
                  </div>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-xs">
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">
                        Taktung (Intervall)
                      </span>
                      <span className="text-emerald-400 font-bold">
                        {typeof source.pollIntervalSec === "number"
                          ? `alle ${source.pollIntervalSec}s`
                          : `${source.pollIntervalSec}s`}
                      </span>
                    </div>

                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">
                        Abrufe / Tag (x)
                      </span>
                      <span className="text-teal-400 font-bold">
                        {source.callsPerDay}
                      </span>
                    </div>

                    <div className="col-span-2 sm:col-span-1 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 block uppercase font-sans font-semibold">
                        Gespeicherte Zeilen (z)
                      </span>
                      <span className="text-amber-400 font-bold">
                        {source.estimatedRowsPerDay} / Tag
                      </span>
                    </div>
                  </div>

                  {/* Endpoint URI */}
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 font-mono text-xs space-y-1">
                    <span className="text-[10px] text-slate-500 font-sans uppercase font-bold tracking-wider">
                      Upstream-Endpunkt:
                    </span>
                    <p className="text-slate-300 break-all select-all">
                      {source.endpointUrl}
                    </p>
                  </div>

                  {/* Captured parameters */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-300">
                      Erfasste Größen &amp; Parameter:
                    </span>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-400 list-disc list-inside">
                      {source.metrics.map((m, idx) => (
                        <li key={idx} className="truncate" title={m}>
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer notes */}
                <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-1.5">
                  <p className="leading-relaxed">{source.notes}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Lizenz: {source.license}</span>
                    <span className="font-mono text-slate-600">ID: {source.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CALCULATION METHODOLOGY BANNER */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-3">
            <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-400" />
              Berechnungsgrundlage &amp; Deduplizierungslogik der Tageszeilen
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Die Summe $z$ der täglich erfassten Datenzeilen errechnet sich aus:
              <br />
              <code className="text-emerald-400 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800 inline-block my-1.5">
                Zeilen/Tag = (Zyklen/Tag) × (Metriken/Zyklus) × (aktive Stationen)
              </code>
              <br />
              Kollektoren wie <em>Smart City</em> und <em>Nextbike</em> verwerfen
              unveränderte Rohbeobachtungen transaktional oder schreiben nur bei
              echten Messwertänderungen neue Zeitreihenzeilen (Change-Detection).
              Daher stellt die Spalte <em>Gespeicherte Zeilen (z)</em> den
              fundierten empirischen Tagesdurchschnittswert im Regelbetrieb dar.
            </p>
          </div>
        </section>

        {/* SECTION 2: PERIODISCHE FACHREGISTER & AMTLICHE GEODATEN */}
        <section className="space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-teal-400 uppercase tracking-wider">
              <Building2 className="w-4 h-4" /> Pipeline Teil 2
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
              Amtliche Fachregister, Geodaten &amp; Kommunalstatistiken
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Periodisch synchronisierte Datenebenen von Landesbehörden, statistischen
              Ämtern und Kommunalverwaltungen für Wirtschaft, Haushalt, Soziales,
              Umwelt, Infrastruktur und Wohnen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DOMAIN_REGISTRIES.map((reg, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-slate-700/80 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 font-bold">
                      {reg.domain}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Turnus: {reg.updateCadence}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-100 leading-snug">
                    {reg.title}
                  </h3>

                  <div className="text-xs space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Datenursprung / Primärquelle:
                    </span>
                    <p className="text-slate-300 font-medium">{reg.provider}</p>
                  </div>

                  <div className="text-xs space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Räumlicher Geltungsbereich:
                    </span>
                    <p className="text-slate-400">{reg.datasetScope}</p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Erfasste Fachmerkmale:
                    </span>
                    <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                      {reg.parameters.map((param, pIdx) => (
                        <li key={pIdx} className="leading-tight">
                          {param}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <div className="font-mono text-[11px] text-slate-500 truncate" title={reg.storageTarget}>
                    Ziel: {reg.storageTarget}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">
                      Lizenz: {reg.license}
                    </span>
                    <Link
                      href={reg.link}
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                    >
                      {reg.linkText} <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: SPEICHERUNG, RETENTION & ARCHIVIERUNG */}
        <section className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                Speicherarchitektur, Retention &amp; Offene Monatsarchive
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Wie Open Ried Sens hunderte Gigabyte an Sensordaten effizient komprimiert
                und für Bürgerinnen, Bürger und Wissenschaftler bereitstellt.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
              <span className="text-emerald-400 font-bold uppercase tracking-wider block text-[10px]">
                1. TimescaleDB Hypertables
              </span>
              <p className="text-slate-300 font-semibold">Automatische Chunk-Kompression</p>
              <p className="text-slate-400 leading-relaxed">
                Messwerte älter als 7 Tage werden spaltenorientiert mit Gorilla- und
                Delta-of-Delta-Algorithmen komprimiert (Faktor ~10:1 Speichereinsparung).
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
              <span className="text-teal-400 font-bold uppercase tracking-wider block text-[10px]">
                2. S3-Monatsarchive
              </span>
              <p className="text-slate-300 font-semibold">ZIP-Parts &amp; CSV-Exporte</p>
              <p className="text-slate-400 leading-relaxed">
                Ein monatlicher Node.js Archive-Worker streamt historische Zeitreihen
                in signierte ZIP-Archive (z. B. auf Uploadthing/S3) zum Download ohne API-Limits.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
              <span className="text-blue-400 font-bold uppercase tracking-wider block text-[10px]">
                3. Open REST API &amp; OpenAPI
              </span>
              <p className="text-slate-300 font-semibold">Direktzugriff ohne API-Key</p>
              <p className="text-slate-400 leading-relaxed">
                Aggregatfunktionen über <code>time_bucket()</code> (5 Min bis 1 Monat)
                können direkt und ohne Authentifizierung über unsere REST-API abgefragt werden.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <Link
              href="/daten"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-400 text-slate-950 font-bold text-xs hover:bg-emerald-300 transition-colors"
            >
              Zu den CSV-Downloads &amp; Monatsarchiven <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <span className="text-xs text-slate-500">
              Alle Telemetriedaten unterliegen der Creative Commons Attribution 4.0 (CC BY 4.0) Lizenz.
            </span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
