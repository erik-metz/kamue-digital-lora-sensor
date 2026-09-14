"use client";

import { MapPin, RefreshCw, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CATEGORIES, CATEGORY_IDS, parseStoredCategories, visibleNodes, type Category, type MapMode, type SensorNode } from "@/lib/mapData";
import TelemetryCharts from "./TelemetryCharts";

const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => <div className="h-[480px] sm:h-[560px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400"><RefreshCw className="size-5 animate-spin mr-2" /> Karte wird geladen…</div>,
});
const STORAGE_KEY = "ried-map-categories-v1";
const DEFAULT_SELECTION = JSON.stringify(CATEGORY_IDS);
let fallback = DEFAULT_SELECTION;
function preferences() { try { return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SELECTION; } catch { return fallback; } }
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("ried-map-filter", listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener("ried-map-filter", listener); };
}
function saveCategories(categories: Category[]) {
  fallback = JSON.stringify(categories);
  try { localStorage.setItem(STORAGE_KEY, fallback); } catch { /* Session filters still work when storage is blocked. */ }
  window.dispatchEvent(new Event("ried-map-filter"));
}
function CategoryIcon({ category }: { category: Category }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0" aria-hidden="true"><path d={CATEGORIES[category].path} /></svg>;
}

type Props = { nodes: SensorNode[]; loadFailed?: boolean; readingsAvailable?: boolean };
export default function DashboardClient({ nodes: initialNodes, loadFailed = false, readingsAvailable = true }: Props) {
  const [data, setData] = useState({ nodes: initialNodes, readingsAvailable });
  const [updateFailed, setUpdateFailed] = useState(loadFailed);
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<MapMode>("category");
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const stored = useSyncExternalStore(subscribe, preferences, () => DEFAULT_SELECTION);
  const categories = useMemo(() => parseStoredCategories(stored), [stored]);
  const nodes = data.nodes;
  const filtered = useMemo(() => visibleNodes(nodes, categories, mode), [nodes, categories, mode]);
  const selected = filtered.find(n => n.id === selectedNodeId);
  const chartNode = selected ?? filtered[0];
  const counts = useMemo(() => Object.fromEntries(CATEGORY_IDS.map(c => [c, nodes.filter(n => n.categories.includes(c)).length])) as Record<Category, number>, [nodes]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const response = await fetch("/api/map-sensors", { signal: controller.signal });
        if (!response.ok) throw new Error("Map unavailable");
        const updated: { nodes: SensorNode[]; readingsAvailable: boolean } = await response.json();
        if (!controller.signal.aborted) { setData(updated); setUpdateFailed(false); }
      } catch { if (!controller.signal.aborted) setUpdateFailed(true); }
      finally {
        if (!controller.signal.aborted) { setNow(Date.now()); timer = setTimeout(refresh, 60_000); }
      }
    }
    timer = setTimeout(refresh, loadFailed ? 0 : 60_000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [loadFailed]);

  const reset = () => { saveCategories(CATEGORY_IDS); setMode("category"); setSelectedNodeId(undefined); };
  return <>
    <div className="border-b border-slate-800 pb-4">
      <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-1"><Zap className="size-4" /> Sensor-Dashboard</div>
      <h2 className="text-2xl sm:text-3xl font-bold">Messdaten aus Bürstadt & Lampertheim</h2>
      <p className="mt-2 text-sm text-slate-400">Entdecke die Region nach Thema. Nahe Standorte werden zusammengefasst – ein Klick vergrößert den Ausschnitt.</p>
    </div>
    {updateFailed ? <p role="alert" className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-3 text-sm text-amber-200">Die Kartendaten konnten nicht aktualisiert werden. {nodes.length ? "Zuletzt geladene Standorte bleiben sichtbar." : "Bitte versuche es später erneut."}</p> : null}
    {!data.readingsAvailable ? <p role="status" className="text-sm text-amber-200">Standorte verfügbar. Für Messwerte und Messwertfarben muss die neue Backend-Version bereitgestellt werden.</p> : null}
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-emerald-400" /> Themen auf der Karte</h3>
          <button type="button" onClick={reset} className="text-xs text-slate-400 underline underline-offset-4 hover:text-white">Zurücksetzen</button>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sensorgruppen auswählen">
          <button type="button" aria-pressed={categories.length === CATEGORY_IDS.length} onClick={() => saveCategories(CATEGORY_IDS)} className="rounded-full border border-slate-600 px-3 py-2 text-sm aria-pressed:bg-slate-100 aria-pressed:text-slate-950 focus-visible:outline-2 focus-visible:outline-emerald-400">Alle <span className="ml-1 opacity-70">{nodes.length}</span></button>
          {CATEGORY_IDS.filter(c => counts[c] > 0).map(c => <button key={c} type="button" aria-pressed={categories.includes(c)} onClick={() => {
            const next = categories.length === CATEGORY_IDS.length ? [c] : categories.includes(c) ? categories.filter(v => v !== c) : [...categories, c];
            saveCategories(next);
          }} style={{ borderColor: categories.includes(c) ? CATEGORIES[c].color : undefined, color: categories.includes(c) ? CATEGORIES[c].color : undefined }} className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white">
            <CategoryIcon category={c} />{CATEGORIES[c].label}<span className="text-xs opacity-70">{counts[c]}</span>
          </button>)}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">Darstellung
            <select value={mode} onChange={e => setMode(e.target.value as MapMode)} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100">
              <option value="category">Themenfarben</option><option value="temperature" disabled={!data.readingsAvailable}>Temperatur · °C</option>
            </select>
          </label>
          <span className="text-xs text-slate-400" aria-live="polite">{filtered.length} von {nodes.length} Standorten ausgewählt</span>
        </div>
        <p className="text-xs text-slate-500">Ein Thema anklicken, danach weitere hinzufügen. Ein Standort kann zu mehreren Themen gehören.</p>
      </div>
      <MapComponent nodes={filtered} categories={categories} mode={mode} now={now} selectedNodeId={selected?.id} onSelectNode={setSelectedNodeId} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400" aria-label="Kartenlegende">
        {mode === "temperature" ? <>
          {[['#818cf8', '< 0 °C'], ['#38bdf8', '0–<10 °C'], ['#2dd4bf', '10–<20 °C'], ['#fbbf24', '20–<30 °C'], ['#fb7185', '≥ 30 °C']].map(([color, label]) => <span key={label} className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: color }} />{label}</span>)}
          <span>Luft- und Bodentemperatur · Symbole zeigen das Thema</span>
        </> : <span>Symbol & Farbe = Thema · Farbring am Cluster = enthaltene Themen</span>}
        <span>Gestrichelt / blass = älterer Messwert oder keine Daten</span>
        <span>Zahl im Kreis = Standorte</span>
      </div>
      <p className="text-xs text-slate-500">Messwerte erscheinen beim Hineinzoomen. Parkplatzwerte zeigen den zuletzt gemeldeten Zustand, keinen Online-Status.</p>
    </div>
    {chartNode ? <TelemetryCharts key={chartNode.id} node={chartNode} nodes={filtered} onSelectNode={setSelectedNodeId} /> : <p className="text-sm text-slate-400">Keine Station in dieser Auswahl. Wähle weitere Themen oder setze die Filter zurück.</p>}
  </>;
}
