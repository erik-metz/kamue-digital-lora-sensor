import { CATEGORIES, type Category } from "./mapData";

/** No sensor IDs or stored HTML are rendered inside a marker. */
export function createMarkerContent(category: Category, color: string, muted: boolean, value = ""): HTMLElement {
  const content = document.createElement("div");
  content.className = `sensor-marker${muted ? " sensor-marker-muted" : ""}`;
  content.style.setProperty("--marker-color", color);
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", CATEGORIES[category].path);
  icon.append(path);
  content.append(icon);
  if (value) {
    const label = document.createElement("span");
    label.className = "sensor-marker-value";
    label.textContent = value;
    content.append(label);
  }
  return content;
}

export function createTempPinContent(color: string, muted: boolean, value = ""): HTMLElement {
  const content = document.createElement("div");
  content.className = `sensor-temp-pin${muted ? " sensor-temp-pin-muted" : ""}`;
  content.style.setProperty("--marker-color", color);
  if (value) {
    const label = document.createElement("span");
    label.className = "sensor-marker-value";
    label.textContent = value;
    content.append(label);
  }
  return content;
}


export function createClusterContent(colors: string[], count: number, labelText?: string): HTMLElement {
  const content = document.createElement("div");
  content.className = "sensor-cluster";
  const counts = new Map<string, number>();
  for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1);
  let offset = 0;
  const stops = [...counts].map(([color, size]) => {
    const start = offset;
    offset += size / colors.length * 100;
    return `${color} ${start}% ${offset}%`;
  });
  content.style.background = `conic-gradient(${stops.join(",")})`;
  content.title = labelText ? `${labelText} frei – zum Vergrößern anklicken` : `${count} Standorte – zum Vergrößern anklicken`;
  const label = document.createElement("span");
  label.textContent = labelText ?? String(count);
  content.append(label);
  return content;
}

export interface TrainMarkerProps {
  line: string;
  destination: string;
  status: "moving" | "stopped";
  speedKmh: number;
  currentStationName?: string;
  dwellTimeRemainingSec?: number;
  dwellProgress?: number; // 1.0 (just arrived) -> 0.0 (departing)
}

export function createTrainMarkerContent(props: TrainMarkerProps): HTMLElement {
  const isStopped = props.status === "stopped";
  const color = isStopped ? "#f59e0b" : props.line.includes("ICE") ? "#a855f7" : "#0284c7";

  const content = document.createElement("div");
  content.className = `train-marker ${isStopped ? "train-marker-stopped" : "train-marker-moving"}`;
  content.style.setProperty("--train-color", color);

  // Locomotive SVG icon
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");

  const path1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  path1.setAttribute("x", "4");
  path1.setAttribute("y", "3");
  path1.setAttribute("width", "16");
  path1.setAttribute("height", "14");
  path1.setAttribute("rx", "2");

  const path2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path2.setAttribute("d", "M4 11h16 M12 3v8 M8 17l-3 4 M16 17l3 4");

  const circle1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle1.setAttribute("cx", "8");
  circle1.setAttribute("cy", "14");
  circle1.setAttribute("r", "1");

  const circle2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle2.setAttribute("cx", "16");
  circle2.setAttribute("cy", "14");
  circle2.setAttribute("r", "1");

  icon.append(path1, path2, circle1, circle2);
  content.append(icon);

  // Line badge
  const badge = document.createElement("div");
  badge.className = "train-marker-badge";
  badge.textContent = props.line;
  content.append(badge);

  // If stopped at station, render the animated radial departure countdown gauge!
  if (isStopped && props.dwellTimeRemainingSec !== undefined) {
    const gaugeWrap = document.createElement("div");
    gaugeWrap.className = "train-gauge-container";
    const gaugeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    gaugeSvg.setAttribute("viewBox", "0 0 36 36");
    gaugeSvg.setAttribute("class", "train-gauge-svg");

    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("class", "gauge-track");
    bgCircle.setAttribute("cx", "18");
    bgCircle.setAttribute("cy", "18");
    bgCircle.setAttribute("r", "15.915");

    const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    progressCircle.setAttribute("class", "gauge-progress");
    progressCircle.setAttribute("cx", "18");
    progressCircle.setAttribute("cy", "18");
    progressCircle.setAttribute("r", "15.915");
    progressCircle.setAttribute("stroke-dasharray", "100, 100");

    const progress = Math.max(0, Math.min(1, props.dwellProgress ?? 1));
    const offset = 100 - progress * 100;
    progressCircle.setAttribute("stroke-dashoffset", String(offset));

    gaugeSvg.append(bgCircle, progressCircle);

    const countdownText = document.createElement("span");
    countdownText.className = "train-gauge-text";
    countdownText.textContent = `${props.dwellTimeRemainingSec}s`;

    gaugeWrap.append(gaugeSvg, countdownText);
    content.append(gaugeWrap);

    // Label showing station & countdown
    const sublabel = document.createElement("span");
    sublabel.className = "train-marker-sublabel";
    sublabel.textContent = `Halt: ${props.currentStationName ?? "Station"}`;
    content.append(sublabel);
  } else {
    // In motion: show destination & speed
    const sublabel = document.createElement("span");
    sublabel.className = "train-marker-sublabel";
    sublabel.textContent = `→ ${props.destination}`;
    content.append(sublabel);
  }

  return content;
}

