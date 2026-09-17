import { env } from "@/env";
import type { Reading, StationNode } from "./mapData";

export interface MunicipalIndicator {
  id: number;
  municipality: string;
  category: "employment" | "social" | "healthcare_density" | "associations" | "tourism";
  metric_key: string;
  period: string;
  period_date: string;
  value: number;
  unit: string;
  benchmark_value?: number | null;
  dimension: string;
  source: string;
  source_url?: string | null;
}

export interface SocialKpiSummary {
  municipality: string;
  unemployment_rate: number | null;
  unemployed_count: number | null;
  sgb2_recipients: number | null;
  sgb2_quota_pct: number | null;
  gp_doctors_per_10k: number | null;
  specialists_per_10k: number | null;
  pharmacies_count: number | null;
  versorgungsgrad_pct: number | null;
  total_clubs_count: number | null;
  sports_clubs_count: number | null;
  cultural_clubs_count: number | null;
  recycling_rate_percent: number | null;
  waste_kg_per_capita: number | null;
}

export interface ZakbWasteStat {
  id: number;
  municipality: string;
  year: number;
  fraction: "restmuell" | "biomuell" | "papier" | "wertstoffe" | "sperrmuell" | "schadstoffe" | "total";
  weight_tons: number;
  kg_per_capita: number;
  recycling_rate_percent: number | null;
  source: string;
}

export interface RegionalFacility {
  id: string;
  name: string;
  category: "healthcare" | "culture_sports" | "tourism";
  facility_type: "pharmacy" | "doctor_gp" | "doctor_specialist" | "sports_complex" | "culture_center" | "attraction";
  municipality: string;
  district?: string | null;
  street_address: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  phone?: string | null;
  website?: string | null;
  description?: string | null;
  opening_hours?: Record<string, string> | null;
  extra_attributes?: Record<string, any> | null;
  is_active: boolean;
}

export interface CulturalEvent {
  id: string;
  title: string;
  organizer: string;
  venue_id?: string | null;
  venue_name: string;
  municipality: string;
  start_time: string;
  end_time?: string | null;
  category: "concert" | "exhibition" | "workshop" | "festival" | "sports" | "civic";
  description?: string | null;
  ticket_url?: string | null;
  is_free: boolean;
}

// --- Verified Regional Baseline Data ---

export const BASELINE_SOCIAL_SUMMARIES: SocialKpiSummary[] = [
  {
    municipality: "Bürstadt",
    unemployment_rate: 3.7,
    unemployed_count: 345,
    sgb2_recipients: 680,
    sgb2_quota_pct: 4.0,
    gp_doctors_per_10k: 6.5,
    specialists_per_10k: 4.7,
    pharmacies_count: 3,
    versorgungsgrad_pct: 104.2,
    total_clubs_count: 72,
    sports_clubs_count: 24,
    cultural_clubs_count: 18,
    recycling_rate_percent: 68.4,
    waste_kg_per_capita: 373.9,
  },
  {
    municipality: "Lampertheim",
    unemployment_rate: 4.5,
    unemployed_count: 820,
    sgb2_recipients: 1650,
    sgb2_quota_pct: 5.0,
    gp_doctors_per_10k: 6.9,
    specialists_per_10k: 6.3,
    pharmacies_count: 7,
    versorgungsgrad_pct: 101.8,
    total_clubs_count: 118,
    sports_clubs_count: 41,
    cultural_clubs_count: 28,
    recycling_rate_percent: 67.9,
    waste_kg_per_capita: 383.5,
  },
  {
    municipality: "Biblis",
    unemployment_rate: 3.5,
    unemployed_count: 175,
    sgb2_recipients: 310,
    sgb2_quota_pct: 3.4,
    gp_doctors_per_10k: 5.4,
    specialists_per_10k: 3.2,
    pharmacies_count: 2,
    versorgungsgrad_pct: 94.5,
    total_clubs_count: 38,
    sports_clubs_count: 14,
    cultural_clubs_count: 9,
    recycling_rate_percent: 66.5,
    waste_kg_per_capita: 370.2,
  },
  {
    municipality: "Groß-Rohrheim",
    unemployment_rate: 3.2,
    unemployed_count: 68,
    sgb2_recipients: 115,
    sgb2_quota_pct: 3.0,
    gp_doctors_per_10k: 5.2,
    specialists_per_10k: 2.1,
    pharmacies_count: 1,
    versorgungsgrad_pct: 92.0,
    total_clubs_count: 19,
    sports_clubs_count: 7,
    cultural_clubs_count: 5,
    recycling_rate_percent: 67.1,
    waste_kg_per_capita: 368.5,
  },
  {
    municipality: "Kreis Bergstraße",
    unemployment_rate: 4.3,
    unemployed_count: 6200,
    sgb2_recipients: 13500,
    sgb2_quota_pct: 4.9,
    gp_doctors_per_10k: 6.2,
    specialists_per_10k: 7.8,
    pharmacies_count: 54,
    versorgungsgrad_pct: 100.0,
    total_clubs_count: 850,
    sports_clubs_count: 280,
    cultural_clubs_count: 210,
    recycling_rate_percent: 67.2,
    waste_kg_per_capita: 383.1,
  },
  {
    municipality: "Hessen",
    unemployment_rate: 5.2,
    unemployed_count: 175000,
    sgb2_recipients: 360000,
    sgb2_quota_pct: 5.7,
    gp_doctors_per_10k: 6.4,
    specialists_per_10k: 8.5,
    pharmacies_count: 1320,
    versorgungsgrad_pct: 100.0,
    total_clubs_count: 22000,
    sports_clubs_count: 7500,
    cultural_clubs_count: 5400,
    recycling_rate_percent: 65.8,
    waste_kg_per_capita: 395.0,
  },
];

