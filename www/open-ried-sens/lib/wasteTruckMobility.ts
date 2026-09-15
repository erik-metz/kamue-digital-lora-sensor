import { interpolatePolyline } from "./railMobility";

export type WasteFraction = "restmuell" | "biomuell" | "papier" | "gelber_sack" | "umweltmobil";

export interface WasteFractionMeta {
  id: WasteFraction;
  name: string;
  binColor: string;
  accentColor: string;
  icon: string;
  description: string;
}

export const WASTE_FRACTIONS: Record<WasteFraction, WasteFractionMeta> = {
  restmuell: {
    id: "restmuell",
    name: "Restmüll",
    binColor: "#475569", // Graue Tonne
    accentColor: "#f97316",
    icon: "🗑️",
    description: "Restabfall (Graue Tonne) – ZAKB Tour",
  },
  biomuell: {
    id: "biomuell",
    name: "Biomüll",
    binColor: "#16a34a", // Braune/Grüne Tonne
    accentColor: "#22c55e",
    icon: "🌱",
    description: "Bioguttonne (Braune Tonne) – Verwertung im Biomassezentrum",
  },
  papier: {
    id: "papier",
    name: "Altpapier",
    binColor: "#2563eb", // Blaue Tonne
    accentColor: "#60a5fa",
    icon: "📦",
    description: "Papier, Pappe, Kartonagen (Blaue Tonne)",
  },
  gelber_sack: {
    id: "gelber_sack",
    name: "Gelber Sack",
    binColor: "#eab308", // Gelber Wertstoffsack
    accentColor: "#fef08a",
    icon: "♻️",
    description: "Leichtverpackungen & Wertstoffe (Gelber Sack / Gelbe Tonne)",
  },
  umweltmobil: {
    id: "umweltmobil",
    name: "Umweltmobil",
    binColor: "#9333ea", // Schadstoffmobil
    accentColor: "#c084fc",
    icon: "⚠️",
    description: "ZAKB Schadstoffmobil / Umweltmobil für Problemabfälle",
  },
};

export interface WasteDepot {
  id: string;
  name: string;
  municipality: string;
  address: string;
  lat: number;
  lng: number;
  type: "headquarters_depot" | "recycling_yard";
}

export const ZAKB_DEPOTS: WasteDepot[] = [
  {
    id: "zakb-huettenfeld",
    name: "ZAKB Energiepark Hüttenfeld (Zentrale & Fuhrpark)",
    municipality: "Lampertheim",
    address: "Heidenfahrt 1, 68623 Lampertheim-Hüttenfeld",
    lat: 49.5962,
    lng: 8.5838,
    type: "headquarters_depot",
  },
  {
    id: "zakb-buerstadt",
    name: "ZAKB Wertstoffhof Bürstadt & Umladestation",
    municipality: "Bürstadt",
    address: "Zur Biogasanlage 1, 68642 Bürstadt",
    lat: 49.6382,
    lng: 8.4485,
    type: "recycling_yard",
  },
  {
    id: "zakb-lampertheim",
    name: "ZAKB Wertstoffhof Lampertheim",
    municipality: "Lampertheim",
    address: "Klärwerkstraße 6–8, 68623 Lampertheim",
    lat: 49.6018,
    lng: 8.4524,
    type: "recycling_yard",
  },
  {
    id: "zakb-biblis",
    name: "ZAKB Wertstoffhof Biblis",
    municipality: "Biblis",
    address: "Am Werrtor, 68647 Biblis",
    lat: 49.6912,
    lng: 8.4420,
    type: "recycling_yard",
  },
];

export interface CollectionWaypoint {
  street: string;
  lat: number;
  lng: number;
  stopProg: number; // 0.0 to 1.0 along tour route
  expectedTimeWindow: string; // e.g. "07:30 - 08:30"
  dwellSec: number; // Duration of bin compaction stop in seconds
}

export interface WasteTourDefinition {
  id: string;
  tourCode: string; // e.g. "BST-R01"
  name: string;
  municipality: "Bürstadt" | "Lampertheim" | "Hofheim (Ried)" | "Biblis";
  fraction: WasteFraction;
  licensePlate: string; // e.g. "HP-ZK 102"
  vehicleModel: string;
  periodSec: number; // Duration of simulated loop in seconds (e.g. 1080s = 18min demo cycle)
  offsetSec: number;
  speedCollectingKmh: number; // Realistic collection speed: 12-18 km/h
  speedTransitKmh: number; // 45-55 km/h
  track: [number, number][];
  waypoints: CollectionWaypoint[];
}

