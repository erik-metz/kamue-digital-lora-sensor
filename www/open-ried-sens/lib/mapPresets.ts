import { MAP_LAYER_IDS, type MapLayerId, DEFAULT_MAP_LAYERS } from "./urlState";

export type LayerCategory = "mobility" | "environment" | "infrastructure" | "planning";

export interface LayerMetadata {
  id: MapLayerId;
  label: string;
  icon: string;
  category: LayerCategory;
  description: string;
  minZoom?: number;
  highlightColor?: string;
}

export const LAYER_CATEGORIES: Record<LayerCategory, {
  label: string;
  icon: string;
  description: string;
}> = {
  mobility: {
    label: "Mobilität & Verkehr",
    icon: "🚗",
    description: "Straßenverkehr, Sperrungen, ÖPNV, Bahnübergänge & Ladeinfrastruktur",
  },
  environment: {
    label: "Umwelt & Gewässer",
    icon: "🌿",
    description: "Naturschutzgebiete, Hochwasser- & Flusspegel, Starkregen und Agrarflächen",
  },
  infrastructure: {
    label: "Infrastruktur & Digitales",
    icon: "⚡",
    description: "Erneuerbare Energien, KI-Straßenzustand, WLAN-Hotspots & Breitband",
  },
  planning: {
    label: "Planung & Kommunales",
    icon: "🏛️",
    description: "Bodenrichtwerte, Bebauungspläne, Kommunalpolitik, Betriebe & Müllabfuhr",
  },
};

