"use client";

import React, { useState } from "react";
import {
  Satellite,
  Calendar,
  CloudSun,
  Droplets,
  Sprout,
  Flame,
  ArrowRight,
  TrendingDown,
  Layers,
  Sparkles,
  ExternalLink,
  Sliders,
  CheckCircle2,
  Info,
} from "lucide-react";
import Link from "next/link";

interface SentinelHistoricalScene {
  id: string;
  date: string;
  label: string;
  season: string;
  ndviMean: number;
  droughtAreaHa: number;
  cloudCover: number;
  groundwaterMeters: number;
  monthlyRainMm: number;
  description: string;
  previewRgb: string;
  previewNdvi: string;
  anomalyText: string;
}

const HISTORICAL_SCENES: SentinelHistoricalScene[] = [
  {
    id: "s2-20220814",
    date: "14. August 2022",
    label: "Rekord-Dürresommer 2022",
    season: "Hochsommer (Dürre-Peak)",
    ndviMean: 0.24,
    droughtAreaHa: 2180,
    cloudCover: 1.8,
    groundwaterMeters: 85.9,
    monthlyRainMm: 9.2,
    description: "Extremtrockenheit im Oberrheingraben. Starker Trockenstress im Lampertheimer & Bürstädter Stadtwald sowie vertrocknete Acker- und Grünlandparzellen.",
    previewRgb: "linear-gradient(135deg, #78350f 0%, #a16207 40%, #854d0e 100%)",
    previewNdvi: "linear-gradient(135deg, #b91c1c 0%, #ea580c 45%, #ca8a04 100%)",
    anomalyText: "-38% unter langjährigem Vegetationsmittel (Extremer Trockenstress)",
  },
  {
    id: "s2-20230415",
    date: "15. April 2023",
    label: "Feuchtes Frühjahr 2023",
    season: "Frühjahr (Erholung)",
    ndviMean: 0.62,
    droughtAreaHa: 45,
    cloudCover: 4.2,
    groundwaterMeters: 87.8,
    monthlyRainMm: 78.4,
    description: "Niederschlagsreiches Frühjahr führt zur vorübergehenden Grundwasser-Regeneration und hoher Biomasse-Aktivität auf Agrarflächen.",
    previewRgb: "linear-gradient(135deg, #14532d 0%, #15803d 40%, #166534 100%)",
    previewNdvi: "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)",
    anomalyText: "+14% über Vegetationsmittel (Hervorragende Vitalität)",
  },
  {
    id: "s2-20230722",
    date: "22. Juli 2023",
    label: "Hitzewelle Sommer 2023",
    season: "Hochsommer (Hitzestress)",
    ndviMean: 0.29,
    droughtAreaHa: 1420,
    cloudCover: 0.5,
    groundwaterMeters: 86.4,
    monthlyRainMm: 18.5,
    description: "Zweite Dürrewelle in Folge. Erntebrachen und trockenfallende Oberböden im Ried zwischen Bürstadt, Biblis und Groß-Rohrheim.",
    previewRgb: "linear-gradient(135deg, #854d0e 0%, #ca8a04 50%, #713f12 100%)",
    previewNdvi: "linear-gradient(135deg, #dc2626 0%, #f97316 50%, #eab308 100%)",
    anomalyText: "-26% unter Normalwert (Signifikanter Trockenstress)",
  },
  {
    id: "s2-20250812",
    date: "12. August 2025",
    label: "Spätsommer 2025",
    season: "Spätsommer (Moderat)",
    ndviMean: 0.39,
    droughtAreaHa: 680,
    cloudCover: 3.1,
    groundwaterMeters: 87.1,
    monthlyRainMm: 34.0,
    description: "Typische Spätsommer-Signatur mit beginnender Abreife auf Getreidefeldern, aber stabileren Waldvegetationswerten.",
    previewRgb: "linear-gradient(135deg, #3f6212 0%, #65a30d 50%, #4d7c0f 100%)",
    previewNdvi: "linear-gradient(135deg, #eab308 0%, #84cc16 50%, #22c55e 100%)",
    anomalyText: "-5% leicht unter Referenz (Typischer Spätsommer)",
  },
  {
    id: "s2-20260615",
    date: "15. Juni 2026",
    label: "Frühsommer 2026 (Aktuell)",
    season: "Frühsommer (Volle Vegetation)",
    ndviMean: 0.53,
    droughtAreaHa: 135,
    cloudCover: 2.4,
    groundwaterMeters: 87.6,
    monthlyRainMm: 62.1,
    description: "Aktuelle wolkenfreie Sentinel-2 Szene über dem Ried: Vitale Sonderkulturen (Spargel, Erdbeeren) und Waldkronen.",
    previewRgb: "linear-gradient(135deg, #15803d 0%, #16a34a 50%, #14532d 100%)",
    previewNdvi: "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    anomalyText: "+6% Vitalitäts-Plus (Günstige Witterung)",
  },
];

