"use client";

import { useEffect, useRef, useState } from "react";
import { TrainFront, ParkingCircle, Bike, CloudSun, Wind, Waves, RefreshCw } from "lucide-react";
import type { PitchWindowResult } from "@/lib/pitchWindow";

const metricNames: Record<string, string> = { temperature: "Temperatur", humidity: "Luftfeuchte", relative_humidity: "Luftfeuchte", water_level: "Wasserstand", river_level: "Pegel", river_water_level: "Pegel", PM25: "Feinstaub PM2.5", pm25: "Feinstaub PM2.5", "PM2.5": "Feinstaub PM2.5", NO2: "Stickstoffdioxid", air_quality_index: "Luftqualitätsindex", groundwater_level: "Grundwasserstand", PM10: "Feinstaub PM10", pm10: "Feinstaub PM10", parking_free: "Freie Plätze", parking_occupied: "Belegte Plätze", bike_available: "Verfügbare Räder", bikes_available: "Verfügbare Räder", crossing_state: "Schrankenstatus" };
const categoryStyles = {
  crossings: { icon: TrainFront, color: "text-orange-400", background: "bg-orange-400/10" },
  parking: { icon: ParkingCircle, color: "text-violet-400", background: "bg-violet-400/10" },
  bikes: { icon: Bike, color: "text-emerald-400", background: "bg-emerald-400/10" },
  weather: { icon: CloudSun, color: "text-amber-400", background: "bg-amber-400/10" },
  air: { icon: Wind, color: "text-teal-400", background: "bg-teal-400/10" },
  water: { icon: Waves, color: "text-sky-400", background: "bg-sky-400/10" },
};
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
  return <section className="space-y-3" aria-label="Live-Daten seit Vortragsbeginn" aria-live="polite">
    {!data ? <div className="py-8 text-xl text-slate-300">
      <p>{error ? "Live-Daten derzeit nicht verfügbar" : "Live-Daten werden geladen …"}</p>
      {error && <button type="button" onClick={() => setRevision((value) => value + 1)} className="mt-4 rounded-lg border border-slate-600 px-3 py-2 text-sm">Erneut laden</button>}
    </div> : <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.categories.map((category) => {
          const row = category.sample;
          const { icon: Icon, color, background } = categoryStyles[category.id];
          const value = row?.metric === "crossing_state"
            ? ["Offen", "Schließt bald", "Geschlossen"][row.value]
            : row ? `${row.value.toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${row.unit}` : null;
          const stateColor = row?.metric === "crossing_state"
            ? ["text-emerald-400", "text-amber-400", "text-red-400"][row.value] : color;
          return <article key={category.id} className="flex min-h-48 flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center gap-3">
              <span className={`rounded-xl p-2.5 ${background} ${stateColor}`}><Icon className="h-7 w-7" aria-hidden="true" /></span>
              <h3 className="text-xl font-semibold">{category.label}</h3>
            </div>
            <p className={`mt-4 text-3xl font-bold ${row ? stateColor : "text-slate-400"}`}>{value ?? (category.unavailable ? "Nicht verfügbar" : "Noch kein neuer Wert")}</p>
            {row && <p className="mt-1 text-sm text-slate-400">{category.model ? "Geschätzt aus Zugdaten" : metricNames[row.metric ?? ""] ?? row.metric ?? "Messwert"}</p>}
            <div className="mt-auto pt-4 text-sm text-slate-400">
              {row && <p className="truncate" title={row.station}>{row.station} · {time(row.timestamp)}</p>}
              {!category.model && <p className={category.unavailable || category.truncated ? "text-amber-400" : ""}>{category.unavailable && !row ? "Quelle nicht erreichbar" : `${category.unavailable || category.truncated ? "≥ " : ""}${category.count?.toLocaleString("de-DE")} neue Rohwerte`}</p>}
            </div>
          </article>;
        })}
      </div>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <p>Seit {time(data.startedAt)} · Stand {time(data.checkedAt)}</p>
        <button type="button" onClick={() => setRevision((value) => value + 1)} aria-label="Live-Daten aktualisieren" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </>}
  </section>;
}
