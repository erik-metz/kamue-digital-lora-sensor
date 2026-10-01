import { env } from "@/env";
import {
  Archive as ArchiveIcon,
  Calendar,
  CheckCircle2,
  Download,
  FileCode,
  HardDrive,
  Layers,
  Sparkles,
  Terminal,
} from "lucide-react";

type Archive = {
  month: string;
  generated_at: string;
  is_complete: boolean;
  reading_count: number;
  size_bytes: number;
  files: {
    filename: string;
    url: string;
    size_bytes: number;
    reading_count: number;
    sha256: string;
  }[];
};

function size(bytes: number) {
  return `${(bytes / 1024 / 1024).toLocaleString("de-DE", {
    maximumFractionDigits: 1,
  })} MB`;
}

function formatPeriodTitle(period: string) {
  // 1. Year: e.g. "2026"
  if (/^\d{4}$/.test(period)) {
    return {
      title: `Gesamtjahr ${period}`,
      badge: "Jahresarchiv",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      description: "Vollständiger Datensatz über das gesamte Kalenderjahr.",
    };
  }
  // 2. Quarter: e.g. "2026-Q3"
  const qMatch = period.match(/^(\d{4})-Q([1-4])$/);
  if (qMatch) {
    const quarters: Record<string, string> = {
      "1": "Januar – März",
      "2": "April – Juni",
      "3": "Juli – September",
      "4": "Oktober – Dezember",
    };
    return {
      title: `Quartal ${qMatch[2]} / ${qMatch[1]}`,
      badge: `Q${qMatch[2]}-Archiv`,
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      description: `3-Monats-Paket (${quarters[qMatch[2]] || ""}).`,
    };
  }
  // 3. Month: e.g. "2026-04"
  const monthNames = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];
  const mMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (mMatch) {
    const mIndex = parseInt(mMatch[2], 10) - 1;
    const mName = monthNames[mIndex] || period;
    return {
      title: `${mName} ${mMatch[1]}`,
      badge: "Monatsarchiv",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      description: "Monatlicher Export aller Messungen und Metadaten.",
    };
  }
  return {
    title: period,
    badge: "Archiv",
    badgeColor: "bg-slate-800 text-slate-300 border-slate-700",
    description: "Datenexport.",
  };
}

