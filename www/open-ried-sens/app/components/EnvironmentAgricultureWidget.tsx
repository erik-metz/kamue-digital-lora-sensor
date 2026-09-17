"use client";

import { useState } from "react";
import {
  Droplets,
  Sprout,
  ShieldCheck,
  Waves,
  TreePine,
  AlertTriangle,
  Info,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  DEFAULT_PROTECTED_AREAS,
  DEFAULT_AGRICULTURE_STATS,
  DEFAULT_FLOOD_GAUGES,
} from "@/lib/environmentData";

const GROUNDWATER_WELLS = [
  { id: "gw-bst-boxheimerhof", name: "Bürstadt Boxheimerhof", depth: 2.15, nitrate: 28.4, status: "normal" },
  { id: "gw-bst-riedrode", name: "Bürstadt Riedrode", depth: 1.85, nitrate: 19.2, status: "normal" },
  { id: "gw-la-neuschloss", name: "Lampertheim Neuschloß", depth: 3.40, nitrate: 22.1, status: "normal" },
  { id: "gw-la-biedensand", name: "Lampertheim Biedensand", depth: 1.20, nitrate: 14.5, status: "normal" },
  { id: "gw-bib-wattenheim", name: "Biblis-Wattenheim", depth: 2.30, nitrate: 36.8, status: "normal" },
];