// 1. Realistic Route Polylines in Kreis Bergstraße (Ried)
// Bürstadt Tour (Kernstadt & Bobstadt)
export const ROUTE_BUERSTADT: [number, number][] = [
  [49.6382, 8.4485], // Start: ZAKB Wertstoffhof Zur Biogasanlage
  [49.6395, 8.4510],
  [49.6415, 8.4530], // Nibelungenstraße (B47)
  [49.6425, 8.4542], // Marktplatz / Historisches Rathaus
  [49.6440, 8.4548], // Mainstraße Süd
  [49.6465, 8.4552], // Mainstraße Mitte (nahe BÜ)
  [49.6480, 8.4565], // Wilhelminenstraße
  [49.6505, 8.4575], // Gartenstadt
  [49.6520, 8.4550], // Boxheimerhofstraße
  [49.6560, 8.4520], // Verbindung nach Bobstadt
  [49.6610, 8.4485], // Bobstadt Frankenstraße
  [49.6635, 8.4465], // Bobstadt St.-Josef-Straße / Altes Rathaus
  [49.6600, 8.4450], // Bobstadt Kurpfalzstraße
  [49.6530, 8.4490], // Rückfahrt Bürstadt West
  [49.6440, 8.4510], // Heinrichstraße
  [49.6382, 8.4485], // Zurück zum Wertstoffhof
];

// Lampertheim Tour (Kernstadt & Neuschloß)
export const ROUTE_LAMPERTHEIM: [number, number][] = [
  [49.6018, 8.4524], // Start: ZAKB Wertstoffhof Klärwerkstraße
  [49.5985, 8.4580], // Römerstraße
  [49.5955, 8.4635], // Domkirche / Schillerplatz
  [49.5940, 8.4670], // Kaiserstraße
  [49.5952, 8.4720], // Ernst-Ludwig-Straße
  [49.5968, 8.4770], // Bürstädter Straße
  [49.5975, 8.4830], // Neuschloßstraße West
  [49.5985, 8.4950], // Neuschloß Schlossplatz
  [49.5970, 8.4900], // Ulmenweg / Ahornweg
  [49.5930, 8.4750], // Wilhelmstraße
  [49.5915, 8.4660], // Biedensandstraße
  [49.5960, 8.4590], // Chemiestraße
  [49.6018, 8.4524], // Rückkehr Klärwerkstraße
];

// Hofheim (Ried) Tour
export const ROUTE_HOFHEIM: [number, number][] = [
  [49.6425, 8.4542], // Bürstadt Anfahrt B47
  [49.6500, 8.4350], // B47 Ried-Querung
  [49.6550, 8.4180], // Hofheim Ortseingang Ost
  [49.6575, 8.4140], // Bahnhofstraße Hofheim
  [49.6590, 8.4125], // Lindenstraße / Balthasar-Neumann-Kirche
  [49.6615, 8.4135], // Bibliser Weg (nahe BÜ)
  [49.6630, 8.4160], // Backhausstraße / Nordend
  [49.6580, 8.4175], // Friedrich-Ebert-Straße
  [49.6540, 8.4150], // Wormser Straße Süd
  [49.6480, 8.4320], // Rückweg via Riedstraße
  [49.6382, 8.4485], // Endstation Bürstadt Wertstoffhof
];

// Biblis Tour (Kernort & Wattenheim)
export const ROUTE_BIBLIS: [number, number][] = [
  [49.6912, 8.4420], // Start: ZAKB Wertstoffhof Am Werrtor
  [49.6885, 8.4460], // Darmstädter Straße / Rathaus
  [49.6850, 8.4475], // Bahnhofstraße Biblis
  [49.6820, 8.4440], // Kirchstraße (Gemeindesee)
  [49.6860, 8.4410], // Hintergasse
  [49.6890, 8.4380], // Verbindung nach Wattenheim
  [49.6940, 8.4280], // Wattenheim Rheinstraße
  [49.6970, 8.4230], // Wattenheim Ortsmitte / Kirche
  [49.6950, 8.4200], // Rheinuferstraße
  [49.6920, 8.4320], // Rückweg Feldweg Wattenheim-Biblis
  [49.6912, 8.4420], // Rückkehr Am Werrtor
];

