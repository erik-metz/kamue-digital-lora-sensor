import { Radio, Layers, Database, Wrench, FileText, ShieldCheck, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function SiteFooter({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <footer className="mt-auto border-t border-slate-800/80 py-7 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <p>Open Ried · Ehrenamtlich. Offen. Für die Region.</p>
          <nav aria-label="Weiterführende Links" className="flex flex-wrap gap-x-5 gap-y-3">
            <Link href="/quellen" className="hover:text-emerald-300">Quellen</Link>
            <Link href="/daten" className="hover:text-emerald-300">Daten &amp; API</Link>
            <a href="https://kamue.me" target="_blank" rel="noreferrer" className="hover:text-emerald-300">KAMÜ</a>
            <a href="https://github.com/erik-metz/kamue-digital-lora-sensor" target="_blank" rel="noreferrer" className="hover:text-emerald-300">GitHub</a>
          </nav>
        </div>
      </footer>
    );
  }
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 py-12 mt-auto text-sm text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Main Footer Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Initiative Profile */}
          <div className="space-y-3 lg:col-span-1">
            <div className="flex items-center gap-2 text-slate-100 font-bold">
              <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Open Ried Sens</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Eine unabhängige Bürgerinitiative für offene Sensordaten, Umweltmessungen und
              regionale Datentransparenz in Zusammenarbeit mit dem Kulturzentrum{" "}
              <a
                href="https://kamue.me"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline font-medium hover:text-emerald-300 transition-colors"
              >
                KAMÜ
              </a>{" "}
              in Bürstadt.
            </p>
            <div className="pt-2 text-xs font-mono text-slate-500">
              Bürstadt • Lampertheim • Biblis • Hessisches Ried
            </div>
          </div>

          {/* Column 2: Sensor-Netzwerk & Partizipation */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Sensorik &amp; Daten
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/"
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5 text-slate-500" />
                  <span>Dashboard (Sensor-Karte)</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/daten"
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5 text-slate-500" />
                  <span>Offene Daten &amp; API</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/sensor-bauen"
                  className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Sensor bauen (DIY-Anleitung)</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Regionalatlas (Kommunaldaten) */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Regionalatlas Ried
              </h4>
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/regionalatlas"
                  className="text-slate-200 hover:text-emerald-400 font-medium transition-colors"
                >
                  Übersicht Regionalatlas
                </Link>
              </li>
              <li>
                <Link
                  href="/bauen-wohnen"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Bauen &amp; Wohnen (BORIS Hessen)
                </Link>
              </li>
              <li>
                <Link
                  href="/demografie"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Demografie &amp; Bildung
                </Link>
              </li>
              <li>
                <Link
                  href="/haushalt"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Finanzen &amp; Haushalt
                </Link>
              </li>
              <li>
                <Link
                  href="/wirtschaft"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Wirtschaft &amp; Gewerbe
                </Link>
              </li>
              <li>
                <Link
                  href="/statistik"
                  className="hover:text-emerald-400 transition-colors"
                >
                  Regionalstatistik &amp; Vereine
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: System & Transparenz */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Transparenz &amp; Open Source
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/quellen"
                  className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                >
                  <FileText className="w-3 h-3" />
                  <span>Datenquellen &amp; Takte</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="hover:text-emerald-400 transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Admin-Bereich</span>
                </Link>
              </li>
              <li>
                <a
                  href="https://www.thethingsindustries.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
                >
                  <span>TTN LoRaWAN Community</span>
                  <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/erik-metz/kamue-digital-lora-sensor"
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            &copy; {new Date().getFullYear()} Open Ried Sens. Freie Daten und
            offene Schnittstellen für das Hessische Ried.
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/" className="hover:text-slate-200 transition-colors">
              Dashboard
            </Link>
            <span>•</span>
            <Link href="/regionalatlas" className="hover:text-slate-200 transition-colors">
              Regionalatlas
            </Link>
            <span>•</span>
            <Link href="/daten" className="hover:text-slate-200 transition-colors">
              API
            </Link>
            <span>•</span>
            <Link href="/quellen" className="hover:text-slate-200 transition-colors">
              Datenquellen
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
