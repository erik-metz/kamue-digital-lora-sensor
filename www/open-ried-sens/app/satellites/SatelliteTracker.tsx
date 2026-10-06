"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SatelliteMap = dynamic(() => import("./SatelliteMap"), { ssr: false, loading: () => <p>Karte wird geladen …</p> });
export interface SatellitePosition {
  norad_id: number; name?: string; latitude: number; longitude: number; altitude_km: number;
  speed_km_s: number; timestamp: string; element_epoch?: string; element_age_seconds?: number;
}
interface Snapshot { satellites: { norad_id: number; name: string }[]; positions: SatellitePosition[]; last_import: string | null; timestamp: string }
const empty: Snapshot = { satellites: [], positions: [], last_import: null, timestamp: "" };

export default function SatelliteTracker() {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [failed, setFailed] = useState(false);
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [historyDate, setHistoryDate] = useState("");
  const [history, setHistory] = useState<SatellitePosition[]>([]);
  const [trail, setTrail] = useState<SatellitePosition[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [detailError, setDetailError] = useState("");
  function resetDetail() { setTrail([]); setHistory([]); setCursor(0); setPlaying(false); setDetailError(""); }
  function chooseSatellite(id: number | null) { if (id === selected) return; resetDetail(); setSelected(id); }
  function chooseDate(value: string) { if (value === historyDate) return; resetDetail(); setHistoryDate(value); }
  useEffect(() => {
    const stream = new EventSource("/api/satellites/stream");
    const controller = new AbortController();
    let lastEvent = 0;
    const accept = (body: Snapshot) => {
      if (!Array.isArray(body.positions)) throw new Error("Invalid stream");
      lastEvent = Date.now(); setSnapshot(body); setFailed(false);
    };
    stream.onmessage = event => { try { accept(JSON.parse(event.data)); } catch { setFailed(true); } };
    stream.onerror = () => setFailed(true);
    async function fallback() {
      if (Date.now()-lastEvent < 5000) return;
      try {
        const res = await fetch("/api/satellites", { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error("Unavailable");
        const body = await res.json(); if (!controller.signal.aborted) accept(body);
      } catch { if (!controller.signal.aborted) { setFailed(true); setSnapshot(previous => ({ ...previous, positions: [] })); } }
    }
    void fallback();
    const timer = setInterval(() => { if (Date.now()-lastEvent > 5000) { setFailed(true); setSnapshot(previous => ({ ...previous, positions: [] })); } void fallback(); }, 5000);
    return () => { stream.close(); controller.abort(); clearInterval(timer); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (!selected) return () => controller.abort();
    async function load() {
      try {
        const path = historyDate ? `history?start=${encodeURIComponent(historyDate+"T00:00:00Z")}&end=${encodeURIComponent(new Date(Date.parse(historyDate+"T00:00:00Z")+86400000).toISOString())}&limit=10000` : "orbit";
        const res = await fetch(`/api/satellites/${selected}/${path}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Keine Bahndaten für diesen Zeitraum verfügbar.");
        const body = await res.json();
        if (!controller.signal.aborted) {
          const points = body.positions.map((p: SatellitePosition) => ({ ...p, norad_id: selected }));
          setTrail(points); if (historyDate) setHistory(points);
          if (!points.length) setDetailError("Keine gespeicherten Positionen für diesen Tag.");
        }
      } catch (error) { if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : "Daten nicht verfügbar."); }
    }
    void load(); return () => controller.abort();
  }, [selected, historyDate]);
  useEffect(() => {
    if (!playing || !history.length) return;
    const timer = setInterval(() => setCursor(value => (value+1)%history.length), 250);
    return () => clearInterval(timer);
  }, [playing, history.length]);
  const matches = (p: { name?: string; norad_id: number }) => {
    const name = p.name ?? "";
    const category = /STARLINK/i.test(name) ? "starlink" : /GPS|NAVSTAR/i.test(name) ? "gps" : p.norad_id === 25544 ? "iss" : "other";
    return (group === "all" || category === group) && `${name} ${p.norad_id}`.toLowerCase().includes(query.toLowerCase());
  };
  const filtered = snapshot.positions.filter(matches);
  const catalog = snapshot.satellites.filter(matches);
  const historical = historyDate ? history[cursor] : undefined;
  const positions = historyDate ? (historical ? [historical] : []) : filtered;
  const current = historyDate ? historical : snapshot.positions.find(p => p.norad_id === selected);
  return <div className="space-y-4">
    <p role="status">{failed ? "Verbindung unterbrochen; erneuter Verbindungsaufbau …" : snapshot.positions.length ? `${snapshot.positions.length} Satelliten im Stream` : "Noch keine aktuellen Bahndaten vorhanden."}
      {snapshot.last_import ? ` · Letzter Import: ${new Date(snapshot.last_import).toLocaleString("de-DE")}` : ""}</p>
    <div className="flex flex-wrap gap-4">
      <label>Gruppe <select className="rounded border p-2" value={group} onChange={e => setGroup(e.target.value)}><option value="all">Alle</option><option value="iss">ISS</option><option value="starlink">Starlink</option><option value="gps">GPS</option><option value="other">Weitere</option></select></label>
      <label>Suche <input className="rounded border p-2" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name oder NORAD-ID" /></label>
      <label>Satellit <select className="rounded border p-2" value={selected ?? ""} onChange={e => chooseSatellite(Number(e.target.value) || null)}>
        <option value="">Bitte auswählen</option>{catalog.map(p => <option key={p.norad_id} value={p.norad_id}>{p.name ?? p.norad_id} ({p.norad_id})</option>)}
      </select></label>
      <label>Historie (UTC) <input type="date" disabled={!selected} className="rounded border p-2" value={historyDate} onInput={e => chooseDate(e.currentTarget.value)} /></label>
      <button className="rounded border px-3" onClick={() => chooseDate("")}>Live</button>
    </div>
    <SatelliteMap positions={positions} trail={trail} selected={selected} onSelect={chooseSatellite} />
    {detailError ? <p role="status">{detailError}</p> : null}
    {history.length ? <div className="flex items-center gap-3">
      <button className="rounded border p-2" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Abspielen"}</button>
      <input className="flex-1" aria-label="Historischer Zeitpunkt" type="range" min={0} max={history.length-1} value={cursor} onChange={e => setCursor(Number(e.target.value))} />
      <time>{new Date(history[cursor].timestamp).toLocaleString("de-DE")}</time>
    </div> : null}
    {current ? <p>{current.name ?? `NORAD ${current.norad_id}`} · Höhe {current.altitude_km.toFixed(1)} km · Geschwindigkeit {current.speed_km_s.toFixed(2)} km/s
      {current.element_age_seconds != null ? ` · Bahnelemente ${(current.element_age_seconds/3600).toFixed(1)} Stunden alt` : ""} · berechnet</p> : null}
    <details><summary>Positionsstream</summary><div className="max-h-64 overflow-auto"><table className="w-full text-left"><thead><tr><th>Satellit</th><th>Zeit</th><th>Breite</th><th>Länge</th><th>Höhe</th></tr></thead>
      <tbody>{positions.map(p => <tr key={p.norad_id}><td><button className="underline" onClick={() => chooseSatellite(p.norad_id)}>{p.name ?? p.norad_id}</button></td><td>{new Date(p.timestamp).toLocaleTimeString("de-DE")}</td><td>{p.latitude.toFixed(3)}°</td><td>{p.longitude.toFixed(3)}°</td><td>{p.altitude_km.toFixed(1)} km</td></tr>)}</tbody></table></div></details>
    <p className="text-sm">Quelle: <a className="underline" href="https://www.space-track.org/">Space-Track</a>. Modellpositionen, keine Live-Messungen. Veraltete Bahnelemente über zehn Tage werden ausgeblendet.</p>
  </div>;
}
