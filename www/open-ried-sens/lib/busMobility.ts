/**
 * VRN GTFS-RT Bus Mobility Engine for the Hessian Ried.
 * Covers regional VRN lines (641, 642, 644, 652 School Bus),
 * bus stop dwell with animated radial departure countdown gauges,
 * automated school bus detection using school schedules & Hessian holiday calendar,
 * level crossing (BÜ) conflict warnings, and intermodal train synchronization.
 */

import { haversineMeters, interpolatePolyline, ACTIVE_LEVEL_CROSSINGS, calculateRiedMobility } from "./railMobility";

export interface BusStop {
  id: string;
  name: string;
  municipality: "Bürstadt" | "Lampertheim" | "Hofheim (Ried)" | "Biblis" | "Bobstadt";
  lat: number;
  lng: number;
  lines: string[];
  isSchoolStop?: boolean;
  nearbySchoolName?: string;
  isTrainHub?: boolean; // Bürstadt Bhf, Lampertheim Bhf, Biblis Bhf
  platforms?: string[];
}

export interface LiveBus {
  id: string;
  line: string; // "641", "642", "644", "652"
  lineCode: string;
  operator: string;
  origin: string;
  destination: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  status: "moving" | "stopped";
  currentStopId?: string;
  currentStopName?: string;
  nextStopId?: string;
  nextStopName?: string;
  dwellTimeRemainingSec?: number;
  dwellTotalSec?: number;
  dwellProgress?: number; // 1.0 (just arrived) -> 0.0 (departing)
  delaySec: number; // GTFS-RT delay (can be 0 or small positive/negative)
  delayMinutes: number;
  isSchoolBus: boolean;
  schoolBusReason?: string;
  wheelchairAccessible: boolean; // Niederflurbus
  approachingCrossingWarning?: string; // BÜ closure warning
  intermodalConnectionInfo?: string; // e.g. "Anschluss zu S 9 in 5 Min"
}

export interface BusDeparture {
  line: string;
  destination: string;
  origin: string;
  scheduledTime: string;
  estimatedTime: string;
  delayMinutes: number;
  isSchoolBus: boolean;
  schoolBusReason?: string;
  wheelchairAccessible: boolean;
  platform?: string;
}

