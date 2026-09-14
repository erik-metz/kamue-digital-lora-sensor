import { env } from "@/env";
import {
  Activity,
  Building2,
  CheckCircle2,
  CloudSun,
  Database,
  HeartHandshake,
  Layers,
  Radio,
  Terminal,
  Volume2,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import DashboardClient from "./components/DashboardClient.tsx";
import HeaderLogo from "./components/HeaderLogo";
import { SensorNode } from "./components/MapComponent";

export const dynamic = "force-dynamic";

type ApiSensor = {
  id: string;
  friendly_name: string;
  latitude: number | null;
  longitude: number | null;
  description?: string | null;
  is_hidden?: boolean;
};

async function fetchSensors(): Promise<SensorNode[] | null> {
  try {
    const res = await fetch(
      new URL("/api/v1/sensors", env.BACKEND_API_URL).href,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );
    if (!res.ok) {
      console.error("Public sensor request failed", { status: res.status });
      return null;
    }

    const data: ApiSensor[] = await res.json();

    return data
      .filter((s) => !s.is_hidden && s.latitude != null && s.longitude != null)
      .map((s) => ({
        id: s.id,
        name: s.friendly_name,
        locationName: s.friendly_name,
        address: s.description ?? "—",
        lat: s.latitude!,
        lng: s.longitude!,
        status: "online" as const,

      }));
  } catch {
    console.error("Public sensor request failed: backend unavailable or invalid response");
    return null;
  }
}

export default async function Home() {
  const sensors = await fetchSensors();
  const nodes = sensors ?? [];
  const liveLogs = [];
  const onlineCount = nodes.filter((n) => n.status === "online").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <HeaderLogo />

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-end gap-6 text-sm font-medium text-slate-300">
            {/* <a
              href="#projekt"
              className="hover:text-emerald-400 transition-colors"
            >
              Über das Projekt
            </a>
            <a
              href="#sensorik"
              className="hover:text-emerald-400 transition-colors"
            >
              Multisensorik
            </a>
            <a
              href="#dashboard"
              className="hover:text-emerald-400 transition-colors"
            >
              Echtzeit-Dashboard
            </a>
            <a
              href="#karte"
              className="hover:text-emerald-400 transition-colors"
            >
              Kartennetz
            </a>
            <a
              href="#telemetrie"
              className="hover:text-emerald-400 transition-colors"
            >
              LoRaWAN TTN
            </a> */}
            <Link
              href="/daten"
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              Offene Daten & API
            </Link>
          </nav>

          {/* Network Status Badge */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-sm text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium text-emerald-400">
              {sensors === null ? "Stationen nicht erreichbar" : `${onlineCount}/${nodes.length} Stationen Aktiv`}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* HERO SECTION */}
        <section
          id="projekt"
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl"
        >
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
              <HeartHandshake className="w-3.5 h-3.5" /> Bürgerinitiative für
              ein digitales Ried
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight tracking-tight">
              Digitale Umweltdaten für den regionalen{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Hackathon
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              <strong>Open Ried Sens</strong> ist ein privates Mitmach-Projekt
              zur Digitalisierung der Städte
              <strong> Bürstadt</strong> und <strong>Lampertheim</strong> in
              Kooperation mit dem Kulturzentrum{" "}
              <a
                href="https://kamue.me"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline font-medium hover:text-emerald-300 transition-colors"
              >
                KAMÜ
              </a>{" "}
              in Bürstadt. Wir bauen ein kontinuierliches, historisches
              Multisensor-Netzwerk auf, um eine verlässliche Datenbasis für
              künftige regionale Hackathons zu schaffen.
            </p>

            {/* Feature Highlights Badges */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Building2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    5 Privatsensoren
                  </h4>
                  <p className="text-sm text-slate-400">
                    Montiert auf privaten Grundstücken für reale Langzeitdaten.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Wifi className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    LoRaWAN & TTN
                  </h4>
                  <p className="text-sm text-slate-400">
                    Eigene Gateways für freie IoT-Funkabdeckung in der Region.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <Database className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-slate-200">
                    Open-Data Basis
                  </h4>
                  <p className="text-sm text-slate-400">
                    Offene Umweltdaten für Ideen, Analysen & Smart City Apps.
                  </p>
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
            <p className="text-base text-slate-400">
              Jede Messstation ist mit moderner Sensorik für hochpräzise Umwelt-
              und Umfelddaten ausgestattet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Sensor 1: Klima */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <CloudSun className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Klima & Wetter
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Präzise Erfassung von Temperatur, relativer Luftfeuchtigkeit,
                Niederschlagsmenge (Regen) und UV-Index.
              </p>
            </div>

            {/* Sensor 2: Luftqualität */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Gase & Luftqualität
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Messung von VOC-Index (flüchtige organische Verbindungen) und
                NOx (Stickoxide) für gesunde Außenluft.
              </p>
            </div>

            {/* Sensor 3: Feinstaub */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Feinstaub (PM2.5 & PM10)
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Optische Feinstaubmessung zur Analyse von Partikelbelastungen in
                Wohngebieten und Verkehrsknoten.
              </p>
            </div>

            {/* Sensor 4: Akustik & Lärm */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                <Volume2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Akustische Lärmanalyse
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Mikrofon mit intelligenter Klassifikation zur Unterscheidung von
                Fahrzeugen, Passanten/Sprache und Wind.
              </p>
            </div>
          </div>
        </section>

        {/* DASHBOARD & KARTEN SECTION */}
        <section id="dashboard" className="space-y-8">
          <DashboardClient nodes={nodes} loadFailed={sensors === null} />
        </section>

        {/* TELEMETRIE & LORAWAN TTN LOGS SECTION */}
        {false && (
          <section
            id="telemetrie"
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* LoRaWAN & TTN Infrastructure Overview (1 Col) */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    LoRaWAN & TTN Aufbau
                  </h3>
                  <p className="text-sm text-slate-400">
                    Regionale Funkabdeckung
                  </p>
                </div>
              </div>

              <p className="text-sm text-slate-300 leading-relaxed">
                Da in Bürstadt und Lampertheim bisher keine flächendeckenden
                LoRaWAN-Gateways existieren, installieren wir im Rahmen dieser
                Initiative eigene LoRaWAN-Gateways mit Anbindung an{" "}
                <a
                  href="https://www.thethingsindustries.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 underline font-medium hover:text-emerald-300 transition-colors"
                >
                  The Things Network (TTN)
                </a>
                .
              </p>

              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Standard: <strong>EU868 (868 MHz)</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Aktivierung: <strong>OTAA (Over-The-Air)</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Payload: <strong>Kompakte 9-Byte Binärkodierung</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Live TTN Packet Log Viewer (2 Cols) */}
            <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-slate-100">
                    Live-Uplink Datenstream (TTN Feed)
                  </h3>
                </div>
                <span className="text-sm font-mono text-slate-500">
                  FPort: 1 | Payload Format: Binary
                </span>
              </div>

              {/* Log Output Box */}
              <div className="bg-slate-950 font-mono text-sm p-4 rounded-xl border border-slate-800/80 space-y-2.5 max-h-56 overflow-y-auto">
                {liveLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-300 border-b border-slate-900/80 pb-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">[{log.timestamp}]</span>
                      <span className="text-emerald-400 font-bold">
                        {log.node}
                      </span>
                      <span className="text-slate-400 text-xs">→ Payload:</span>
                      <span className="text-amber-300 font-bold tracking-wider">
                        {log.payload}
                      </span>
                    </div>
                    <span className="text-slate-500 text-xs">
                      RSSI: {log.rssi} dBm
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Open Ried Sens</strong> – Eine private Bürgerinitiative
              mit dem Kulturzentrum{" "}
              <a
                href="https://kamue.me"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 underline font-medium hover:text-emerald-300"
              >
                KAMÜ
              </a>{" "}
              in Bürstadt.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <Link
              href="/daten"
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              Offene Daten & API
            </Link>
            <span>•</span>
            <Link
              href="/admin"
              className="text-slate-400 hover:text-emerald-400 transition-colors"
            >
              Admin-Bereich
            </Link>
            <span>•</span>
            <a
              href="https://www.thethingsindustries.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 transition-colors"
            >
              The Things Network
            </a>
            <span>•</span>
            <a
              href="https://github.com/erik-metz/kamue-digital-lora-sensor"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 transition-colors"
            >
              Open Source
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