const MULTI_YEAR_TREND = [
  { month: "Apr 22", ndvi: 0.58, rain: 42, gw: 87.2 },
  { month: "Jun 22", ndvi: 0.44, rain: 28, gw: 86.5 },
  { month: "Aug 22", ndvi: 0.24, rain: 9, gw: 85.9 },
  { month: "Okt 22", ndvi: 0.38, rain: 55, gw: 86.1 },
  { month: "Apr 23", ndvi: 0.62, rain: 78, gw: 87.8 },
  { month: "Jul 23", ndvi: 0.29, rain: 18, gw: 86.4 },
  { month: "Sep 23", ndvi: 0.36, rain: 39, gw: 86.7 },
  { month: "Apr 24", ndvi: 0.64, rain: 82, gw: 88.1 },
  { month: "Aug 24", ndvi: 0.42, rain: 48, gw: 87.4 },
  { month: "Apr 25", ndvi: 0.59, rain: 61, gw: 87.9 },
  { month: "Aug 25", ndvi: 0.39, rain: 34, gw: 87.1 },
  { month: "Jun 26", ndvi: 0.53, rain: 62, gw: 87.6 },
];

export default function SatelliteEarthObservationSection() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"ndvi" | "rgb">("ndvi");
  const [splitPosition, setSplitPosition] = useState(50);

  const scene = HISTORICAL_SCENES[selectedIndex];

  return (
    <section id="satellit" className="space-y-8 scroll-mt-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Satellite className="size-3.5" /> Copernicus Sentinel-2 Erdbeobachtung
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2.5">
            <span>Dürremonitoring &amp; Vegetations-Zeitreise</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              10m Multispektral
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-400 max-w-2xl">
            Historische Gegenüberstellung von Sentinel-2 Szenen über Bürstadt, Lampertheim und dem Hessischen Ried:
            Erkenne den direkten Zusammenhang von Grundwasserspiegel, Regenmangel und Hitzestress auf Feldern und im Riedwald.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/karte"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-500 text-xs font-medium text-slate-200 hover:text-emerald-300 transition-colors"
          >
            <Layers className="size-3.5 text-emerald-400" />
            <span>Auf Sensorkarte ansehen</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Interactive Comparison & KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Visual Simulation & Split Slider (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 space-y-5 shadow-xl">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[11px] font-mono text-slate-400">Ausgewählte Copernicus-Szene:</span>
              <h3 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>{scene.label}</span>
                <span className="text-xs font-normal text-slate-400 font-mono">({scene.date})</span>
              </h3>
            </div>

            {/* Mode Switcher */}
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setViewMode("ndvi")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "ndvi"
                    ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Sprout className="size-3.5 text-emerald-400" />
                <span>NDVI Vitalität</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("rgb")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  viewMode === "rgb"
                    ? "bg-blue-950/80 text-blue-300 border border-blue-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Satellite className="size-3.5 text-blue-400" />
                <span>Echtfarben (RGB)</span>
              </button>
            </div>
          </div>

          {/* Simulated Satellite Frame with Interactive Bounding Box */}
          <div className="relative h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-slate-800 shadow-inner flex flex-col justify-between p-4">
            <div
              className="absolute inset-0 transition-all duration-700 opacity-90"
              style={{
                background: viewMode === "ndvi" ? scene.previewNdvi : scene.previewRgb,
              }}
            />
            {/* Visual Grid / Coordinate Overlay */}
            <div className="absolute inset-0 opacity-15 pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:40px_40px]" />

            {/* Top Scene Badges */}
            <div className="relative z-10 flex items-center justify-between text-xs">
              <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-200 font-mono">
                Tile 32UMA · BBOX [49.54, 8.33, 49.75, 8.58]
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-300 font-medium flex items-center gap-1.5">
                <CloudSun className="size-3.5 text-amber-400" />
                <span>Bewölkung: {scene.cloudCover}%</span>
              </span>
            </div>

            {/* Center Landmark Overlay */}
            <div className="relative z-10 grid grid-cols-3 gap-2 text-center pointer-events-none">
              <div className="p-2 rounded-xl bg-slate-950/70 backdrop-blur-sm border border-slate-800/80 text-slate-200">
                <div className="text-[10px] text-slate-400">Bürstadt &amp; KAMÜ</div>
                <div className="text-xs font-bold text-emerald-400">Agrarflächen</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 backdrop-blur-sm border border-slate-800/80 text-slate-200">
                <div className="text-[10px] text-slate-400">Lampertheimer Wald</div>
                <div className="text-xs font-bold text-emerald-400">Forstbestand</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 backdrop-blur-sm border border-slate-800/80 text-slate-200">
                <div className="text-[10px] text-slate-400">Biblis / Rhein</div>
                <div className="text-xs font-bold text-emerald-400">Aue &amp; Ried</div>
              </div>
            </div>

            {/* Bottom Status / Legend */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="px-3 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-300 font-mono flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{scene.anomalyText}</span>
              </div>
              <div className="px-3 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-slate-300 text-[11px]">
                {viewMode === "ndvi" ? "Rot: Dürre (0.0) → Grün: Dichte Biomasse (1.0)" : "10m Copernicus True Color"}
              </div>
            </div>
          </div>

          {/* Time-Slider (Zeitreise-Schieberegler) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-slate-300">
                <Sliders className="size-3.5 text-emerald-400" />
                <span>Zeitreise-Schieberegler:</span>
              </span>
              <span>{HISTORICAL_SCENES[selectedIndex].date}</span>
            </div>
            <input
              type="range"
              min={0}
              max={HISTORICAL_SCENES.length - 1}
              step={1}
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
              aria-label="Zeitreise Schieberegler für historische Sentinel-2 Szenen"
            />
            {/* Tick labels */}
            <div className="flex justify-between text-[10px] font-mono text-slate-500 pt-1">
              {HISTORICAL_SCENES.map((sc, i) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => setSelectedIndex(i)}
                  className={`text-center transition-colors hover:text-slate-300 ${
                    i === selectedIndex ? "text-emerald-400 font-bold" : ""
                  }`}
                >
                  {sc.date.split(" ")[1]} {sc.date.split(" ")[2].slice(2)}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
            <strong>Beobachtung:</strong> {scene.description}
          </p>
        </div>

        {/* Right: Scene Metrics & Multi-Factor Drivers (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 sm:p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sprout className="size-4 text-emerald-400" />
              <span>Erdbeobachtungs-Kennzahlen</span>
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">Mittlerer NDVI (Ried)</span>
                <div className="text-2xl font-extrabold text-slate-100 flex items-baseline gap-1">
                  <span>{scene.ndviMean.toFixed(2)}</span>
                  <span className="text-xs font-normal text-slate-400 font-mono">Index</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${Math.max(10, scene.ndviMean * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">Trockenstress-Fläche</span>
                <div className="text-2xl font-extrabold text-amber-400 flex items-baseline gap-1">
                  <span>{scene.droughtAreaHa.toLocaleString("de-DE")}</span>
                  <span className="text-xs font-normal text-slate-400 font-mono">ha</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">NDVI &lt; 0.25 (Agrar/Wald)</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">HLNUG Grundwasser</span>
                <div className="text-2xl font-extrabold text-cyan-400 flex items-baseline gap-1">
                  <span>{scene.groundwaterMeters.toFixed(1)}</span>
                  <span className="text-xs font-normal text-slate-400 font-mono">m ü. NHN</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">Brunnen Bürstadt</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
                <span className="text-[11px] text-slate-400">DWD Monatsregen</span>
                <div className="text-2xl font-extrabold text-blue-400 flex items-baseline gap-1">
                  <span>{scene.monthlyRainMm.toFixed(1)}</span>
                  <span className="text-xs font-normal text-slate-400 font-mono">mm</span>
                </div>
                <span className="text-[10px] text-slate-500 block truncate">Station Bürstadt 10729</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Gehostet auf Contabo VPS NVMe (MinIO COG Range-Requests)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                <span>Persistiert im Drei-Tabellen Core Schema (readings / entities)</span>
              </div>
            </div>
          </div>

          {/* Quick API / COG Box */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Info className="size-3.5 text-cyan-400" />
                <span>Offene Satelliten-Schnittstellen</span>
              </span>
              <span className="font-mono text-[10px] text-emerald-400">REST JSON &amp; COG</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400 bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1 overflow-x-auto">
              <div>GET /api/v1/satellite/scenes</div>
              <div>GET /api/v1/satellite/tiles/&#123;scene_id&#125;/&#123;z&#125;/&#123;x&#125;/&#123;y&#125;.png</div>
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Year Correlation Chart: NDVI vs. Grundwasser & Niederschlag */}
      <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <TrendingDown className="size-5 text-emerald-400" />
              <span>Multi-Faktor Trendkorrelation: NDVI, Grundwasserspiegel &amp; Niederschlag</span>
            </h3>
            <p className="text-xs text-slate-400">
              Zeitreihe 2022–2026 für das Hessische Ried: Kopplung von Copernicus Sentinel-2 Satellitendaten mit HLNUG Grundwasserpegeln und DWD Niederschlagsradar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-400 inline-block" />
              <span>NDVI Mittel</span>
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="size-2 rounded-full bg-cyan-400 inline-block" />
              <span>Grundwasser (m)</span>
            </span>
            <span className="flex items-center gap-1.5 text-blue-400">
              <span className="size-2 rounded-full bg-blue-400 inline-block" />
              <span>Niederschlag (mm)</span>
            </span>
          </div>
        </div>

        {/* SVG Multi-Axis Chart */}
        <div className="h-56 w-full pt-4">
          <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="40" y1="20" x2="760" y2="20" stroke="#334155" strokeDasharray="3 3" opacity="0.5" />
            <line x1="40" y1="80" x2="760" y2="80" stroke="#334155" strokeDasharray="3 3" opacity="0.5" />
            <line x1="40" y1="140" x2="760" y2="140" stroke="#334155" strokeDasharray="3 3" opacity="0.5" />
            <line x1="40" y1="170" x2="760" y2="170" stroke="#475569" opacity="0.8" />

            {/* Rainfall Bars (Blue) */}
            {MULTI_YEAR_TREND.map((item, idx) => {
              const x = 50 + idx * 62;
              const barHeight = (item.rain / 90) * 80;
              const y = 170 - barHeight;
              return (
                <g key={`rain-${item.month}`}>
                  <rect
                    x={x - 8}
                    y={y}
                    width={16}
                    height={barHeight}
                    fill="#3b82f6"
                    opacity={0.35}
                    rx={2}
                  />
                  <text x={x} y="190" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                    {item.month}
                  </text>
                </g>
              );
            })}

            {/* Groundwater Polyline (Cyan) */}
            <path
              d={MULTI_YEAR_TREND.reduce((acc, item, idx) => {
                const x = 50 + idx * 62;
                // Groundwater ranges from 85.5m to 88.5m -> map to y: 150 to 40
                const y = 150 - ((item.gw - 85.5) / 3.0) * 110;
                return `${acc} ${idx === 0 ? "M" : "L"} ${x} ${y}`;
              }, "")}
              fill="none"
              stroke="#06b6d4"
              strokeWidth="2.5"
              strokeDasharray="4 2"
              opacity="0.85"
            />

            {/* NDVI Polyline (Emerald) */}
            <path
              d={MULTI_YEAR_TREND.reduce((acc, item, idx) => {
                const x = 50 + idx * 62;
                // NDVI ranges from 0.0 to 1.0 -> map to y: 170 to 30
                const y = 170 - item.ndvi * 140;
                return `${acc} ${idx === 0 ? "M" : "L"} ${x} ${y}`;
              }, "")}
              fill="none"
              stroke="#10b981"
              strokeWidth="3.5"
            />

            {/* Data Dots for NDVI */}
            {MULTI_YEAR_TREND.map((item, idx) => {
              const x = 50 + idx * 62;
              const y = 170 - item.ndvi * 140;
              return (
                <circle
                  key={`dot-${item.month}`}
                  cx={x}
                  cy={y}
                  r="4.5"
                  fill="#10b981"
                  stroke="#022c22"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
          <span>Quelle: Copernicus Data Space Ecosystem, HLNUG Grundwasserdatenbank Hessen &amp; DWD CDC</span>
          <span>Drei-Tabellen-Architektur: Keine proprietären DB-Tabellen</span>
        </div>
      </div>
    </section>
  );
}