// 1. Bus Stops in the Ried corridor
export const RIED_BUS_STOPS: BusStop[] = [
  // Bürstadt
  {
    id: "stop-bst-bahnhof",
    name: "Bürstadt Bahnhof",
    municipality: "Bürstadt",
    lat: 49.6458,
    lng: 8.4563,
    lines: ["641", "642", "643", "652"],
    isTrainHub: true,
    platforms: ["Bussteig 1", "Bussteig 2"],
  },
  {
    id: "stop-bst-marktplatz",
    name: "Bürstadt Marktplatz / Historisches Rathaus",
    municipality: "Bürstadt",
    lat: 49.6425,
    lng: 8.4542,
    lines: ["641", "642", "652"],
    platforms: ["Steig A", "Steig B"],
  },
  {
    id: "stop-bst-eks",
    name: "Bürstadt Erich-Kästner-Schule",
    municipality: "Bürstadt",
    lat: 49.6385,
    lng: 8.4610,
    lines: ["642", "652"],
    isSchoolStop: true,
    nearbySchoolName: "Erich-Kästner-Schule (Integrierte Gesamtschule)",
    platforms: ["Schulbussteig 1", "Schulbussteig 2"],
  },
  {
    id: "stop-bst-schillerschule",
    name: "Bürstadt Schillerschule / Rathaus",
    municipality: "Bürstadt",
    lat: 49.6438,
    lng: 8.4568,
    lines: ["641", "652"],
    isSchoolStop: true,
    nearbySchoolName: "Schillerschule Grundschule",
  },
  {
    id: "stop-bst-boxheimerhof",
    name: "Bürstadt Boxheimerhof",
    municipality: "Bürstadt",
    lat: 49.6520,
    lng: 8.4550,
    lines: ["641", "652"],
  },
  {
    id: "stop-bst-sonneneck",
    name: "Bürstadt Sonneneck / Mainstraße Süd",
    municipality: "Bürstadt",
    lat: 49.6432,
    lng: 8.4515,
    lines: ["642"],
  },

  // Bobstadt
  {
    id: "stop-bob-altes-rathaus",
    name: "Bobstadt Altes Rathaus / St.-Josef",
    municipality: "Bobstadt",
    lat: 49.6635,
    lng: 8.4465,
    lines: ["641", "652"],
  },
  {
    id: "stop-bob-frankenstr",
    name: "Bobstadt Frankenstraße",
    municipality: "Bobstadt",
    lat: 49.6610,
    lng: 8.4485,
    lines: ["641", "652"],
  },

  // Lampertheim
  {
    id: "stop-la-bahnhof",
    name: "Lampertheim Bahnhof",
    municipality: "Lampertheim",
    lat: 49.5980,
    lng: 8.4760,
    lines: ["641", "644", "652"],
    isTrainHub: true,
    platforms: ["Steig 1", "Steig 2", "Steig 3"],
  },
  {
    id: "stop-la-domkirche",
    name: "Lampertheim Domkirche / Schillerplatz",
    municipality: "Lampertheim",
    lat: 49.5955,
    lng: 8.4635,
    lines: ["641", "652"],
  },
  {
    id: "stop-la-lessing-gymnasium",
    name: "Lampertheim Lessing-Gymnasium",
    municipality: "Lampertheim",
    lat: 49.5932,
    lng: 8.4715,
    lines: ["641", "652"],
    isSchoolStop: true,
    nearbySchoolName: "Lessing-Gymnasium Lampertheim",
  },
  {
    id: "stop-la-alfred-delp",
    name: "Lampertheim Alfred-Delp-Schule",
    municipality: "Lampertheim",
    lat: 49.5975,
    lng: 8.4830,
    lines: ["641", "652"],
    isSchoolStop: true,
    nearbySchoolName: "Alfred-Delp-Schule (Realschule / Hauptschule)",
  },

  // Hofheim (Ried)
  {
    id: "stop-hof-bahnhof",
    name: "Hofheim (Ried) Bahnhof",
    municipality: "Hofheim (Ried)",
    lat: 49.6588,
    lng: 8.4115,
    lines: ["642"],
    isTrainHub: true,
  },
  {
    id: "stop-hof-schule",
    name: "Hofheim Schule / Sportpark",
    municipality: "Hofheim (Ried)",
    lat: 49.6580,
    lng: 8.4175,
    lines: ["642"],
    isSchoolStop: true,
    nearbySchoolName: "Schule Hofheim Grundschule",
  },
  {
    id: "stop-hof-kirche",
    name: "Hofheim Balthasar-Neumann-Kirche",
    municipality: "Hofheim (Ried)",
    lat: 49.6590,
    lng: 8.4125,
    lines: ["642"],
  },

  // Biblis
  {
    id: "stop-bib-bahnhof",
    name: "Biblis Bahnhof",
    municipality: "Biblis",
    lat: 49.6886,
    lng: 8.4485,
    lines: ["644"],
    isTrainHub: true,
  },
  {
    id: "stop-bib-rathaus",
    name: "Biblis Rathaus",
    municipality: "Biblis",
    lat: 49.6885,
    lng: 8.4460,
    lines: ["644"],
  },
  {
    id: "stop-bib-schule",
    name: "Biblis Schule am Weschnitzdamm",
    municipality: "Biblis",
    lat: 49.6835,
    lng: 8.4445,
    lines: ["644"],
    isSchoolStop: true,
    nearbySchoolName: "Schule am Weschnitzdamm (Grundschule)",
  },
];

// 2. Bus Route Track Polylines
// Line 641: Bürstadt Bahnhof <-> Bobstadt <-> Lampertheim Bahnhof
export const ROUTE_641_TRACK: [number, number][] = [
  [49.6458, 8.4563], // Bürstadt Bhf
  [49.6440, 8.4548],
  [49.6425, 8.4542], // Bürstadt Marktplatz
  [49.6480, 8.4565], // Wilhelminenstr
  [49.6520, 8.4550], // Boxheimerhof
  [49.6560, 8.4520],
  [49.6610, 8.4485], // Bobstadt Frankenstraße
  [49.6635, 8.4465], // Bobstadt Altes Rathaus
  [49.6560, 8.4520], // Return south towards Lampertheim
  [49.6380, 8.4600],
  [49.6200, 8.4650], // B44 corridor south
  [49.6050, 8.4700],
  [49.5980, 8.4760], // Lampertheim Bhf
  [49.5955, 8.4635], // Domkirche
  [49.5932, 8.4715], // Lessing-Gymnasium
  [49.5975, 8.4830], // Alfred-Delp-Schule
  [49.5980, 8.4760], // End Lampertheim Bhf
];

