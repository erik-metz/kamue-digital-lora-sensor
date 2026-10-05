"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { previewCollectedData, evidenceExpired, type EvidencePreview } from "@/lib/pitchEvidence";

const datasets = [
  { path: "environment/flood/gauges", label: "Pegelstände" },
  { path: "infrastructure/ev-charging", label: "Ladeinfrastruktur" },
] as const;

type Evidence = {
  label: string;
  path: string;
  status: "available" | "empty" | "unavailable";
  preview?: EvidencePreview;
  source?: string | null;
  updated?: string | null;
  collected?: string | null;
};

function formatTime(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Nicht mitgeliefert";
  return new Date(value).toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
}

export default function CollectedDataEvidence() {
  const [revision, setRevision] = useState(0);
  const [results, setResults] = useState<Evidence[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let disposed = false;
    async function load() {
      const next = await Promise.all(datasets.map(async (dataset): Promise<Evidence> => {
        const base = { label: dataset.label, path: dataset.path };
        try {
          const response = await fetch(`/api/collected/${dataset.path}`, { signal: controller.signal, cache: "no-store" });
          if (!response.ok || evidenceExpired(response.headers.get("x-data-expires-at"))) throw new Error("Unavailable");
          const preview = previewCollectedData(await response.json());
          return { ...base, status: preview ? "available" : "empty", preview: preview ?? undefined,
            source: response.headers.get("x-data-source"), updated: response.headers.get("x-source-updated-at"), collected: response.headers.get("x-collected-at") };
        } catch {
          return { ...base, status: "unavailable" };
        }
      }));
      clearTimeout(timeout);
      if (!disposed) { setResults(next); setCheckedAt(new Date().toISOString()); }
    }
    void load();
    return () => { disposed = true; controller.abort(); clearTimeout(timeout); };
  }, [revision]);

  function refresh() { setResults(null); setCheckedAt(null); setRevision((value) => value + 1); }

  return <section className="space-y-5" aria-label="Prüfung gesammelter Quelldaten">
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <p className="text-base text-slate-400">{checkedAt ? `Abfrage: ${formatTime(checkedAt)}` : "Datensätze werden abgefragt …"}</p>
      <div className="flex items-center gap-4">
        <Link href="/quellen" className="text-base text-emerald-400 underline">Alle Datenquellen</Link>
        <button type="button" onClick={refresh} disabled={!results} className="rounded-lg border border-slate-600 px-4 py-2 text-base text-slate-100 disabled:opacity-50">Erneut prüfen</button>
      </div>
    </div>
    <div aria-live="polite" className="space-y-4">
      {results?.map((result) => <article key={result.path} className="border-t border-slate-700 pt-4">
        <div className="flex flex-wrap justify-between gap-3">
          <h3 className="text-xl font-semibold text-slate-100">{result.label}</h3>
          <p className={`text-lg ${result.status === "available" ? "text-emerald-400" : "text-amber-300"}`}>
            {result.status === "available" ? "Gespeicherte Quelldaten abrufbar" : result.status === "empty" ? "Keine auswertbaren Einträge" : "Aktuell nicht abrufbar"}
          </p>
        </div>
        {result.status === "available" && <>
          <p className="mt-2 text-base text-slate-400">Quelle: {result.source || "Nicht mitgeliefert"} · Quellenstand: {formatTime(result.updated)} · Gesammelt: {formatTime(result.collected)}</p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            {result.preview?.fields.map((field) => <div key={field.name} className="min-w-0"><dt title={field.name} className="text-sm text-slate-400 truncate">{field.name}</dt><dd title={field.value} className="text-lg text-slate-100 break-words line-clamp-2">{field.value}</dd></div>)}
          </dl>
        </>}
      </article>)}
    </div>
    <p className="text-base text-slate-300">Gespeicherte Quelldaten. Quellenstand und Messzeit können voneinander abweichen.</p>
  </section>;
}
