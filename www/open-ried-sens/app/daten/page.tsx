import { env } from "@/env";
import {
  Code2,
  Database,
  ExternalLink,
  Globe,
  HeartHandshake,
  Layers,
  Radio,
  Satellite,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import SiteHeader from "../components/SiteHeader";
import HackathonDataSection from "./HackathonDataSection";
import SatelliteDownloadSection from "./SatelliteDownloadSection";
import ArchiveDownloads from "./ArchiveDownloads";
import ApiDevToolsSection from "./ApiDevToolsSection";
import CommunitySection from "./CommunitySection";
import MunicipalDataCatalog from "./MunicipalDataCatalog";
import SiteFooter from "../components/SiteFooter";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offene Daten & APIs | Open Ried Sens",
  description:
    "Freie Umweltdaten, Hackathon-Datensätze, monatliche Archive, FastAPI-Dokumentation, Postman/Insomnia Collections und Mitmach-Aktionen für das Hessische Ried.",
};

const API_DOCS_URL = "https://open-ried-sens.duckdns.org/docs";

export default async function DataDocsPage() {
  let stations: { id: string; friendly_name: string }[] = [];
  let stationsError = false;

  try {
    const response = await fetch(new URL("/api/v1/sensors", env.BACKEND_API_URL), {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Stations unavailable");
    stations = await response.json();
  } catch {
    stationsError = true;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header */}
      <SiteHeader />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <Code2 className="w-3.5 h-3.5" /> Offene Programmierschnittstelle (REST API)
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" /> Hackathon-Datasets
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight tracking-tight">
              Freie Umweltdaten &amp; offene Schnittstellen für das{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300">
                Hessische Ried
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              Das Projekt <strong>Open Ried Sens</strong> stellt alle erfassten Umwelt- und
              Klimaparameter des Bürstädter und Lampertheimer LoRaWAN-Sensornetzwerks als{" "}
              <strong>Open Data</strong> zur Verfügung. Völlig barrierefrei: keine
              Zugangsbeschränkungen, keine Registrierung und keine API-Keys für Lesezugriff.
            </p>

            {/* Quick Navigation Anchor Links */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="#datasets"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm transition-all shadow-md shadow-emerald-500/10"
              >
                <Database className="w-4 h-4" /> CSV-Datensätze &amp; Download
              </a>
              <a
                href="#satellit-download"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm transition-colors border border-slate-700"
              >
                <Satellite className="w-4 h-4 text-cyan-400" /> Satelliten-Download
              </a>
              <a
                href="#api-tools"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm transition-colors border border-slate-700"
              >
                <Zap className="w-4 h-4 text-emerald-400" /> FastAPI &amp; Postman
              </a>
              <a
                href="#community"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs sm:text-sm transition-colors border border-slate-700"
              >
                <HeartHandshake className="w-4 h-4 text-teal-400" /> Mitmachen &amp; Sensorbau
              </a>
              <a
                href="#themen-katalog"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-emerald-400 font-medium text-xs sm:text-sm transition-colors"
              >
                <Layers className="w-4 h-4" /> Regionalkataloge
              </a>
            </div>

            {/* Feature Highlights Badges */}
            <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-semibold text-slate-300">
              <span className="px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" /> 100% Open Data (CC BY 4.0)
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-teal-400" /> UploadThing Monats- &amp; Jahresarchive
              </span>
              <span className="px-3 py-1.5 rounded-full bg-slate-950/80 border border-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Ohne Registrierung oder API-Keys
              </span>
            </div>
          </div>
        </section>

        {/* 1. HACKATHON DATASETS & CSV DOWNLOADS */}
        <HackathonDataSection stations={stations} unavailable={stationsError} />

        {/* 2. SATELLITE EO TIME-SERIES & IMAGE DOWNLOADS (SENTINEL-2) */}
        <SatelliteDownloadSection />

        {/* 3. FULL MONTHLY ARCHIVES (UPLOADTHING) */}
        <Suspense
          fallback={
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-sm">
              Monatsarchive von UploadThing werden geladen …
            </div>
          }
        >
          <ArchiveDownloads />
        </Suspense>

        {/* 3. API & DEVELOPER TOOLS (FASTAPI, POSTMAN, INSOMNIA, CODE SNIPPETS) */}
        <ApiDevToolsSection />

        {/* 4. COMMUNITY & MITMACHEN (GITHUB STAR & WORKSHOPS SENSOR-BAU IN RIED) */}
        <CommunitySection />

        {/* 5. REGIONAL / MUNICIPAL DATA CATALOGS */}
        <MunicipalDataCatalog />

        {/* 6. OPEN DATA LICENSE & ATTRIBUTION */}
        <section className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-200">
              Open-Data Lizenz &amp; Namensnennung
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Die Telemetriedaten und regionalen Datensätze werden unter den Bedingungen der{" "}
              <strong>Creative Commons Attribution 4.0 International (CC BY 4.0)</strong>{" "}
              Lizenz bereitgestellt. Bei Verwendung in Projekten, Apps oder Hackathon-Arbeiten bitten
              wir um die Quellenangabe:{" "}
              <em>„Daten: Open Ried Sens / Kulturzentrum KAMÜ Bürstadt“</em>.
            </p>
          </div>
          <a
            href="https://creativecommons.org/licenses/by/4.0/deed.de"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-emerald-400 hover:border-slate-700 transition-colors shrink-0"
          >
            CC BY 4.0 Lizenztext
          </a>
        </section>
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