// Line 642: Worms Hbf <-> Hofheim <-> Bürstadt Bahnhof (crosses BÜ Mainstraße!)
export const ROUTE_642_TRACK: [number, number][] = [
  [49.6320, 8.3600], // Worms Hbf (Anfahrt Rheinbrücke)
  [49.6450, 8.3900], // Rheinbrücke / B47
  [49.6550, 8.4100], // Hofheim Ortseingang
  [49.6588, 8.4115], // Hofheim Bahnhof
  [49.6590, 8.4125], // Balthasar-Neumann-Kirche
  [49.6580, 8.4175], // Schule Hofheim
  [49.6500, 8.4350], // B47 Ried-Transit nach Bürstadt
  [49.6432, 8.4515], // Bürstadt Sonneneck
  [49.6425, 8.4542], // Bürstadt Marktplatz
  [49.6460, 8.4540], // Nahe Bahnübergang Mainstraße (km 9.8)
  [49.6458, 8.4563], // Bürstadt Bahnhof
  [49.6385, 8.4610], // Bürstadt Erich-Kästner-Schule
];

// Line 644: Worms Hbf <-> Biblis Bahnhof
export const ROUTE_644_TRACK: [number, number][] = [
  [49.6320, 8.3600], // Worms
  [49.6600, 8.4100],
  [49.6750, 8.4300], // B44 Nord
  [49.6835, 8.4445], // Schule am Weschnitzdamm
  [49.6885, 8.4460], // Biblis Rathaus
  [49.6886, 8.4485], // Biblis Bahnhof
];

// Line 652: Dedizierter Schülerverkehr Bürstadt & Lampertheim (Schulbus EKS & Lessing)
export const ROUTE_652_TRACK: [number, number][] = [
  [49.6635, 8.4465], // Bobstadt Altes Rathaus
  [49.6610, 8.4485], // Bobstadt Frankenstraße
  [49.6520, 8.4550], // Bürstadt Boxheimerhof
  [49.6425, 8.4542], // Bürstadt Marktplatz
  [49.6438, 8.4568], // Bürstadt Schillerschule
  [49.6458, 8.4563], // Bürstadt Bahnhof
  [49.6385, 8.4610], // Bürstadt Erich-Kästner-Schule (Hauptschulzentrum)
  [49.6200, 8.4650], // Zubringer nach Lampertheim Schulen
  [49.5932, 8.4715], // Lampertheim Lessing-Gymnasium
  [49.5975, 8.4830], // Lampertheim Alfred-Delp-Schule
  [49.5980, 8.4760], // Lampertheim Bahnhof
];

export interface BusStopWaypoint {
  stopId: string;
  stopProg: number; // 0.0 to 1.0 along polyline
  dwellSec: number; // Dwell duration in seconds
}

export interface BusTourDefinition {
  id: string;
  line: string;
  lineCode: string;
  operator: string;
  origin: string;
  destination: string;
  periodSec: number;
  offsetSec: number;
  speedTransitKmh: number;
  track: [number, number][];
  waypoints: BusStopWaypoint[];
  isSchoolLine?: boolean;
}

