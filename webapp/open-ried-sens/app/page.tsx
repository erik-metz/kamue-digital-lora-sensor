"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Wifi,
  Radio,
  Database,
  Layers,
  MapPin,
  RefreshCw,
  Zap,
  CheckCircle2,
  Terminal,
  Activity,
  Volume2,
  CloudSun,
  Building2,
  HeartHandshake
} from "lucide-react";
import { SensorNode } from "./components/MapComponent";
import TelemetryCharts from "./components/TelemetryCharts";

// Client-only dynamic load for Leaflet map
const MapComponent = dynamic(() => import("./components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
      <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mr-2" />
      Interaktive Karte wird geladen...
    </div>
  ),
});

const INITIAL_NODES: SensorNode[] = [
  {
    id: "ried-01",
    name: "Station 1: Bürstadt Mitte",
    locationName: "KAMÜ Kulturzentrum",
    lat: 49.6425,
    lng: 8.456,
    status: "online",
    batteryPct: 96,
    rssi: -84,
    snr: 9.5,
    temp: 21.4,
    humidity: 58,
    rainMm: 0.0,
    uvIndex: 4,
    vocIndex: 110,
    noxIndex: 22,
    pm25: 12,
    noiseDb: 54,
    noiseLabel: "Passanten/Sprache",
    lastSeen: "Vor 12 Sek.",
  },
  {
    id: "ried-02",
    name: "Station 2: Lampertheim Nord",
    locationName: "Privatgrundstück Nordstadt",
    lat: 49.605,
    lng: 8.468,
    status: "online",
    batteryPct: 91,
    rssi: -92,
    snr: 7.8,
    temp: 20.8,
    humidity: 62,
    rainMm: 0.2,
    uvIndex: 3,
    vocIndex: 95,
    noxIndex: 35,
    pm25: 16,
    noiseDb: 68,
    noiseLabel: "Fahrzeugverkehr",
    lastSeen: "Vor 45 Sek.",
  },
  {
    id: "ried-03",
    name: "Station 3: Ried-West",
    locationName: "Rheinauen Biotop",
    lat: 49.621,
    lng: 8.415,
    status: "online",
    batteryPct: 88,
    rssi: -101,
    snr: 4.2,
    temp: 19.5,
    humidity: 74,
    rainMm: 0.0,
    uvIndex: 5,
    vocIndex: 45,
    noxIndex: 12,
    pm25: 8,
    noiseDb: 41,
    noiseLabel: "Wind/Natur",
    lastSeen: "Vor 1 Min.",
  },
  {
    id: "ried-04",
    name: "Station 4: Bürstadt Süd",
    locationName: "Agrar- & Feldmesspunkt",
    lat: 49.631,
    lng: 8.472,
    status: "online",
    batteryPct: 100,
    rssi: -79,
    snr: 11.0,
    temp: 22.1,
    humidity: 54,
    rainMm: 0.0,
    uvIndex: 5,
    vocIndex: 80,
    noxIndex: 18,
    pm25: 11,
    noiseDb: 38,
    noiseLabel: "Ruhig",
    lastSeen: "Vor 2 Min.",
  },
  {
    id: "ried-05",
    name: "Station 5: Lampertheim Ost",
    locationName: "Garten & Wohnumfeld",
    lat: 49.589,
    lng: 8.489,
    status: "online",
    batteryPct: 84,
    rssi: -95,
    snr: 6.1,
    temp: 21.0,
    humidity: 60,
    rainMm: 0.0,
    uvIndex: 4,
    vocIndex: 105,
    noxIndex: 28,
    pm25: 14,
    noiseDb: 52,
    noiseLabel: "Passanten/Sprache",
    lastSeen: "Vor 3 Min.",
  },
];