export interface LevelCrossingMarkerProps {
  name: string;
  street: string;
  status: "open" | "closing_soon" | "closed" | "unknown";
  nextTrainLine?: string;
  secondsUntilClosure?: number;
  secondsUntilClearance?: number;
}

export function createLevelCrossingMarkerContent(props: LevelCrossingMarkerProps): HTMLElement {
  const statusColors = {
    open: "#10b981",
    closing_soon: "#f59e0b",
    closed: "#ef4444",
    unknown: "#94a3b8",
  };
  const color = statusColors[props.status] || "#94a3b8";

  const content = document.createElement("div");
  content.className = `crossing-marker crossing-marker-${props.status}`;
  content.style.setProperty("--crossing-color", color);

  // St. Andrew's Cross (Andreaskreuz) SVG icon
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2.5");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");

  // Cross lines (X)
  const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line1.setAttribute("x1", "5");
  line1.setAttribute("y1", "5");
  line1.setAttribute("x2", "19");
  line1.setAttribute("y2", "19");

  const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line2.setAttribute("x1", "19");
  line2.setAttribute("y1", "5");
  line2.setAttribute("x2", "5");
  line2.setAttribute("y2", "19");

  // Barrier arm line
  const barrier = document.createElementNS("http://www.w3.org/2000/svg", "line");
  barrier.setAttribute("x1", "3");
  barrier.setAttribute("y1", props.status === "closed" ? "12" : "7");
  barrier.setAttribute("x2", "21");
  barrier.setAttribute("y2", props.status === "closed" ? "12" : "17");
  barrier.setAttribute("stroke-dasharray", "3, 2");

  icon.append(line1, line2, barrier);
  content.append(icon);

  // Status badge
  const badge = document.createElement("span");
  badge.className = "crossing-marker-badge";
  if (props.status === "closed") {
    badge.textContent = `Geschlossen (${props.secondsUntilClearance ? `${props.secondsUntilClearance}s` : "Zug"})`;
  } else if (props.status === "closing_soon") {
    badge.textContent = `Schließt in ${props.secondsUntilClosure ?? 60}s`;
  } else {
    badge.textContent = "BÜ Frei";
  }
  content.append(badge);

  return content;
}

