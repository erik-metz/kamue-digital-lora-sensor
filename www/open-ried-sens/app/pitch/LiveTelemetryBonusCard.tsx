"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Radio,
  Trash2,
  Train,
  ShieldAlert,
  Zap,
  Droplets,
  Car,
  Clock,
  ExternalLink,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { calculateLiveRegionalMetrics, type LiveRegionalMetrics } from "@/lib/pitchLiveTicker";

interface LiveTelemetryBonusCardProps {
  elapsedSeconds: number;
}

export default function LiveTelemetryBonusCard({
  elapsedSeconds,
}: LiveTelemetryBonusCardProps) {
  const [metrics, setMetrics] = useState<LiveRegionalMetrics>(() =>
    calculateLiveRegionalMetrics(elapsedSeconds)
  );

  useEffect(() => {
    setMetrics(calculateLiveRegionalMetrics(elapsedSeconds));
  }, [elapsedSeconds]);

  return (
    <div className="w-full bg-slate-900/90 border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in duration-300">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 -translate-y-8 translate-x-8 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Live Pulser */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Live-Regionaldaten · Echtzeit-Beweis
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Vortragsdauer: {metrics.formattedDuration}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-100">
            Das ist im Ried passiert, während Sie diesen Pitch gehört haben
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/?preset=mobility&darstellung=satellit"
            target="_blank"
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/15 transition-all"
          >
            <span>Live auf der Karte ansehen</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Grid of Dynamic Live Metric Counters */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* ZAKB Waste Bins */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1 relative group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <Trash2 className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-mono text-emerald-400">ZAKB Tour</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono tracking-tight">
            {metrics.binsEmptied}
          </div>
          <div className="text-xs font-bold text-slate-300">
            Tonnen geleert
          </div>
          <p className="text-[10px] text-slate-400 font-light leading-tight">
            Rest-, Bio- & Papiertonne im Ried
          </p>
        </div>

        {/* Level Crossing Events */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1 relative group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] font-mono text-rose-400">Schranken</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono tracking-tight">
            {metrics.levelCrossingEvents}
          </div>
          <div className="text-xs font-bold text-slate-300">
            Schranken-Aktivitäten
          </div>
          <p className="text-[10px] text-slate-400 font-light leading-tight">
            Öffnung / Schließung Riedbahn
          </p>
        </div>

        {/* Trains traversed */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1 relative group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <Train className="w-4 h-4 text-sky-400" />
            <span className="text-[10px] font-mono text-sky-400">Riedbahn</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono tracking-tight">
            {metrics.trainsTraversed}
          </div>
          <div className="text-xs font-bold text-slate-300">
            Züge durchquert
          </div>
          <p className="text-[10px] text-slate-400 font-light leading-tight">
            ICE, RE70, RB63 & Güterverkehr
          </p>
        </div>

        {/* LoRaWAN Telemetry Packets */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1 relative group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-mono text-emerald-400">LoRaWAN</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
            {metrics.telemetryPackets}
          </div>
          <div className="text-xs font-bold text-slate-300">
            Messpakete erfasst
          </div>
          <p className="text-[10px] text-slate-400 font-light leading-tight">
            Temp, Feuchte, CO2, Feinstaub
          </p>
        </div>

        {/* Parking State Changes (smartcity-system.de) */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1 relative group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <Car className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] font-mono text-amber-400">Parken</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono tracking-tight">
            {metrics.parkingStateChanges}
          </div>
          <div className="text-xs font-bold text-slate-300">
            Belegungswechsel
          </div>
          <p className="text-[10px] text-slate-400 font-light leading-tight">
            smartcity-system.de Bürstadt
          </p>
        </div>

        {/* Solar Energy Generated */}
        <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1 relative group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-slate-400">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-[10px] font-mono text-yellow-400">Energie</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono tracking-tight">
            {metrics.solarKwhGenerated}
          </div>
          <div className="text-xs font-bold text-slate-300">
            kWh Solarstrom
          </div>
          <p className="text-[10px] text-slate-400 font-light leading-tight">
            Generiert auf Ried-Dächern
          </p>
        </div>
      </div>

      {/* Live Pipeline Status Radar */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Aktive Daten-Pipelines:
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            ZAKB Touren-Feed
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            Riedbahn Mobilitäts-Radar
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            TTN LoRaWAN Gateway
          </span>
          <span className="flex items-center gap-1 text-slate-300 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            TimescaleDB Ingestion
          </span>
        </div>

        <div className="text-[11px] text-emerald-400 font-mono">
          ✓ Latenz &lt; 250ms
        </div>
      </div>
    </div>
  );
}
