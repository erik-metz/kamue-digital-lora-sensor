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