export const VRN_BUS_TOURS: BusTourDefinition[] = [
  // 1. Linie 641: Bürstadt <-> Lampertheim (alle 30 Min)
  {
    id: "tour-bus-641-south",
    line: "641",
    lineCode: "VRN-641",
    operator: "VRN / Verkehrsgesellschaft Gersprenztal (VGG)",
    origin: "Bürstadt Bahnhof",
    destination: "Lampertheim Bahnhof",
    periodSec: 1800,
    offsetSec: 120,
    speedTransitKmh: 42,
    track: ROUTE_641_TRACK,
    waypoints: [
      { stopId: "stop-bst-bahnhof", stopProg: 0.0, dwellSec: 40 },
      { stopId: "stop-bst-marktplatz", stopProg: 0.12, dwellSec: 30 },
      { stopId: "stop-bst-boxheimerhof", stopProg: 0.25, dwellSec: 25 },
      { stopId: "stop-bob-altes-rathaus", stopProg: 0.42, dwellSec: 30 },
      { stopId: "stop-la-bahnhof", stopProg: 0.72, dwellSec: 45 },
      { stopId: "stop-la-domkirche", stopProg: 0.82, dwellSec: 30 },
      { stopId: "stop-la-lessing-gymnasium", stopProg: 0.90, dwellSec: 35 },
    ],
  },
  {
    id: "tour-bus-641-north",
    line: "641",
    lineCode: "VRN-641",
    operator: "VRN / VGG",
    origin: "Lampertheim Bahnhof",
    destination: "Bürstadt Bahnhof",
    periodSec: 1800,
    offsetSec: 1020,
    speedTransitKmh: 42,
    track: [...ROUTE_641_TRACK].reverse(),
    waypoints: [
      { stopId: "stop-la-bahnhof", stopProg: 0.05, dwellSec: 40 },
      { stopId: "stop-la-domkirche", stopProg: 0.18, dwellSec: 30 },
      { stopId: "stop-bob-altes-rathaus", stopProg: 0.55, dwellSec: 30 },
      { stopId: "stop-bst-boxheimerhof", stopProg: 0.72, dwellSec: 25 },
      { stopId: "stop-bst-marktplatz", stopProg: 0.85, dwellSec: 30 },
      { stopId: "stop-bst-bahnhof", stopProg: 0.98, dwellSec: 45 },
    ],
  },

  // 2. Linie 642: Worms <-> Hofheim <-> Bürstadt (EKS)
  {
    id: "tour-bus-642-east",
    line: "642",
    lineCode: "VRN-642",
    operator: "VRN / Busverkehr Rhein-Neckar (BRN)",
    origin: "Worms Hbf",
    destination: "Bürstadt EKS",
    periodSec: 1800,
    offsetSec: 300,
    speedTransitKmh: 45,
    track: ROUTE_642_TRACK,
    waypoints: [
      { stopId: "stop-hof-bahnhof", stopProg: 0.25, dwellSec: 35 },
      { stopId: "stop-hof-schule", stopProg: 0.38, dwellSec: 30 },
      { stopId: "stop-bst-sonneneck", stopProg: 0.62, dwellSec: 25 },
      { stopId: "stop-bst-marktplatz", stopProg: 0.75, dwellSec: 30 },
      { stopId: "stop-bst-bahnhof", stopProg: 0.88, dwellSec: 45 },
      { stopId: "stop-bst-eks", stopProg: 0.98, dwellSec: 50 },
    ],
  },
  {
    id: "tour-bus-642-west",
    line: "642",
    lineCode: "VRN-642",
    operator: "VRN / BRN",
    origin: "Bürstadt EKS",
    destination: "Worms Hbf",
    periodSec: 1800,
    offsetSec: 1200,
    speedTransitKmh: 45,
    track: [...ROUTE_642_TRACK].reverse(),
    waypoints: [
      { stopId: "stop-bst-eks", stopProg: 0.02, dwellSec: 45 },
      { stopId: "stop-bst-bahnhof", stopProg: 0.12, dwellSec: 40 },
      { stopId: "stop-bst-marktplatz", stopProg: 0.25, dwellSec: 30 },
      { stopId: "stop-bst-sonneneck", stopProg: 0.38, dwellSec: 25 },
      { stopId: "stop-hof-schule", stopProg: 0.62, dwellSec: 30 },
      { stopId: "stop-hof-bahnhof", stopProg: 0.75, dwellSec: 35 },
    ],
  },

  // 3. Linie 644: Worms <-> Biblis Bahnhof
  {
    id: "tour-bus-644-north",
    line: "644",
    lineCode: "VRN-644",
    operator: "VRN / BRN",
    origin: "Worms Hbf",
    destination: "Biblis Bahnhof",
    periodSec: 1800,
    offsetSec: 600,
    speedTransitKmh: 48,
    track: ROUTE_644_TRACK,
    waypoints: [
      { stopId: "stop-bib-schule", stopProg: 0.60, dwellSec: 30 },
      { stopId: "stop-bib-rathaus", stopProg: 0.80, dwellSec: 25 },
      { stopId: "stop-bib-bahnhof", stopProg: 0.98, dwellSec: 40 },
    ],
  },

  // 4. Linie 652: Dedizierter Schülerbus Bürstadt / Lampertheim (Schulbus EKS & Lessing)
  {
    id: "tour-bus-652-school",
    line: "652",
    lineCode: "VRN-652S",
    operator: "VRN / Schülerverkehr Kreis Bergstraße",
    origin: "Bobstadt Altes Rathaus",
    destination: "Lampertheim Schulzentrum",
    periodSec: 1800,
    offsetSec: 450,
    speedTransitKmh: 38,
    track: ROUTE_652_TRACK,
    isSchoolLine: true,
    waypoints: [
      { stopId: "stop-bob-altes-rathaus", stopProg: 0.05, dwellSec: 35 },
      { stopId: "stop-bst-boxheimerhof", stopProg: 0.20, dwellSec: 30 },
      { stopId: "stop-bst-marktplatz", stopProg: 0.32, dwellSec: 30 },
      { stopId: "stop-bst-schillerschule", stopProg: 0.42, dwellSec: 40 },
      { stopId: "stop-bst-bahnhof", stopProg: 0.50, dwellSec: 45 },
      { stopId: "stop-bst-eks", stopProg: 0.62, dwellSec: 60 }, // Major school drop-off
      { stopId: "stop-la-lessing-gymnasium", stopProg: 0.85, dwellSec: 55 },
      { stopId: "stop-la-alfred-delp", stopProg: 0.95, dwellSec: 50 },
    ],
  },
];

