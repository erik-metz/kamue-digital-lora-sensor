/** Build a marker without interpreting stored sensor IDs as HTML. */
export function createMarkerContent(id: string, color: string, ringColor: string, selected: boolean): HTMLElement {
  const content = document.createElement("div");
  content.style.cssText = "position:relative;width:38px;height:38px;display:flex;align-items:center;justify-content:center";
  const ring = document.createElement("div");
  ring.style.cssText = "position:absolute;width:38px;height:38px;border-radius:50%;opacity:0.7";
  ring.style.background = ringColor;
  ring.style.animation = selected ? "pulse 2s infinite" : "none";
  const label = document.createElement("div");
  label.style.cssText = "width:28px;height:28px;border-radius:50%;background:#0f172a;box-shadow:0 4px 12px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:bold";
  label.style.border = `3px solid ${color}`;
  label.textContent = id.split("-")[1] || id;
  content.append(ring, label);
  return content;
}