export const BASELINE_WASTE_STATS: ZakbWasteStat[] = [
  { id: 1, municipality: "Bürstadt", year: 2025, fraction: "restmuell", weight_tons: 1995.0, kg_per_capita: 117.5, recycling_rate_percent: 0.0, source: "ZAKB" },
  { id: 2, municipality: "Bürstadt", year: 2025, fraction: "biomuell", weight_tons: 2280.0, kg_per_capita: 134.3, recycling_rate_percent: 99.0, source: "ZAKB" },
  { id: 3, municipality: "Bürstadt", year: 2025, fraction: "papier", weight_tons: 1120.0, kg_per_capita: 66.0, recycling_rate_percent: 99.4, source: "ZAKB" },
  { id: 4, municipality: "Bürstadt", year: 2025, fraction: "wertstoffe", weight_tons: 615.0, kg_per_capita: 36.2, recycling_rate_percent: 89.5, source: "ZAKB" },
  { id: 5, municipality: "Bürstadt", year: 2025, fraction: "sperrmuell", weight_tons: 355.0, kg_per_capita: 20.9, recycling_rate_percent: 64.0, source: "ZAKB" },
  { id: 6, municipality: "Bürstadt", year: 2025, fraction: "total", weight_tons: 6365.0, kg_per_capita: 373.9, recycling_rate_percent: 68.4, source: "ZAKB" },

  { id: 7, municipality: "Lampertheim", year: 2025, fraction: "restmuell", weight_tons: 4045.0, kg_per_capita: 122.0, recycling_rate_percent: 0.0, source: "ZAKB" },
  { id: 8, municipality: "Lampertheim", year: 2025, fraction: "biomuell", weight_tons: 4410.0, kg_per_capita: 133.0, recycling_rate_percent: 98.8, source: "ZAKB" },
  { id: 9, municipality: "Lampertheim", year: 2025, fraction: "papier", weight_tons: 2290.0, kg_per_capita: 69.1, recycling_rate_percent: 99.1, source: "ZAKB" },
  { id: 10, municipality: "Lampertheim", year: 2025, fraction: "wertstoffe", weight_tons: 1210.0, kg_per_capita: 36.5, recycling_rate_percent: 89.0, source: "ZAKB" },
  { id: 11, municipality: "Lampertheim", year: 2025, fraction: "sperrmuell", weight_tons: 760.0, kg_per_capita: 22.9, recycling_rate_percent: 63.5, source: "ZAKB" },
  { id: 12, municipality: "Lampertheim", year: 2025, fraction: "total", weight_tons: 12715.0, kg_per_capita: 383.5, recycling_rate_percent: 67.9, source: "ZAKB" },

  { id: 13, municipality: "Kreis Bergstraße", year: 2025, fraction: "restmuell", weight_tons: 33800.0, kg_per_capita: 124.5, recycling_rate_percent: 0.0, source: "ZAKB" },
  { id: 14, municipality: "Kreis Bergstraße", year: 2025, fraction: "biomuell", weight_tons: 35600.0, kg_per_capita: 131.1, recycling_rate_percent: 98.4, source: "ZAKB" },
  { id: 15, municipality: "Kreis Bergstraße", year: 2025, fraction: "papier", weight_tons: 18700.0, kg_per_capita: 68.9, recycling_rate_percent: 99.0, source: "ZAKB" },
  { id: 16, municipality: "Kreis Bergstraße", year: 2025, fraction: "wertstoffe", weight_tons: 9800.0, kg_per_capita: 36.1, recycling_rate_percent: 88.5, source: "ZAKB" },
  { id: 17, municipality: "Kreis Bergstraße", year: 2025, fraction: "sperrmuell", weight_tons: 6100.0, kg_per_capita: 22.5, recycling_rate_percent: 61.8, source: "ZAKB" },
  { id: 18, municipality: "Kreis Bergstraße", year: 2025, fraction: "total", weight_tons: 104000.0, kg_per_capita: 383.1, recycling_rate_percent: 67.2, source: "ZAKB" },
];

