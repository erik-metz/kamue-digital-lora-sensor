"use client";

import { useState } from "react";
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


const SOURCE_INFO: Record<
  string,
  {
    title: string;
    domain: string;
    provider: string;
  }
> = {
  "vrn-realtime": {
    title: "VRN GTFS-Realtime (Live-Fahrplandaten)",
    domain: "Mobilität & ÖPNV",
    provider: "Verkehrsverbund Rhein-Neckar",
  },
  vrn: {
    title: "VRN Soll-Fahrplan & Netz (GTFS)",
    domain: "Mobilität & ÖPNV",
    provider: "Verkehrsverbund Rhein-Neckar",
  },
  "delfi-regional-gtfsde": {
    title: "DELFI Bundesweiter ÖPNV-Fahrplan",
    domain: "Mobilität & ÖPNV",
    provider: "DELFI e.V. / Bund & Länder",
  },
  "zakb-calendar": {
    title: "ZAKB Abfallkalender & Leerungstermine",
    domain: "Abfall & Kreislauf",
    provider: "Zweckverband Abfallwirtschaft Kreis Bergstraße",
  },
  "bkg-topplus": {
    title: "BKG TopPlus-Open Raster-Karten",
    domain: "Karten & Geodaten",
    provider: "Bundesamt für Kartographie und Geodäsie",
  },
  "bnetza-chargers": {
    title: "BNetzA Öffentliches Ladesäulenregister",
    domain: "Infrastruktur & E-Mobilität",
    provider: "Bundesnetzagentur",
  },
  "cross7-buerstadt": {
    title: "Cross-7 Veranstaltungskalender",
    domain: "Kultur & Termine",
    provider: "Stadt Bürstadt / Cross-7",
  },
  "hessen-municipal-statistics": {
    title: "Hessische Gemeindestatistik",
    domain: "Statistik & Finanzen",
    provider: "Hessisches Statistisches Landesamt (HSL)",
  },
  "bundeswahlleiterin-2025": {
    title: "Bundestagswahl Wahlbezirke & Ergebnisse",
    domain: "Wahlen & Demokratie",
    provider: "Die Bundeswahlleiterin",
  },
  "osm-regional-addresses": {
    title: "OpenStreetMap Straßen & Adressregister",
    domain: "Karten & Geodaten",
    provider: "OpenStreetMap / Geofabrik Hessen",
  },
  "biblis-adopted-budget": {
    title: "Haushaltsplan der Gemeinde Biblis",
    domain: "Statistik & Finanzen",
    provider: "Gemeinde Biblis",
  },
  "environment-pegel": {
    title: "Pegelstände & Gewässerkunde Rhein",
    domain: "Umwelt & Gewässer",
    provider: "HLNUG Hessen / Pegel Online",
  },
  "environment-weather": {
    title: "Wetter- & Klimadaten Ried",
    domain: "Umwelt & Gewässer",
    provider: "Deutscher Wetterdienst / Open-Meteo",
  },
  "environment-radolan": {
    title: "DWD RADOLAN Niederschlagsradar",
    domain: "Umwelt & Gewässer",
    provider: "Deutscher Wetterdienst (DWD Open Data)",
  },
  "environment-mosmix": {
    title: "DWD MOSMIX Stationsvorhersage",
    domain: "Umwelt & Gewässer",
    provider: "Deutscher Wetterdienst (DWD Open Data)",
  },
  "hlnug-groundwater": {
    title: "HLNUG Grundwassermessstellen Ried",
    domain: "Umwelt & Gewässer",
    provider: "Hessisches Landesamt für Naturschutz, Umwelt und Geologie (HLNUG)",
  },
  "traffic-corridors": {
    title: "Verkehrsfluss & Stauvolumen Ried",
    domain: "Mobilität & ÖPNV",
    provider: "Die Autobahn & TomTom Flow / Korridor-Modell",
  },
  "environment-blitzortung": {
    title: "Blitzortung Live-Gewitterüberwachung",
    domain: "Umwelt & Wetter",
    provider: "Blitzortung.org Community Network",
  },
  "invekos-agriculture": {
    title: "INVEKOS Landwirtschaftliche Parzellen & Feldblöcke",
    domain: "Landwirtschaft & Boden",
    provider: "Land Hessen (HMLU / GDI-Hessen)",
  },
  "copernicus-sentinel2": {
    title: "Copernicus Sentinel-2 Satellitenbilder",
    domain: "Umwelt & Erdbeobachtung",
    provider: "Europäische Weltraumorganisation (ESA / Copernicus)",
  },
  "rast-monitor": {
    title: "Rast-Monitor (LKW-Rastplätze Autobahn)",
    domain: "Mobilität & Verkehr",
    provider: "Toll Collect / Mobilithek / rast-monitor.de",
  },
  opensensemap: {
    title: "openSenseMap & senseBox (Bürger-Sensornetzwerk)",
    domain: "Umwelt & Luftqualität",
    provider: "re:edu / Universität Münster & Citizen Science Community",
  },
  uba: {
    title: "Umweltbundesamt (UBA) Luftdaten",
    domain: "Umwelt & Luftqualität",
    provider: "Umweltbundesamt (UBA)",
  },
  "hessen-verkehr": {
    title: "Verkehrsservice Hessen (Hessen Mobil)",
    domain: "Mobilität & Verkehr",
    provider: "Landesverkehrszentrale Hessen / Hessen Mobil",
  },
};