// ZAKB Schadstoffmobil / Umweltmobil Tour
export const ROUTE_UMWELTMOBIL: [number, number][] = [
  [49.5962, 8.5838], // Start: ZAKB Zentrale Hüttenfeld
  [49.5975, 8.5300], // L3111 Transit
  [49.6018, 8.4524], // Halt 1: Lampertheim Wertstoffhof Klärwerkstraße
  [49.6200, 8.4600], // Transit L3110 nach Bürstadt
  [49.6382, 8.4485], // Halt 2: Bürstadt Wertstoffhof Zur Biogasanlage
  [49.6500, 8.4350], // Transit Hofheim
  [49.6580, 8.4120], // Halt 3: Hofheim Sportpark / Parkplatz
  [49.6700, 8.4300], // Transit nach Biblis
  [49.6912, 8.4420], // Halt 4: Biblis Wertstoffhof
  [49.6450, 8.5100], // Rückfahrt B47 / L3111
  [49.5962, 8.5838], // Rückkehr ZAKB Energiepark Hüttenfeld
];

export const ZAKB_TOURS: WasteTourDefinition[] = [
  {
    id: "tour-bst-restmuell",
    tourCode: "BST-R01",
    name: "Tour B1: Bürstadt Kernstadt & Bobstadt",
    municipality: "Bürstadt",
    fraction: "restmuell",
    licensePlate: "HP-ZK 102",
    vehicleModel: "Mercedes-Benz Econic 2630 (Faun Rotopress)",
    periodSec: 1080,
    offsetSec: 60,
    speedCollectingKmh: 14,
    speedTransitKmh: 48,
    track: ROUTE_BUERSTADT,
    waypoints: [
      { street: "Nibelungenstraße", lat: 49.6415, lng: 8.4530, stopProg: 0.15, expectedTimeWindow: "07:30 – 08:30 Uhr", dwellSec: 40 },
      { street: "Mainstraße", lat: 49.6465, lng: 8.4552, stopProg: 0.32, expectedTimeWindow: "08:30 – 09:30 Uhr", dwellSec: 45 },
      { street: "Wilhelminenstraße / Gartenstadt", lat: 49.6480, lng: 8.4565, stopProg: 0.44, expectedTimeWindow: "09:30 – 10:30 Uhr", dwellSec: 35 },
      { street: "Bobstadt Frankenstraße", lat: 49.6610, lng: 8.4485, stopProg: 0.68, expectedTimeWindow: "10:30 – 11:30 Uhr", dwellSec: 40 },
      { street: "Bobstadt Kurpfalzstraße", lat: 49.6600, lng: 8.4450, stopProg: 0.82, expectedTimeWindow: "11:30 – 12:15 Uhr", dwellSec: 35 },
    ],
  },
  {
    id: "tour-la-biomuell",
    tourCode: "LA-B02",
    name: "Tour L2: Lampertheim Mitte & Neuschloß",
    municipality: "Lampertheim",
    fraction: "biomuell",
    licensePlate: "HP-ZK 214",
    vehicleModel: "MAN TGM 26.320 (Zöller Medium X4)",
    periodSec: 1140,
    offsetSec: 340,
    speedCollectingKmh: 15,
    speedTransitKmh: 45,
    track: ROUTE_LAMPERTHEIM,
    waypoints: [
      { street: "Schillerplatz / Domkirche", lat: 49.5955, lng: 8.4635, stopProg: 0.18, expectedTimeWindow: "07:15 – 08:15 Uhr", dwellSec: 35 },
      { street: "Kaiserstraße / Fußgängerzone", lat: 49.5940, lng: 8.4670, stopProg: 0.30, expectedTimeWindow: "08:15 – 09:15 Uhr", dwellSec: 45 },
      { street: "Ernst-Ludwig-Straße", lat: 49.5952, lng: 8.4720, stopProg: 0.42, expectedTimeWindow: "09:15 – 10:15 Uhr", dwellSec: 40 },
      { street: "Neuschloß Schlossplatz", lat: 49.5985, lng: 8.4950, stopProg: 0.62, expectedTimeWindow: "10:15 – 11:15 Uhr", dwellSec: 50 },
      { street: "Biedensandstraße", lat: 49.5915, lng: 8.4660, stopProg: 0.85, expectedTimeWindow: "11:15 – 12:00 Uhr", dwellSec: 35 },
    ],
  },
  {
    id: "tour-hof-gelbersack",
    tourCode: "HOF-G01",
    name: "Tour H1: Hofheim (Ried)",
    municipality: "Hofheim (Ried)",
    fraction: "gelber_sack",
    licensePlate: "HP-ZK 308",
    vehicleModel: "Scania L280 (Variopress 524)",
    periodSec: 960,
    offsetSec: 180,
    speedCollectingKmh: 16,
    speedTransitKmh: 50,
    track: ROUTE_HOFHEIM,
    waypoints: [
      { street: "Bahnhofstraße", lat: 49.6575, lng: 8.4140, stopProg: 0.30, expectedTimeWindow: "07:45 – 08:45 Uhr", dwellSec: 40 },
      { street: "Lindenstraße", lat: 49.6590, lng: 8.4125, stopProg: 0.42, expectedTimeWindow: "08:45 – 09:45 Uhr", dwellSec: 35 },
      { street: "Bibliser Weg", lat: 49.6615, lng: 8.4135, stopProg: 0.54, expectedTimeWindow: "09:45 – 10:45 Uhr", dwellSec: 45 },
      { street: "Friedrich-Ebert-Straße", lat: 49.6580, lng: 8.4175, stopProg: 0.72, expectedTimeWindow: "10:45 – 11:30 Uhr", dwellSec: 35 },
    ],
  },
  {
    id: "tour-bib-papier",
    tourCode: "BIB-P01",
    name: "Tour BI1: Biblis & Wattenheim",
    municipality: "Biblis",
    fraction: "papier",
    licensePlate: "HP-ZK 419",
    vehicleModel: "Volvo FE Electric (Faun Variopress)",
    periodSec: 1020,
    offsetSec: 520,
    speedCollectingKmh: 15,
    speedTransitKmh: 52,
    track: ROUTE_BIBLIS,
    waypoints: [
      { street: "Darmstädter Straße", lat: 49.6885, lng: 8.4460, stopProg: 0.18, expectedTimeWindow: "08:00 – 09:00 Uhr", dwellSec: 45 },
      { street: "Kirchstraße / Seepromenade", lat: 49.6820, lng: 8.4440, stopProg: 0.35, expectedTimeWindow: "09:00 – 10:00 Uhr", dwellSec: 40 },
      { street: "Wattenheim Rheinstraße", lat: 49.6940, lng: 8.4280, stopProg: 0.65, expectedTimeWindow: "10:00 – 11:00 Uhr", dwellSec: 45 },
      { street: "Wattenheim Ortsmitte", lat: 49.6970, lng: 8.4230, stopProg: 0.78, expectedTimeWindow: "11:00 – 11:45 Uhr", dwellSec: 35 },
    ],
  },
  {
    id: "tour-ried-umweltmobil",
    tourCode: "UMW-01",
    name: "ZAKB Umweltmobil / Schadstofftour Ried",
    municipality: "Bürstadt",
    fraction: "umweltmobil",
    licensePlate: "HP-UM 1",
    vehicleModel: "Sonder-LKW Schadstofferfassung Kreis Bergstraße",
    periodSec: 1500,
    offsetSec: 0,
    speedCollectingKmh: 0,
    speedTransitKmh: 55,
    track: ROUTE_UMWELTMOBIL,
    waypoints: [
      { street: "Halt: Wertstoffhof Lampertheim (Klärwerkstr.)", lat: 49.6018, lng: 8.4524, stopProg: 0.20, expectedTimeWindow: "09:30 – 13:00 Uhr", dwellSec: 75 },
      { street: "Halt: Wertstoffhof Bürstadt (Zur Biogasanlage)", lat: 49.6382, lng: 8.4485, stopProg: 0.42, expectedTimeWindow: "09:30 – 12:30 Uhr", dwellSec: 70 },
      { street: "Halt: Hofheim Sportpark", lat: 49.6580, lng: 8.4120, stopProg: 0.60, expectedTimeWindow: "13:30 – 15:30 Uhr", dwellSec: 60 },
      { street: "Halt: Wertstoffhof Biblis (Am Werrtor)", lat: 49.6912, lng: 8.4420, stopProg: 0.80, expectedTimeWindow: "15:45 – 17:00 Uhr", dwellSec: 65 },
    ],
  },
];

