"use client";

import {
  Box,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Layers,
  Play,
  Printer,
  Sparkles,
  Video,
} from "lucide-react";

export default function DownloadsAndMediaSection() {
  return (
    <section id="downloads" className="space-y-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <Download className="w-3.5 h-3.5" /> Downloads &amp; Medien
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Vorlagen, 3D-Druck (STL) &amp; Video-Tutorial
        </h2>
        <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
          Hier findest du alle digitalen Hilfsmittel für den Zusammenbau deiner Station:
          Gehäuse-Dateien für deinen 3D-Drucker, druckbare PDF-Datenblätter und den Video-Demoleitfaden.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* VIDEO TUTORIAL DEMO (PLACEHOLDER) */}
        <div className="lg:col-span-2 rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Video className="w-4 h-4" /> Video-Tutorial (Zusammenbau)
              </span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-medium">
                In Vorbereitung für Workshop-Saison
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-100">
              Video-Leitfaden: Von der Platine bis zum ersten Funk-Telegramm
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              In diesem ca. 15-minütigen Video zeigen wir dir in Nahaufnahme: das Anlöten der
              I²C-Sensoren an das RAK3113-Board, den Einbau in das Lamellengehäuse und die
              Live-Überprüfung auf der Open-Ried-Sens Karte.
            </p>
          </div>

          {/* VIDEO PLAYER PREVIEW CONTAINER (PLACEHOLDER) */}
          <div className="relative group overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center shadow-inner">
            {/* Background Aesthetic */}
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-950/30 opacity-80" />
            <div className="absolute top-4 left-4 flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-emerald-400" /> ca. 15 Minuten
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-slate-400 bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800">
              <span>Kapitel: Werkzeug · Löten · Stevenson-Gehäuse · TTN-Test</span>
              <span className="text-emerald-400 font-semibold">1080p HD</span>
            </div>

            {/* Big Play Button Overlay */}
            <div className="relative z-10 flex flex-col items-center gap-3">
              <button
                type="button"
                className="w-16 h-16 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/20 hover:scale-110 transition-transform group-hover:bg-emerald-300"
                aria-label="Video abspielen"
              >
                <Play className="w-7 h-7 fill-slate-950 ml-1" />
              </button>
              <span className="text-xs font-medium text-slate-300 text-center">
                Video-Demo wird zum nächsten Workshop freigeschaltet
              </span>
            </div>
          </div>
        </div>

        {/* 3D-PRINT & PDF DOWNLOAD CARDS */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* 3D-PRINT STL CARD */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                <Box className="w-4 h-4" />
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                STL / 3D-Druck
              </span>
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-base">
                Stevenson Screen Gehäuse
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Wetterfeste Lamellenkonstruktion mit Montageplatte für RAK3113, SPS30-Kanal und
                Sensirion-Sensoren.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
              <div><strong>Material:</strong> PETG oder ASA (weiß, UV-stabil)</div>
              <div><strong>Infill:</strong> 20–30 % · 4 Wandlinien</div>
            </div>
            <a
              href="https://github.com/erik-metz/kamue-digital-lora-sensor/tree/main/hardware/sensor-node/v2/3d-prints"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold px-4 py-2.5 text-xs transition-colors border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>STL-Dateien im GitHub Repo ansehen</span>
              <ExternalLink className="w-3 h-3 text-slate-500 ml-1" />
            </a>
          </div>

          {/* PDF MANUAL CHEATSHEET CARD */}
          <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                PDF-Download
              </span>
            </div>
            <div>
              <h4 className="font-bold text-slate-100 text-base">
                Bauanleitung &amp; Pinout-Spickzettel
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Kompakte 2-seitige Schnellübersicht mit I²C-Adressenliste, Schaltplan und
                Lötanleitung zum Ausdrucken auf die Werkbank.
              </p>
            </div>
            <a
              href="https://github.com/erik-metz/kamue-digital-lora-sensor/blob/main/hardware/sensor-node/v2/bom.md"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 text-xs transition-colors border border-slate-700"
            >
              <Printer className="w-3.5 h-3.5 text-blue-400" />
              <span>BOM &amp; Schaltplan Dokumentation</span>
              <ExternalLink className="w-3 h-3 text-slate-500 ml-1" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