export const LAYER_DEFINITIONS: Record<MapLayerId, LayerMetadata> = {
  // Mobility & Traffic
  closures: {
    id: "closures",
    label: "Sperrungen",
    icon: "⛔",
    category: "mobility",
    description: "Aktuelle und geplante Straßensperrungen & Baustellen im Ried",
    highlightColor: "border-red-500 text-red-300",
  },
  traffic: {
    id: "traffic",
    label: "Verkehrslage",
    icon: "🚗",
    category: "mobility",
    description: "Echtzeit-Verkehrslage, Staus und Verzögerungen auf Ried-Hauptachsen",
    highlightColor: "border-amber-500 text-amber-300",
  },
  buses: {
    id: "buses",
    label: "VRN Busse",
    icon: "🚌",
    category: "mobility",
    description: "Fahrplanbasierte Live-Positionen der VRN-Buslinien im Ried",
    highlightColor: "border-sky-500 text-sky-300",
  },
  stops: {
    id: "stops",
    label: "Haltestellen",
    icon: "🚏",
    category: "mobility",
    description: "VRN-Bushaltestellen mit Richtungssteigen & Abfahrten (sichtbar ab Zoom 13)",
    minZoom: 13,
    highlightColor: "border-amber-500 text-amber-300",
  },
  trains: {
    id: "trains",
    label: "Züge & BÜ",
    icon: "🚅",
    category: "mobility",
    description: "Riedbahn & Nibelungenbahn Live-Züge und aktive Bahnübergänge mit Schrankenstatus",
    highlightColor: "border-sky-500 text-sky-300",
  },
  charging: {
    id: "charging",
    label: "Ladesäulen",
    icon: "⚡",
    category: "mobility",
    description: "Öffentliche Elektro-Ladesäulen und Live-Belegungsstatus",
    highlightColor: "border-emerald-400 text-emerald-300",
  },

  // Environment & Water
  nature: {
    id: "nature",
    label: "Naturschutz",
    icon: "🌿",
    category: "environment",
    description: "Naturschutzgebiete (Biedensand, Lampertheimer Altrhein, Weschnitzinsel)",
    highlightColor: "border-emerald-500 text-emerald-300",
  },
  floods: {
    id: "floods",
    label: "Flusspegel",
    icon: "🌊",
    category: "environment",
    description: "Offizielle Rhein-Pegel (Worms) & Weschnitz-Pegel mit Alarmstufen",
    highlightColor: "border-sky-400 text-sky-300",
  },
  starkregen: {
    id: "starkregen",
    label: "Starkregen-WMS",
    icon: "🌧️",
    category: "environment",
    description: "Offizielle HLNUG Starkregengefahrenkarte Hessen (Fließwege & Überflutung)",
    highlightColor: "border-blue-500 text-blue-300",
  },
  crops: {
    id: "crops",
    label: "Agrarkulturen",
    icon: "🌾",
    category: "environment",
    description: "Spargelanbau, Gemüseflächen und Ackerschläge im Ried (sichtbar ab Zoom 13)",
    minZoom: 13,
    highlightColor: "border-purple-400 text-purple-300",
  },

  // Infrastructure & Energy
  energy: {
    id: "energy",
    label: "Ökostrom",
    icon: "☀️",
    category: "infrastructure",
    description: "ZAKB Energiepark Hüttenfeld, Biogasanlagen & Solarparks im Ried",
    highlightColor: "border-amber-400 text-amber-300",
  },
  road: {
    id: "road",
    label: "Straßen-KI",
    icon: "🛣️",
    category: "infrastructure",
    description: "KI-basierte Fahrbahnbewertung durch ZAKB-Flottensensorik",
    highlightColor: "border-lime-400 text-lime-300",
  },
  wifi: {
    id: "wifi",
    label: "WLAN",
    icon: "📶",
    category: "infrastructure",
    description: "Öffentliche WLAN-Hotspots (Hessen-WLAN & Freifunk Ried)",
    highlightColor: "border-cyan-400 text-cyan-300",
  },
  broadband: {
    id: "broadband",
    label: "Glasfaser",
    icon: "🌐",
    category: "infrastructure",
    description: "Breitband- und Glasfaser-Ausbaugebiete im Ried",
    highlightColor: "border-purple-400 text-purple-300",
  },

  // Planning & Municipal
  boris: {
    id: "boris",
    label: "Bodenrichtwerte",
    icon: "🏡",
    category: "planning",
    description: "Offizielle BORIS Hessen Bodenrichtwertzonen (€/m² Wohnbauland)",
    highlightColor: "border-teal-400 text-teal-300",
  },
  devplans: {
    id: "devplans",
    label: "B-Pläne",
    icon: "🏗️",
    category: "planning",
    description: "Bebauungspläne und Neubaugebiete in Bürstadt, Lampertheim & Biblis",
    highlightColor: "border-amber-400 text-amber-300",
  },
  elections: {
    id: "elections",
    label: "Wahlbezirke",
    icon: "🗳️",
    category: "planning",
    description: "Stimmbezirke und historische Wahlbeteiligung der Kommunalwahlen",
    highlightColor: "border-purple-400 text-purple-300",
  },
  companies: {
    id: "companies",
    label: "Arbeitgeber",
    icon: "🏢",
    category: "planning",
    description: "Bedeutende Industrie- & Gewerbearbeitgeber im Ried",
    highlightColor: "border-sky-400 text-sky-300",
  },
  waste: {
    id: "waste",
    label: "Müllabfuhr",
    icon: "🚛",
    category: "planning",
    description: "Live-Fahrzeuge der ZAKB Müllabfuhr und Sammeltouren im Ried",
    highlightColor: "border-emerald-500 text-emerald-300",
  },
};

export type LayerPresetId = "default" | "sensors_only" | "mobility" | "environment" | "planning";

export interface LayerPreset {
  id: LayerPresetId;
  label: string;
  icon: string;
  shortLabel: string;
  description: string;
  layers: Record<MapLayerId, boolean>;
}