/**
 * Hessian School Calendar Validation.
 * Checks if a date is an active school day in Hessen (Mon-Fri, non-holiday, non-school-vacations).
 * Standard vacations in Hessen for 2026:
 * - Osterferien: 2026-03-30 to 2026-04-10
 * - Sommerferien: 2026-06-29 to 2026-08-07
 * - Herbstferien: 2026-10-05 to 2026-10-17
 * - Weihnachtsferien: 2026-12-23 to 2027-01-09
 */
export function isHessenSchoolDay(date: Date = new Date()): boolean {
  const dayOfWeek = date.getDay();
  // Saturday (6) and Sunday (0) are not school days
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // Public holidays in Hessen (fixed dates)
  if (month === 1 && day === 1) return false; // Neujahr
  if (month === 5 && day === 1) return false; // Tag der Arbeit
  if (month === 10 && day === 3) return false; // Tag der Deutschen Einheit
  if (month === 12 && (day === 24 || day === 25 || day === 26 || day === 31)) return false;

  // Sommerferien Hessen (~July - early August)
  if (month === 7 || (month === 8 && day <= 10)) return false;
  // Herbstferien (~October 5 to 18)
  if (month === 10 && day >= 5 && day <= 18) return false;
  // Weihnachtsferien (~Dec 23 to Jan 9)
  if ((month === 12 && day >= 23) || (month === 1 && day <= 9)) return false;

  return true;
}

/**
 * School Bus Heuristic Classification.
 * Evaluates whether a trip is a "Schulbus" based on line code, destination,
 * current time, and school stop proximity.
 */