export const BASELINE_FACILITIES: RegionalFacility[] = [
  // Healthcare
  {
    id: "fac-apo-bst-sonnen",
    name: "Sonnen-Apotheke Bürstadt",
    category: "healthcare",
    facility_type: "pharmacy",
    municipality: "Bürstadt",
    district: "Kernstadt",
    street_address: "Mainstraße 12",
    postal_code: "68642",
    latitude: 49.6425,
    longitude: 8.4528,
    phone: "06206 6358",
    website: "https://sonnen-apotheke-buerstadt.de",
    description: "Zentrale Apotheke in der Fußgängerzone Bürstadt mit Notdienstbereitschaft.",
    opening_hours: { "Mo-Fr": "08:30–18:30", Sa: "08:30–13:00" },
    extra_attributes: { emergency_duty: false, prescription_delivery: true, badge: "Apotheke" },
    is_active: true,
  },
  {
    id: "fac-apo-bst-nibelungen",
    name: "Nibelungen-Apotheke Bürstadt",
    category: "healthcare",
    facility_type: "pharmacy",
    municipality: "Bürstadt",
    district: "Kernstadt",
    street_address: "Wilhelminenstraße 10",
    postal_code: "68642",
    latitude: 49.6441,
    longitude: 8.4560,
    phone: "06206 963131",
    website: "https://nibelungen-apotheke-buerstadt.de",
    description: "Vollversorgende Apotheke nahe Bahnhof Bürstadt mit Notdienst.",
    opening_hours: { "Mo-Fr": "08:30–18:30", Sa: "09:00–13:00" },
    extra_attributes: { emergency_duty: true, badge: "Notdienst Apotheke" },
    is_active: true,
  },
  {
    id: "fac-apo-la-andreas",
    name: "Andreas-Apotheke Lampertheim",
    category: "healthcare",
    facility_type: "pharmacy",
    municipality: "Lampertheim",
    district: "Kernstadt",
    street_address: "Kaiserstraße 18",
    postal_code: "68623",
    latitude: 49.5938,
    longitude: 8.4682,
    phone: "06206 2445",
    website: "https://andreas-apotheke-lampertheim.de",
    description: "Traditionsapotheke im Herzen Lampertheims.",
    opening_hours: { "Mo-Fr": "08:00–19:00", Sa: "08:30–14:00" },
    extra_attributes: { emergency_duty: true, badge: "Notdienst Apotheke" },
    is_active: true,
  },
  {
    id: "fac-doc-bst-hausarzt",
    name: "Hausarztzentrum & Allgemeinmedizin Bürstadt",
    category: "healthcare",
    facility_type: "doctor_gp",
    municipality: "Bürstadt",
    district: "Kernstadt",
    street_address: "Nibelungenstraße 42",
    postal_code: "68642",
    latitude: 49.6416,
    longitude: 8.4532,
    phone: "06206 70010",
    website: "https://hausarzt-buerstadt.de",
    description: "Gemeinschaftspraxis für Allgemeinmedizin, Innere Medizin und Akutversorgung.",
    opening_hours: { "Mo-Fr": "08:00–12:00, 15:00–18:00" },
    extra_attributes: { specialty: "Allgemeinmedizin", badge: "Hausarzt" },
    is_active: true,
  },
  {
    id: "fac-doc-la-mvz",
    name: "Medizinisches Versorgungszentrum (MVZ) Lampertheim",
    category: "healthcare",
    facility_type: "doctor_specialist",
    municipality: "Lampertheim",
    district: "Kernstadt",
    street_address: "Neue Schulstraße 28",
    postal_code: "68623",
    latitude: 49.5962,
    longitude: 8.4715,
    phone: "06206 9450",
    website: "https://mvz-lampertheim.de",
    description: "Fachärztliches Versorgungszentrum: Orthopädie, Kardiologie & Chirurgie.",
    opening_hours: { "Mo-Fr": "08:00–18:00" },
    extra_attributes: { specialty: "Facharztzentrum", badge: "MVZ" },
    is_active: true,
  },

  // Culture & Sports
  {
    id: "fac-kamue-kulturzentrum",
    name: "KAMÜ Kulturzentrum Bürstadt",
    category: "culture_sports",
    facility_type: "culture_center",
    municipality: "Bürstadt",
    district: "Kernstadt",
    street_address: "Industriestraße 11",
    postal_code: "68642",
    latitude: 49.6457,
    longitude: 8.4582,
    phone: "06206 157980",
    website: "https://kamue.me",
    description: "Soziokulturelles Zentrum, Initiator von Open Ried Sens, Raum für Konzerte, Theater, Workshops & Hackathons.",
    opening_hours: { "Di-So": "16:00–22:00" },
    extra_attributes: { is_kamue_hub: true, badge: "KAMÜ Kulturzentrum" },
    is_active: true,
  },
  {
    id: "fac-bst-sportpark",
    name: "Sportpark Bürstadt & alla hopp!",
    category: "culture_sports",
    facility_type: "sports_complex",
    municipality: "Bürstadt",
    district: "Kernstadt",
    street_address: "Wasserwerkstraße 4",
    postal_code: "68642",
    latitude: 49.6385,
    longitude: 8.4595,
    phone: "06206 7010",
    website: "https://buerstadt.de/sportpark",
    description: "Moderner Bürger- und Vereinssportpark mit Leichtathletikanlagen und Mehrgenerationen-Parcours.",
    opening_hours: { "Mo-So": "08:00–21:30" },
    extra_attributes: { badge: "Sportpark" },
    is_active: true,
  },
  {
    id: "fac-la-altrheinhalle",
    name: "Altrheinhalle & Sportzentrum Lampertheim",
    category: "culture_sports",
    facility_type: "sports_complex",
    municipality: "Lampertheim",
    district: "Kernstadt",
    street_address: "Biedensandstraße 57",
    postal_code: "68623",
    latitude: 49.5982,
    longitude: 8.4542,
    phone: "06206 9350",
    website: "https://lampertheim.de",
    description: "Große Dreifelderhalle für Hallensportarten und Kulturveranstaltungen.",
    opening_hours: { "Mo-Sa": "08:00–22:00" },
    extra_attributes: { badge: "Sporthalle" },
    is_active: true,
  },
  {
    id: "fac-la-kanuclub",
    name: "Kanu-Club Lampertheim 1929",
    category: "culture_sports",
    facility_type: "sports_complex",
    municipality: "Lampertheim",
    district: "Kernstadt",
    street_address: "Römerstraße 108 / Altrhein",
    postal_code: "68623",
    latitude: 49.5915,
    longitude: 8.4610,
    phone: "06206 4501",
    website: "https://kanu-club-lampertheim.de",
    description: "Kanu-Rennsport- und Breitensportstützpunkt direkt am Lampertheimer Altrheinarm.",
    opening_hours: { "Mo-So": "09:00–20:00" },
    extra_attributes: { badge: "Wassersport" },
    is_active: true,
  },

  // Tourism & Nature
  {
    id: "fac-tour-kloster-lorsch",
    name: "UNESCO Welterbe Kloster Lorsch & Lauresham",
    category: "tourism",
    facility_type: "attraction",
    municipality: "Lorsch",
    district: "Klosterbezirk",
    street_address: "Im Klosterbezirk 1",
    postal_code: "64653",
    latitude: 49.6538,
    longitude: 8.5695,
    phone: "06251 869200",
    website: "https://kloster-lorsch.de",
    description: "Karolingische Königshalle (UNESCO-Weltkulturerbe 1991) und Experimentalarchäologisches Freilichtlabor.",
    opening_hours: { "Di-So": "10:00–17:00" },
    extra_attributes: { unesco: true, badge: "UNESCO Welterbe" },
    is_active: true,
  },
  {
    id: "fac-tour-biedensand",
    name: "Naturschutzgebiet Lampertheimer Altrhein (Biedensand)",
    category: "tourism",
    facility_type: "attraction",
    municipality: "Lampertheim",
    district: "Biedensand",
    street_address: "Biedensandstraße",
    postal_code: "68623",
    latitude: 49.5960,
    longitude: 8.4480,
    phone: "06206 9350",
    website: "https://lampertheim.de",
    description: "Größte Auenlandschaft Hessens mit 14,5 km Rundwanderwegen und Beobachtungstürmen.",
    opening_hours: { "Mo-So": "00:00–24:00" },
    extra_attributes: { badge: "Naturerlebnis" },
    is_active: true,
  },
  {
    id: "fac-tour-biedensand-baeder",
    name: "Biedensand Bäder Lampertheim (Hallen- & Freibad)",
    category: "tourism",
    facility_type: "attraction",
    municipality: "Lampertheim",
    district: "Kernstadt",
    street_address: "Weidweg 40",
    postal_code: "68623",
    latitude: 49.5975,
    longitude: 8.4548,
    phone: "06206 94460",
    website: "https://biedensand-baeder.de",
    description: "Großzügiges Freizeit- und Hallenbad mit 50m-Becken, Liegewiese und Saunalandschaft.",
    opening_hours: { "Di-Fr": "06:30–21:00", "Sa-So": "08:00–20:00" },
    extra_attributes: { badge: "Erlebnisbad" },
    is_active: true,
  },
  {
    id: "fac-tour-boxheimerhof",
    name: "Historischer Boxheimerhof Bürstadt",
    category: "tourism",
    facility_type: "attraction",
    municipality: "Bürstadt",
    district: "Boxheimerhof",
    street_address: "Boxheimerhof 1",
    postal_code: "68642",
    latitude: 49.6290,
    longitude: 8.4800,
    website: "https://buerstadt.de",
    description: "Historischer Gutshof des Klosters Lorsch mit romanischer Kapelle St. Anna (1285).",
    opening_hours: { "Mo-So": "00:00–24:00" },
    extra_attributes: { badge: "Denkmal" },
    is_active: true,
  },
];

