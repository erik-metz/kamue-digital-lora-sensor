/** Presentation only: all locations and values are supplied by the backend. */
export const MAP_SYMBOLS: Record<string, { label: string; symbol: string; color: string }> = {
  vehicles: { label: "Fahrzeuge · zum Vergrößern anklicken", symbol: "↔", color: "#38bdf8" },
  education: { label: "Schule / Bildung", symbol: "🏫", color: "#38bdf8" },
  healthcare: { label: "Gesundheit", symbol: "✚", color: "#34d399" },
  culture: { label: "Kultur & Freizeit", symbol: "🎭", color: "#f472b6" },
  places: { label: "Öffentlicher Ort", symbol: "🏫", color: "#38bdf8" },
  crossings: { label: "Bahnübergang", symbol: "🚧", color: "#fbbf24" },
  bus: { label: "Bus", symbol: "🚌", color: "#38bdf8" },
  ship: { label: "Schiff", symbol: "🚢", color: "#22d3ee" },
  train: { label: "Zug", symbol: "🚆", color: "#c084fc" },
  waste: { label: "Abfallsammlung", symbol: "🚛", color: "#fb923c" },
  stops: { label: "Haltestelle", symbol: "H", color: "#facc15" },
  charging: { label: "Ladestation", symbol: "⚡", color: "#34d399" },
  energy: { label: "Ökostrom / Solaranlage", symbol: "☀", color: "#fbbf24" },
  traffic: { label: "Verkehrsmeldung", symbol: "⚠", color: "#fb923c" },
  corridor: { label: "Verkehrsachse", symbol: "🚗", color: "#10b981" },
  closures: { label: "Sperrung", symbol: "⛔", color: "#ef4444" },
  roadwork: { label: "Baustelle", symbol: "🚧", color: "#f59e0b" },
  wifi: { label: "WLAN", symbol: "📶", color: "#22d3ee" },
  companies: { label: "Unternehmen", symbol: "🏭", color: "#a78bfa" },
  nature: { label: "Schutzgebiet", symbol: "🌳", color: "#4ade80" },
  crops: { label: "Landwirtschaft", symbol: "🌾", color: "#a3e635" },
  floods: { label: "Gewässer / Pegel", symbol: "≈", color: "#38bdf8" },
  road: { label: "Straße", symbol: "↔", color: "#94a3b8" },
  broadband: { label: "Breitband", symbol: "⌁", color: "#22d3ee" },
  boris: { label: "Bodenrichtwert", symbol: "€", color: "#fbbf24" },
  devplans: { label: "Bebauungsplan", symbol: "▤", color: "#a78bfa" },
  elections: { label: "Wahlbezirk", symbol: "✓", color: "#c084fc" },
  lora: { label: "LoRaWAN Gateway", symbol: "📡", color: "#06b6d4" },
  lora_gateway: { label: "LoRaWAN Gateway", symbol: "📡", color: "#06b6d4" },
  emf: { label: "Funkanlage / Mobilfunk", symbol: "🗼", color: "#0284c7" },
  radio_tower: { label: "Funkanlage / Mobilfunk", symbol: "🗼", color: "#0284c7" },
};

export function mapSymbol(kind: string) {
  return MAP_SYMBOLS[kind] ?? { label: "Standort", symbol: "⌖", color: "#94a3b8" };
}

export function placeMarker(kind: string, label = "", predicted = false, direction?: number): HTMLElement {
  const style = mapSymbol(kind);
  const root = document.createElement("div");
  root.className = `map-place-marker${predicted ? " map-place-predicted" : ""}${kind === "stops" ? " map-place-stop" : ""}`;
  root.style.setProperty("--place-color", style.color);
  root.title = `${style.label}${label ? ` · ${label}` : ""}`;
  const icon = document.createElement("span");
  icon.textContent = style.symbol;
  icon.setAttribute("aria-hidden", "true");
  root.append(icon);
  if (kind === "ship" && direction !== undefined && Number.isFinite(direction) && direction >= 0 && direction < 360) {
    const arrow = document.createElement("span");
    arrow.textContent = "▲";
    arrow.style.display = "inline-block";
    arrow.style.transform = `rotate(${direction}deg)`;
    arrow.setAttribute("aria-hidden", "true");
    root.append(arrow);
  }
  if (label) {
    const badge = document.createElement("span");
    badge.className = "map-place-label";
    badge.textContent = label;
    root.append(badge);
  }
  return root;
}

export function detailCard(title: string, subtitle: string, rows: string[]): HTMLElement {
  const root = document.createElement("section");
  root.className = "map-detail-card";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const description = document.createElement("p");
  description.className = "map-detail-subtitle";
  description.textContent = subtitle;
  root.append(heading, description);
  for (const value of rows) {
    const row = document.createElement("p");
    row.textContent = value;
    root.append(row);
  }
  return root;
}

