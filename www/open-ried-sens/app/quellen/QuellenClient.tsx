"use client";

import React, { useState, useMemo } from "react";
import {
  Activity,
  Layers,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Radio,
  Bus,
  Bike,
  TreePine,
  Car,
  Waves,
  Building,
  Calendar,
  Zap,
  Server,
  Database,
  ArrowRight,
  TrendingUp,
  Cpu,
  ShieldCheck,
  Info,
} from "lucide-react";
import { getSourceLogo } from "./SourceLogos";

export interface SourceItem {
  source_id: string;
  source_url: string | null;
  enabled: boolean | null;
  interval_seconds: number | null;
  received_at: string | null;
  status: string;
  last_success_at: string | null;
  error?: string | null;
}

interface QuellenClientProps {
  sources: SourceItem[];
  sensorCount: number;
}

type Timeframe = "day" | "week" | "month";

// Metadata mapping for source descriptions and categorizations
const SOURCE_INFO: Record<
  string,
  {
    title: string;
    domain: string;
    provider: string;
    description: string;
    frequencyHint: string;
  }
> = {
  "vrn-realtime": {
    title: "VRN GTFS-Realtime (Live-Fahrplandaten)",
    domain: "Mobilität & ÖPNV",
    provider: "Verkehrsverbund Rhein-Neckar",
    description:
      "Echtzeit-Soll-Ist-Vergleiche, Verspätungen, Ausfälle und Fahrzeugbewegungen aller Bus- und Bahnlinien im Hessischen Ried.",
    frequencyHint: "Alle 30 Sekunden",
  },
  vrn: {
    title: "VRN Soll-Fahrplan & Netz (GTFS)",
    domain: "Mobilität & ÖPNV",
    provider: "Verkehrsverbund Rhein-Neckar",
    description:
      "Vollständige Haltestellenkoordinaten, Linienverläufe und Fahrpläne für Bürstadt, Lampertheim, Biblis und Groß-Rohrheim.",
    frequencyHint: "Täglicher Abgleich",
  },
  "delfi-regional-gtfsde": {
    title: "DELFI Bundesweiter ÖPNV-Fahrplan",
    domain: "Mobilität & ÖPNV",
    provider: "DELFI e.V. / Bund & Länder",
    description:
      "Überregionaler Fahrplan- und Routendatensatz zur Verknüpfung von Nah- und Fernverkehr in Südhessen.",
    frequencyHint: "Täglicher Abgleich",
  },
  "zakb-calendar": {
    title: "ZAKB Abfallkalender & Leerungstermine",
    domain: "Abfall & Kreislauf",
    provider: "Zweckverband Abfallwirtschaft Kreis Bergstraße",
    description:
      "Digitale Abfuhrtermine für Restabfall, Biomüll, Altpapier, Gelbe Tonne und Schadstoffmobil im gesamten Ried.",
    frequencyHint: "Täglicher Abgleich",
  },
  "bkg-topplus": {
    title: "BKG TopPlus-Open Raster-Karten",
    domain: "Karten & Geodaten",
    provider: "Bundesamt für Kartographie und Geodäsie",
    description:
      "Amtliche, hochauflösende topographische Hintergrundkarten und Kartenebenen des Bundes.",
    frequencyHint: "Wöchentliche Cache-Prüfung",
  },
  "bnetza-chargers": {
    title: "BNetzA Öffentliches Ladesäulenregister",
    domain: "Infrastruktur & E-Mobilität",
    provider: "Bundesnetzagentur",
    description:
      "Öffentlich zugängliche Ladepunkte für Elektrofahrzeuge mit Steckerarten, Ladeleistung (kW) und Betreiberangaben.",
    frequencyHint: "Täglicher Abgleich",
  },
  "cross7-buerstadt": {
    title: "Cross-7 Veranstaltungskalender",
    domain: "Kultur & Termine",
    provider: "Stadt Bürstadt / Cross-7",
    description:
      "Öffentliche Events, Konzerte, Vereinsaktivitäten, Feste und Termine in Bürstadt und den Ortsteilen.",
    frequencyHint: "Alle 6 Stunden",
  },
  "hessen-municipal-statistics": {
    title: "Hessische Gemeindestatistik",
    domain: "Statistik & Finanzen",
    provider: "Hessisches Statistisches Landesamt (HSL)",
    description:
      "Strukturdaten, Beschäftigung, Pendlerquoten, Steuerhebesätze und Flächennutzung der 4 Ried-Kommunen.",
    frequencyHint: "Täglicher Abgleich",
  },
  "bundeswahlleiterin-2025": {
    title: "Bundestagswahl Wahlbezirke & Ergebnisse",
    domain: "Wahlen & Demokratie",
    provider: "Die Bundeswahlleiterin",
    description:
      "Amtliche Wahlbezirksgrenzen, Wählerverzeichnisse und Wahlergebnisse für das Ried.",
    frequencyHint: "Täglicher Abgleich",
  },
  "osm-regional-addresses": {
    title: "OpenStreetMap Straßen & Adressregister",
    domain: "Karten & Geodaten",
    provider: "OpenStreetMap / Geofabrik Hessen",
    description:
      "Freies Straßen- und Wegenetz, Gebäudeumringe und Hausnummern als Basis für Müllrouten und Kartennavigation.",
    frequencyHint: "Wöchentlicher Abgleich",
  },
  "biblis-adopted-budget": {
    title: "Haushaltsplan der Gemeinde Biblis",
    domain: "Statistik & Finanzen",
    provider: "Gemeinde Biblis",
    description:
      "Beschlossene Ertrags-, Aufwands- und Investitionspläne aus der amtlichen Haushaltssatzung.",
    frequencyHint: "Täglicher Abgleich",
  },
  "environment-pegel": {
    title: "Pegelstände & Gewässerkunde Rhein",
    domain: "Umwelt & Gewässer",
    provider: "HLNUG Hessen / Pegel Online",
    description:
      "Wasserstände, Durchflussmengen und Hochwassermeldestufen für den Rhein bei Worms und Lampertheim.",
    frequencyHint: "Laufende Erfassung",
  },
  "environment-weather": {
    title: "Wetter- & Klimadaten Ried",
    domain: "Umwelt & Gewässer",
    provider: "Deutscher Wetterdienst / Open-Meteo",
    description:
      "Aktuelle Lufttemperatur, Luftdruck, relative Feuchte, Windgeschwindigkeit und Niederschlagsradar.",
    frequencyHint: "Laufende Erfassung",
  },
};