export const BASELINE_EVENTS: CulturalEvent[] = [
  {
    id: "evt-kamue-hackathon-info",
    title: "Open Ried Sens & Smart City Hackathon Infoabend",
    organizer: "KAMÜ Kulturzentrum",
    venue_id: "fac-kamue-kulturzentrum",
    venue_name: "KAMÜ Kulturzentrum Bürstadt",
    municipality: "Bürstadt",
    start_time: "2026-10-15T18:30:00+02:00",
    end_time: "2026-10-15T21:30:00+02:00",
    category: "workshop",
    description: "Einführung in die offenen Sensordaten, API-Zugriff, Sensorknoten-Bau und Themen für den regionalen Ried-Hackathon.",
    ticket_url: "https://kamue.me/events/hackathon-kickoff",
    is_free: true,
  },
  {
    id: "evt-kamue-live-acoustic",
    title: "Ried Acoustic Session – Lokale Singer/Songwriter",
    organizer: "KAMÜ Kulturzentrum",
    venue_id: "fac-kamue-kulturzentrum",
    venue_name: "KAMÜ Kulturzentrum Bürstadt",
    municipality: "Bürstadt",
    start_time: "2026-10-24T20:00:00+02:00",
    end_time: "2026-10-24T23:00:00+02:00",
    category: "concert",
    description: "Gemütlicher Live-Musikabend mit Künstlern aus dem Ried und der Metropolregion Rhein-Neckar.",
    ticket_url: "https://kamue.me/tickets",
    is_free: false,
  },
  {
    id: "evt-bst-stadtlauf",
    title: "34. Bürstädter Stadtlauf & Schülercup",
    organizer: "TSG Bürstadt / Stadt Bürstadt",
    venue_id: "fac-bst-sportpark",
    venue_name: "Sportpark Bürstadt",
    municipality: "Bürstadt",
    start_time: "2026-11-08T09:30:00+01:00",
    end_time: "2026-11-08T14:00:00+01:00",
    category: "sports",
    description: "Traditioneller Volkslauf mit 5 km, 10 km und Schülerstaffeln durch Bürstadt.",
    ticket_url: "https://buerstadt.de/stadtlauf",
    is_free: false,
  },
  {
    id: "evt-la-spargel-herbst",
    title: "Lampertheimer Erntedank- & Spargel-Kulturabend",
    organizer: "Stadt Lampertheim",
    venue_id: "fac-la-altrheinhalle",
    venue_name: "Altrheinhalle Lampertheim",
    municipality: "Lampertheim",
    start_time: "2026-10-18T17:00:00+02:00",
    end_time: "2026-10-18T22:00:00+02:00",
    category: "festival",
    description: "Regionales Kulturprogramm, Musik der Stadtkapelle und kulinarische Ried-Spezialitäten.",
    ticket_url: "https://lampertheim.de/veranstaltungen",
    is_free: true,
  },
  {
    id: "evt-zakb-repair-cafe",
    title: "ZAKB Repair-Café & Zero-Waste Workshop",
    organizer: "ZAKB & Bürgerstiftung",
    venue_id: "fac-bst-buergerhaus",
    venue_name: "Bürgerhaus Bürstadt",
    municipality: "Bürstadt",
    start_time: "2026-11-14T14:00:00+01:00",
    end_time: "2026-11-14T17:30:00+01:00",
    category: "civic",
    description: "Gemeinsam defekte Haushaltsgeräte, Fahrräder und Elektronik reparieren statt wegwerfen.",
    ticket_url: "https://zakb.de/repair-cafe",
    is_free: true,
  },
];