export interface WasteTruckMarkerProps {
  fraction: string;
  fractionLabel: string;
  binColor: string;
  accentColor: string;
  licensePlate: string;
  status: "collecting" | "bin_emptying" | "transit";
  speedKmh: number;
  currentStreet: string;
  nextStreet: string;
  expectedTimeWindow: string;
  loadPercent: number;
  emptyCountdownSec?: number;
  emptyProgress?: number;
}

export function createWasteTruckMarkerContent(props: WasteTruckMarkerProps): HTMLElement {
  const isDwell = props.status === "bin_emptying";
  const content = document.createElement("div");
  content.className = `waste-truck-marker waste-truck-${props.status} waste-truck-${props.fraction}`;
  content.style.setProperty("--truck-color", props.binColor);
  content.style.setProperty("--truck-accent", props.accentColor);

  // Flashing orange beacon on roof
  const beacon = document.createElement("div");
  beacon.className = `truck-beacon ${isDwell ? "truck-beacon-rapid" : "truck-beacon-active"}`;
  content.append(beacon);

  // Waste truck SVG
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.75");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");

  // Compactor body
  const compactor = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  compactor.setAttribute("x", "2");
  compactor.setAttribute("y", "7");
  compactor.setAttribute("width", "11");
  compactor.setAttribute("height", "9");
  compactor.setAttribute("rx", "1");

  // Hydraulic press rib
  const compactorRib = document.createElementNS("http://www.w3.org/2000/svg", "line");
  compactorRib.setAttribute("x1", "7");
  compactorRib.setAttribute("y1", "7");
  compactorRib.setAttribute("x2", "7");
  compactorRib.setAttribute("y2", "16");

  // Cab
  const cab = document.createElementNS("http://www.w3.org/2000/svg", "path");
  cab.setAttribute("d", "M13 10h4l3 3v3h-7z");

  // Window
  const windowElem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  windowElem.setAttribute("x", "14.5");
  windowElem.setAttribute("y", "11");
  windowElem.setAttribute("width", "3");
  windowElem.setAttribute("height", "2");

  // Wheels
  const wheel1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  wheel1.setAttribute("cx", "5.5");
  wheel1.setAttribute("cy", "17.5");
  wheel1.setAttribute("r", "1.75");
  wheel1.setAttribute("fill", "currentColor");

  const wheel2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  wheel2.setAttribute("cx", "16.5");
  wheel2.setAttribute("cy", "17.5");
  wheel2.setAttribute("r", "1.75");
  wheel2.setAttribute("fill", "currentColor");

  icon.append(compactor, compactorRib, cab, windowElem, wheel1, wheel2);
  content.append(icon);

  // Fraction badge
  const badge = document.createElement("div");
  badge.className = "waste-truck-badge";
  badge.textContent = props.fractionLabel;
  content.append(badge);

  // Dwell countdown gauge for bin emptying / hydraulic compaction
  if (isDwell && props.emptyCountdownSec !== undefined) {
    const gaugeWrap = document.createElement("div");
    gaugeWrap.className = "truck-gauge-container";
    const gaugeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    gaugeSvg.setAttribute("viewBox", "0 0 36 36");
    gaugeSvg.setAttribute("class", "truck-gauge-svg");

    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("class", "truck-gauge-track");
    bgCircle.setAttribute("cx", "18");
    bgCircle.setAttribute("cy", "18");
    bgCircle.setAttribute("r", "15.915");

    const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    progressCircle.setAttribute("class", "truck-gauge-progress");
    progressCircle.setAttribute("cx", "18");
    progressCircle.setAttribute("cy", "18");
    progressCircle.setAttribute("r", "15.915");
    progressCircle.setAttribute("stroke-dasharray", "100, 100");

    const progress = Math.max(0, Math.min(1, props.emptyProgress ?? 1));
    const offset = 100 - progress * 100;
    progressCircle.setAttribute("stroke-dashoffset", String(offset));

    gaugeSvg.append(bgCircle, progressCircle);

    const countdownText = document.createElement("span");
    countdownText.className = "truck-gauge-text";
    countdownText.textContent = `${props.emptyCountdownSec}s`;

    gaugeWrap.append(gaugeSvg, countdownText);
    content.append(gaugeWrap);

    const sublabel = document.createElement("span");
    sublabel.className = "waste-truck-sublabel";
    sublabel.textContent = `Leerung: ${props.currentStreet}`;
    content.append(sublabel);
  } else {
    const sublabel = document.createElement("span");
    sublabel.className = "waste-truck-sublabel";
    sublabel.textContent = props.status === "transit" ? "Depot-Fahrt" : props.currentStreet;
    content.append(sublabel);
  }

  return content;
}

