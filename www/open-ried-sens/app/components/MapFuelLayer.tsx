"use client";
import L from "leaflet";
import { useEffect, useState } from "react";
import { detailCard, placeMarker } from "@/lib/mapPresentation";
import { compareFuel, decodeFuel, formatFuelPrice, fuelDistance, fuelFresh, FUEL_LABELS, type Fuel, type FuelSnapshot } from "@/lib/fuelData";

export default function MapFuelLayer({ map, clustered }: { map: L.Map; clustered: boolean }) {
  const [snapshot, setSnapshot] = useState<FuelSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [fuel, setFuel] = useState<Fuel>("e10");
  const [sort, setSort] = useState<"price" | "distance">("price");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [center, setCenter] = useState<[number, number]>(() => [map.getCenter().lat, map.getCenter().lng]);
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const update = () => { const c = map.getCenter(); setCenter([c.lat, c.lng]); setZoom(map.getZoom()); };
    map.on("moveend", update);
    return () => { map.off("moveend", update); };
  }, [map]);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch("/api/fuel", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const data = decodeFuel(await response.json());
        if (!controller.signal.aborted) { setSnapshot(data); setFailed(false); setNow(Date.now()); }
      } catch { if (!controller.signal.aborted) setFailed(true); }
      if (!controller.signal.aborted) timer = setTimeout(load, 60_000);
    }
    void load();
    const clock = setInterval(() => setNow(Date.now()), 30_000);
    return () => { controller.abort(); clearTimeout(timer); clearInterval(clock); };
  }, []);
  const fresh = fuelFresh(snapshot, now);
  // An old reported opening status must not be presented as currently open.
  const stations = snapshot?.stations.filter(s => !onlyOpen || (fresh && s.is_open)) ?? [];
  useEffect(() => {
    const group = (clustered ? L.markerClusterGroup({ maxClusterRadius: 65, disableClusteringAtZoom: 16, showCoverageOnHover: false,
      iconCreateFunction: cluster => L.divIcon({ html: placeMarker("fuel", String(cluster.getChildCount())), className: "map-place-icon", iconSize: [36, 36] }),
    }) : L.layerGroup()).addTo(map);
    for (const s of snapshot?.stations ?? []) {
      if (onlyOpen && (!fresh || !s.is_open)) continue;
      const status = fresh ? (s.is_open ? "Geöffnet laut Anbieter" : "Geschlossen laut Anbieter") : "Veraltet · Öffnungsstatus unbekannt";
      const label = zoom >= 15 ? `${formatFuelPrice(s[fuel])}${fresh ? "" : " · alt"}` : "";
      L.marker([s.latitude, s.longitude], { alt: `${s.name} · ${status}`, keyboard: true,
        icon: L.divIcon({ html: placeMarker("fuel", label, !fresh), className: "map-place-icon", iconSize: [36, 36], iconAnchor: [18, 18] }),
      }).bindTooltip(detailCard(s.name, status, []))
        .bindPopup(detailCard(s.name, status, [s.brand, `${s.street} ${s.houseNumber}, ${s.postCode} ${s.place}`,
          ...Object.entries(FUEL_LABELS).map(([key, name]) => `${name}: ${formatFuelPrice(s[key as Fuel])}`),
          `Abgerufen: ${snapshot?.fetched_at ? new Date(snapshot.fetched_at).toLocaleString("de-DE") : "unbekannt"}`,
          "Quelle: Tankerkönig / MTS-K · CC BY 4.0",
        ])).addTo(group);
    }
    return () => { group.remove(); };
  }, [map, clustered, snapshot, fuel, onlyOpen, fresh, zoom]);
  const ranked = compareFuel(stations, fuel, sort, center);
  const cheapest = fresh ? compareFuel(stations.filter(s => s.is_open && s[fuel] !== null), fuel, "price", center)[0] : undefined;
  return <section className="space-y-3 rounded-xl border border-slate-700 p-4" aria-label="Tankstellen und Spritpreise">
    <h3 className="font-semibold text-slate-200">⛽ Tankstellen &amp; Spritpreise</h3>
    <div className="flex flex-wrap items-center gap-3">
      <label>Kraftstoff <select className="rounded bg-slate-800 p-2" value={fuel} onChange={e => setFuel(e.target.value as Fuel)}>
        {Object.entries(FUEL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <label>Sortierung <select className="rounded bg-slate-800 p-2" value={sort} onChange={e => setSort(e.target.value as "price" | "distance")}>
        <option value="price">Preis</option><option value="distance">Entfernung zur Kartenmitte</option>
      </select></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} /> Nur geöffnet</label>
    </div>
    <p role="status">{failed ? "Abruf fehlgeschlagen. " : ""}{snapshot?.fetched_at ? `${fresh ? "Abgerufen" : "Veraltete Daten vom"}: ${new Date(snapshot.fetched_at).toLocaleString("de-DE")}.` : "Noch keine Tankstellenpreise verfügbar."}
      {snapshot ? ` Gebiet: ${snapshot.radius_km} km um Bürstadt/Lampertheim · ${snapshot.stations.length} gemeldete Tankstellen.` : ""}</p>
    {cheapest ? <p className="text-emerald-300">Günstigster gemeldeter {FUEL_LABELS[fuel]}-Preis bei geöffneter Tankstelle im Erfassungsgebiet: {cheapest.name} · {formatFuelPrice(cheapest[fuel])}</p> : null}
    <details><summary className="cursor-pointer">Vergleichsliste ({ranked.length})</summary>
      <div className="max-h-80 overflow-auto"><table className="mt-2 w-full text-left"><caption className="sr-only">Preise für {FUEL_LABELS[fuel]}; Entfernungen als Luftlinie zur Kartenmitte</caption>
        <thead><tr><th scope="col">Tankstelle</th><th scope="col">Preis</th><th scope="col">Entfernung</th><th scope="col">Status</th></tr></thead>
        <tbody>{ranked.map(s => <tr key={s.id} className="border-t border-slate-800">
          <td className="py-2"><button className="text-sky-300 underline" onClick={() => map.setView([s.latitude, s.longitude], 16)}>{s.name}</button><br />{s.place}</td>
          <td>{formatFuelPrice(s[fuel])}{fresh ? "" : " · alt"}</td><td>{fuelDistance(s, center).toLocaleString("de-DE", { maximumFractionDigits: 1 })} km</td>
          <td>{fresh ? s.is_open ? "Geöffnet" : "Geschlossen" : "Unbekannt"}</td>
        </tr>)}</tbody>
      </table></div>{ranked.length === 0 ? <p>Keine Tankstellen für diesen Filter verfügbar.</p> : null}
    </details>
    <p>Entfernungen als Luftlinie zur Kartenmitte. Preise können sich bis zur Ankunft ändern.</p>
    <p>Quelle: <a className="underline" href="https://creativecommons.tankerkoenig.de/">Tankerkönig</a> / MTS-K · <a className="underline" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>
  </section>;
}
