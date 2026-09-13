"use client";

import { MapPin, RefreshCw, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import type { SensorNode } from "./MapComponent";
import TelemetryCharts from "./TelemetryCharts";

const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mr-2" />
      Interaktive Karte wird geladen...
    </div>
  ),
});

type Props = {
  nodes: SensorNode[];
};

export default function DashboardClient({ nodes }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(
    nodes[0]?.id
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? nodes[0];

  if (nodes.length === 0) {
    return (
      <section id="dashboard" className="space-y-4">
        <p className="text-slate-400">
          Aktuell sind keine Stationen verfügbar.
        </p>
      </section>
    );
  }

  // selectedNode is defined here
  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Zap className="w-3.5 h-3.5" /> Sensor-Dashboard
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
            Echtzeitdaten aus Bürstadt & Lampertheim
          </h2>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" /> Standorte im Hessischen Ried
        </h3>
        <MapComponent nodes={nodes} selectedNodeId={selectedNode.id} onSelectNode={setSelectedNodeId} />
      </div>
      <TelemetryCharts key={selectedNode.id} node={selectedNode} nodes={nodes} onSelectNode={setSelectedNodeId} />
    </>
  );
}
