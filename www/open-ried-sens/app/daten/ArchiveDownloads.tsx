import { env } from "@/env";

type Archive = {
  month: string;
  generated_at: string;
  is_complete: boolean;
  reading_count: number;
  files: { filename: string; url: string; size_bytes: number }[];
};

export default async function ArchiveDownloads() {
  let archives: Archive[] | null = null;
  try {
    const response = await fetch(new URL("/api/v1/archives", env.BACKEND_API_URL), {
      cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Archive catalogue unavailable");
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Invalid archive catalogue");
    archives = data;
  } catch { archives = null; }

  return (
    <section id="monatsarchive" className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4">
      <h2 className="text-2xl font-bold">Sensorarchive</h2>
      <p className="text-sm text-slate-300">Gespeicherte Sensormesswerte als ZIP mit Messwert-CSV und Stationsmetadaten. Bei mehrteiligen Archiven alle Teile des Zeitraums herunterladen.</p>
      {archives === null ? (
        <p role="status" className="text-sm text-amber-300">Der Downloadkatalog ist momentan nicht erreichbar. Bitte später erneut versuchen.</p>
      ) : archives.filter(archive => archive.files.length > 0).length === 0 ? (
        <p role="status" className="text-sm text-amber-300">Der Downloadkatalog liefert derzeit keine Archivdateien. Nutze den Themen-Export oben für die gespeicherten Daten.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {archives.filter(archive => archive.files.length > 0).map(archive => (
            <li key={archive.month} className="py-4 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h3 className="font-semibold">{archive.month}</h3>
                <span className="text-xs text-slate-400">{archive.reading_count.toLocaleString("de-DE")} Messwerte · Stand {new Date(archive.generated_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}{archive.is_complete ? "" : " · laufender Zeitraum"}</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {archive.files.map(file => (
                  <a key={file.filename} href={file.url} className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-emerald-300 hover:bg-slate-800 break-all">
                    {archive.files.length === 1 ? "ZIP herunterladen" : file.filename} · {(file.size_bytes / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB ↓
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
