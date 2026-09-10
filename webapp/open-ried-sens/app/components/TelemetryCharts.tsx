"use client";

import { useState } from "react";
import { SensorNode } from "./MapComponent";
import { Thermometer, Volume2, CloudFog, Signal, Activity, Wind, Sun, Droplets } from "lucide-react";

interface TelemetryChartsProps {
  node: SensorNode;
}

export default function TelemetryCharts({ node }: TelemetryChartsProps) {
  const [activeTab, setActiveTab] = useState<"klima" | "laerm" | "luft" | "lora">("klima");

  // Simulated 12-point time series data for the selected node
  const generateHistoryData = () => {
    const hours = ["00:00", "02:00", "04:00", "06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
    return hours.map((time, idx) => {
      const offset = (Math.sin(idx) * 2.5);
      return {
        time,
        temp: Math.round((node.temp + offset) * 10) / 10,
        humidity: Math.min(100, Math.max(30, Math.round(node.humidity - offset * 3))),
        noiseDb: Math.min(95, Math.max(35, Math.round(node.noiseDb + offset * 4))),
        pm25: Math.min(50, Math.max(5, Math.round(node.pm25 + Math.cos(idx) * 3))),
        rssi: Math.round(node.rssi + Math.sin(idx * 2) * 3),
      };
    });
  };

  const history = generateHistoryData();

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col gap-6">
      {/* Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-slate-100">
              Echtzeit-Analyse & Zeitverlauf
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Station: <span className="text-emerald-400 font-semibold">{node.name}</span> ({node.locationName})
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab("klima")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "klima"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" /> Klima & Wetter
          </button>
          <button
            onClick={() => setActiveTab("laerm")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "laerm"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" /> Lärm & Mikrofon
          </button>
          <button
            onClick={() => setActiveTab("luft")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "luft"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CloudFog className="w-3.5 h-3.5" /> Luft & Feinstaub
          </button>
          <button
            onClick={() => setActiveTab("lora")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "lora"
                ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Signal className="w-3.5 h-3.5" /> LoRaWAN Signal
          </button>
        </div>
      </div>

      {/* Grid of Key Sensor Values */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-amber-400" /> Temperatur
          </span>
          <span className="text-2xl font-bold text-slate-100 mt-2">
            {node.temp.toFixed(1)} <span className="text-sm font-normal text-slate-400">°C</span>
          </span>
          <span className="text-[11px] text-slate-500 mt-1">24h Max: {(node.temp + 3.2).toFixed(1)} °C</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Droplets className="w-4 h-4 text-blue-400" /> Luftfeuchtigkeit
          </span>
          <span className="text-2xl font-bold text-slate-100 mt-2">
            {node.humidity} <span className="text-sm font-normal text-slate-400">%</span>
          </span>
          <span className="text-[11px] text-slate-500 mt-1">Taupunkt: ~{(node.temp - (100 - node.humidity) / 5).toFixed(1)} °C</span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-purple-400" /> Akustik & Lärm
          </span>
          <span className="text-2xl font-bold text-slate-100 mt-2">
            {node.noiseDb} <span className="text-sm font-normal text-slate-400">dB(A)</span>
          </span>
          <span className="text-[11px] text-emerald-400 mt-1 font-medium">
            Klassifikation: {node.noiseLabel}
          </span>
        </div>

        <div className="bg-slate-950/60 border border-slate-800/80 p-4 rounded-xl flex flex-col">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <CloudFog className="w-4 h-4 text-cyan-400" /> Feinstaub PM2.5
          </span>
          <span className="text-2xl font-bold text-slate-100 mt-2">
            {node.pm25} <span className="text-sm font-normal text-slate-400">µg/m³</span>
          </span>
          <span className="text-[11px] text-emerald-400 mt-1 font-medium">
            Status: Sehr gut
          </span>
        </div>
      </div>

      {/* SVG Time-Series Chart */}
      <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {activeTab === "klima" && "24h-Temperaturverlauf (°C)"}
            {activeTab === "laerm" && "24h-Lärmpegelmessung (dB SPL)"}
            {activeTab === "luft" && "24h-Feinstaubbelastung PM2.5 (µg/m³)"}
            {activeTab === "lora" && "24h-LoRaWAN RSSI Signalstärke (dBm)"}
          </h4>
          <span className="text-[11px] text-slate-500 font-mono">Sensortakt: 10 Min.</span>
        </div>

        {/* Responsive Custom SVG Line Chart */}
        <div className="w-full h-48 relative">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[30, 60, 90, 120].map((y, i) => (
              <line
                key={i}
                x1="0"
                y1={y}
                x2="500"
                y2={y}
                stroke="#1e293b"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
            ))}

            {/* Render Polyline based on active tab */}
            {(() => {
              const getValue = (d: typeof history[0]) => {
                if (activeTab === "klima") return d.temp;
                if (activeTab === "laerm") return d.noiseDb;
                if (activeTab === "luft") return d.pm25;
                return Math.abs(d.rssi);
              };

              const vals = history.map(getValue);
              const minVal = Math.min(...vals) - 2;
              const maxVal = Math.max(...vals) + 2;

              const points = history.map((d, i) => {
                const x = (i / (history.length - 1)) * 500;
                const val = getValue(d);
                const y = 140 - ((val - minVal) / (maxVal - minVal || 1)) * 110;
                return { x, y, val, time: d.time };
              });

              const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              const areaD = `${pathD} L 500 150 L 0 150 Z`;

              return (
                <>
                  <path d={areaD} fill="url(#chartGradient)" />
                  <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                  {points.map((p, idx) => (
                    <g key={idx} className="group">
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        className="fill-slate-950 stroke-emerald-400 stroke-[2.5] hover:r-6 transition-all cursor-pointer"
                      />
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        </div>

        {/* X-Axis Timestamps */}
        <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mt-3 px-1">
          {history.map((h, i) => (
            <span key={i}>{h.time}</span>
          ))}
        </div>
      </div>

      {/* Additional Sensor Specs Footer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400 bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-amber-400 shrink-0" />
          <span>UV-Index: <strong className="text-slate-200">{node.uvIndex} (Mäßig)</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>Gaswerte: <strong className="text-slate-200">VOC {node.vocIndex} | NOx {node.noxIndex}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Regenmenge (24h): <strong className="text-slate-200">{node.rainMm.toFixed(1)} mm</strong></span>
        </div>
      </div>
    </div>
  );
}
