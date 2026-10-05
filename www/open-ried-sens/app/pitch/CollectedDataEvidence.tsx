"use client";

import { useEffect, useRef, useState } from "react";
import type { PitchWindowResult } from "@/lib/pitchWindow";

const metricNames: Record<string, string> = { temperature: "Temperatur", humidity: "Luftfeuchte", relative_humidity: "Luftfeuchte", water_level: "Wasserstand", river_level: "Pegel", river_water_level: "Pegel", PM25: "Feinstaub PM2.5", pm25: "Feinstaub PM2.5", PM10: "Feinstaub PM10", pm10: "Feinstaub PM10", pgv: "Bodenbewegung" };
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
  const partial = data?.stations.some((station) => station.unavailable || station.truncated);
  const successful = data?.stations.filter((station) => !station.unavailable).length ?? 0;
  const retry = <button type="button" onClick={() => setRevision((value) => value + 1)} className="shrink-0 rounded-lg border border-slate-600 px-3 py-2 text-sm">Erneut abfragen</button>;
  return <section className="space-y-3" aria-label="Echte Rohdaten seit Vortragsbeginn" aria-live="polite">
    {!data ? <p className="py-8 text-xl text-slate-300">{error ? "Die Rohdaten sind momentan nicht abrufbar. Es wird keine Zahl geschätzt." : "Echte Rohdaten seit Vortragsbeginn werden abgefragt …"}</p> : <>
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
        <p className="text-6xl md:text-7xl font-bold text-emerald-400">{partial ? "≥ " : ""}{data.count.toLocaleString("de-DE")}</p>
        <div><p className="text-2xl font-semibold">Rohmesswerte während dieses Vortrags</p><p className="mt-1 text-base text-slate-400">{Math.floor((elapsed ?? 0) / 60)} Min. {(elapsed ?? 0) % 60} Sek. · {successful} von {data.stations.length} ausgewählten Stationen abgefragt</p></div>
      </div>
      <p className="text-base text-slate-400">Messzeit zwischen {time(data.startedAt)} und {time(data.checkedAt)}. Automatische Aktualisierung alle 30 Sekunden.</p>
      {partial && <p className="text-base text-amber-300">Teilansicht: Eine Station ist nicht erreichbar oder das Abfragelimit ist erreicht. Die Zahl ist eine Untergrenze.</p>}
      {data.count === 0 ? <p className="text-lg text-slate-300">In diesem Zeitraum liegen für diese Stationen noch keine neuen Messwerte vor. Die Messintervalle unterscheiden sich je Quelle.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-base">
        <thead className="text-sm text-slate-400"><tr><th className="py-2 font-normal">Station</th><th className="py-2 font-normal">Messgröße</th><th className="py-2 font-normal">Rohwert</th><th className="py-2 font-normal">Messzeit</th></tr></thead>
        <tbody>{data.samples.map((row) => <tr key={JSON.stringify([row.sensor_id, row.metric, row.unit, row.timestamp])} className="border-t border-slate-800">
          <td className="py-2 pr-4 max-w-[320px] truncate" title={row.station}>{row.station}</td><td className="py-2 pr-4">{metricNames[row.metric ?? ""] ?? row.metric ?? "Messwert"}</td><td className="py-2 pr-4 font-semibold">{row.value.toLocaleString("de-DE", { maximumFractionDigits: 6 })} {row.unit}</td><td className="py-2">{time(row.timestamp)}</td>
        </tr>)}</tbody>
      </table></div>}
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-4xl text-sm text-slate-400">Beispiel aus bis zu acht Stationen, keine Hochrechnung auf das gesamte Netz. Die Messzeit belegt den Zeitraum, nicht den Zeitpunkt des Datenimports.</p>{retry}</div>
    </>}
    {!data && retry}
  </section>;
}
