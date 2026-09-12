import { Radio } from "lucide-react";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
        <div className="flex items-center gap-2 text-center sm:text-left">
          <Radio className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Open Ried Sens</strong> – Eine private Bürgerinitiative mit
            dem Kulturzentrum{" "}
            <a
              href="https://kamue.me"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 underline font-medium hover:text-emerald-300 transition-colors"
            >
              KAMÜ
            </a>{" "}
            in Bürstadt.
          </span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-3 text-xs">
          <Link
            href="/"
            className="hover:text-emerald-400 transition-colors"
          >
            Dashboard
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/daten"
            className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
          >
            Offene Daten &amp; API
          </Link>
          <span className="text-slate-700">•</span>
          <Link
            href="/admin"
            className="hover:text-emerald-400 transition-colors"
          >
            Admin-Bereich
          </Link>
          <span className="text-slate-700">•</span>
          <a
            href="https://www.thethingsindustries.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-emerald-400 transition-colors"
          >
            The Things Network
          </a>
          <span className="text-slate-700">•</span>
          <a
            href="https://github.com/erik-metz/kamue-digital-lora-sensor"
            target="_blank"
            rel="noreferrer"
            className="hover:text-emerald-400 transition-colors"
          >
            Open Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