export default function EnvironmentAgricultureWidget() {
  const [activeTab, setActiveTab] = useState<"agriculture" | "groundwater" | "nature">("agriculture");
  const [selectedMunicipality, setSelectedMunicipality] = useState<"Bürstadt" | "Lampertheim">("Bürstadt");

  const muniStats = DEFAULT_AGRICULTURE_STATS.filter(
    (s) => s.municipality === selectedMunicipality
  );
  const totalAgriHectares = muniStats.reduce((acc, s) => acc + s.area_hectares, 0);

  return (
    <div className="rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 sm:p-8 space-y-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <Sprout className="size-3.5" /> Umwelt & Landwirtschaft im Ried
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-100">
            Grundwasser, Anbaukulturen & Naturschutzgebiete
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Reale Umwelt- und Geodaten für Bürstadt, Lampertheim und das Hessische Ried – von Grundwasserpegeln bis zum regionalen Spargelanbau.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-3.5 py-1.5 rounded-full text-xs self-start sm:self-auto">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-medium">
            Open Data HLNUG & InVeKoS
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Groundwater */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Mittlerer Flurabstand</span>
            <Droplets className="size-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-sky-300">
            2,18 m
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
            <span>Grundwasserstand stabil</span>
          </div>
        </div>

        {/* KPI 2: River Gauges */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Rheinpegel Worms</span>
            <Waves className="size-4 text-cyan-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-cyan-300">
            2,78 m
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
            <span>Meldestufe 1 (4,50m) unkritisch</span>
          </div>
        </div>

        {/* KPI 3: Asparagus & Veg */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Spargelanbaufläche</span>
            <Sprout className="size-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-purple-300">
            1.105 ha
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>Gemüsegarten Hessens</span>
          </div>
        </div>

        {/* KPI 4: Protected Nature Area */}
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Schutzgebiete</span>
            <TreePine className="size-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-emerald-300">
            3.234 ha
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span>NSG Altrhein, FFH-Wälder & WSG</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("agriculture")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "agriculture"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          🌾 Landwirtschaft & Kulturen
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("groundwater")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "groundwater"
              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          💧 Grundwasser & Pegel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("nature")}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "nature"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          🌿 Naturschutzgebiete
        </button>
      </div>

      {/* TAB 1: AGRICULTURE */}
      {activeTab === "agriculture" && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-800/80">
            <span className="text-xs text-slate-300 font-medium">
              Kommune auswählen ({totalAgriHectares.toFixed(0)} ha bewirtschaftet):
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedMunicipality("Bürstadt")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedMunicipality === "Bürstadt"
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "bg-slate-900 text-slate-300 border border-slate-800"
                }`}
              >
                Bürstadt
              </button>
              <button
                type="button"
                onClick={() => setSelectedMunicipality("Lampertheim")}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  selectedMunicipality === "Lampertheim"
                    ? "bg-emerald-500 text-slate-950 shadow-md"
                    : "bg-slate-900 text-slate-300 border border-slate-800"
                }`}
              >
                Lampertheim
              </button>
            </div>
          </div>

          {/* Crop Breakdown Rows */}
          <div className="space-y-3">
            {muniStats.map((s) => {
              const barColor =
                s.crop_family === "sonderkultur"
                  ? "bg-purple-500"
                  : s.crop_family === "gemuese"
                  ? "bg-emerald-500"
                  : s.crop_family === "getreide"
                  ? "bg-amber-500"
                  : "bg-cyan-500";

              return (
                <div key={s.crop_name} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/60 space-y-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-semibold text-slate-200">{s.crop_name}</span>
                    <span className="font-mono text-slate-300">
                      <strong>{s.area_hectares.toFixed(1)} ha</strong> ({s.percentage_of_agricultural_land.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${barColor} rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, s.percentage_of_agricultural_land * 3)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div>
              <strong>Agrarhistorischer Kontext:</strong> Das Hessische Ried war im 19. und 20. Jahrhundert eines der bedeutendsten Tabakanbaugebiete Deutschlands. Heute dominieren die Sonderkulturen Spargel und Freilandgemüse, die aufgrund des sandigen Bodens und warmen Rheinebenen-Klimas auf gezielte Grundwasserberegnung angewiesen sind.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GROUNDWATER & GAUGES */}
      {activeTab === "groundwater" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* River Gauges */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                🌊 Rhein- & Weschnitz-Pegel
              </h4>
              {DEFAULT_FLOOD_GAUGES.map((g) => (
                <div key={g.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-sm">{g.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium">
                      Normal
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-sky-300 font-mono">
                      {g.current_level_m.toFixed(2)} m
                    </span>
                    <span className="text-xs text-slate-400">
                      Meldestufe 1 ab {g.alarm_level_1_m.toFixed(2)} m
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Quelle: {g.source === "pegelonline_wsv" ? "Wasserstraßen- und Schifffahrtsverwaltung (WSV)" : "HLNUG"}
                  </div>
                </div>
              ))}
            </div>

            {/* Groundwater Monitoring Wells */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                💧 HLNUG Grundwassermessstellen (Flurabstand & Nitrat)
              </h4>
              <div className="space-y-2">
                {GROUNDWATER_WELLS.map((w) => (
                  <div key={w.id} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{w.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        Flurabstand: <strong className="text-sky-300">{w.depth.toFixed(2)} m u. GOK</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-mono font-semibold ${w.nitrate > 50 ? "text-red-400" : w.nitrate > 25 ? "text-amber-300" : "text-emerald-400"}`}>
                        {w.nitrate.toFixed(1)} mg/l
                      </div>
                      <div className="text-[10px] text-slate-500">Nitrat (EU-Grenzwert 50)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 flex items-start gap-2.5">
            <Droplets className="size-4 shrink-0 mt-0.5" />
            <div>
              <strong>Ried-Grundwassersteuerung:</strong> Das Hessische Ried unterliegt einer strengen Bewirtschaftung nach dem Infiltrations- und Entnahmeplan des Wasserverbandes Hessisches Ried (WHR), um gleichzeitig Vernässungen von Wohngebäuden und Trockenschäden der Landwirtschaft zu verhindern.
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NATURE RESERVES */}
      {activeTab === "nature" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {DEFAULT_PROTECTED_AREAS.map((n) => (
              <div key={n.id} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold uppercase mb-1">
                    <span>{n.designation.toUpperCase()}</span>
                    <span>{n.municipality}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100">{n.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-3">
                    {n.conservation_aims}
                  </p>
                </div>
                <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Fläche: <strong className="text-emerald-300">{n.area_hectares} ha</strong></span>
                  <span>seit {n.legal_ordinance_year || "k.A."}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
            <ShieldCheck className="size-4 shrink-0 mt-0.5" />
            <div>
              <strong>Biosphäre & Artenschutz:</strong> Mit dem Lampertheimer Altrhein besitzt das Ried eines der wertvollsten Feuchtgebiete Mitteleuropas. Es dient Weißstörchen, Purpurreihern und seltenen Zugvogelarten als Kernbiotop und steht unter europäischem Vogelschutz (Natura 2000).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
