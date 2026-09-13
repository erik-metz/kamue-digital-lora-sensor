"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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

      {/* Interactive Map & Selected Node Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" /> Standorte im
              Hessischen Ried
            </h3>
            <span className="text-sm text-slate-400">
              Klick auf Marker für Details
            </span>
          </div>
          <MapComponent
            nodes={nodes}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => setSelectedNodeId(id)}
          />
        </div>

        {/* Selected Node Overview Card (1 Col) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-xs uppercase font-bold text-emerald-400 tracking-wider">
                  Ausgewählte Station
                </span>

                <div className="mt-1 w-full">
                  <Combobox
                    items={nodes}
                    value={selectedNode}
                    itemToStringValue={(node) =>
                      `${node.locationName} ${node.name} ${node.address}`
                    }
                    onValueChange={(node) => {
                      if (node) setSelectedNodeId(node.id);
                    }}
                    autoHighlight
                  >
                    <ComboboxInput
                      aria-label="Station auswählen"
                      placeholder="Standort suchen…"
                      className="w-full rounded-xl border-slate-700 bg-slate-950/80 text-slate-100 shadow-none focus-within:border-emerald-500/60 focus-within:ring-1 focus-within:ring-emerald-500/30"
                    />
                    <ComboboxContent className="border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl">
                      <ComboboxEmpty className="py-3 text-slate-500">
                        Kein Standort gefunden
                      </ComboboxEmpty>
                      <ComboboxList className="max-h-48 p-1">
                        {(node) => (
                          <ComboboxItem
                            key={node.id}
                            value={node}
                            className="flex-col items-start gap-0 rounded-lg px-3 py-2.5 text-slate-300 data-highlighted:bg-slate-800/80 data-highlighted:text-slate-100"
                          >
                            <span className="font-semibold leading-tight">
                              {node.locationName}
                            </span>
                            <span className="mt-0.5 text-xs text-slate-500">
                              {node.name} · {node.address}
                            </span>
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>

                {/* Address line */}
                <p className="text-sm text-slate-500 mt-1.5 flex items-center gap-1">
                  🏠 {selectedNode.address}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 mt-5">
                Aktiv
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-400 block text-xs">Temperatur</span>
                <span className="text-lg font-bold text-slate-100">
                  {selectedNode.temp.toFixed(1)} °C
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-400 block text-xs">
                  Luftfeuchtigkeit
                </span>
                <span className="text-lg font-bold text-slate-100">
                  {selectedNode.humidity}%
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-400 block text-xs">
                  Lärmanalyse
                </span>
                <span className="text-lg font-bold text-slate-100">
                  {selectedNode.noiseDb} dB
                </span>
                <span className="text-xs text-emerald-400 block">
                  {selectedNode.noiseLabel}
                </span>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                <span className="text-slate-400 block text-xs">Akkustand</span>
                <span className="text-lg font-bold text-slate-100">
                  {selectedNode.batteryPct}%
                </span>
                <span className="text-xs text-slate-500 block">
                  Solar-Ladekreis
                </span>
              </div>
            </div>
          </div>

          {/* Signal & Gateway Status Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-sm text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Automatische TTN-Übertragung
            </span>
            <span className="text-slate-500 font-mono">LoRaWAN OTAA</span>
          </div>
        </div>
      </div>

      {/* Time-Series Charts Component */}
      <TelemetryCharts node={selectedNode} />
    </>
  );
}