export function evaluateSchoolBus(
  line: string,
  lineCode: string,
  isDedicatedSchoolLine: boolean | undefined,
  currentStop?: BusStop,
  nextStop?: BusStop,
  date: Date = new Date()
): { isSchoolBus: boolean; reason?: string } {
  // 1. Explicit school line (e.g. 652, 642S)
  if (isDedicatedSchoolLine || lineCode.includes("S") || line === "652") {
    return {
      isSchoolBus: true,
      reason: "Regulärer Schülerverkehr (Linie 652 / Verstärkerfahrt)",
    };
  }

  // 2. Spatial-temporal schedule heuristic:
  // Must be a school day in Hessen
  if (!isHessenSchoolDay(date)) {
    return { isSchoolBus: false };
  }

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const timeMin = hours * 60 + minutes;

  // School time windows:
  // Window 1 (Morgens / Schulbeginn): 07:10 – 07:55 (430 to 475 min)
  const isMorningWindow = timeMin >= 430 && timeMin <= 475;
  // Window 2 (Mittags / Schulschluss 6. Std): 12:45 – 13:35 (765 to 815 min)
  const isNoonWindow = timeMin >= 765 && timeMin <= 815;
  // Window 3 (Nachmittags / Ganztagsschule): 15:00 – 15:45 (900 to 945 min)
  const isAfternoonWindow = timeMin >= 900 && timeMin <= 945;

  const inSchoolWindow = isMorningWindow || isNoonWindow || isAfternoonWindow;
  if (!inSchoolWindow) {
    return { isSchoolBus: false };
  }

  // Check if bus is serving a designated school stop
  const atSchoolStop = currentStop?.isSchoolStop || nextStop?.isSchoolStop;
  if (atSchoolStop) {
    const schoolName = currentStop?.nearbySchoolName || nextStop?.nearbySchoolName || "Schulzentrum";
    let windowName = "Schulbeginn";
    if (isNoonWindow) windowName = "Schulschluss (6. Stunde)";
    if (isAfternoonWindow) windowName = "Schulschluss (Ganztagsunterricht)";

    return {
      isSchoolBus: true,
      reason: `Schulbus-Einsatz für ${schoolName} (${windowName})`,
    };
  }

  return { isSchoolBus: false };
}

/**
 * Calculate Level Crossing (BÜ) Conflict Warning for buses.
 * If bus route approaches BÜ Mainstraße in Bürstadt and the crossing is closed/closing,
 * generate real-time warning with estimated barrier wait time.
 */
export function checkLevelCrossingWarning(busLat: number, busLng: number, line: string): string | undefined {
  if (line !== "642") return undefined;

  const mainstrCrossing = ACTIVE_LEVEL_CROSSINGS.find((c) => c.id === "bu-buerstadt-mainstr");
  if (!mainstrCrossing) return undefined;

  const distToCrossing = haversineMeters(busLat, busLng, mainstrCrossing.lat, mainstrCrossing.lng);
  // If bus is within 450 meters of the level crossing
  if (distToCrossing <= 450) {
    const mobility = calculateRiedMobility(Date.now());
    const liveCrossing = mobility.crossings.find((c) => c.id === "bu-buerstadt-mainstr");
    if (liveCrossing && (liveCrossing.status === "closed" || liveCrossing.status === "closing_soon")) {
      const waitSec = liveCrossing.secondsUntilClearance ?? 90;
      return `⚠️ Schranken-Halt an BÜ Mainstraße (${liveCrossing.status === "closed" ? "geschlossen" : "schließt bald"}, ca. ${waitSec}s Wartezeit für Zug ${liveCrossing.nextTrainLine ?? "RB 63"})`;
    }
  }

  return undefined;
}

/**
 * Calculate Intermodal Train Synchronization at Train Hubs (Bürstadt Bhf, Lampertheim Bhf, Biblis Bhf).
 */
export function checkIntermodalConnection(stop?: BusStop): string | undefined {
  if (!stop?.isTrainHub) return undefined;

  const mobility = calculateRiedMobility(Date.now());
  // Find trains near or dwelling at this station
  for (const train of mobility.trains) {
    if (train.currentStationName?.toLowerCase().includes(stop.municipality.toLowerCase())) {
      return `🚉 Umstieg zu ${train.line} nach ${train.destination} (am Bahnsteig)`;
    }
  }

  if (stop.municipality === "Bürstadt") {
    return "🚉 Direkter Übergang zu Riedbahn (RE 70 / S 9) & Nibelungenbahn (RB 63)";
  } else if (stop.municipality === "Lampertheim") {
    return "🚉 Direkter Übergang zu S-Bahn S 9 & RE 70 (Mannheim / Frankfurt)";
  } else if (stop.municipality === "Biblis") {
    return "🚉 Direkter Übergang zu RE 70 & S 9";
  }

  return undefined;
}

/**
 * High-precision Real-time Simulation & State Calculator for VRN Buses in the Ried.
 * Generates live bus coordinates, stop dwell states with departure countdown gauges,
 * school bus status, and level crossing conflict warnings.
 */