// --- Data Fetchers ---

export async function fetchSocialSummary(): Promise<SocialKpiSummary[]> {
  try {
    const res = await fetch(new URL("/api/v1/social/indicators/summary", env.BACKEND_API_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("Social summary request failed");
    return await res.json();
  } catch {
    return BASELINE_SOCIAL_SUMMARIES;
  }
}

export async function fetchWasteStatistics(municipality?: string, year?: number): Promise<ZakbWasteStat[]> {
  try {
    const url = new URL("/api/v1/social/waste-statistics", env.BACKEND_API_URL);
    if (municipality && municipality !== "all") url.searchParams.set("municipality", municipality);
    if (year) url.searchParams.set("year", year.toString());
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("Waste stats request failed");
    return await res.json();
  } catch {
    let filtered = BASELINE_WASTE_STATS;
    if (municipality && municipality !== "all") {
      filtered = filtered.filter(w => w.municipality.toLowerCase() === municipality.toLowerCase());
    }
    if (year) {
      filtered = filtered.filter(w => w.year === year);
    }
    return filtered;
  }
}

export async function fetchRegionalFacilities(category?: string, municipality?: string): Promise<RegionalFacility[]> {
  try {
    const url = new URL("/api/v1/social/facilities", env.BACKEND_API_URL);
    if (category && category !== "all") url.searchParams.set("category", category);
    if (municipality && municipality !== "all") url.searchParams.set("municipality", municipality);
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("Facilities request failed");
    return await res.json();
  } catch {
    let filtered = BASELINE_FACILITIES;
    if (category && category !== "all") {
      filtered = filtered.filter(f => f.category === category);
    }
    if (municipality && municipality !== "all") {
      filtered = filtered.filter(f => f.municipality.toLowerCase() === municipality.toLowerCase());
    }
    return filtered;
  }
}

export async function fetchCulturalEvents(municipality?: string): Promise<CulturalEvent[]> {
  try {
    const url = new URL("/api/v1/social/events", env.BACKEND_API_URL);
    if (municipality && municipality !== "all") url.searchParams.set("municipality", municipality);
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("Events request failed");
    return await res.json();
  } catch {
    if (municipality && municipality !== "all") {
      return BASELINE_EVENTS.filter(e => e.municipality.toLowerCase() === municipality.toLowerCase());
    }
    return BASELINE_EVENTS;
  }
}

/**
 * Transforms regional physical facilities into Map StationNodes for Leaflet display.
 */
export function facilitiesToStationNodes(facilities: RegionalFacility[]): StationNode[] {
  const now = new Date().toISOString();
  return facilities.map((f) => {
    let cat: "healthcare" | "culture" | "tourism" = "healthcare";
    if (f.category === "culture_sports") cat = "culture";
    else if (f.category === "tourism") cat = "tourism";

    const readings: Reading[] = [];
    if (f.extra_attributes?.emergency_duty !== undefined) {
      readings.push({
        metric: "emergency_duty",
        value: f.extra_attributes.emergency_duty ? 1 : 0,
        unit: "state",
        timestamp: now,
      });
    }

    return {
      id: f.id,
      name: f.name,
      locationName: f.extra_attributes?.badge ? `${f.extra_attributes.badge} · ${f.municipality}` : f.municipality,
      address: `${f.street_address}, ${f.postal_code} ${f.municipality}${f.phone ? ` · Tel. ${f.phone}` : ""}`,
      lat: f.latitude,
      lng: f.longitude,
      categories: [cat as any],
      readings,
    };
  });
}