export interface BusMarkerProps {
  line: string;
  destination: string;
  status: "moving" | "stopped";
  speedKmh: number;
  currentStopName?: string;
  dwellTimeRemainingSec?: number;
  dwellProgress?: number; // 1.0 (just arrived) -> 0.0 (departing)
  isSchoolBus: boolean;
  delayMinutes: number;
  wheelchairAccessible?: boolean;
}

export function createBusMarkerContent(props: BusMarkerProps): HTMLElement {
  const isStopped = props.status === "stopped";
  const isSchool = props.isSchoolBus;
  const color = isSchool ? "#f59e0b" : "#0284c7";

  const content = document.createElement("div");
  content.className = `bus-marker ${isStopped ? "bus-marker-stopped" : "bus-marker-moving"}${isSchool ? " bus-marker-school" : ""}`;
  content.style.setProperty("--bus-color", color);

  // Bus SVG silhouette
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");

  const busBody = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  busBody.setAttribute("x", "3");
  busBody.setAttribute("y", "4");
  busBody.setAttribute("width", "18");
  busBody.setAttribute("height", "14");
  busBody.setAttribute("rx", "2");

  const windshield = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  windshield.setAttribute("x", "5");
  windshield.setAttribute("y", "6");
  windshield.setAttribute("width", "14");
  windshield.setAttribute("height", "5");
  windshield.setAttribute("rx", "1");

  const divider = document.createElementNS("http://www.w3.org/2000/svg", "line");
  divider.setAttribute("x1", "12");
  divider.setAttribute("y1", "6");
  divider.setAttribute("x2", "12");
  divider.setAttribute("y2", "11");

  const light1 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  light1.setAttribute("cx", "6");
  light1.setAttribute("cy", "14.5");
  light1.setAttribute("r", "1");

  const light2 = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  light2.setAttribute("cx", "18");
  light2.setAttribute("cy", "14.5");
  light2.setAttribute("r", "1");

  icon.append(busBody, windshield, divider, light1, light2);
  content.append(icon);

  // Line badge
  const badge = document.createElement("div");
  badge.className = "bus-marker-badge";
  badge.textContent = isSchool ? `🎒 ${props.line}` : props.line;
  content.append(badge);

  // Delay indicator chip if delayed
  if (props.delayMinutes > 0) {
    const delayBadge = document.createElement("div");
    delayBadge.className = "bus-delay-badge";
    delayBadge.textContent = `+${props.delayMinutes}m`;
    content.append(delayBadge);
  }

  // Animated radial departure countdown gauge when stopped at a bus stop
  if (isStopped && props.dwellTimeRemainingSec !== undefined) {
    const gaugeWrap = document.createElement("div");
    gaugeWrap.className = "bus-gauge-container";
    const gaugeSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    gaugeSvg.setAttribute("viewBox", "0 0 36 36");
    gaugeSvg.setAttribute("class", "bus-gauge-svg");

    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("class", "bus-gauge-track");
    bgCircle.setAttribute("cx", "18");
    bgCircle.setAttribute("cy", "18");
    bgCircle.setAttribute("r", "15.915");

    const progressCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    progressCircle.setAttribute("class", "bus-gauge-progress");
    progressCircle.setAttribute("cx", "18");
    progressCircle.setAttribute("cy", "18");
    progressCircle.setAttribute("r", "15.915");
    progressCircle.setAttribute("stroke-dasharray", "100, 100");

    const progress = Math.max(0, Math.min(1, props.dwellProgress ?? 1));
    const offset = 100 - progress * 100;
    progressCircle.setAttribute("stroke-dashoffset", String(offset));

    gaugeSvg.append(bgCircle, progressCircle);

    const countdownText = document.createElement("span");
    countdownText.className = "bus-gauge-text";
    countdownText.textContent = `${props.dwellTimeRemainingSec}s`;

    gaugeWrap.append(gaugeSvg, countdownText);
    content.append(gaugeWrap);

    // Dwell sublabel
    const sublabel = document.createElement("span");
    sublabel.className = "bus-marker-sublabel";
    sublabel.textContent = `Halt: ${props.currentStopName ?? "Haltestelle"}`;
    content.append(sublabel);
  } else {
    // In transit sublabel
    const sublabel = document.createElement("span");
    sublabel.className = "bus-marker-sublabel";
    sublabel.textContent = `→ ${props.destination}`;
    content.append(sublabel);
  }

  return content;
}