export function calculateBusMobility(timestampMs: number = Date.now()): {
  buses: LiveBus[];
  stops: BusStop[];
} {
  const buses: LiveBus[] = [];
  const now = new Date(timestampMs);
  const nowSec = timestampMs / 1000;

  for (const tour of VRN_BUS_TOURS) {
    const cycleTime = (nowSec - tour.offsetSec) % tour.periodSec;
    const elapsedSec = (cycleTime + tour.periodSec) % tour.periodSec;

    // Stable unique bus cycle ID
    const cycleIndex = Math.floor((nowSec - tour.offsetSec) / tour.periodSec);
    const busId = `${tour.id}-${cycleIndex}`;

    // Total travel progress across the route (0.0 to 1.0)
    const totalProg = Math.max(0, Math.min(1, elapsedSec / tour.periodSec));

    // Check waypoint dwell state
    let isStopped = false;
    let currentStop: BusStop | undefined;
    let nextStop: BusStop | undefined;
    let dwellRemainingSec = 0;
    let dwellTotalSec = 0;
    let dwellProg = 0;

    const dwellWindowProg = 0.04;

    for (let i = 0; i < tour.waypoints.length; i++) {
      const wp = tour.waypoints[i];
      const stop = RIED_BUS_STOPS.find((s) => s.id === wp.stopId);
      const startProg = wp.stopProg - dwellWindowProg / 2;
      const endProg = wp.stopProg + dwellWindowProg / 2;

      if (totalProg >= startProg && totalProg <= endProg) {
        isStopped = true;
        currentStop = stop;
        dwellTotalSec = wp.dwellSec;
        const dwellFraction = (totalProg - startProg) / dwellWindowProg;
        // Gauge goes from 1.0 (just arrived) down to 0.0 (departing)
        dwellProg = Math.max(0, Math.min(1, 1.0 - dwellFraction));
        dwellRemainingSec = Math.max(1, Math.round(dwellProg * wp.dwellSec));
        const nextWp = tour.waypoints[(i + 1) % tour.waypoints.length];
        nextStop = RIED_BUS_STOPS.find((s) => s.id === nextWp.stopId);
        break;
      }

      if (totalProg < wp.stopProg && !nextStop) {
        nextStop = stop;
      }
    }

    if (!nextStop && tour.waypoints.length > 0) {
      const firstWp = tour.waypoints[0];
      nextStop = RIED_BUS_STOPS.find((s) => s.id === firstWp.stopId);
    }

    // Interpolate bus position along route
    let lat: number;
    let lng: number;
    let heading: number;
    let speedKmh: number;

    if (isStopped && currentStop) {
      lat = currentStop.lat;
      lng = currentStop.lng;
      const pos = interpolatePolyline(tour.track, totalProg);
      heading = pos.heading;
      speedKmh = 0;
    } else {
      const pos = interpolatePolyline(tour.track, totalProg);
      lat = Number(pos.lat.toFixed(6));
      lng = Number(pos.lng.toFixed(6));
      heading = pos.heading;
      speedKmh = tour.speedTransitKmh;
    }

    // Check school bus heuristic
    const schoolEval = evaluateSchoolBus(
      tour.line,
      tour.lineCode,
      tour.isSchoolLine,
      currentStop,
      nextStop,
      now
    );

    // Realistic slight delay variation from GTFS-RT simulation (0 to +2 min)
    const simulatedDelaySec = (Math.abs(Math.sin(cycleIndex * 17 + tour.offsetSec)) > 0.6) ? 120 : 0;
    const delayMinutes = Math.round(simulatedDelaySec / 60);

    // Check level crossing warning (BÜ Mainstraße for line 642)
    const crossingWarning = checkLevelCrossingWarning(lat, lng, tour.line);

    // Check train connection info if stopped at hub
    const intermodalInfo = isStopped ? checkIntermodalConnection(currentStop) : undefined;

    buses.push({
      id: busId,
      line: tour.line,
      lineCode: tour.lineCode,
      operator: tour.operator,
      origin: tour.origin,
      destination: tour.destination,
      lat,
      lng,
      heading,
      speedKmh,
      status: isStopped ? "stopped" : "moving",
      currentStopId: currentStop?.id,
      currentStopName: currentStop?.name,
      nextStopId: nextStop?.id,
      nextStopName: nextStop?.name,
      dwellTimeRemainingSec: isStopped ? dwellRemainingSec : undefined,
      dwellTotalSec: isStopped ? dwellTotalSec : undefined,
      dwellProgress: isStopped ? dwellProg : undefined,
      delaySec: simulatedDelaySec,
      delayMinutes,
      isSchoolBus: schoolEval.isSchoolBus,
      schoolBusReason: schoolEval.reason,
      wheelchairAccessible: true, // Modern VRN low-floor fleet
      approachingCrossingWarning: crossingWarning,
      intermodalConnectionInfo: intermodalInfo,
    });
  }

  return {
    buses,
    stops: RIED_BUS_STOPS,
  };
}

