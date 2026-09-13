"use client";

import { useState } from "react";

const inputClass = "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-400";
const buttonClass = "rounded-xl px-5 py-3 font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400";

export default function DataDownload({ stations, unavailable }: {
  stations: { id: string; friendly_name: string }[]; unavailable: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function download(form: HTMLFormElement, sample: boolean) {
    setBusy(true);
    setMessage("");
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => params.set(key, String(value)));
    if (sample) params.set("sample", "1");
    try {
      const response = await fetch(`/api/data-download?${params}`, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Download fehlgeschlagen.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "open-ried-sens.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage("Die CSV-Datei wurde zum Download bereitgestellt.");
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Download fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  if (unavailable) return <p role="status" className="text-amber-300">Die Stationen konnten nicht geladen werden. Bitte die Seite erneut laden oder später wiederkommen.</p>;
  if (!stations.length) return <p role="status" className="text-slate-300">Derzeit sind keine öffentlichen Stationen verfügbar.</p>;

  return <form onSubmit={event => { event.preventDefault(); void download(event.currentTarget, false); }} className="space-y-5">
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <legend className="sr-only">Daten auswählen</legend>
      <label className="text-sm font-medium">Station
        <select name="sensor_id" required className={inputClass}>
          {stations.map(station => <option key={station.id} value={station.id}>{station.friendly_name || station.id}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">Messgröße (optional)
        <input name="metric" maxLength={64} placeholder="Leer lassen für alle Messgrößen" className={inputClass} aria-describedby="metric-help" />
        <span id="metric-help" className="mt-1 block text-xs text-slate-400">Exakte Kennung aus der Spalte „metric“ der Stichprobe.</span>
      </label>
      <label className="text-sm font-medium">Von (UTC, einschließlich)
        <input type="date" name="start" required className={inputClass} />
      </label>
      <label className="text-sm font-medium">Bis (UTC, einschließlich)
        <input type="date" name="end" required className={inputClass} />
      </label>
    </fieldset>
    <p className="text-sm text-slate-400">Maximal 31 Tage pro Download. Für eine Stichprobe sind keine Datumsangaben nötig.</p>
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={busy} className={`${buttonClass} bg-emerald-400 text-slate-950 hover:bg-emerald-300`}>Auswahl als CSV herunterladen</button>
      <button type="button" disabled={busy} onClick={event => { if (event.currentTarget.form) void download(event.currentTarget.form, true); }} className={`${buttonClass} border border-slate-700 text-emerald-300 hover:bg-slate-800`}>Stichprobe als CSV herunterladen</button>
    </div>
    <p role="status" aria-live="polite" className="text-sm text-slate-300">{busy ? "Messdaten werden geladen …" : message}</p>
  </form>;
}