export interface BusStopMarkerProps {
  name: string;
  lines: string[];
  directionLabel?: string;
  isSchoolStop?: boolean;
  isTrainHub?: boolean;
}

export function createBusStopMarkerContent(props: BusStopMarkerProps): HTMLElement {
  const content = document.createElement("div");
  content.className = `bus-stop-marker${props.isSchoolStop ? " bus-stop-school" : ""}${props.isTrainHub ? " bus-stop-hub" : ""}`;
  content.title = `${props.name}${props.directionLabel ? ` (${props.directionLabel})` : ""} (Linien: ${props.lines.join(", ")})`;

  // German Haltestelle sign: bold "H" inside yellow circular disc with green ring
  const label = document.createElement("span");
  label.className = "bus-stop-h";
  label.textContent = "H";
  content.append(label);

  if (props.isSchoolStop) {
    const schoolPin = document.createElement("span");
    schoolPin.className = "bus-stop-school-icon";
    schoolPin.textContent = "🎒";
    content.append(schoolPin);
  }

  return content;
}

export interface TrafficIncidentMarkerProps {
  roadName: string;
  delayMinutes: number;
  lengthKm: number;
  severity: "minor" | "moderate" | "major" | "standstill";
  causeType: "congestion" | "accident" | "roadwork" | "closure";
}

export function createTrafficIncidentMarkerContent(props: TrafficIncidentMarkerProps): HTMLElement {
  const content = document.createElement("div");
  const isSevere = props.severity === "major" || props.severity === "standstill";
  const isClosure = props.causeType === "closure" || props.severity === "standstill";
  const color = isClosure ? "#ef4444" : isSevere ? "#f97316" : "#eab308";

  content.className = `traffic-incident-marker ${isClosure ? "traffic-closure" : isSevere ? "traffic-stau" : "traffic-sluggish"}`;
  content.style.setProperty("--traffic-color", color);

  const iconSpan = document.createElement("span");
  iconSpan.className = "traffic-marker-icon";
  iconSpan.textContent = isClosure ? "⛔" : props.causeType === "accident" ? "💥" : props.causeType === "roadwork" ? "🚧" : "⚠️";
  content.append(iconSpan);

  const roadBadge = document.createElement("span");
  roadBadge.className = "traffic-marker-road";
  roadBadge.textContent = props.roadName;
  content.append(roadBadge);

  if (props.delayMinutes > 0) {
    const delayBadge = document.createElement("span");
    delayBadge.className = "traffic-marker-delay";
    delayBadge.textContent = `+${props.delayMinutes}m`;
    content.append(delayBadge);
  }

  const pulse = document.createElement("span");
  pulse.className = "traffic-marker-pulse";
  content.append(pulse);

  return content;
}