const FIELD_LABELS: Record<string, string> = {
  level_m: "Wasserstand (m)", measured_at: "Messzeitpunkt", source: "Quelle", barrier: "Schrankenanlage",
  totalPoints: "Ladepunkte", maxPowerKw: "Max. Ladeleistung (kW)", availablePoints: "Freie Ladepunkte",
  installedCapacityKw: "Installierte Leistung (kW)", currentPowerKw: "Aktuelle Leistung (kW)",
  sourceUpdatedAt: "Quellenstand",
  operator: "Betreiber", facility_type: "Anlagentyp", facilityType: "Anlagentyp", power_source: "Energieträger",
  address: "Adresse", street: "Straße", house_number: "Hausnummer",
  municipality: "Gemeinde", district: "Ortsteil", city: "Ort", postcode: "Postleitzahl", postal_code: "Postleitzahl",
  total_points: "Ladepunkte", charging_points: "Ladepunkte", available_points: "Freie Ladepunkte",
  max_power_kw: "Max. Ladeleistung (kW)", power_kw: "Leistung (kW)", installed_capacity_kw: "Installierte Leistung (kW)",
  current_power_kw: "Aktuelle Leistung (kW)", connector_type: "Anschluss", industry: "Branche",
  ssid: "Netzwerk", description: "Beschreibung", road_name: "Straße", road: "Straße",
  direction: "Richtung", location_from: "Von", location_to: "Bis", title: "Meldung",
  start_time: "Beginn", end_time: "Ende", valid_from: "Gültig ab", valid_until: "Gültig bis",
  delay_minutes: "Verzögerung (Min.)", length_km: "Länge (km)", name: "Name",
  reason: "Grund", detour: "Umleitung", closure_type: "Sperrungsart", status: "Verkehrsstatus",
  active_incidents_count: "Aktive Meldungen",
  gateway_eui: "Gateway EUI", eui: "Gateway EUI", online_status: "Status",
  placement: "Montage", antenna_placement: "Montage", cluster_id: "TTN Cluster",
  antenna_count: "Antennenanzahl", frequency_plan: "Frequenzplan",
  stob_nr: "STOB-Nummer", stob_date: "Erteilt am", method_stob: "Bewertungsverfahren",
  providers: "Mobilfunkbetreiber", max_height_m: "Max. Antennenhöhe (m)",
  max_safety_distance_h_m: "Horiz. Sicherheitsabstand (m)",
};

export function featureKind(kind: string, values: Record<string, unknown>): string {
  if (kind === "closures") {
    const isRoadwork = values.cause_type === "roadwork"
      || values.closure_type === "partial"
      || values.closure_type === "lane_restriction"
      || String(values.description ?? "").toLowerCase().includes("baustelle")
      || String(values.reason ?? "").toLowerCase().includes("baustelle")
      || String(values.reason ?? "").toLowerCase().includes("bauarbeiten")
      || String(values.reason ?? "").toLowerCase().includes("instandsetzung");
    return isRoadwork ? "roadwork" : "closures";
  }
  if (kind === "traffic" && values.kind === "corridor") return "corridor";
  if (kind !== "places") return kind;
  if (["school", "kindergarten", "university", "college"].includes(String(values.place_type))) return "education";
  if (["hospital", "clinic", "doctors", "pharmacy"].includes(String(values.place_type))) return "healthcare";
  return "culture";
}

function formatFieldValue(key: string, value: string | number): string {
  if (key === "status") {
    const s = String(value).toLowerCase();
    if (s === "clear") return "🟢 Freie Fahrt";
    if (s === "sluggish") return "🟡 Zähflüssig";
    if (s === "congestion") return "🔴 Stau";
    if (s === "closure") return "⛔ Gesperrt";
  }
  if (key === "closure_type") {
    const ct = String(value).toLowerCase();
    if (ct === "full") return "⛔ Vollsperrung";
    if (ct === "partial") return "🚧 Halbseitige Sperrung / Baustelle";
    if (ct === "lane_restriction") return "⚠️ Fahrbahnverengung";
  }
  if ((key === "start_time" || key === "end_time") && typeof value === "string" && value.includes("T")) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr";
    }
  }
  return String(value);
}

export function featureCard(kind: string, values: Record<string, unknown>): HTMLElement {
  const style = mapSymbol(featureKind(kind, values));
  let title = String(values.name ?? values.title ?? style.label);
  let subtitle = style.label;

  if (kind === "energy") {
    const isGeneric = !values.name || values.name === "Energieanlage" || values.name === "Ökostrom / Solaranlage";
    const facilityType = typeof values.facility_type === "string"
      ? values.facility_type
      : typeof values.facilityType === "string"
      ? values.facilityType
      : undefined;
    if (isGeneric) {
      title = facilityType ? `Solaranlage (${facilityType})` : "Private Solaranlage / Photovoltaik";
    }
    subtitle = "Kartierte Erzeugungsanlage · keine Live-Messung";
  }

  const rows = Object.entries(FIELD_LABELS).flatMap(([key, label]) => {
    const raw = values[key];
    if ((typeof raw !== "string" && typeof raw !== "number") || raw === title) return [];
    return [`${label}: ${formatFieldValue(key, raw)}`];
  });
  if (kind === "places") rows.push("Öffnungs- und Notdienststatus nicht verfügbar.");
  if (kind === "crossings") rows.push("Schrankenstatus unbekannt – keine Live-Meldung verfügbar.");
  if (kind === "charging" && values.available_points == null && values.availablePoints == null) rows.push("Live-Belegung nicht verfügbar.");
  if (kind === "energy") {
    rows.push("Hinweis: Kartierte private oder gewerbliche Solaranlage bzw. Erzeugungsstandort (OpenStreetMap). Statischer Geodatensatz, keine Live-Telemetrie.");
  }
  if (Array.isArray(values.connectorTypes)) rows.push(`Anschlüsse: ${values.connectorTypes.filter(v => typeof v === "string").join(", ")}`);
  return detailCard(`${style.symbol} ${title}`, subtitle, rows.length ? rows : ["Für weitere Details liegen noch keine Daten vor."]);
}
