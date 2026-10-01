"use client";

import {
  Code2,
  Cpu,
  ExternalLink,
  GitFork,
  Github,
  GraduationCap,
  HeartHandshake,
  Layers,
  Mail,
  MapPin,
  Radio,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import Link from "next/link";

export default function CommunitySection() {
  const mailSubject = encodeURIComponent("Interesse am Sensor-Bau-Workshop – Open Ried Sens");
  const mailBody = encodeURIComponent(
    "Hallo Open-Ried-Sens-Team,\n\nich interessiere mich für die Teilnahme an einem Sensor-Bau-Workshop im Kulturzentrum KAMÜ / im Ried bzw. möchte gerne eine eigene Station aufbauen.\n\nMein Wohnort / Stadtteil:\nInteresse an (z. B. Selber löten, Standort bereitstellen, Schüler-/Vereinsprojekt):\n\nViele Grüße,\n"
  );

  return (
    <section id="community" className="space-y-8">
      {/* SECTION HEADER */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <HeartHandshake className="w-3.5 h-3.5" /> Community &amp; Mitmachen
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Hilf mit, das Projekt voranzubringen!
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
          <strong>Open Ried Sens</strong> ist ein unabhängiges, ehrenamtliches
          Bürgerprojekt für das Hessische Ried. Wir möchten gemeinsam wachsen –
          sowohl in der Software als auch draußen im Feld mit neuer Sensor-Hardware.
          Hier sind die zwei wichtigsten Wege, wie du dich einbringen kannst:
        </p>
      </div>

      {/* TWO PILLARS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PILLAR 1: CODE & GITHUB STAR */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8 space-y-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                Säule 1: Open Source &amp; Code
              </span>
              <span className="text-xs text-slate-400 font-mono">MIT / CC BY 4.0</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Github className="w-6 h-6 text-slate-200" />
              GitHub: Stern dalassen &amp; Mitentwickeln
            </h3>

            <p className="text-sm text-slate-300 leading-relaxed">
              Die einfachste und wirkungsvollste Unterstützung: Gib unserem Repository auf GitHub
              einen <strong>Stern (Star ⭐)</strong>! Das erhöht die Sichtbarkeit unseres Projekts
              in der Open-Source-Community und hilft uns, Förderer und Partner zu gewinnen.
            </p>

            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-2.5 text-xs text-slate-300">
              <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] block">
                Offene Bereiche für Beiträge:
              </span>
              <ul className="space-y-1.5 text-slate-400">
                <li className="flex items-start gap-2">
                  <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Webapp:</strong> Next.js 16, React 19, Tailwind CSS v4, Leaflet-Karten &amp; interaktive Dashboards.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Backend &amp; Pipelines:</strong> FastAPI, TimescaleDB, Python-Kollektoren für Wetter, ÖPNV und Kommunaldaten.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Code2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Firmware:</strong> C++ / Arduino / ESP32 &amp; SX1262 LoRaWAN RadioLib-Treiber für Sensorknoten.
                  </span>
                </li>
              </ul>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href="https://github.com/erik-metz/kamue-digital-lora-sensor"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-bold px-5 py-3 transition-all hover:scale-[1.01] shadow-lg text-sm"
            >
              <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              <span>Stern auf GitHub vergeben ⭐</span>
              <ExternalLink className="w-3.5 h-3.5 ml-1 text-slate-600" />
            </a>

            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Forken &amp; Pull Request einreichen</span>
              <a
                href="https://github.com/erik-metz/kamue-digital-lora-sensor/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                Issues &amp; Feature-Ideen ansehen →
              </a>
            </div>
          </div>
        </div>

        {/* PILLAR 2: HARDWARE DIY & SENSOR BUILDING IN RIED */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 sm:p-8 space-y-6 flex flex-col justify-between shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Säule 2: Neu im Ried · Hardware DIY
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-400" /> Bürstadt &amp; Ried
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-emerald-400" />
              Eigene Sensoren bauen: Workshops im Ried!
            </h3>

            <p className="text-sm text-slate-300 leading-relaxed">
              Wie auf der Hauptseite angekündigt: <strong>Wir bauen jetzt neue Sensoren!</strong>{" "}
              Bürgerinnen, Bürger, Schüler, Vereine und Technikbegeisterte aus Bürstadt,
              Lampertheim, Biblis und Umgebung können bei unseren gemeinsamen Bau-Events
              eigene Messstationen zusammenbauen und Teil des Netzwerks werden.
            </p>

            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 space-y-2.5 text-xs text-slate-300">
              <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] block">
                Das erwartet dich bei den Workshops:
              </span>
              <ul className="space-y-1.5 text-slate-400">
                <li className="flex items-start gap-2">
                  <Cpu className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Einfacher Zusammenbau:</strong> Löten und Montieren der Sensoren (Temperatur, Feinstaub, VOC, Lärm) mit praktischer Anleitung.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Radio className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Freier LoRaWAN-Funk:</strong> Kostenlose Anbindung über The Things Network – keine SIM-Karte, kein WLAN vor Ort nötig.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Eigener Messpunkt:</strong> Bringe den Sensor an deinem Haus oder Balkon an und verfolge die Messwerte live auf dieser Website!
                  </span>
                </li>
              </ul>
            </div>

            {/* PHASE 2 SNEAK PEEK */}
            <div className="rounded-2xl bg-emerald-950/20 border border-emerald-500/20 p-4 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                <GraduationCap className="w-4 h-4" />
                In Vorbereitung: Phase 2 Bildungs- &amp; Bauportal
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                Wir bereiten derzeit eine eigene Mitmach-Landingpage vor mit{" "}
                <strong>PDF-Bauanleitungen, Video-Tutorials, 3D-Druck-Vorlagen (STL)</strong>{" "}
                sowie didaktischen Modulen: <em>Wie funktioniert LoRa? Wie wird aus physikalischen Größen ein Messwert? Welchen wissenschaftlichen Wert hat ein flächendeckendes Netz im Ried?</em>
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              href="/sensor-bauen"
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold px-5 py-3 transition-all hover:scale-[1.01] shadow-lg text-sm"
            >
              <Wrench className="w-4 h-4" />
              <span>Zur Mitmach-Seite &amp; Bauanleitung</span>
            </Link>

            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Workshops im Kulturzentrum KAMÜ Bürstadt</span>
              <a
                href="https://kamue.me"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1"
              >
                kamue.me <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
