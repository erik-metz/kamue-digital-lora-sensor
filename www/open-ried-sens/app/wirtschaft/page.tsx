import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Briefcase, Database, MapPin } from "lucide-react";
import HeaderLogo from "../components/HeaderLogo";
import SiteFooter from "../components/SiteFooter";
import WirtschaftClient from "./WirtschaftClient";
import {
  fetchBusinessRegistrations,
  fetchCompanies,
  fetchEconomyOverview,
  fetchIndustryStructure,
  fetchStartupInitiatives,
  fetchTaxRates,
} from "@/lib/economyData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wirtschaft & Unternehmen | Open Ried Sens",
  description:
    "Gewerbeanmeldungen, Unternehmensneugründungen, Branchenstruktur, Gewerbesteuer-Hebesätze und Top-Arbeitgeber in Bürstadt, Lampertheim, Biblis und dem Kreis Bergstraße.",
};

export default async function WirtschaftPage() {
  const [
    overview,
    companies,
    taxRates,
    registrations,
    industryEmployment,
    startupInitiatives,
  ] = await Promise.all([
    fetchEconomyOverview(2024),
    fetchCompanies(),
    fetchTaxRates(2024),
    fetchBusinessRegistrations(),
    fetchIndustryStructure("kreis-bergstrasse", 2024),
    fetchStartupInitiatives(),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Header / Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <HeaderLogo />

          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Sensor-Dashboard</span>
            </Link>
            <Link
              href="/haushalt"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              Haushalte
            </Link>
            <Link
              href="/demografie"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 transition-colors"
            >
              Demografie
            </Link>
            <Link
              href="/daten"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Offene Daten & API</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
              <Briefcase className="w-3.5 h-3.5" /> Regionalökonomie & Wirtschaftsstandort
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-100 leading-tight tracking-tight">
              Wirtschaft, Gewerbe &{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                Unternehmen im Ried
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Detaillierte Gründungsstatistiken von <strong>Statistik Hessen</strong>, Gewerbesteuer-Hebesätze aller 22 Kommunen des <strong>Kreises Bergstraße</strong>, Branchenstrukturen und ein Profil der wichtigsten Arbeitgeber in Bürstadt, Lampertheim, Biblis und der Metropolregion.
            </p>
          </div>
        </section>

        {/* CLIENT DASHBOARD */}
        <WirtschaftClient
          overview={overview}
          companies={companies}
          taxRates={taxRates}
          registrations={registrations}
          industryEmployment={industryEmployment}
          startupInitiatives={startupInitiatives}
        />
      </main>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