const LABELS: Record<string, string> = {
  success: "Erfasst", partial: "Teilweise erfasst", failed: "Abruf fehlgeschlagen",
  not_configured: "Noch nicht angebunden", pending: "Noch kein Abruf",
  received: "Empfangen, Verarbeitung offen",
};

function timestamp(value: string | null) {
  return value ? new Date(value).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) : "Noch kein erfolgreicher Abruf";
}

const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-400";

export default function QuellenClient({ sources }: { sources: SourceItem[] }) {
  const [search, setSearch] = useState("");
  const [domain, setDomain] = useState("all");
  const [status, setStatus] = useState("all");
  const domains = [...new Set(sources.map(source => SOURCE_INFO[source.source_id]?.domain ?? "Weitere Quellen"))].sort();
  const query = search.trim().toLocaleLowerCase("de");
  const filtered = sources.filter(source => {
    const info = SOURCE_INFO[source.source_id];
    return (!query || [source.source_id, info?.title, info?.provider, info?.domain].join(" ").toLocaleLowerCase("de").includes(query))
      && (domain === "all" || domain === (info?.domain ?? "Weitere Quellen"))
      && (status === "all" || source.status === status);
  });

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Angebundene Quellen</h2>
        <p className="text-sm text-slate-400">{sources.length} registrierte Quellen · {sources.filter(source => source.status === "success" && source.enabled !== false).length} zuletzt erfolgreich erfasst</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-2 text-sm"><span className="block">Quelle suchen</span>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Quelle oder Anbieter" className={inputClass} />
        </label>
        <label className="space-y-2 text-sm"><span className="block">Thema</span>
          <select value={domain} onChange={event => setDomain(event.target.value)} className={inputClass}>
            <option value="all">Alle Themen</option>
            {domains.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm"><span className="block">Erfassungsstatus</span>
          <select value={status} onChange={event => setStatus(event.target.value)} className={inputClass}>
            <option value="all">Alle Status</option>
            {Object.entries(LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      <p role="status" className="text-xs text-slate-400">{filtered.length} Quellen für diese Auswahl</p>
      {filtered.length === 0 ? <p className="text-sm text-slate-300">Keine passenden Quellen gefunden.</p> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map(source => {
            const info = SOURCE_INFO[source.source_id];
            return (
              <li key={source.source_id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  {getSourceLogo(source.source_id, "w-8 h-8 shrink-0")}
                  <div className="min-w-0">
                    <h3 className="font-semibold break-words">{info?.title ?? source.source_id}</h3>
                    {info ? <p className="mt-1 text-xs text-slate-400">{info.provider} · {info.domain}</p> : null}
                  </div>
                </div>
                <p className={`text-xs ${source.status === "success" ? "text-emerald-300" : source.status === "failed" || source.status === "partial" ? "text-amber-300" : "text-slate-400"}`}>
                  {LABELS[source.status] ?? "Unbekannter Status"}{source.enabled === false ? " · deaktiviert" : ""}
                </p>
                <p className="text-xs text-slate-400">Letzter Erfolg: {timestamp(source.last_success_at)}</p>
                {source.source_url ? <a href={source.source_url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm text-emerald-300 hover:underline">Originalquelle öffnen ↗</a> : <p className="text-xs text-slate-500">Kein öffentlicher Quellenlink hinterlegt.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