export interface LiveWasteTruck {
  id: string;
  tourCode: string;
  name: string;
  municipality: string;
  fraction: WasteFraction;
  fractionLabel: string;
  binColor: string;
  accentColor: string;
  licensePlate: string;
  vehicleModel: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  status: "collecting" | "bin_emptying" | "transit";
  currentStreet: string;
  nextStreet: string;
  expectedTimeWindow: string;
  loadPercent: number;
  emptyCountdownSec?: number;
  emptyProgress?: number;
  predictionBasis: string;
}

export function calculateWasteTruckMobility(timestampMs: number = Date.now()): {
  trucks: LiveWasteTruck[];
  depots: WasteDepot[];
} {
  const trucks: LiveWasteTruck[] = [];

  for (const tour of ZAKB_TOURS) {
    const fractionMeta = WASTE_FRACTIONS[tour.fraction];
    const cycleTimeSec = ((timestampMs / 1000 + tour.offsetSec) % tour.periodSec);
    const totalProg = Math.max(0, Math.min(1, cycleTimeSec / tour.periodSec));

    let isDwelling = false;
    let currentWaypoint: CollectionWaypoint | undefined;
    let nextWaypoint: CollectionWaypoint | undefined;
    let dwellProgress = 0;
    let dwellRemainingSec = 0;

    const dwellWindowProg = 0.05;

    for (let i = 0; i < tour.waypoints.length; i++) {
      const wp = tour.waypoints[i];
      const startProg = wp.stopProg - dwellWindowProg / 2;
      const endProg = wp.stopProg + dwellWindowProg / 2;

      if (totalProg >= startProg && totalProg <= endProg) {
        isDwelling = true;
        currentWaypoint = wp;
        const dwellProgFraction = (totalProg - startProg) / dwellWindowProg;
        dwellProgress = 1.0 - dwellProgFraction;
        dwellRemainingSec = Math.round(dwellProgress * wp.dwellSec);
        nextWaypoint = tour.waypoints[(i + 1) % tour.waypoints.length];
        break;
      }

      if (totalProg < wp.stopProg && !nextWaypoint) {
        nextWaypoint = wp;
      }
    }

    if (!nextWaypoint && tour.waypoints.length > 0) {
      nextWaypoint = tour.waypoints[0];
    }

    let lat: number;
    let lng: number;
    let heading: number;
    let speedKmh: number;
    let status: "collecting" | "bin_emptying" | "transit";

    if (isDwelling && currentWaypoint) {
      lat = currentWaypoint.lat;
      lng = currentWaypoint.lng;
      const pos = interpolatePolyline(tour.track, currentWaypoint.stopProg);
      heading = pos.heading;
      speedKmh = 0;
      status = "bin_emptying";
    } else {
      const pos = interpolatePolyline(tour.track, totalProg);
      lat = pos.lat;
      lng = pos.lng;
      heading = pos.heading;

      const isTransitSegment = totalProg < 0.1 || totalProg > 0.9;
      speedKmh = isTransitSegment ? tour.speedTransitKmh : tour.speedCollectingKmh;
      status = isTransitSegment ? "transit" : "collecting";
    }

    let currentStreet = isDwelling && currentWaypoint
      ? currentWaypoint.street
      : nextWaypoint
      ? `Zufahrt ${nextWaypoint.street}`
      : `${tour.municipality} Ortslage`;

    if (status === "transit") {
      currentStreet = totalProg < 0.1 ? "Ausfahrt Depot / Stützpunkt" : "Rückfahrt ZAKB Wertstoffhof / Depot";
    }

    const nextStreet = nextWaypoint ? nextWaypoint.street : "Depot";
    const expectedTimeWindow = nextWaypoint ? nextWaypoint.expectedTimeWindow : "Planmäßig";
    const loadPercent = Math.min(95, Math.round(15 + totalProg * 75));

    trucks.push({
      id: tour.id,
      tourCode: tour.tourCode,
      name: tour.name,
      municipality: tour.municipality,
      fraction: tour.fraction,
      fractionLabel: fractionMeta.name,
      binColor: fractionMeta.binColor,
      accentColor: fractionMeta.accentColor,
      licensePlate: tour.licensePlate,
      vehicleModel: tour.vehicleModel,
      lat,
      lng,
      heading,
      speedKmh,
      status,
      currentStreet,
      nextStreet,
      expectedTimeWindow,
      loadPercent,
      emptyCountdownSec: isDwelling ? dwellRemainingSec : undefined,
      emptyProgress: isDwelling ? dwellProgress : undefined,
      predictionBasis: "Prognose nach ZAKB Abfuhrkalender & Tourenmodell (kein Echtzeit-GPS)",
    });
  }

  return {
    trucks,
    depots: ZAKB_DEPOTS,
  };
}
