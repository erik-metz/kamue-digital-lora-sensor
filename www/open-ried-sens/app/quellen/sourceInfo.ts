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


export const SOURCE_INFO: Record<
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
