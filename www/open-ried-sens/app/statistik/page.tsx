import {
  fetchCulturalEvents,
  fetchRegionalFacilities,
  fetchSocialSummary,
  fetchWasteStatistics,
} from "@/lib/regionalStats";
import {
  ArrowLeft,
  Briefcase,
  Code2,
  Database,
  ExternalLink,
  HeartHandshake,
  HeartPulse,
  MapPin,
  Radio,
  Recycle,
  Sparkles,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import HeaderLogo from "../components/HeaderLogo";
import StatistikClient from "./StatistikClient";

export const dynamic = "force-dynamic";

export default async function RegionalStatistikPage() {
  const [summaries, wasteStats, facilities, events] = await Promise.all([
    fetchSocialSummary(),
    fetchWasteStatistics(),
    fetchRegionalFacilities(),
    fetchCulturalEvents(),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <HeaderLogo />

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/"
              className="text-slate-300 hover:text-emerald-400 transition-colors"
            >
              Sensor-Karte
            </Link>
            <Link
              href="/bauen-wohnen"
              className="text-slate-300 hover:text-emerald-400 transition-colors"
            >
              Bauen & Wohnen
            </Link>
            <Link
              href="/demografie"
              className="text-slate-300 hover:text-emerald-400 transition-colors"
            >
              Demografie & Bildung
            </Link>
            <Link
              href="/statistik"
              className="text-emerald-400 font-bold border-b-2 border-emerald-400 pb-0.5"
            >
              Regionalstatistik & Leben
            </Link>
            <Link
              href="/daten"
              className="text-slate-300 hover:text-emerald-400 transition-colors"
            >
              Offene Daten & API
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Zurück zur Karte</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
              <HeartHandshake className="w-3.5 h-3.5" /> Regionales Leben, Soziales & Kreislaufwirtschaft
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight">
              Arbeit, Gesundheit & Vereine im{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Hessischen Ried
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              Strukturdaten und regionale Lebensqualität für{" "}
              <strong>Bürstadt</strong>, <strong>Lampertheim</strong>,{" "}
              <strong>Biblis</strong> und den <strong>Kreis Bergstraße</strong>:
              Arbeitsmarktkennzahlen, Versorgungsdichte von Ärzten & Apotheken,
              ZAKB Abfallmengen & Recyclingquoten sowie die lebendige Vereins- und
              Kulturlandschaft rund um das Kulturzentrum <strong>KAMÜ</strong>.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg">
                <Briefcase className="w-3.5 h-3.5 text-emerald-400" /> Bundesagentur für Arbeit
              </span>
              <span className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg">
                <HeartPulse className="w-3.5 h-3.5 text-cyan-400" /> Kassenärztliche Vereinigung Hessen
              </span>
              <span className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg">
                <Recycle className="w-3.5 h-3.5 text-amber-400" /> ZAKB Jahresbilanzen
              </span>
              <span className="flex items-center gap-1.5 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> KAMÜ Kulturzentrum Bürstadt
              </span>
            </div>
          </div>
        </section>

        {/* Interactive Client Dashboard Component */}
        <StatistikClient
          summaries={summaries}
          wasteStats={wasteStats}
          facilities={facilities}
          events={events}
        />

        {/* Developer / Hackathon Callout */}
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950 p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-emerald-400" />
                Sozial- & Versorgungsdaten per API abfragen
              </h3>
              <p className="text-sm text-slate-400 max-w-2xl">
                Alle Kennzahlen zu Arbeitsmarkt, ZAKB-Kreislaufwirtschaft und Standorten
                stehen als offene JSON-Endpunkte für den regionalen Hackathon und
                Forschungsprojekte bereit.
              </p>
            </div>
            <Link
              href="/daten"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm transition-colors shrink-0"
            >
              API-Dokumentation
              <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>Open Ried Sens</strong> – Bürgerinitiative für freie Daten in
              Kooperation mit dem Kulturzentrum{" "}
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
              href="/statistik"
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
            >
              Regionalstatistik & Leben
            </Link>
            <Link
              href="/demografie"
              className="text-slate-400 hover:text-slate-300 transition-colors"
            >
              Demografie & Bildung
            </Link>
            <Link
              href="/daten"
              className="text-slate-400 hover:text-slate-300 transition-colors"
            >
              Offene Daten & API
            </Link>
            <Link
              href="/admin"
              className="text-slate-500 hover:text-slate-400 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
