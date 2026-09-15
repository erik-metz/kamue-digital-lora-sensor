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
