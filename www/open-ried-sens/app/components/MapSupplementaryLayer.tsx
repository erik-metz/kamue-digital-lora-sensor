"use client";
import L from "leaflet";
import { useEffect, useState } from "react";
import type { FeatureCollection, GeoJsonObject } from "geojson";
import { SUPPLEMENTARY_SOURCES, retainedWarning, type SupplementaryId } from "@/lib/supplementaryLayers";
import { decodeSupplementarySnapshot, mergedChargers, supplementaryColor, supplementaryRows, supplementaryTitle, warningsFresh, type SupplementarySnapshot } from "@/lib/supplementaryPresentation";
import { detailCard } from "@/lib/mapPresentation";

const PRESENTATION = {
  protected: { title: "Schutzgebiete", zoom: 8, legend: "Grün: Landschafts-/Naturschutz und Naturparke · Türkis: FFH · Cyan: Vogelschutz. Kategorien überlagern sich." },
  monitoring: { title: "Gewässermessstellen", zoom: 12, legend: "G · Violett: Grundwasser · O · Blau: Oberflächenwasser" },
  warnings: { title: "DWD-Wetterwarnungen", zoom: 8, legend: "DWD-Schweregrad: Minor gelb · Moderate orange · Severe rot · Extreme violett · unbekannt grau" },
  chargers: { title: "Ladesäulen", zoom: 14, legend: "⚡ Registerstandorte · direkte BNetzA-Daten haben bei gleicher ID Vorrang. Keine Live-Belegung." },
} as const;
export default function MapSupplementaryLayer({ map, id, primary }: { map: L.Map; id: SupplementaryId; primary?: GeoJsonObject }) {
  const config = SUPPLEMENTARY_SOURCES[id];
  const presentation = PRESENTATION[id];
  const [state, setState] = useState<{ data: SupplementarySnapshot | null; failed: boolean }>({ data: null, failed: false });
  const [attempt, setAttempt] = useState(0);
  const [zoom, setZoom] = useState(() => map.getZoom());
  const [now, setNow] = useState(() => Date.now());
  const visible = zoom >= presentation.zoom;
  useEffect(() => {
    const update = () => setZoom(map.getZoom());
    map.on("zoomend", update);
    return () => { map.off("zoomend", update); };
  }, [map]);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch(`/api/supplementary-layers?layer=${id}`, { signal: controller.signal, ...(id === "warnings" ? { cache: "no-store" as const } : {}) });
        if (!response.ok) throw new Error("Unavailable");
        const data = decodeSupplementarySnapshot(id, await response.json());
        if (!controller.signal.aborted) { setState({ data, failed: false }); setNow(Date.now()); }
      } catch {
        if (!controller.signal.aborted) setState({ data: null, failed: true });
      }
      if (id === "warnings" && !controller.signal.aborted) timer = setTimeout(load, 60_000);
    }
    void load();
    const clock = id === "warnings" ? setInterval(() => setNow(Date.now()), 30_000) : null;
    return () => { controller.abort(); clearTimeout(timer); if (clock) clearInterval(clock); };
  }, [id, visible, attempt]);
  const fresh = id !== "warnings" || warningsFresh(state.data, now);
  useEffect(() => {
    if (!visible) return;
    const primaryCollection = primary && "features" in primary ? primary as FeatureCollection : undefined;
    const collection = id === "chargers" ? mergedChargers(primaryCollection, state.data)
      : id === "warnings" && fresh && state.data ? { ...state.data, features: state.data.features.filter(f => retainedWarning(f.properties ?? {}, now)) }
      : id === "warnings" ? null : state.data;
    if (!collection) return;
    const paneName = `supplementary-${id}`;
    const pane = map.getPane(paneName) ?? map.createPane(paneName);
    pane.style.zIndex = String(id === "warnings" ? 390 : id === "protected" ? 305 : 450);
    const renderer = L.canvas({ pane: paneName });
    const layer = L.geoJSON(collection, {
      pane: paneName,
      style: feature => ({ renderer, color: supplementaryColor(id, feature?.properties ?? {}), weight: 2, fillOpacity: id === "warnings" ? .25 : .12 }),
      pointToLayer: (feature, latlng) => {
        const label = supplementaryTitle(id, feature.properties ?? {});
        const icon = document.createElement("span");
        icon.textContent = id === "chargers" ? "⚡" : feature.properties?.source_layer === 1 ? "G" : "O";
        icon.style.cssText = `display:block;border-radius:50%;text-align:center;line-height:26px;background:${supplementaryColor(id, feature.properties ?? {})};color:#0f172a;border:2px solid white;font-weight:bold`;
        return L.marker(latlng, { pane: paneName, keyboard: true, title: label, alt: label, icon: L.divIcon({ html: icon, className: "", iconSize: [30, 30], iconAnchor: [15, 15] }) });
      },
      onEachFeature: (feature, shape) => shape.bindPopup(detailCard(supplementaryTitle(id, feature.properties ?? {}), id === "chargers" && feature.properties?.register_source === "direct" ? "Direkter BNetzA-Registerimport" : config.dataStand, [
        ...supplementaryRows(id, feature.properties ?? {}, now), config.attribution,
      ]), { maxWidth: 360, maxHeight: 300 }),
    }).addTo(map);
    const attribution = `<a href="https://opendata-esridech.hub.arcgis.com/maps/${config.item}">${config.attribution}</a>`;
    map.attributionControl?.addAttribution(attribution);
    return () => { layer.remove(); renderer.remove(); map.attributionControl?.removeAttribution(attribution); };
  }, [map, id, primary, state.data, fresh, visible, now, config]);
  const currentWarnings = fresh ? state.data?.features.filter(f => retainedWarning(f.properties ?? {}, now)) : undefined;
  const primaryCollection = primary && "features" in primary ? primary as FeatureCollection : undefined;
  const count = id === "chargers" ? mergedChargers(primaryCollection, state.data).features.length : id === "warnings" ? currentWarnings?.length : state.data?.features.length;
  return <section className="space-y-1 border-t border-slate-700 pt-2" aria-label={presentation.title}>
    <strong>{presentation.title}</strong>
    <p>{presentation.legend}</p>
    <p>{id === "chargers" ? "Esri-Vergleichsstand Juli 2026 · direkter Registerstand je Standort im Popup." : config.dataStand}</p>
    {id === "protected" || id === "warnings" ? <p>Flächen für die Anzeige vereinfacht.</p> : null}
    <p>{id === "chargers" ? "Zusätzlicher Registerstand: über die BNetzA-ID mit dem direkten Import zusammengeführt. Keine Live-Belegung." : config.note}</p>
    <p>Regionaler Auswahlbereich um Bürstadt, Lampertheim, Biblis und Groß-Rohrheim.</p>
    <p><a className="underline" href={`https://opendata-esridech.hub.arcgis.com/maps/${config.item}`} target="_blank" rel="noreferrer">{config.attribution}</a> · <a className="underline" href={config.license} target="_blank" rel="noreferrer">Nutzungsbedingungen</a></p>
    <p role="status">{!visible ? `Anzeige ab Zoom ${presentation.zoom}.` : state.failed ? id === "chargers" ? `Esri-Vergleichsstand nicht verfügbar; ${count ?? 0} Standorte aus dem direkten Import angezeigt.` : "Quelldaten derzeit nicht verfügbar." : id === "warnings" && state.data && !fresh ? "Warnungsbestand veraltet; aktuelle Warnlage unbekannt." : state.data ? id === "warnings" && count === 0 ? "Keine gültigen Warnpolygone im zuletzt geprüften Esri-Bestand des Ausschnitts." : `${count} ${id === "monitoring" ? "Messstellen" : id === "chargers" ? "Ladestandorte" : id === "warnings" ? "Warnpolygone" : "Schutzgebietsflächen"} angezeigt.` : "Quelldaten werden geladen …"}</p>
    {id === "warnings" ? <>
      <p>Quellenaktualisierung: {state.data?.source_updated_at ? new Date(state.data.source_updated_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "unbekannt"} · geprüft: {state.data?.checked_at ? new Date(state.data.checked_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "unbekannt"} (Europe/Berlin)</p>
      <a className="underline" href="https://www.dwd.de/warnungen" target="_blank" rel="noreferrer">Amtliche DWD-Warnlage öffnen</a>
      {currentWarnings?.length ? <details><summary>Warnmeldungen lesen</summary>{currentWarnings.map((f, index) => <article className="mt-2" key={`${f.properties?.IDENTIFIER}-${index}`}><strong>{supplementaryTitle(id, f.properties ?? {})}</strong>{supplementaryRows(id, f.properties ?? {}, now).map((row, i) => <p key={i}>{row}</p>)}</article>)}</details> : null}
    </> : null}
    {state.failed ? <button className="underline" onClick={() => setAttempt(value => value + 1)}>Erneut versuchen</button> : null}
  </section>;
}