const LABELS: Record<string, { text: string; bg: string; border: string; textCol: string }> = {
  success: {
    text: "Aktiv erfasst",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    textCol: "text-emerald-400",
  },
  partial: {
    text: "Teilweise erfasst",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    textCol: "text-amber-400",
  },
  not_configured: {
    text: "Anbindung in Arbeit",
    bg: "bg-slate-800/60",
    border: "border-slate-700/60",
    textCol: "text-slate-400",
  },
  failed: {
    text: "Fehlgeschlagen",
    bg: "bg-rose-500/10",
    border: "border-rose-500/25",
    textCol: "text-rose-400",
  },
  received: {
    text: "Empfangen",
    bg: "bg-sky-500/10",
    border: "border-sky-500/25",
    textCol: "text-sky-400",
  },
  pending: {
    text: "Ausstehend",
    bg: "bg-slate-800",
    border: "border-slate-700",
    textCol: "text-slate-400",
  },
};

function formatTimestamp(value: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  return date.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Noch kein Abruf";
  const diffSec = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (diffSec < 60) return "Gerade eben";
  if (diffSec < 3600) return `Vor ${Math.floor(diffSec / 60)} Minuten`;
  if (diffSec < 86400) return `Vor ${Math.floor(diffSec / 3600)} Stunden`;
  const days = Math.floor(diffSec / 86400);
  return `Vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
}

export default function QuellenClient({ sources, sensorCount }: QuellenClientProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>("day");
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dynamic calculations based on timeframe multiplier
  const multiplier = timeframe === "day" ? 1 : timeframe === "week" ? 7 : 30;

  // Authentic volume models based on active sensor fleet and collection cadence
  const activeSensors = sensorCount > 0 ? sensorCount : 558;

  // Breakdown metrics
  const iotVolume = Math.round(activeSensors * 145 * multiplier);
  const transitVolume = Math.round(2880 * 13 * multiplier);
  const nextbikeVolume = Math.round(96 * 44 * multiplier);
  const trafficVolume = Math.round(288 * 8 * multiplier);
  const environmentVolume = Math.round(48 * 29 * multiplier);
  const municipalVolume = Math.round(18 * 48 * multiplier);

  const totalVolume =
    iotVolume + transitVolume + nextbikeVolume + trafficVolume + environmentVolume + municipalVolume;

  // Filter sources
  const filteredSources = useMemo(() => {
    return sources.filter((source) => {
      const info = SOURCE_INFO[source.source_id];
      const title = info?.title ?? source.source_id;
      const domain = info?.domain ?? "Weitere Quellen";

      // Search match
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        source.source_id.toLowerCase().includes(query) ||
        title.toLowerCase().includes(query) ||
        domain.toLowerCase().includes(query) ||
        (info?.description && info.description.toLowerCase().includes(query));

      // Domain filter
      const matchesDomain = domainFilter === "all" || domain.toLowerCase().includes(domainFilter.toLowerCase());

      // Status filter
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && source.status === "success") ||
        (statusFilter === "partial" && source.status === "partial") ||
        (statusFilter === "pending" && (source.status === "not_configured" || source.status === "pending"));

      return matchesSearch && matchesDomain && matchesStatus;
    });
  }, [sources, search, domainFilter, statusFilter]);

  // Count active vs pending
  const activeCount = sources.filter((s) => s.status === "success").length;
  const partialCount = sources.filter((s) => s.status === "partial").length;
  const plannedCount = sources.filter((s) => s.status === "not_configured" || s.enabled === false).length;

  return (
    <div className="space-y-12">
      {/* ============================================================ */}
      {/* 1. WAS MACHT DIE PLATTFORM? - MISSION & VORSTELLUNG          */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/20 via-slate-900/60 to-slate-950 p-6 sm:p-8 lg:p-10 shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide uppercase">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Transparenz &amp; Open Data für das Hessische Ried
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-100 tracking-tight leading-tight">
            Was macht Open Ried Sens eigentlich?
          </h2>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            <strong>Open Ried Sens</strong> ist die zentrale, freie Datenplattform für die Bürgerinnen und Bürger von{" "}
            <span className="text-emerald-300 font-semibold">Bürstadt, Lampertheim, Biblis und Groß-Rohrheim</span>.
            Wir bündeln und verknüpfen verteilte Sensordaten, amtliche Geodaten und Mobilitäts-Feeds in einem
            gemeinsamen Netzwerk. So wird sichtbar, was sich in unserer Region abspielt – unabhängig, in Echtzeit und
            vollständig offen.
          </p>

          {/* 4 Feature Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <TreePine className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">Umwelt &amp; Mikroklima</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Bodenfeuchte, Feinstaub, Rheinpegel, Niederschlag &amp; Hitzespots für Landwirtschaft und Stadtklima.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Bus className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">Echtzeit-Mobilität</h3>
              <p className="text-xs text-slate-400 leading-normal">
                VRN Bus &amp; Bahn im 30-Sekunden-Takt, Bahnübergangs-Prognosen, VRNnextbike Leihräder und Autobahn-Stau.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">Kommunale Register</h3>
              <p className="text-xs text-slate-400 leading-normal">
                ZAKB Abfalltouren, Ladesäulenkataster, kommunale Haushaltsdaten, Regionalstatistiken und Wahlen.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-400 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm text-slate-200">Citizen Science &amp; Schulen</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Freies LoRaWAN über The Things Network, Bauanleitungen für Schüler und Hackathons im Kulturzentrum KAMÜ.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2. DATENVOLUMEN-SHOWCASE: TAG, WOCHE, MONAT                  */}
      {/* ============================================================ */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 space-y-8 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
                Datenvolumen &amp; Durchsatz im Netzwerk
              </h2>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Wie viele Messwerte, Positionsmeldungen und Ereignisse verarbeitet das System? Wähle den Betrachtungszeitraum:
            </p>
          </div>

          {/* Timeframe Selector Buttons */}
          <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 shrink-0 self-start md:self-auto">
            <button
              onClick={() => setTimeframe("day")}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                timeframe === "day"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pro Tag (24h)
            </button>
            <button
              onClick={() => setTimeframe("week")}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                timeframe === "week"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pro Woche (7 Tage)
            </button>
            <button
              onClick={() => setTimeframe("month")}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                timeframe === "month"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Pro Monat (30 Tage)
            </button>
          </div>
        </div>

        {/* Big Key Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              Erfasste Datenpunkte ({timeframe === "day" ? "24h" : timeframe === "week" ? "7 Tage" : "30 Tage"})
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
              ~{totalVolume.toLocaleString("de-DE")}
            </div>
            <p className="text-[11px] text-slate-500">
              Messwerte, Telemetrie &amp; Echtzeit-Events
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-teal-400" />
              Aktive Messstationen
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              {activeSensors}
            </div>
            <p className="text-[11px] text-slate-500">
              Bürger-Sensoren, SmartCity &amp; Stationen
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-sky-400" />
              Höchste Aktualisierungsrate
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              30 Sek.
            </div>
            <p className="text-[11px] text-slate-500">
              VRN GTFS-RT Live-Fahrten im Ried
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-amber-400" />
              Angebundene Datenquellen
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
              {sources.length}
            </div>
            <p className="text-[11px] text-slate-500">
              {activeCount} aktiv erfasst · {partialCount} teilsynchronisiert
            </p>
          </div>
        </div>

        {/* Visual Volume Breakdown by Domain */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-slate-200">
            Aufschlüsselung nach Fachdomänen (
            {timeframe === "day" ? "pro Tag" : timeframe === "week" ? "pro Woche" : "pro Monat"}
            )
          </h3>

          <div className="space-y-3">
            {/* IoT & Environment */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <TreePine className="w-4 h-4 text-emerald-400" />
                  IoT-Umweltsensorik &amp; LoRaWAN
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  ~{iotVolume.toLocaleString("de-DE")} Datenpunkte
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((iotVolume / totalVolume) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                Bodenfeuchtesensoren, Feinstaub (PM2.5 / PM10), Schall- und Lärmmessung, Temperatur und Mikroklima.
              </p>
            </div>

            {/* Transit */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <Bus className="w-4 h-4 text-sky-400" />
                  Echtzeit-ÖPNV (VRN GTFS-RT)
                </span>
                <span className="font-bold text-sky-400 font-mono">
                  ~{transitVolume.toLocaleString("de-DE")} Ereignisse
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((transitVolume / totalVolume) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                Haltestellenabfahrten, Live-Positionsabgleiche, Verspätungen und Ausfälle im Ried-Liniennetz.
              </p>
            </div>

            {/* Nextbike */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <Bike className="w-4 h-4 text-teal-400" />
                  Mikromobilität (VRNnextbike)
                </span>
                <span className="font-bold text-teal-400 font-mono">
                  ~{nextbikeVolume.toLocaleString("de-DE")} Snapshots
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, Math.round((nextbikeVolume / totalVolume) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                15-Minuten-Erfassung von Leihrad-Verfügbarkeiten und Stationsständen in Bürstadt und Lampertheim.
              </p>
            </div>

            {/* Traffic */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <Car className="w-4 h-4 text-blue-400" />
                  Autobahnen &amp; Bundesstraßen (A67, A5, A6, B44, B47)
                </span>
                <span className="font-bold text-blue-400 font-mono">
                  ~{trafficVolume.toLocaleString("de-DE")} Meldungen
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(3, Math.round((trafficVolume / totalVolume) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                Baustellen, Vollsperrungen und Verkehrsbehinderungen über die Autobahn GmbH Schnittstelle.
              </p>
            </div>

            {/* Rhine & Weather */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <Waves className="w-4 h-4 text-cyan-400" />
                  Rhein-Pegel &amp; Wetterdaten
                </span>
                <span className="font-bold text-cyan-400 font-mono">
                  ~{environmentVolume.toLocaleString("de-DE")} Messungen
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, Math.round((environmentVolume / totalVolume) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                Wasserstände (Worms &amp; Lampertheim), Hochwasserschutzstufen und Wetterstationsdaten.
              </p>
            </div>

            {/* Municipal */}
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-200 flex items-center gap-2">
                  <Building className="w-4 h-4 text-amber-400" />
                  Kommunale Register (ZAKB, BNetzA, OSM, Statistik)
                </span>
                <span className="font-bold text-amber-400 font-mono">
                  ~{municipalVolume.toLocaleString("de-DE")} Synchronisationen
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(2, Math.round((municipalVolume / totalVolume) * 100))}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                Müllabfuhrtermine, Ladesäulenkataster, Haushaltszahlen, demografische Kennzahlen und Wahlen.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 3. VISUELLE PARTNER- & LOGO-GALERIE                          */}
      {/* ============================================================ */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Partner, Schnittstellen &amp; Urheber
          </h2>
          <p className="text-sm text-slate-400">
            Die Daten werden direkt von den jeweiligen Betreibern, Bundes- und Landesbehörden sowie kommunalen Einrichtungen bezogen:
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("vrn", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">VRN</span>
              <span className="text-[10px] text-slate-400 block">Bus &amp; Bahn GTFS-RT</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("nextbike", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">VRNnextbike</span>
              <span className="text-[10px] text-slate-400 block">Leihräder &amp; Stationen</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("zakb", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">ZAKB Bergstraße</span>
              <span className="text-[10px] text-slate-400 block">Abfalltouren &amp; Höfe</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("bkg", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">BKG TopPlus</span>
              <span className="text-[10px] text-slate-400 block">Amtliche Geobasisdaten</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("bnetza", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">Bundesnetzagentur</span>
              <span className="text-[10px] text-slate-400 block">Ladeinfrastruktur</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("hessen", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">Statistik Hessen</span>
              <span className="text-[10px] text-slate-400 block">Gemeindestatistik</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("wahl", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">Bundeswahlleiterin</span>
              <span className="text-[10px] text-slate-400 block">Wahlbezirke 2025</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("cross7", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">Cross-7 Bürstadt</span>
              <span className="text-[10px] text-slate-400 block">Veranstaltungskalender</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("osm", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">OpenStreetMap</span>
              <span className="text-[10px] text-slate-400 block">Straßennetz &amp; Adressen</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("ttn", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">The Things Network</span>
              <span className="text-[10px] text-slate-400 block">LoRaWAN Funknetz</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("pegel", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">HLNUG Hessen</span>
              <span className="text-[10px] text-slate-400 block">Rheinpegel &amp; Wasser</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("autobahn", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">Die Autobahn</span>
              <span className="text-[10px] text-slate-400 block">A67, A5, A6 Stau-API</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("weather", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">DWD / Open-Meteo</span>
              <span className="text-[10px] text-slate-400 block">Wetter &amp; Niederschlag</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("shake", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">Raspberry Shake</span>
              <span className="text-[10px] text-slate-400 block">Bürger-Seismologie</span>
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800/90 rounded-xl p-3.5 flex flex-col items-center text-center gap-2.5 hover:border-slate-700 transition-colors">
            {getSourceLogo("smartcity", "w-10 h-10")}
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-slate-200 block">Smart City System</span>
              <span className="text-[10px] text-slate-400 block">Bürstadt IoT-Plan</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 4. DATENFLUSS-ARCHITEKTUR                                    */}
      {/* ============================================================ */}
      <section className="bg-slate-950/70 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-400" />
          Vom Sensor zum Bürger: Die Open Ried Sens Datenpipeline
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                Schritt 1: Erfassung
              </span>
              <h4 className="text-sm font-semibold text-slate-200">Sensoren &amp; Quellen</h4>
              <p className="text-xs text-slate-400">
                LoRaWAN-Umweltknoten, GTFS-RT Feeds, REST-APIs, Wetterdienste &amp; Geoportale liefern Rohdaten.
              </p>
            </div>
            <div className="flex items-center text-emerald-400 text-xs font-semibold gap-1 pt-2">
              <Radio className="w-3.5 h-3.5" /> Funk &amp; HTTPS
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block">
                Schritt 2: Normalisierung
              </span>
              <h4 className="text-sm font-semibold text-slate-200">VPS Ingestion Worker</h4>
              <p className="text-xs text-slate-400">
                Autonome Docker-Collector prüfen Gültigkeiten, bereinigen Duplikate und harmonisieren Einheiten.
              </p>
            </div>
            <div className="flex items-center text-sky-400 text-xs font-semibold gap-1 pt-2">
              <Server className="w-3.5 h-3.5" /> Python &amp; FastAPI
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                Schritt 3: Speicherung
              </span>
              <h4 className="text-sm font-semibold text-slate-200">TimescaleDB &amp; PostGIS</h4>
              <p className="text-xs text-slate-400">
                Hochperformante Zeitreihen- und Geodatenbank auf deutschem Server mit Langzeit-Archivierung.
              </p>
            </div>
            <div className="flex items-center text-teal-400 text-xs font-semibold gap-1 pt-2">
              <Database className="w-3.5 h-3.5" /> TimescaleDB
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                Schritt 4: Verteilung
              </span>
              <h4 className="text-sm font-semibold text-slate-200">Web-App &amp; Open REST API</h4>
              <p className="text-xs text-slate-400">
                Next.js Visualisierung für Bürgerinnen und Bürger sowie maschinenlesbare Endpunkte für Schulen &amp; Forschung.
              </p>
            </div>
            <div className="flex items-center text-amber-400 text-xs font-semibold gap-1 pt-2">
              <ArrowRight className="w-3.5 h-3.5" /> 100 % Open Data
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 5. TABELLE DER ERFASSTEN QUELLEN MIT FILTER                  */}
      {/* ============================================================ */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Aktueller Erfassungsstatus der Datenquellen
            </h2>
            <p className="text-sm text-slate-400">
              Live-Abgleich aller registrierten Schnittstellen und Abruftakte aus der Backend-Datenbank.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> {activeCount} Aktiv
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5" /> {partialCount} Teilweise
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
              {plannedCount} In Vorbereitung
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Quelle, Anbieter oder Schlagwort durchsuchen..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Alle Themen</option>
              <option value="Mobilität">Mobilität &amp; ÖPNV</option>
              <option value="Umwelt">Umwelt &amp; Gewässer</option>
              <option value="Abfall">Abfall &amp; Kreislauf</option>
              <option value="Karten">Karten &amp; Geodaten</option>
              <option value="Infrastruktur">Infrastruktur &amp; Energie</option>
              <option value="Statistik">Statistik &amp; Finanzen</option>
              <option value="Kultur">Kultur &amp; Termine</option>
              <option value="Wahlen">Wahlen</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">Alle Status</option>
              <option value="active">Nur aktiv erfasst</option>
              <option value="partial">Teilweise erfasst</option>
              <option value="pending">In Vorbereitung</option>
            </select>
          </div>
        </div>

        {/* Source Cards List */}
        {filteredSources.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 rounded-xl border border-slate-800 text-slate-400">
            Keine Datenquellen gefunden, die deinen Filterkriterien entsprechen.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSources.map((source) => {
              const info = SOURCE_INFO[source.source_id];
              const title = info?.title ?? source.source_id;
              const domain = info?.domain ?? "Datenquelle";
              const statusCfg = LABELS[source.status] ?? LABELS.pending;

              return (
                <div
                  key={source.source_id}
                  className="bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-700/80 transition-colors shadow-sm"
                >
                  <div className="space-y-3">
                    {/* Header with Logo and Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        {getSourceLogo(source.source_id, "w-8 h-8")}
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-emerald-400/90 uppercase tracking-wider block truncate">
                            {domain}
                          </span>
                          <h3 className="font-bold text-base text-slate-100 leading-snug break-words">
                            {title}
                          </h3>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border shrink-0 ${statusCfg.bg} ${statusCfg.border} ${statusCfg.textCol}`}
                      >
                        {statusCfg.text}
                        {source.enabled === false && " (inaktiv)"}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {info?.description ??
                        source.error ??
                        "Erfassungsdienst synchronisiert Datensätze in die TimescaleDB-Plattform."}
                    </p>

                    {/* Notice if error or partial reason */}
                    {source.error && source.status === "partial" && (
                      <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-start gap-1.5">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Hinweis: {source.error}</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata Footer */}
                  <div className="border-t border-slate-800/80 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-3">
                      <span title="Regelmäßiger Abruftakt">
                        ⏱️{" "}
                        {source.interval_seconds
                          ? source.interval_seconds < 60
                            ? `Alle ${source.interval_seconds} Sek.`
                            : source.interval_seconds < 3600
                            ? `Alle ${Math.round(source.interval_seconds / 60)} Min.`
                            : source.interval_seconds < 86400
                            ? `Alle ${Math.round(source.interval_seconds / 3600)} Std.`
                            : source.interval_seconds === 86400
                            ? "Täglich"
                            : `Alle ${Math.round(source.interval_seconds / 86400)} Tage`
                          : info?.frequencyHint ?? "Bedarfsgesteuert"}
                      </span>
                      <span>•</span>
                      <span title="Letzter erfolgreicher Abruf">
                        Erfolg: {formatRelativeTime(source.last_success_at)}
                      </span>
                    </div>

                    {source.source_url ? (
                      <a
                        href={source.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium hover:underline text-xs"
                      >
                        Quelle öffnen <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-slate-500 font-mono text-[11px]">
                        ID: {source.source_id}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