/**
 * Generate Live Departure Board for a specific bus stop.
 */
export function getBusStopDepartures(stopId: string, timestampMs: number = Date.now()): BusDeparture[] {
  const stop = RIED_BUS_STOPS.find((s) => s.id === stopId);
  if (!stop) return [];

  const now = new Date(timestampMs);
  const mobility = calculateBusMobility(timestampMs);
  const departures: BusDeparture[] = [];

  // 1. Check if there is currently a bus at this stop
  for (const bus of mobility.buses) {
    if (bus.currentStopId === stopId) {
      departures.push({
        line: bus.line,
        origin: bus.origin,
        destination: bus.destination,
        scheduledTime: "Jetzt",
        estimatedTime: bus.dwellTimeRemainingSec ? `in ${bus.dwellTimeRemainingSec}s` : "Sofort",
        delayMinutes: bus.delayMinutes,
        isSchoolBus: bus.isSchoolBus,
        schoolBusReason: bus.schoolBusReason,
        wheelchairAccessible: bus.wheelchairAccessible,
        platform: stop.platforms?.[0] ?? "Steig 1",
      });
    }
  }

  // 2. Generate regular departures for lines serving this stop
  for (const line of stop.lines) {
    // Determine destination and intervals
    let dest = "Bürstadt Bahnhof";
    let orig = "Worms Hbf";
    if (line === "641") {
      dest = stop.municipality === "Bürstadt" ? "Lampertheim Bahnhof" : "Bürstadt Bahnhof";
      orig = stop.municipality === "Bürstadt" ? "Bürstadt Bahnhof" : "Lampertheim Bahnhof";
    } else if (line === "642") {
      dest = stop.id === "stop-bst-eks" ? "Worms Hbf" : "Bürstadt EKS";
      orig = "Worms Hbf";
    } else if (line === "644") {
      dest = stop.municipality === "Biblis" ? "Worms Hbf" : "Biblis Bahnhof";
      orig = "Biblis Bahnhof";
    } else if (line === "652") {
      dest = "Lampertheim Schulzentrum";
      orig = "Bobstadt Altes Rathaus";
    }

    const nextMinutes1 = 7 + (line.charCodeAt(line.length - 1) % 11);
    const nextMinutes2 = nextMinutes1 + 25;

    const time1 = new Date(timestampMs + nextMinutes1 * 60 * 1000);
    const time2 = new Date(timestampMs + nextMinutes2 * 60 * 1000);

    const schoolEval = evaluateSchoolBus(line, `VRN-${line}`, line === "652", stop, undefined, time1);

    departures.push({
      line,
      origin: orig,
      destination: dest,
      scheduledTime: `${String(time1.getHours()).padStart(2, "0")}:${String(time1.getMinutes()).padStart(2, "0")}`,
      estimatedTime: `in ${nextMinutes1} Min`,
      delayMinutes: 0,
      isSchoolBus: schoolEval.isSchoolBus,
      schoolBusReason: schoolEval.reason,
      wheelchairAccessible: true,
      platform: stop.platforms?.[0] ?? "Steig 1",
    });

    departures.push({
      line,
      origin: orig,
      destination: dest,
      scheduledTime: `${String(time2.getHours()).padStart(2, "0")}:${String(time2.getMinutes()).padStart(2, "0")}`,
      estimatedTime: `in ${nextMinutes2} Min`,
      delayMinutes: 0,
      isSchoolBus: schoolEval.isSchoolBus,
      schoolBusReason: schoolEval.reason,
      wheelchairAccessible: true,
      platform: stop.platforms?.[1] ?? stop.platforms?.[0] ?? "Steig 1",
    });
  }

  return departures.slice(0, 8);
}
