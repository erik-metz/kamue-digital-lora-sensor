"use client";

import { useState } from "react";

const inputClass = "mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-400";
const buttonClass = "rounded-xl px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400";

export default function HackathonDataSection() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function download(params: URLSearchParams) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/data-download?${params}`, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Download fehlgeschlagen.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("Content-Disposition")?.match(/filename="([^\"]+)"/)?.[1] || "open-ried-sens.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage("Die ZIP-Datei wurde zum Download bereitgestellt.");
    } catch (error) {
      setMessage(error instanceof Error && error.name !== "TimeoutError" ? error.message : "Der Download dauert zu lange. Bitte einen kürzeren Zeitraum wählen oder erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="datasets" className="space-y-5">
      <h2 className="text-2xl sm:text-3xl font-bold">Daten herunterladen</h2>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Mit einer Stichprobe starten</h3>
          <p className="max-w-2xl text-sm text-slate-300">Drei zusammengehörige CSV-Dateien: Messpunkte, Messgrößen und Messwerte. Mit IDs zum Verknüpfen und einer kurzen Anleitung im ZIP.</p>
          <p className="text-xs text-slate-400">Bis zu 300 Messgrößen mit je einem aktuellen gespeicherten Wert. Eine Stichprobe, kein vollständiger Datenbestand.</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void download(new URLSearchParams({ sample: "1" }))} className={`${buttonClass} shrink-0 bg-emerald-400 text-slate-950 hover:bg-emerald-300`}>Stichprobe laden (ZIP)</button>
      </div>
      <form onSubmit={event => {
        event.preventDefault();
        const params = new URLSearchParams();
        new FormData(event.currentTarget).forEach((value, key) => params.set(key, String(value)));
        void download(params);
      }} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Thema &amp; Zeitraum wählen</h3>
          <p className="text-sm text-slate-300">Alle öffentlichen Messpunkte des gewählten Themas gemeinsam herunterladen.</p>
        </div>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-3">
          <legend className="sr-only">Export auswählen</legend>
          <label className="text-sm font-medium">Thema
            <select name="topic" className={inputClass}>
              <option value="all">Alle Themen</option>
              <option value="temperature">Temperatur aller Messpunkte</option>
              <option value="mobility">Mobilität &amp; Verkehr</option>
              <option value="roadworks">Baustellen &amp; Sperrungen</option>
            </select>
          </label>
          <label className="text-sm font-medium">Von (UTC)
            <input type="date" name="start" required className={inputClass} />
          </label>
          <label className="text-sm font-medium">Bis (UTC, einschließlich)
            <input type="date" name="end" required className={inputClass} />
          </label>
        </fieldset>
        <p className="text-xs text-slate-400">Bis zu 31 Tage und 50.000 Messwerte pro Export. Größere Auswahlen werden nicht abgeschnitten. Baustellen und Sperrungen enthalten gespeicherte Meldungen, deren Gültigkeit den Zeitraum überlappt.</p>
        <button type="submit" disabled={busy} className={`${buttonClass} border border-slate-700 text-emerald-300 hover:bg-slate-800`}>Auswahl laden (ZIP)</button>
      </form>
      <p role="status" aria-live="polite" className="text-sm text-slate-300">{busy ? "Datenpaket wird erstellt …" : message}</p>
      <p className="text-sm text-slate-400">Für den Hackathon: Ein Paket für den gewünschten Zeitraum laden und gemeinsam im lokalen Netzwerk bereitstellen. Langfristige Sensordaten findest du in den UploadThing-Archiven.</p>
    </section>
  );
}