export const LAYER_PRESETS: Record<LayerPresetId, LayerPreset> = {
  default: {
    id: "default",
    label: "Standard-Ansicht",
    shortLabel: "Standard",
    icon: "🌟",
    description: "Ausgewogene Ried-Übersicht mit Kern-Ebenen",
    layers: DEFAULT_MAP_LAYERS,
  },
  sensors_only: {
    id: "sensors_only",
    label: "Nur Sensoren",
    shortLabel: "Nur Sensoren",
    icon: "🎯",
    description: "Maximaler Fokus auf IoT-Messwerte ohne Geodaten-Overlays",
    layers: {
      nature: false,
      crops: false,
      floods: false,
      starkregen: false,
      charging: false,
      energy: false,
      road: false,
      wifi: false,
      broadband: false,
      boris: false,
      devplans: false,
      elections: false,
      companies: false,
      closures: false,
      traffic: false,
      buses: false,
      stops: false,
      waste: false,
      trains: false,
    },
  },
  mobility: {
    id: "mobility",
    label: "Mobilität & Verkehr",
    shortLabel: "Mobilität",
    icon: "🚗",
    description: "Sperrungen, Staus, Live-Busse, Haltestellen, Züge & Ladesäulen",
    layers: {
      nature: false,
      crops: false,
      floods: false,
      starkregen: false,
      charging: true,
      energy: false,
      road: true,
      wifi: false,
      broadband: false,
      boris: false,
      devplans: false,
      elections: false,
      companies: false,
      closures: true,
      traffic: true,
      buses: true,
      stops: true,
      waste: true,
      trains: true,
    },
  },
  environment: {
    id: "environment",
    label: "Umwelt & Gewässer",
    shortLabel: "Umwelt",
    icon: "🌿",
    description: "Naturschutzgebiete, Flusspegel, Starkregen-WMS & Agrarkulturen",
    layers: {
      nature: true,
      crops: true,
      floods: true,
      starkregen: true,
      charging: false,
      energy: true,
      road: false,
      wifi: false,
      broadband: false,
      boris: false,
      devplans: false,
      elections: false,
      companies: false,
      closures: false,
      traffic: false,
      buses: false,
      stops: false,
      waste: false,
      trains: false,
    },
  },
  planning: {
    id: "planning",
    label: "Planung & Bauen",
    shortLabel: "Planung",
    icon: "🏛️",
    description: "Bodenrichtwerte (BORIS), B-Pläne, Glasfaser, Gewerbe & ZAKB",
    layers: {
      nature: false,
      crops: false,
      floods: false,
      starkregen: false,
      charging: false,
      energy: false,
      road: false,
      wifi: true,
      broadband: true,
      boris: true,
      devplans: true,
      elections: true,
      companies: true,
      closures: false,
      traffic: false,
      buses: false,
      stops: false,
      waste: true,
      trains: false,
    },
  },
};

export const PRESET_IDS: LayerPresetId[] = ["default", "sensors_only", "mobility", "environment", "planning"];

export function getLayersByCategory(category: LayerCategory): LayerMetadata[] {
  return MAP_LAYER_IDS
    .map((id) => LAYER_DEFINITIONS[id])
    .filter((meta) => meta.category === category);
}

export function countActiveLayers(layers: Record<MapLayerId, boolean>): number {
  return MAP_LAYER_IDS.reduce((acc, id) => (layers[id] ? acc + 1 : acc), 0);
}

export function countCategoryActiveLayers(
  category: LayerCategory,
  layers: Record<MapLayerId, boolean>
): { active: number; total: number } {
  const items = getLayersByCategory(category);
  const active = items.reduce((acc, item) => (layers[item.id] ? acc + 1 : acc), 0);
  return { active, total: items.length };
}

export function detectActivePreset(layers: Record<MapLayerId, boolean>): LayerPresetId | "custom" {
  for (const presetId of PRESET_IDS) {
    const presetLayers = LAYER_PRESETS[presetId].layers;
    const isMatch = MAP_LAYER_IDS.every((id) => Boolean(layers[id]) === Boolean(presetLayers[id]));
    if (isMatch) return presetId;
  }
  return "custom";
}
