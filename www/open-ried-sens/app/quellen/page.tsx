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
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

export const metadata: Metadata = {
  title: "Datenquellen, Takte & Pipeline-Architektur | Open Ried Sens",
  description:
    "Umfassende und lückenlose Dokumentation aller Datenquellen, Erfassungstakte, Datenbank-Tabellen und täglichen Erfassungsmengen von Open Ried Sens für das Hessische Ried.",
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
  dbTables: string[];
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
    dbTables: ["sensor_data", "sensor_latest", "telemetry_ingest_batches"],
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
    dbTables: ["smartcity_sources", "smartcity_metrics", "smartcity_observations", "smartcity_revisions"],
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
    dbTables: ["nextbike_sources", "nextbike_bikes", "nextbike_trips", "nextbike_observations"],
    metrics: [
      "Stationskapazität & verfügbare Fahrräder",
      "Fahrrad-GPS-Standorte im freien Rückgaberaum",
      "Erkannte Fahrten & Stationswechsel (Inferred Movements)",
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
    dbTables: ["traffic_incidents", "traffic_corridor_snapshots"],
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
    id: "vrn-bus-mobility",
    category: "ÖPNV & Busnetz Ried",
    name: "VRN Buslinien, Haltestellen & Live-Positionen",
    provider: "Verkehrsverbund Rhein-Neckar (VRN GmbH / Open Data ÖPNV)",
    endpointUrl: "https://opendata.vrn.de/datasets / https://www.vrn.de/service/entwickler/gtfs-realtime/",
    protocol: "HTTPS REST",
    pollIntervalSec: 60,
    pollRateText: "GTFS-RT TripUpdate Polling alle 30–60 Sek.",
    callsPerDay: "1.440 – 2.880",
    metricsPerCycle: "Bus-Positionen, Haltestellen & Verspätungen",
    estimatedRowsPerDay: "~8.000 – 15.000",
    dbTables: ["bus_stops", "bus_lines", "bus_positions"],
    metrics: [
      "Haltestellenkoordinaten, Steige & Schulausweisung (Hessisches Ried)",
      "Liniennetz 641, 642, 644, 652 inkl. Schulbusse",
      "Fahrzeugpositionen (Breite, Länge, Tempo, Status 'moving'/'stopped')",
      "Verspätungssekunden (delay_sec) & Abfahrts-Countdowns",
    ],
    notes:
      "Verbindet amtliche GTFS-Fahrplandaten mit GTFS-RT TripUpdates. Unterstützt Fallback-Kinematik bei Netzausfall.",
    license: "Open Data ÖPNV Deutschland / dl-de/by-2-0",
  },
  {
    id: "zakb-waste-fleet",
    category: "Kommunale Entsorgung & Logistik",
    name: "ZAKB Abfuhrkalender, Wertstoffhöfe & Flottentouren",
    provider: "Zweckverband Abfallwirtschaft Kreis Bergstraße (ZAKB)",
    endpointUrl: "https://www.zakb.de/abfallkalender & ZAKB Flotten-Dispositionsdaten",
    protocol: "HTTPS REST",
    pollIntervalSec: "Täglich / Tour",
    pollRateText: "Kalenderabgleich täglich + Tourenüberwachung",
    callsPerDay: "~50 – 100",
    metricsPerCycle: "Straßengenaue Abfuhrtermine & Touren-Fortschritt",
    estimatedRowsPerDay: "~1.200 – 3.500",
    dbTables: ["waste_facilities", "waste_truck_fleet", "waste_collection_calendar", "waste_truck_positions", "waste_collection_events"],
    metrics: [
      "Wertstoffhöfe & Annahmestellen (Bürstadt, Lampertheim, Hüttenfeld)",
      "Sammelfraktionen (Restmüll, Biomüll, Papier, Gelber Sack, Schadstoffmobil)",
      "Müllfahrzeug-Flotte (Kennzeichen, Fraktion, Volumen in m³)",
      "Live-Tourenverlauf mit Leerungs-Countdowns an Haltepunkten",
    ],
    notes:
      "Verknüpft straßengenaue ZAKB-Abfuhrtermine mit den Wertstoffhöfen und den Sammelfahrzeugen.",
    license: "Kommunale Veröffentlichungen ZAKB",
  },
  {
    id: "rail-crossings-mobility",
    category: "Schieneninfrastruktur & Bahnübergänge",
    name: "Bahnübergänge & Schienenverkehr (Ried- & Nibelungenbahn)",
    provider: "Deutsche Bahn Open Data / Eisenbahn-Bundesamt (EBA) / OSM",
    endpointUrl: "https://data.deutschebahn.com / Fahrplan-API",
    protocol: "HTTPS REST",
    pollIntervalSec: 60,
    pollRateText: "Fahrplanabgleich alle 60 Sek.",
    callsPerDay: "1.440",
    metricsPerCycle: "Zugbewegungen & Schrankenstatus",
    estimatedRowsPerDay: "~4.500 – 8.000",
    dbTables: ["rail_crossings", "rail_crossing_events", "train_positions"],
    metrics: [
      "4 aktive Bahnübergänge (Bürstadt Wasserwerkstr., Forsthausstr., Lampertheim Neuschloßstr., Biblis Darmstädter Str.)",
      "Schrankenstatus: 'open', 'closing_soon', 'closed'",
      "Schließdauer-Durchschnitt & tägliche Schließhäufigkeit",
      "Zugpositionen auf der Riedbahn und Nibelungenbahn",
    ],
    notes:
      "Berechnet Schrankenschließzeiten und Wartezeiten basierend auf Zugbewegungen und Fahrplanintervallen.",
    license: "DB Open Data & OpenStreetMap",
  },
  {
    id: "street-closures-hessen",
    category: "Baustellen & Lokale Straßensperrungen",
    name: "Straßensperrungen & Baustellen Hessisches Ried",
    provider: "Hessen Mobil (Verkehrsservice Hessen) & Kommunalverwaltungen",
    endpointUrl: "https://mobil.hessen.de / https://verkehrsservice.hessen.de & Amtsblätter",
    protocol: "HTTPS REST",
    pollIntervalSec: 3600,
    pollRateText: "Stündlicher Abgleich (24 Calls/Tag)",
    callsPerDay: "24",
    metricsPerCycle: "Vollsperrungen, halbseitige Sperrungen & Umleitungen",
    estimatedRowsPerDay: "~50 – 200",
    dbTables: ["street_closures"],
    metrics: [
      "Sperrungstyp: 'full' | 'partial' | 'lane_restriction'",
      "Gültigkeitszeitraum (Beginn, geplantes Ende, Verlängerungen)",
      "Detaillierte Umleitungsbeschreibungen & betroffene Abschnitte",
      "Georeferenzierte Koordinatenpolylines für Kartendarstellung",
    ],
    notes:
      "Erfasst alle Baustellen in Bürstadt, Lampertheim, Hofheim, Biblis, Groß-Rohrheim, Bobstadt, Nordheim und Wattenheim.",
    license: "Hessen Mobil Open Data / Kommunalbekanntmachungen",
  },
  {
    id: "lorawan-community",
    category: "Bürger-LoRaWAN & IoT-Hardware",
    name: "Open Ried Sens DIY Sensor-Stationen",
    provider: "The Things Network (TTN Community v3) & Bürger-Hardware",
    endpointUrl: "https://open-ried-sens.duckdns.org/api/v1/telemetry/batch",
    protocol: "LoRaWAN / Webhook",
    pollIntervalSec: "Inaktiv (0 Stationen)",
    pollRateText: "Aktuell keine aktiven Bürger-Knoten im Feld",
    callsPerDay: "0 (Schnittstelle bereit)",
    metricsPerCycle: "8 Umweltparameter (prozessierbar)",
    estimatedRowsPerDay: "0 (Hardware im Aufbau)",
    dbTables: ["sensor_metadata", "sensor_data", "sensor_latest", "telemetry_ingest_batches"],
    metrics: [
      "Temperatur (°C) & Relative Luftfeuchte (% r.F.)",
      "Luftdruck (hPa)",
      "Feinstaub PM2.5 (µg/m³)",
      "Luftqualität VOC-Index & NOx-Index (0–500)",
      "Schallpegel / Umgebungslärm (dB)",
      "UV-Index (Sonneneinstrahlung)",
    ],
    notes:
      "Status: Das Ingestion-Schema in TimescaleDB und der FastAPI-Endpunkt (/api/v1/telemetry/batch) sind vollständig implementiert. Aktuell sind jedoch keine physischen DIY-Stationen live am Netz, sodass hierfür derzeit 0 Zeilen/Tag in die Datenbank fließen.",
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
    dbTables: ["sensor_data", "flood_gauges"],
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
    dbTables: ["sensor_data", "sensor_latest"],
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
  badgeColor: string;
  link: string;
  linkText: string;
  title: string;
  provider: string;
  updateCadence: string;
  datasetScope: string;
  dbTables: string[];
  parameters: string[];
  license: string;
  storageTarget: string;
}

const DOMAIN_REGISTRIES: DomainRegistryItem[] = [
  {
    domain: "Wirtschaft & Gewerbe",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    link: "/wirtschaft",
    linkText: "Wirtschaftsportal öffnen",
    title: "Unternehmensregister, Gewerbesteuern, Beschäftigung & Startups",
    provider: "Hessisches Statistisches Landesamt (HSL), Bundesagentur für Arbeit (BA), IHK Darmstadt",
    updateCadence: "Jährlich / Quartalsweise",
    datasetScope: "Bürstadt, Lampertheim, Biblis, Groß-Rohrheim & Kreis Bergstraße",
    dbTables: ["municipality_tax_rates", "business_registrations", "industry_employment", "companies", "startup_initiatives"],
    parameters: [
      "Gewerbesteuer- & Grundsteuerhebesätze A/B (Zeitreihen 1995–2025)",
      "Gewerbeanzeigen: Neugründungen, Abmeldungen, Zuzüge, Fortzüge, Wanderungssaldo",
      "Sozialversicherungspflichtig Beschäftigte nach WZ 2008 Wirtschaftszweigen",
      "Standorte, Mitarbeiterklassen, Rechtsformen & Branchen von Industrieunternehmen",
      "Startup- & Gründerinitiativen (Coworking, Technologiezentren, Förderprogramme)",
    ],
    license: "dl-de/by-2-0 & amtliche Statistik",
    storageTarget: "Tabellen: municipality_tax_rates, business_registrations, industry_employment, companies, startup_initiatives",
  },
  {
    domain: "Kommunalhaushalte & Wahlen",
    badgeColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    link: "/haushalt",
    linkText: "Finanzportal öffnen",
    title: "Gemeindehaushalte, Produktausgaben, Schulden & Wahlergebnisse",
    provider: "Amtliche Haushaltspläne der Kommunen, HSL Kommunalfinanzen, Votemanager Hessen",
    updateCadence: "Jährlich (Haushalt) / 4–5 Jahre (Wahlturnus)",
    datasetScope: "Bürstadt, Lampertheim, Biblis, Groß-Rohrheim",
    dbTables: ["finance_budgets", "finance_expenditures", "election_events", "election_districts", "election_district_results"],
    parameters: [
      "Ertrags- & Aufwandspläne, Jahresergebnisse, Steuereinnahmen-Splits (Gewerbe, Grund, Einkommen, USt)",
      "Ausgaben gegliedert nach Produktbereichen (Kitas, Schulen, Straßen, Kultur, Soziales)",
      "Pro-Kopf-Verschuldung und liquide Rücklagen je Gemeinde",
      "Wahlergebnisse aller Stimmbezirke (Kommunal-, Landtags-, Bundestags-, Europawahl)",
    ],
    license: "Amtliche Veröffentlichungen / Open Government",
    storageTarget: "Tabellen: finance_budgets, finance_expenditures, election_events, election_districts, election_district_results",
  },
  {
    domain: "Soziales, Leben & Abfall",
    badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    link: "/statistik",
    linkText: "Sozial- & Statistikportal öffnen",
    title: "Arbeitsmarkt, Versorgungsdichte, Vereinswesen & ZAKB-Abfallbilanz",
    provider: "Bundesagentur für Arbeit, Kassenärztliche Vereinigung Hessen (KVH), ZAKB Bergstraße",
    updateCadence: "Monatlich (BA) bis Jährlich (ZAKB, KVH)",
    datasetScope: "Hessisches Ried & Landkreis Bergstraße",
    dbTables: ["municipal_statistics", "zakb_waste_statistics", "regional_facilities", "cultural_events"],
    parameters: [
      "SGB II / Bürgergeld-Quoten & Arbeitslosenzahlen (Quartals-/Monatsreihen)",
      "Ärztedichte: Hausärzte, Fachärzte, Apotheken & rechnerischer Versorgungsgrad (%)",
      "Vereinsregister: Sportvereine, Kulturorganisationen, Jugendförderung & KAMÜ",
      "ZAKB-Abfallbilanz: Restmüll, Biomüll, Wertstoffe, Papier (kg/Kopf & Recyclingquote)",
      "Regionale Veranstaltungen & Kulturkalender",
    ],
    license: "Offizielle Statistiken, KVH-Register & Verbandsberichte",
    storageTarget: "Tabellen: municipal_statistics, zakb_waste_statistics, regional_facilities, cultural_events",
  },
  {
    domain: "Umwelt, Schutzgebiete & Agrar",
    badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    link: "/",
    linkText: "Umwelt-Kartenlayer öffnen",
    title: "Grundwasser, Schutzgebiete, Sonderkulturen, Deiche & Lärmkartierung",
    provider: "HLNUG Hessen, InVeKoS Hessen (Agrardaten), Eisenbahn-Bundesamt (EBA), BKG",
    updateCadence: "Halbjährlich bis Jährlich / WMS OGC Tile Services",
    datasetScope: "Hessisches Ried (Altrhein, Bürstädter Wald, Weschnitz, Biedensand)",
    dbTables: ["groundwater_stations", "nature_protected_areas", "agriculture_crop_zones", "agriculture_municipal_stats", "flood_infrastructure", "flood_gauges", "noise_corridors", "environmental_map_services"],
    parameters: [
      "HLNUG Grundwassermessstellen mit Pegeltiefe (m) und Nitratgehalt (mg/l)",
      "Natur- & Landschaftsschutzgebiete (NSG Lampertheimer Altrhein, Biedensand, FFH Bürstadt, WSG)",
      "Agrarnutzung & Sonderkulturen: Spargelanbau, Freilandgemüse, Erdbeeren (Hektar & Quoten)",
      "Hochwasserschutz-Infrastruktur: Rheindeiche, Schöpfwerke, Retentionspolder",
      "Lärmkartierung EBA & HLNUG: Lärmpegelbänder (dB Lden / Lnight) an Bahn- & Straßenkorridoren",
      "Starkregengefahrenhinweiskarten & Hochwasserrisikogebiete (WMS BKG / HLNUG)",
    ],
    license: "GeoData dl-de/by-2-0, NATUREG Hessen & EBA Open Data",
    storageTarget: "Tabellen: groundwater_stations, nature_protected_areas, agriculture_crop_zones, flood_infrastructure, noise_corridors",
  },
  {
    domain: "Infrastruktur & Vernetzung",
    badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    link: "/",
    linkText: "Infrastruktur-Kartenlayer öffnen",
    title: "KI-Straßenzustand, Regenerative Energie, Breitband, E-Laden & WLAN",
    provider: "ZAKB Energie, Bundesnetzagentur (BNetzA), Breitbandatlas Hessen, Freifunk, Hessen Mobil",
    updateCadence: "Wöchentlich / Monatlich / OCPI Live-Status",
    datasetScope: "Bürstadt, Lampertheim, Biblis, Groß-Rohrheim",
    dbTables: ["road_condition_segments", "energy_facilities", "energy_production_readings", "broadband_coverage", "ev_charging_stations", "ev_charging_status", "public_wifi_hotspots"],
    parameters: [
      "KI-Straßenzustandsbewertung: Schadensnoten (1–5), Schlaglöcher & Risse via ZAKB-Fahrzeugkameras",
      "ZAKB Energiepark Hüttenfeld & Biogas Bürstadt: PV-Ertrag, Biogas-Grundlast & vermiedenes CO₂",
      "FTTH-Glasfaserausbauquoten nach Ortsteilen (Gigabit-Grundbuch Hessen)",
      "BNetzA Ladesäulenregister: Schnelllader, Normallader & OCPI Echtzeit-Belegung",
      "Öffentliche Wi-Fi Hotspots: Hessen-WLAN („Digitale Dorflinde“) & Freifunk Bergstraße",
    ],
    license: "BNetzA Open Data, OpenStreetMap, ZAKB & Kommunalpartner",
    storageTarget: "Tabellen: road_condition_segments, energy_facilities, broadband_coverage, ev_charging_stations, public_wifi_hotspots",
  },
  {
    domain: "Bauen, Wohnen & Boden",
    badgeColor: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    link: "/bauen-wohnen",
    linkText: "Bauen & Wohnen öffnen",
    title: "Bodenrichtwerte BORIS, Gebäudezählung, B-Pläne & Marktbenchmarks",
    provider: "BORIS Hessen (Gutachterausschüsse), Zensus 2022 / HSL, Bauämter Ried",
    updateCadence: "2-Jahres-Turnus (Bodenrichtwerte) / Jährlich (Wohnungsbestand)",
    datasetScope: "Wohn-, Misch- und Gewerbezonen im Hessischen Ried",
    dbTables: ["housing_stock_stats", "boris_land_value_zones", "land_use_polygons", "construction_permits", "realestate_market_benchmarks", "development_plans"],
    parameters: [
      "BORIS Bodenrichtwerte (€/m²) für Wohn- und Mischbauflächen inklusive Zonenpolygone",
      "Gebäude- und Wohnungsbestand, Wohnfläche je Einwohner, Leerstandsquoten & Heizungsarten",
      "Rechtskräftige Bebauungspläne (B-Pläne) mit Status und Geltungsbereich",
      "Bauanträge, genehmigte Wohnungen und Neubau-Fertigstellungen",
      "Marktbenchmarks: Kaltmieten (€/m²) und Kaufpreisspannen",
    ],
    license: "dl-zero-de/2.0 (BORIS Hessen) & Zensus Open Data",
    storageTarget: "Tabellen: boris_land_value_zones, housing_stock_stats, development_plans, construction_permits",
  },
  {
    domain: "Demografie & Pendler",
    badgeColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    link: "/demografie",
    linkText: "Demografieportal öffnen",
    title: "Einwohnerentwicklung, Alterskohorten, Pendleratlas & Schulen",
    provider: "Hessisches Statistisches Landesamt (Gemeindestatistik), Bundesagentur für Arbeit",
    updateCadence: "Jährlich / Halbjährlich",
    datasetScope: "Kommunen im Hessischen Ried",
    dbTables: ["municipalities", "demographic_snapshots", "commuter_flows", "educational_facilities"],
    parameters: [
      "Einwohnerzahlen, Bevölkerungsdichte, Ausländeranteile, Wanderungssalden",
      "Altersstruktur: Kohorten unter 6 bis über 65 Jahre",
      "Pendlerströme: Ein- und Auspendler nach Zielorten (Mannheim, Worms, BASF, Frankfurt)",
      "Bildungseinrichtungen: Grundschulen, Gesamtschulen, Gymnasien, Kitas & Schülerzahlen",
    ],
    license: "dl-de/by-2-0 & BA Statistik",
    storageTarget: "Tabellen: municipalities, demographic_snapshots, commuter_flows, educational_facilities",
  },
  {
    domain: "Archivierung & Backups",
    badgeColor: "text-slate-400 bg-slate-500/10 border-slate-500/20",
    link: "/daten",
    linkText: "Zu den Monatsarchiven",
    title: "Historische Zeitreihen-Archive & Retention-Management",
    provider: "Open Ried Sens Node.js Archive Worker & Uploadthing / S3",
    updateCadence: "Monatlich am 1. jedes Monats",
    datasetScope: "Alle registrierten Sensoren & Telemetrie-Hypertables",
    dbTables: ["data_archives", "archive_cleanup", "collector_schema_versions"],
    parameters: [
      "Monatliche komprimierte ZIP-Archive aufgetrennt in 64 MB Parts",
      "SHA256-Prüfsummen und Zeilenzahlen je Archivdatei",
      "Automatisierte Cleanup-Warteschlange für rotierte S3-Objektschlüssel",
    ],
    license: "Creative Commons CC BY 4.0",
    storageTarget: "Tabellen: data_archives, archive_cleanup, collector_schema_versions",
  },
];

export default function SourcesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Header */}
      <SiteHeader />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
              <RefreshCw className="w-3.5 h-3.5" /> Datentransparenz &amp; Pipeline-Audit
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight">
              Datenquellen, Taktraten &amp;{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Erfassungsvolumen
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              Vollständige Übersicht des Backends (<code>www/vps</code>):
              Woher beziehen die autonomen Kollektoren welche Daten, in welchen
              Intervallen wird abgefragt und in welchen <strong>PostgreSQL- &amp; TimescaleDB-Tabellen</strong>{" "}
              werden die Ergebnisse gespeichert?
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-300">
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" /> 100% Open Data
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-400" /> 45+ Tabellen in TimescaleDB
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950 border border-slate-800 flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-blue-400" /> CC BY 4.0, dl-de/by-2-0 &amp; dl-zero-de/2.0
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
              Täglich transaktional persistierte Datenzeilen in der TimescaleDB Hypertable
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
              HTTP-REST-Abfragen + 1 permanenter Seismik-Live-Stream + LoRa-Uplinks
            </p>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-teal-500/5 rounded-full blur-xl" />
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Datenbank-Tabellen</span>
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-100 font-mono">
              48 Tabellen
            </p>
            <p className="text-xs text-slate-400">
              Strukturierte Hypertables, Geometrien, Register &amp; Fachstatistiken
            </p>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/5 rounded-full blur-xl" />
          </div>

          <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-2 relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Integrierte Fachbereiche</span>
              <Layers className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-black text-slate-100 font-mono">
              8 Domänen
            </p>
            <p className="text-xs text-slate-400">
              Umwelt, Seismik, Mobilität, Wirtschaft, Haushalt, Soziales, Infra, Wohnen
            </p>
            <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />
          </div>
        </section>

        {/* SECTION 1: ECHTZEIT- & INTERVALL-KOLLEKTOREN */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Cpu className="w-4 h-4" /> Pipeline Teil 1: Autonome Poller &amp; Streaming-Services
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
                Echtzeit-Kollektoren &amp; Zeitreihen-Takte
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Autonome Dienste im Hintergrund-Cluster (VPS Docker), die periodisch
                Messwerte erfassen, normalisieren und transaktional dedupliziert speichern.
              </p>
            </div>
            <div className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 shrink-0 font-mono">
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
                          : `${source.pollIntervalSec}`}
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

                  {/* DB Tables */}
                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/60 font-mono text-xs space-y-1">
                    <span className="text-[10px] text-slate-500 font-sans uppercase font-bold tracking-wider">
                      Zieltabellen in Datenbank (PostgreSQL / TimescaleDB):
                    </span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {source.dbTables.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-teal-300 text-[11px]">
                          {t}
                        </span>
                      ))}
                    </div>
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
              Kollektoren wie <em>Smart City</em>, <em>Nextbike</em> und <em>Traffic</em> verwerfen
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
              <Building2 className="w-4 h-4" /> Pipeline Teil 2: Amtliche Fachdatenbanken &amp; Geodienste
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mt-1">
              Amtliche Fachregister, Geodaten &amp; Kommunalstatistiken
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Periodisch synchronisierte Datenebenen von Landesbehörden, statistischen
              Ämtern und Kommunalverwaltungen für Wirtschaft, Haushalt, Soziales,
              Umwelt, Infrastruktur, Wohnen und Demografie.
            </p>

            {/* Architectural Banner: Zero-Mock & DB-Sovereignty */}
            <div className="mt-4 p-4 rounded-2xl bg-slate-900/90 border border-teal-500/30 space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-teal-400 font-bold uppercase tracking-wider text-[11px]">
                <Cpu className="w-4 h-4" /> Autonomer Hintergrunddienst: <code>registry-sync-worker</code>
              </div>
              <p className="leading-relaxed">
                <strong>Strikte Datenhoheit der Datenbank:</strong> Das Frontend führt <em>keine eigenständigen Drittanbieter-Aufrufe</em> durch und zeigt <em>keine fixen Dummy-Daten</em> an.
                Sämtliche auf den Karten und Fachseiten dargestellten Fachinhalte stammen ausnahmslos aus <strong>PostgreSQL / TimescaleDB</strong>.
                Die periodische Datenbeschaffung erfolgt über den containerisierten <code>registry-sync-worker</code> (gestaffelt nach täglichen, wöchentlichen, monatlichen und jährlichen Cron-Läufen).
                Zur Schonung des Servers nutzt das Frontend serverseitiges Next.js Caching mit kontrollierten TTLs (30s bis 24h).
              </p>
              <div className="flex flex-wrap gap-2 pt-1 font-mono text-[10px] text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400">
                  Audit-Tabelle: collector_sync_logs
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-teal-400">
                  Slow-Changing Dimensions (SCD)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-blue-400">
                  Zero External Client Requests
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DOMAIN_REGISTRIES.map((reg, idx) => (
              <div
                key={idx}
                className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-slate-700/80 transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-3 py-1 rounded-full border font-bold ${reg.badgeColor}`}>
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

                  {/* Database tables badge list */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                      Postgres-Tabellen im Schema:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {reg.dbTables.map((tbl) => (
                        <code key={tbl} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-teal-300">
                          {tbl}
                        </code>
                      ))}
                    </div>
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
                Wie Open Ried Sens Millionen von Messwerten effizient komprimiert
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
