import { env } from "@/env";

type Archive = {
  month: string;
  generated_at: string;
  is_complete: boolean;
  reading_count: number;
  size_bytes: number;
  files: { filename: string; url: string; size_bytes: number; reading_count: number; sha256: string }[];
};

function size(bytes: number) {
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}

export default async function ArchiveDownloads() {
  let archives: Archive[] = [];
  let unavailable = false;
  try {
    const response = await fetch(new URL("/api/v1/archives", env.BACKEND_API_URL), { cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error("Archive catalogue unavailable");
    archives = await response.json();
    if (!Array.isArray(archives)) throw new Error("Invalid archive catalogue");
  } catch { archives = []; unavailable = true; }
  const years = [...new Set(archives.map(archive => archive.month.slice(0, 4)))];
  return <section className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
    <h2 className="text-2xl font-bold">Das gesamte Datenarchiv</h2>
    <p className="text-slate-400">Monatliche ZIP-Downloads mit allen öffentlichen Messwerten zum Exportzeitpunkt – ohne Zeilenlimit. Jeder Teil enthält Messdaten als CSV, Stationsinformationen und eine README. Für einen ganzen Monat bitte alle Teile herunterladen.</p>
    {unavailable ? <p role="status" className="text-amber-300">Das Archiv ist momentan nicht erreichbar. Bitte später erneut versuchen.</p>
      : archives.length === 0 ? <p className="text-slate-300">Noch keine Monatsarchive veröffentlicht. Sobald der erste Export bereitsteht, erscheint er hier. Die CSV-Auswahl und die API stehen unabhängig davon zur Verfügung.</p>
        : years.map(year => <details key={year} open className="rounded-2xl border border-slate-800 p-4">
          <summary className="cursor-pointer text-lg font-semibold text-emerald-300">{year}</summary>
          <div className="mt-4 space-y-6">
            {archives.filter(archive => archive.month.startsWith(year)).map(archive => <div key={archive.month} className="space-y-2">
              <h3 className="font-semibold">{archive.month} {archive.is_complete ? "" : "· Laufender Monat (unvollständig)"}</h3>
              <p className="text-sm text-slate-400">{archive.reading_count.toLocaleString("de-DE")} Messwerte · {size(archive.size_bytes)} · Stand: {new Date(archive.generated_at).toLocaleString("de-DE", { timeZone: "UTC" })} UTC</p>
              {archive.files.length === 0 ? <p className="text-sm text-slate-400">Keine öffentlichen Messwerte in diesem Monat.</p> : <ul className="space-y-3">
                {archive.files.map(file => <li key={file.filename} className="text-sm">
                  <a href={file.url} className="inline-block break-all font-medium text-emerald-300 underline underline-offset-4 hover:text-emerald-200">{file.filename} ({size(file.size_bytes)})</a>
                  <details className="mt-1 text-xs text-slate-400"><summary className="cursor-pointer">SHA-256 Prüfsumme</summary><code className="block break-all pt-1">{file.sha256}</code></details>
                </li>)}
              </ul>}
            </div>)}
          </div>
        </details>)}
    <div className="space-y-3 border-t border-slate-800 pt-5">
      <h3 className="font-semibold">Ein ganzes Jahr oder alles herunterladen</h3>
      <p className="text-sm text-slate-400">Das Python-Skript lädt alle passenden ZIP-Teile herunter, überprüft ihre Prüfsummen und überspringt bereits vollständig geladene Dateien. Python 3 genügt, weitere Pakete sind nicht nötig.</p>
      <a href="/downloads/download_archives.py" download className="inline-block rounded-xl border border-slate-700 px-4 py-2 font-semibold text-emerald-300 hover:bg-slate-800">Download-Skript herunterladen</a>
      <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-300"><code>{`# Alle veröffentlichten Monate\npython3 download_archives.py\n\n# Nur ein Jahr (Beispiel)\npython3 download_archives.py --year 2026`}</code></pre>
      <p className="text-xs text-slate-400">Archive sind Momentaufnahmen. Später eingegangene oder korrigierte Messwerte erscheinen erst nach einer erneuten Veröffentlichung. Bereits heruntergeladene Daten bleiben Teil Ihrer lokalen Kopie.</p>
    </div>
  </section>;
}