export default async function ArchiveDownloads() {
  let archives: Archive[] = [];
  let unavailable = false;

  try {
    const response = await fetch(new URL("/api/v1/archives", env.BACKEND_API_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Archive catalogue unavailable");
    archives = await response.json();
    if (!Array.isArray(archives)) throw new Error("Invalid archive catalogue");
  } catch {
    archives = [];
    unavailable = true;
  }

  const years = [
    ...new Set(archives.map((archive) => archive.month.slice(0, 4))),
  ].sort((a, b) => b.localeCompare(a));

  return (
    <section
      id="monatsarchive"
      className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6"
    >
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <ArchiveIcon className="w-3.5 h-3.5" /> UploadThing Cloud-Archive
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Das gesamte Datenarchiv (Monate, Quartale &amp; Jahre)
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
          Veröffentlichte, komprimierte ZIP-Pakete ohne Zeilenlimit auf UploadThing.
          Jedes Archivpaket enthält:
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-300">
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-emerald-300">
            📄 measurements.csv
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-teal-300">
            🗺️ stations.json
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-blue-300">
            📋 manifest.json
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-slate-400">
            ℹ️ README.txt
          </span>
        </div>
      </div>

      {unavailable ? (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          Das Archiv ist momentan nicht erreichbar. Bitte später erneut versuchen.
        </div>
      ) : archives.length === 0 ? (
        <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 text-sm space-y-2">
          <p className="font-semibold text-slate-200">
            Noch keine statischen Archive im Katalog veröffentlicht.
          </p>
          <p className="text-xs text-slate-400">
            Sobald der erste monatliche, quartalsweise oder jährliche Export-Lauf bereitsteht,
            erscheinen die direkten UploadThing-Downloadlinks hier. Die CSV-Auswahl oben und die
            REST-API stehen unabhängig davon jederzeit live zur Verfügung.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {years.map((year) => {
            const yearArchives = archives.filter((archive) =>
              archive.month.startsWith(year)
            );

            // Group into year, quarter, month
            const fullYearArchives = yearArchives.filter(
              (a) => /^\d{4}$/.test(a.month)
            );
            const quarterArchives = yearArchives.filter((a) =>
              /^\d{4}-Q[1-4]$/.test(a.month)
            );
            const monthArchives = yearArchives.filter((a) =>
              /^\d{4}-(0[1-9]|1[0-2])$/.test(a.month)
            );

            return (
              <details
                key={year}
                open
                className="rounded-3xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6 space-y-4"
              >
                <summary className="cursor-pointer text-xl font-bold text-slate-100 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    Jahrgang {year}
                  </span>
                  <span className="text-xs font-normal text-slate-400 font-mono">
                    {yearArchives.length} Archiv-Paket(e)
                  </span>
                </summary>

                <div className="pt-4 space-y-6">
                  {/* FULL YEAR ARCHIVES */}
                  {fullYearArchives.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                        <HardDrive className="w-4 h-4" /> Jahres-Gesamtpaket
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {fullYearArchives.map((archive) => {
                          const meta = formatPeriodTitle(archive.month);
                          return (
                            <div
                              key={archive.month}
                              className="p-4 rounded-2xl bg-slate-900 border border-blue-500/30 hover:border-blue-500/60 transition-colors space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}>
                                  {meta.badge}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {archive.reading_count.toLocaleString("de-DE")} Zeilen
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-100 text-base">
                                {meta.title}
                              </h4>
                              <p className="text-xs text-slate-400">
                                {meta.description} Größe: {size(archive.size_bytes)}
                              </p>
                              <div className="pt-1 space-y-2">
                                {archive.files.map((file) => (
                                  <a
                                    key={file.filename}
                                    href={file.url}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-slate-800 transition-colors"
                                  >
                                    <span className="font-medium break-all truncate">
                                      {file.filename}
                                    </span>
                                    <span className="shrink-0 text-slate-400 font-mono text-[11px] ml-2">
                                      {size(file.size_bytes)} ↓
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* QUARTERLY ARCHIVES */}
                  {quarterArchives.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                        <Layers className="w-4 h-4" /> Quartals-Pakete (3 Monate)
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {quarterArchives.map((archive) => {
                          const meta = formatPeriodTitle(archive.month);
                          return (
                            <div
                              key={archive.month}
                              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition-colors space-y-3"
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}>
                                  {meta.badge}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {size(archive.size_bytes)}
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-100 text-sm">
                                {meta.title}
                              </h4>
                              <p className="text-xs text-slate-400">
                                {meta.description}
                              </p>
                              <div className="pt-1 space-y-2">
                                {archive.files.map((file) => (
                                  <a
                                    key={file.filename}
                                    href={file.url}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-slate-800 transition-colors"
                                  >
                                    <span className="truncate">{file.filename}</span>
                                    <span className="shrink-0 text-slate-400 font-mono text-[11px] ml-2">
                                      {size(file.size_bytes)} ↓
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* MONTHLY ARCHIVES */}
                  {monthArchives.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> Monats-Exporte
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {monthArchives.map((archive) => {
                          const meta = formatPeriodTitle(archive.month);
                          return (
                            <div
                              key={archive.month}
                              className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-colors space-y-2.5"
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}>
                                  {meta.badge}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                  {size(archive.size_bytes)}
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-100 text-sm">
                                {meta.title}
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                {archive.reading_count.toLocaleString("de-DE")} Messwerte
                              </p>
                              <div className="pt-1 space-y-1.5">
                                {archive.files.map((file) => (
                                  <a
                                    key={file.filename}
                                    href={file.url}
                                    className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-slate-800 transition-colors"
                                  >
                                    <span className="truncate">{file.filename}</span>
                                    <span className="shrink-0 text-slate-400 font-mono text-[10px] ml-2">
                                      {size(file.size_bytes)} ↓
                                    </span>
                                  </a>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {/* AUTOMATED DOWNLOAD SCRIPT */}
      <div className="space-y-4 border-t border-slate-800 pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-100 text-base sm:text-lg flex items-center gap-2">
              <Terminal className="w-5 h-5 text-emerald-400" />
              Automatisiertes Download-Skript (Python CLI)
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Lädt alle passenden ZIP-Teile (Monate, Quartale oder Jahre) automatisch herunter,
              verifiziert SHA-256 Prüfsummen und überspringt bereits geladene Dateien.
            </p>
          </div>

          <a
            href="/downloads/download_archives.py"
            download
            className="inline-flex items-center gap-2 shrink-0 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 font-semibold text-emerald-300 text-xs transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Skript laden (.py)</span>
          </a>
        </div>

        <pre className="overflow-x-auto rounded-2xl bg-slate-950 border border-slate-800 p-4 text-xs font-mono text-slate-300 leading-relaxed">
          <code>{`# 1. Alles herunterladen (alle Monate, Quartale und Jahre):
python3 download_archives.py

# 2. Nur das gesamte Jahr 2026:
python3 download_archives.py --year 2026

# 3. Nur Quartals-Pakete herunterladen:
python3 download_archives.py --type quarter --year 2026

# 4. Nur einen spezifischen Monat herunterladen (z. B. April 2026):
python3 download_archives.py --month 2026-04`}</code>
        </pre>
      </div>
    </section>
  );
}
