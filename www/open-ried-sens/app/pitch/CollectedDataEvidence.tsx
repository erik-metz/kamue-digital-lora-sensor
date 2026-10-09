"use client";

import { useEffect, useRef, useState } from "react";
import type { PitchWindowResult } from "@/lib/pitchWindow";

const metricNames: Record<string, string> = { temperature: "Temperatur", humidity: "Luftfeuchte", relative_humidity: "Luftfeuchte", water_level: "Wasserstand", river_level: "Pegel", river_water_level: "Pegel", PM25: "Feinstaub PM2.5", pm25: "Feinstaub PM2.5", "PM2.5": "Feinstaub PM2.5", NO2: "Stickstoffdioxid", air_quality_index: "Luftqualitätsindex", groundwater_level: "Grundwasserstand", PM10: "Feinstaub PM10", pm10: "Feinstaub PM10", parking_free: "Freie Plätze", parking_occupied: "Belegte Plätze", bike_available: "Verfügbare Räder", bikes_available: "Verfügbare Räder", crossing_state: "Schrankenstatus" };
function time(value: string) { return new Date(value).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

export default function CollectedDataEvidence({ startedAt }: { startedAt: number }) {
  const [data, setData] = useState<PitchWindowResult | null>(null);
  const [error, setError] = useState(false);
  const selected = useRef<string[] | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const params = new URLSearchParams({ start: new Date(startedAt).toISOString() });
        if (selected.current) params.set("stations", selected.current.join(","));
        const response = await fetch(`/api/pitch-window?${params}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const next: PitchWindowResult = await response.json();
        if (!controller.signal.aborted) {
          selected.current = next.stations.map((station) => station.id);
          setData(next); setError(false);
        }
      } catch {
        if (!controller.signal.aborted) { setData(null); setError(true); }
      }
      if (!controller.signal.aborted) timer = setTimeout(load, 30000);
    }
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [startedAt, revision]);
  const elapsed = data ? Math.max(0, Math.floor((Date.parse(data.checkedAt) - startedAt) / 1000)) : null;
  const partial = data?.categories.some((category) => !category.model && (category.unavailable || category.truncated));
  const retry = <button type="button" onClick={() => setRevision((value) => value + 1)} className="shrink-0 rounded-lg border border-slate-600 px-3 py-2 text-sm">Erneut abfragen</button>;
  return <section className="space-y-3" aria-label="Echte Rohdaten seit Vortragsbeginn" aria-live="polite">
    {!data ? <p className="py-8 text-xl text-slate-300">{error ? "Die Rohdaten sind momentan nicht abrufbar. Es wird keine Zahl geschätzt." : "Echte Rohdaten seit Vortragsbeginn werden abgefragt …"}</p> : <>
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <p className="text-4xl md:text-5xl font-bold text-emerald-400">{partial ? "≥ " : ""}{data.count.toLocaleString("de-DE")}</p>
        <div><p className="text-2xl font-semibold">Neue Rohwerte aus dem Alltag</p><p className="mt-1 text-base text-slate-400">{Math.floor((elapsed ?? 0) / 60)} Min. {(elapsed ?? 0) % 60} Sek. · sechs Kategorien im Blick</p></div>
      </div>
      <p className="text-base text-slate-400">Messzeit zwischen {time(data.startedAt)} und {time(data.checkedAt)}. Automatische Aktualisierung alle 30 Sekunden.</p>
      {partial && <p className="text-base text-amber-300">Teilansicht: Nicht jede Kategorie liefert neue Rohwerte. Fehlende Quellen und erreichte Abfragelimits stehen in der Tabelle.</p>}
      <div className="overflow-x-auto"><table className="w-full text-left text-base">
        <thead className="text-sm text-slate-400"><tr><th className="py-2 font-normal">Alltagsthema</th><th className="py-2 font-normal">Seit Vortragsbeginn</th><th className="py-2 font-normal">Neuester Wert / Quelle</th><th className="py-2 font-normal">Datenzeit</th></tr></thead>
        <tbody>{data.categories.map((category) => {
          const row = category.sample;
          const value = row?.metric === "crossing_state"
            ? ["Offen (geschätzt)", "Schließt bald (geschätzt)", "Geschlossen (geschätzt)"][row.value]
            : row ? `${row.value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${row.unit}` : null;
          return <tr key={category.id} className="border-t border-slate-800">
            <th scope="row" className="py-2 pr-4 font-semibold">{category.label}</th>
            <td className="py-2 pr-4">{category.model ? "Schätzung aus Zugdaten" : category.unavailable && !row ? "Quelle nicht abrufbar" : `${category.unavailable || category.truncated ? "≥ " : ""}${category.count?.toLocaleString("de-DE")} Rohwerte`}</td>
            <td className="py-2 pr-4">{row ? <><span className="font-semibold">{value}</span><span className="block text-sm text-slate-400">{category.model ? row.station : `${metricNames[row.metric ?? ""] ?? row.metric ?? "Messwert"} · ${row.station}`}</span></> : <span className="text-slate-400">{category.unavailable ? "Derzeit nicht verfügbar" : "Noch kein neuer Wert im Vortragszeitraum"}</span>}</td>
            <td className="py-2">{row ? time(row.timestamp) : "—"}</td>
          </tr>;
        })}</tbody>
      </table></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-4xl text-sm text-slate-400">Bis zu acht Messstationen, keine Hochrechnung. Bahnübergänge: aktueller berechneter Zustand, keine Live-Messung und nicht in der Rohwertsumme enthalten. Datenzeit statt Importzeit.</p>{retry}</div>
    </>}
    {!data && retry}
  </section>;
}