export default function Home() {
  const [nodes, setNodes] = useState<SensorNode[]>(INITIAL_NODES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("ried-01");
  const [liveLogs, setLiveLogs] = useState<
    Array<{ id: string; timestamp: string; node: string; payload: string; rssi: number }>
  >([
    {
      id: "log-1",
      timestamp: "12:28:44",
      node: "ried-01",
      payload: "01 56 B2 4E 00 81 C3 A2 60",
      rssi: -84,
    },
    {
      id: "log-2",
      timestamp: "12:27:12",
      node: "ried-02",
      payload: "01 54 A0 1C 00 82 DC FF 5B",
      rssi: -92,
    },
    {
      id: "log-3",
      timestamp: "12:25:30",
      node: "ried-03",
      payload: "01 4F 88 E1 00 7E BB D4 58",
      rssi: -101,
    },
  ]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0];

  // Function to simulate dynamic uplink ping
  const handleSimulateUplink = () => {
    const updatedNodes = nodes.map((node) => {
      if (node.id === selectedNodeId) {
        const tempDiff = (Math.random() * 0.8 - 0.4);
        const humDiff = Math.round(Math.random() * 4 - 2);
        const newTemp = Math.round((node.temp + tempDiff) * 10) / 10;
        const newHum = Math.min(100, Math.max(30, node.humidity + humDiff));
        const newNoise = Math.min(95, Math.max(35, Math.round(node.noiseDb + (Math.random() * 6 - 3))));
        
        return {
          ...node,
          temp: newTemp,
          humidity: newHum,
          noiseDb: newNoise,
          batteryPct: Math.max(10, Math.min(100, node.batteryPct)),
          lastSeen: "Gerade eben",
        };
      }
      return node;
    });

    setNodes(updatedNodes);

    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0];
    const hexBytes = Array.from({ length: 9 }, () =>
      Math.floor(Math.random() * 255)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()
    ).join(" ");

    setLiveLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: timeStr,
        node: selectedNode.id,
        payload: hexBytes,
        rssi: selectedNode.rssi + Math.floor(Math.random() * 4 - 2),
      },
      ...prev.slice(0, 5),
    ]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <Radio className="w-6 h-6 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-100 tracking-tight">Open Ried Sens</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Bürstadt & Lampertheim
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Initiative von KAMÜ Kulturzentrum & Bürgerinnen/Bürgern
              </p>
            </div>
          </div>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#projekt" className="hover:text-emerald-400 transition-colors">
              Über das Projekt
            </a>
            <a href="#sensorik" className="hover:text-emerald-400 transition-colors">
              Multisensorik
            </a>
            <a href="#dashboard" className="hover:text-emerald-400 transition-colors">
              Echtzeit-Dashboard
            </a>
            <a href="#karte" className="hover:text-emerald-400 transition-colors">
              Kartennetz
            </a>
            <a href="#telemetrie" className="hover:text-emerald-400 transition-colors">
              LoRaWAN TTN
            </a>
          </nav>

          {/* Network Status Badge */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium text-emerald-400">5/5 Stationen Aktiv</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* HERO SECTION */}
        <section id="projekt" className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <HeartHandshake className="w-3.5 h-3.5" /> Bürgerinitiative für ein digitales Ried
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight tracking-tight">
              Digitale Umweltdaten für den regionalen <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Hackathon</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              <strong>Open Ried Sens</strong> ist ein privates Mitmach-Projekt zur Digitalisierung der Städte 
              <strong> Bürstadt</strong> und <strong>Lampertheim</strong> in Kooperation mit dem Kulturzentrum <strong>KAMÜ</strong> in Bürstadt. 
              Wir bauen ein kontinuierliches, historisches Multisensor-Netzwerk auf, um eine verlässliche Datenbasis für künftige regionale Hackathons zu schaffen.
            </p>

            {/* Feature Highlights Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Building2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">5 Privatsensoren</h4>
                  <p className="text-[11px] text-slate-400">Montiert auf privaten Grundstücken für reale Langzeitdaten.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Wifi className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">LoRaWAN & TTN</h4>
                  <p className="text-[11px] text-slate-400">Eigene Gateways für freie IoT-Funkabdeckung in der Region.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Database className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Open-Data Basis</h4>
                  <p className="text-[11px] text-slate-400">Offene Umweltdaten für Ideen, Analysen & Smart City Apps.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MULTISENSORIK SPEZIFIKATIONEN SECTION */}
        <section id="sensorik" className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Umfassende Multisensor-Stationen
            </h2>
            <p className="text-sm text-slate-400">
              Jede Messstation ist mit moderner Sensorik für hochpräzise Umwelt- und Umfelddaten ausgestattet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Sensor 1: Klima */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <CloudSun className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Klima & Wetter</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Präzise Erfassung von Temperatur, relativer Luftfeuchtigkeit, Niederschlagsmenge (Regen) und UV-Index.
              </p>
            </div>

            {/* Sensor 2: Luftqualität */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Gase & Luftqualität</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Messung von VOC-Index (flüchtige organische Verbindungen) und NOx (Stickoxide) für gesunde Außenluft.
              </p>
            </div>

            {/* Sensor 3: Feinstaub */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Feinstaub (PM2.5 & PM10)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Optische Feinstaubmessung zur Analyse von Partikelbelastungen in Wohngebieten und Verkehrsknoten.
              </p>
            </div>

            {/* Sensor 4: Akustik & Lärm */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Akustische Lärmanalyse</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Mikrofon mit intelligenter Klassifikation zur Unterscheidung von Fahrzeugen, Passanten/Sprache und Wind.
              </p>
            </div>
          </div>
        </section>

        {/* DASHBOARD & KARTEN SECTION */}
        <section id="dashboard" className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                <Zap className="w-3.5 h-3.5" /> Sensor-Dashboard
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
                Echtzeitdaten aus Bürstadt & Lampertheim
              </h2>
            </div>

            {/* Node Selector Buttons */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 max-w-full">
              {nodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedNodeId === node.id
                      ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                      : "bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {node.name.split(":")[1] || node.name}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Map & Selected Node Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Column (2 Cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-400" /> Standorte im Hessischen Ried
                </h3>
                <span className="text-xs text-slate-400">Klick auf Marker für Details</span>
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
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                      Ausgewählte Station
                    </span>
                    <h3 className="text-lg font-bold text-slate-100 mt-0.5">{selectedNode.name}</h3>
                    <p className="text-xs text-slate-400">📍 {selectedNode.locationName}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Aktiv
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    <span className="text-slate-400 block text-[11px]">Temperatur</span>
                    <span className="text-lg font-bold text-slate-100">{selectedNode.temp.toFixed(1)} °C</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    <span className="text-slate-400 block text-[11px]">Luftfeuchtigkeit</span>
                    <span className="text-lg font-bold text-slate-100">{selectedNode.humidity}%</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    <span className="text-slate-400 block text-[11px]">Lärmanalyse</span>
                    <span className="text-lg font-bold text-slate-100">{selectedNode.noiseDb} dB</span>
                    <span className="text-[10px] text-emerald-400 block">{selectedNode.noiseLabel}</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                    <span className="text-slate-400 block text-[11px]">Akkustand</span>
                    <span className="text-lg font-bold text-slate-100">{selectedNode.batteryPct}%</span>
                    <span className="text-[10px] text-slate-500 block">Solar-Ladekreis</span>
                  </div>
                </div>
              </div>

              {/* Action Button: Simulate Telemetry Uplink */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <button
                  onClick={handleSimulateUplink}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                >
                  <RefreshCw className="w-4 h-4" /> Paket-Uplink simulieren
                </button>
                <p className="text-[10px] text-slate-500 text-center">
                  Generiert ein neues TTN-LoRaWAN Datenpaket für die ausgewählte Station.
                </p>
              </div>
            </div>
          </div>

          {/* Time-Series Charts Component */}
          <TelemetryCharts node={selectedNode} />
        </section>

        {/* TELEMETRIE & LORAWAN TTN LOGS SECTION */}
        <section id="telemetrie" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LoRaWAN & TTN Infrastructure Overview (1 Col) */}
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                <Wifi className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">LoRaWAN & TTN Aufbau</h3>
                <p className="text-xs text-slate-400">Regionale Funkabdeckung</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Da in Bürstadt und Lampertheim bisher keine flächendeckenden LoRaWAN-Gateways existieren,
              installieren wir im Rahmen dieser Initiative eigene LoRaWAN-Gateways mit Anbindung an
              <strong> The Things Network (TTN)</strong>.
            </p>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Standard: <strong>EU868 (868 MHz)</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Aktivierung: <strong>OTAA (Over-The-Air)</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Payload: <strong>Kompakte 9-Byte Binärkodierung</strong></span>
              </div>
            </div>
          </div>

          {/* Live TTN Packet Log Viewer (2 Cols) */}
          <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Live-Uplink Datenstream (TTN Feed)</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">FPort: 1 | Payload Format: Binary</span>
            </div>

            {/* Log Output Box */}
            <div className="bg-slate-950 font-mono text-xs p-4 rounded-xl border border-slate-800/80 space-y-2.5 max-h-56 overflow-y-auto">
              {liveLogs.map((log) => (
                <div key={log.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-300 border-b border-slate-900/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">[{log.timestamp}]</span>
                    <span className="text-emerald-400 font-bold">{log.node}</span>
                    <span className="text-slate-400 text-[11px]">→ Payload:</span>
                    <span className="text-amber-300 font-bold tracking-wider">{log.payload}</span>
                  </div>
                  <span className="text-slate-500 text-[11px]">RSSI: {log.rssi} dBm</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Open Ried Sens</strong> – Eine private Bürgerinitiative mit dem <strong>Kulturzentrum KAMÜ</strong> in Bürstadt.
            </span>
          </div>

          <div className="flex items-center gap-4">
            <a href="https://thethingsnetwork.org" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">
              The Things Network
            </a>
            <span>•</span>
            <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">
              Open Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
