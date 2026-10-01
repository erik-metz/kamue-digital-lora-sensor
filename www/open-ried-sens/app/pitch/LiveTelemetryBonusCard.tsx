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
  Terminal,
  Layers,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import {
  calculateLiveRegionalMetrics,
  getLiveEventFeed,
  type LiveRegionalMetrics,
  type LiveEventLogItem,
} from "@/lib/pitchLiveTicker";

interface LiveTelemetryBonusCardProps {
  elapsedSeconds: number;
}

export default function LiveTelemetryBonusCard({
  elapsedSeconds,
}: LiveTelemetryBonusCardProps) {
  const [activeTab, setActiveTab] = useState<"cockpit" | "stream" | "pipelines">("cockpit");
  const [metrics, setMetrics] = useState<LiveRegionalMetrics>(() =>
    calculateLiveRegionalMetrics(elapsedSeconds)
  );
  const [eventFeed, setEventFeed] = useState<LiveEventLogItem[]>(() =>
    getLiveEventFeed(elapsedSeconds)
  );

  useEffect(() => {
    setMetrics(calculateLiveRegionalMetrics(elapsedSeconds));
    setEventFeed(getLiveEventFeed(elapsedSeconds));
  }, [elapsedSeconds]);

  function getCategoryIcon(cat: LiveEventLogItem["category"]) {
    switch (cat) {
      case "lora":
        return <Radio className="w-4 h-4 text-emerald-400" />;
      case "zakb":
        return <Trash2 className="w-4 h-4 text-orange-400" />;
      case "bahn":
        return <Train className="w-4 h-4 text-sky-400" />;
      case "parking":
        return <Car className="w-4 h-4 text-violet-400" />;
      case "umwelt":
        return <Droplets className="w-4 h-4 text-emerald-400" />;
    }
  }

  return (
    <div className="w-full bg-slate-900/95 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in duration-300">
      {/* Background High-Tech Grid Effect */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Control Room Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-xs font-black tracking-widest uppercase text-emerald-400 font-mono">
              Live Regional-Telemetrie · Open Ried Sens
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-slate-200 font-mono">
              ⏱️ Vortragsdauer: {metrics.formattedDuration}
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-100 tracking-tight">
            Was im Ried passiert ist, während Sie diesen Pitch gehört haben
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 font-light">
            Echte, synchronisierte Datenströme aus Müllabfuhr, Bahnübergängen, Parkplätzen & LoRaWAN-Klimastationen.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-2xl shrink-0 self-start md:self-center">
          <button
            onClick={() => setActiveTab("cockpit")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "cockpit"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📊 Kennzahlen
          </button>
          <button
            onClick={() => setActiveTab("stream")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "stream"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🛰️ Live-Stream
          </button>
          <button
            onClick={() => setActiveTab("pipelines")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "pipelines"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📡 Pipelines
          </button>
        </div>
      </div>

      {/* TAB 1: COCKPIT (Big Metrics with Gauges) */}
      {activeTab === "cockpit" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
            {/* ZAKB Waste Bins */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-1.5 relative overflow-hidden group hover:border-orange-500/50 transition-all">
              <div className="flex items-center justify-between text-slate-400">
                <Trash2 className="w-4 h-4 text-orange-400" />
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider font-mono">
                  {metrics.isDaytime ? "ZAKB GPS Live" : "ZAKB Depot"}
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-100 font-mono tracking-tight">
                {metrics.binsEmptied}
              </div>
              <div className="text-xs font-bold text-slate-200">
                {metrics.isDaytime ? "Tonnen geleert" : "Tourenpause (Nacht)"}
              </div>
              <p className="text-[10px] text-slate-400 font-light leading-snug">
                {metrics.binsStatusText}
              </p>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-orange-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metrics.isDaytime ? Math.min(100, metrics.binsEmptied * 3) : 0}%` }}
                />
              </div>
            </div>

            {/* Level Crossing Events */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-1.5 relative overflow-hidden group hover:border-rose-500/50 transition-all">
              <div className="flex items-center justify-between text-slate-400">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider font-mono">
                  Schranken
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-100 font-mono tracking-tight">
                {metrics.levelCrossingEvents}
              </div>
              <div className="text-xs font-bold text-slate-200">
                Schranken-Aktionen
              </div>
              <p className="text-[10px] text-slate-400 font-light leading-snug">
                Öffnung/Schließung B47 & Bobstadt
              </p>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-rose-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, metrics.levelCrossingEvents * 15)}%` }}
                />
              </div>
            </div>

            {/* Trains traversed */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-1.5 relative overflow-hidden group hover:border-sky-500/50 transition-all">
              <div className="flex items-center justify-between text-slate-400">
                <Train className="w-4 h-4 text-sky-400" />
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider font-mono">
                  Riedbahn
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-100 font-mono tracking-tight">
                {metrics.trainsTraversed}
              </div>
              <div className="text-xs font-bold text-slate-200">
                Züge durchquert
              </div>
              <p className="text-[10px] text-slate-400 font-light leading-snug">
                ICE, RE 70, RB 63 & Güterverkehr
              </p>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-sky-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, metrics.trainsTraversed * 25)}%` }}
                />
              </div>
            </div>

            {/* LoRaWAN Telemetry Packets */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-1.5 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="flex items-center justify-between text-slate-400">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono">
                  LoRa 868 MHz
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
                {metrics.telemetryPackets}
              </div>
              <div className="text-xs font-bold text-slate-200">
                Messpakete erfasst
              </div>
              <p className="text-[10px] text-slate-400 font-light leading-snug">
                CO2, PM2.5, Feuchte, Temp, Druck
              </p>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (metrics.telemetryPackets / 300) * 100)}%` }}
                />
              </div>
            </div>

            {/* Parking Spot Changes */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-1.5 relative overflow-hidden group hover:border-violet-500/50 transition-all">
              <div className="flex items-center justify-between text-slate-400">
                <Car className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider font-mono">
                  smartcity-system
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-100 font-mono tracking-tight">
                {metrics.parkingStateChanges}
              </div>
              <div className="text-xs font-bold text-slate-200">
                Park-Ereignisse
              </div>
              <p className="text-[10px] text-slate-400 font-light leading-snug">
                Marktplatz Bürstadt belegt/frei
              </p>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-violet-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, metrics.parkingStateChanges * 10)}%` }}
                />
              </div>
            </div>

            {/* Solar Energy Generated */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/90 space-y-1.5 relative overflow-hidden group hover:border-yellow-500/50 transition-all">
              <div className="flex items-center justify-between text-slate-400">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider font-mono">
                  {metrics.isDaytime ? "Solar PV" : "Solar Nacht"}
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-100 font-mono tracking-tight">
                {metrics.solarKwhGenerated}
              </div>
              <div className="text-xs font-bold text-slate-200">
                kWh Solarstrom
              </div>
              <p className="text-[10px] text-slate-400 font-light leading-snug">
                {metrics.solarStatusText}
              </p>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                <div
                  className="bg-yellow-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metrics.isDaytime ? Math.min(100, parseFloat(metrics.solarKwhGenerated) * 5) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE EVENT STREAM (Terminal Logbuch) */}
      {activeTab === "stream" && (
        <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 text-slate-400 text-[11px]">
            <span className="flex items-center gap-2 text-emerald-400 font-bold">
              <Terminal className="w-3.5 h-3.5" />
              <span>Echtzeit-Event-Logbuch (Neueste zuerst)</span>
            </span>
            <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
              Live Ingestion TimescaleDB
            </span>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {eventFeed.map((evt) => (
              <div
                key={evt.id}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 shrink-0 mt-0.5">
                    {getCategoryIcon(evt.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{evt.title}</span>
                      <span className="text-[10px] font-sans px-2 py-0.2 rounded bg-slate-800 text-slate-400">
                        {evt.location}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                      {evt.detail}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {evt.timeAgoFormatted}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PIPELINES HEALTH */}
      {activeTab === "pipelines" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-200">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Integrierte Live-Schnittstellen</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-slate-300">ZAKB Abfalltouren & Entsorgung</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">Synchron (100%)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-slate-300">Riedbahn Mobilitäts- & Schrankenradar</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">Aktiv (Geofenced)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-slate-300">The Things Network (TTN) EU868</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">MQTT Stream OK</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-slate-300">smartcity-system.de Bürstadt Parken</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">REST Polling 30s</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>System-Performanz & Souveränität</span>
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-slate-300">TimescaleDB Zeitreihen-Speicher</span>
                <span className="text-sky-300 font-mono font-bold text-[11px]">Lokal (Kein US-Cloud Zwang)</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-slate-300">Open-Data API Latenz</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">&lt; 250 ms</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-slate-300">DSGVO & Datenschutz</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">100% Anonym / Konform</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="text-slate-300">Kulturzentrum KAMÜ Server-Node</span>
                <span className="text-emerald-400 font-mono font-bold text-[11px]">Online (Bürstadt)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Footer */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t border-slate-800/80">
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            Verifiziert im Hessischen Ried · Kulturzentrum KAMÜ Bürgerlabor
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/?preset=mobility&darstellung=satellit"
            target="_blank"
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <span>Live-Karte mit diesen Daten im Vollbild öffnen</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
