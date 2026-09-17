"use client";

import {
  Activity,
  Award,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  HeartPulse,
  Info,
  Landmark,
  MapPin,
  Pill,
  Recycle,
  Sparkles,
  Stethoscope,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  type CulturalEvent,
  type RegionalFacility,
  type SocialKpiSummary,
  type ZakbWasteStat,
} from "@/lib/regionalStats";
import {
  parseSubpageParams,
  serializeSubpageParams,
  updateUrlDebounced,
} from "@/lib/urlState";

interface Props {
  summaries: SocialKpiSummary[];
  wasteStats: ZakbWasteStat[];
  facilities: RegionalFacility[];
  events: CulturalEvent[];
}

export default function StatistikClient({
  summaries,
  wasteStats,
  facilities,
  events,
}: Props) {
  const [selectedMuni, setSelectedMuni] = useState<string>("Bürstadt");
  const [activeTab, setActiveTab] = useState<
    "all" | "employment" | "healthcare" | "waste" | "culture" | "tourism"
  >("all");
  const [facilityCategoryFilter, setFacilityCategoryFilter] =
    useState<string>("all");
  const [mounted, setMounted] = useState(false);

  // Initial read from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = parseSubpageParams(window.location.search, {
      tab: "all",
      muni: "Bürstadt",
      cat: "all",
    });
    if (["all", "employment", "healthcare", "waste", "culture", "tourism"].includes(p.tab)) {
      setActiveTab(p.tab as any);
    }
    if (p.muni) setSelectedMuni(p.muni);
    if (p.cat) setFacilityCategoryFilter(p.cat);
    setMounted(true);
  }, []);

  // Listen to popstate
  useEffect(() => {
    const onPopState = () => {
      const p = parseSubpageParams(window.location.search, {
        tab: "all",
        muni: "Bürstadt",
        cat: "all",
      });
      if (["all", "employment", "healthcare", "waste", "culture", "tourism"].includes(p.tab)) {
        setActiveTab(p.tab as any);
      }
      setSelectedMuni(p.muni || "Bürstadt");
      setFacilityCategoryFilter(p.cat || "all");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Sync to URL
  useEffect(() => {
    if (!mounted) return;
    const query = serializeSubpageParams(
      {
        tab: activeTab,
        muni: selectedMuni,
        cat: facilityCategoryFilter,
      },
      { tab: "all", muni: "Bürstadt", cat: "all" }
    );
    updateUrlDebounced(query);
  }, [mounted, activeTab, selectedMuni, facilityCategoryFilter]);

  const muniList = useMemo(() => {
    return summaries.map((s) => s.municipality);
  }, [summaries]);

  const currentSummary = useMemo(() => {
    return (
      summaries.find((s) => s.municipality === selectedMuni) ??
      summaries[0]
    );
  }, [summaries, selectedMuni]);

  const hessenBenchmark = useMemo(() => {
    return summaries.find((s) => s.municipality === "Hessen");
  }, [summaries]);

  const kreisBenchmark = useMemo(() => {
    return summaries.find((s) => s.municipality === "Kreis Bergstraße");
  }, [summaries]);

  const currentWaste = useMemo(() => {
    const list = wasteStats.filter(
      (w) =>
        w.municipality.toLowerCase() === selectedMuni.toLowerCase() ||
        (selectedMuni === "Groß-Rohrheim" && w.municipality === "Kreis Bergstraße") ||
        (selectedMuni === "Biblis" && w.municipality === "Kreis Bergstraße")
    );
    return list.length > 0 ? list : wasteStats.filter((w) => w.municipality === "Bürstadt");
  }, [wasteStats, selectedMuni]);

  const totalWasteFraction = useMemo(() => {
    return currentWaste.find((w) => w.fraction === "total");
  }, [currentWaste]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      const matchMuni =
        selectedMuni === "Kreis Bergstraße" ||
        selectedMuni === "Hessen" ||
        f.municipality.toLowerCase() === selectedMuni.toLowerCase();
      const matchCat =
        facilityCategoryFilter === "all" ||
        f.category === facilityCategoryFilter ||
        (facilityCategoryFilter === "culture" && f.category === "culture_sports");
      return matchMuni && matchCat;
    });
  }, [facilities, selectedMuni, facilityCategoryFilter]);

  const filteredEvents = useMemo(() => {
    return events.filter(
      (e) =>
        selectedMuni === "Kreis Bergstraße" ||
        selectedMuni === "Hessen" ||
        e.municipality.toLowerCase() === selectedMuni.toLowerCase()
    );
  }, [events, selectedMuni]);

  return (
    <div className="space-y-12">
      {/* 1. Municipal Switcher Bar */}
      <div className="bg-slate-900/80 border border-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Region auswählen
          </div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            {selectedMuni}
            {selectedMuni === "Bürstadt" && (
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Kulturzentrum KAMÜ & Partnerstadt
              </span>
            )}
          </h2>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {muniList.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMuni(m)}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                selectedMuni === m
                  ? "bg-emerald-500 text-slate-950 shadow-md font-semibold"
                  : "bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700 hover:text-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Key Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Unemployment */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Arbeitslosenquote
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-slate-100">
              {currentSummary.unemployment_rate !== null
                ? `${currentSummary.unemployment_rate.toFixed(1)} %`
                : "–"}
            </div>
            <p className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
              <TrendingDown className="w-3.5 h-3.5" />
              Unter Hessen-Schnitt ({hessenBenchmark?.unemployment_rate ?? 5.2}%)
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Arbeitslose gesamt:</span>
            <span className="font-semibold text-slate-200">
              {currentSummary.unemployed_count?.toLocaleString("de-DE") ?? "–"}
            </span>
          </div>
        </div>

        {/* Card 2: Healthcare Supply */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Ärztliche Versorgung
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-slate-100">
              {currentSummary.gp_doctors_per_10k !== null
                ? `${currentSummary.gp_doctors_per_10k.toFixed(1)}`
                : "–"}
              <span className="text-sm font-normal text-slate-400 ml-1">/ 10k Einw.</span>
            </div>
            <p className="text-xs text-cyan-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Versorgungsgrad: {currentSummary.versorgungsgrad_pct?.toFixed(1) ?? 100}%
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Apotheken vor Ort:</span>
            <span className="font-semibold text-slate-200">
              {currentSummary.pharmacies_count ?? "–"} Betriebe
            </span>
          </div>
        </div>

        {/* Card 3: ZAKB Recycling */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              ZAKB Recyclingquote
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Recycle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-slate-100">
              {totalWasteFraction?.recycling_rate_percent != null
                ? `${totalWasteFraction.recycling_rate_percent.toFixed(1)} %`
                : "68.4 %"}
            </div>
            <p className="text-xs text-amber-400 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              Wertstoffrückgewinnung ZAKB
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Abfallaufkommen:</span>
            <span className="font-semibold text-slate-200">
              {totalWasteFraction?.kg_per_capita != null
                ? `${totalWasteFraction.kg_per_capita.toFixed(1)} kg / Einw.`
                : "374 kg / Einw."}
            </span>
          </div>
        </div>

        {/* Card 4: Clubs & Culture */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3 relative overflow-hidden group hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Vereine & Gemeinschaft
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-extrabold text-slate-100">
              {currentSummary.total_clubs_count !== null
                ? `${currentSummary.total_clubs_count}`
                : "–"}
              <span className="text-sm font-normal text-slate-400 ml-1">Vereine</span>
            </div>
            <p className="text-xs text-purple-300 flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              {currentSummary.sports_clubs_count ?? 24} Sport · {currentSummary.cultural_clubs_count ?? 18} Kultur
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Kulturzentrum:</span>
            <span className="font-semibold text-purple-300">
              KAMÜ Bürstadt
            </span>
          </div>
        </div>
      </div>

      {/* 3. Section: Arbeitsmarkt & Soziale Sicherung (Benchmark Comparison) */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              <Briefcase className="w-4 h-4" /> Arbeitsmarkt & Bürgergeld
            </div>
            <h3 className="text-xl font-bold text-slate-100">
              Arbeitslosigkeit & Soziale Sicherung im Vergleich
            </h3>
          </div>
          <span className="text-xs text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
            Quelle: Bundesagentur für Arbeit (2025/2026)
          </span>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
          Das Hessische Ried zeichnet sich durch eine traditionell überdurchschnittlich robuste
          Beschäftigungslage aus. Durch die Lage im Wirtschaftsraum Rhein-Neckar / Rhein-Main
          liegt die Arbeitslosenquote in Bürstadt und Biblis spürbar unter dem Landesdurchschnitt
          von Hessen ({hessenBenchmark?.unemployment_rate ?? 5.2}%).
        </p>

        {/* Comparison Bars */}
        <div className="space-y-4 pt-2">
          {summaries.map((s) => {
            const rate = s.unemployment_rate ?? 0;
            const maxRate = 7.0;
            const pctWidth = Math.min(100, Math.max(10, (rate / maxRate) * 100));
            const isCurrent = s.municipality === selectedMuni;

            return (
              <div
                key={s.municipality}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? "bg-slate-900 border-emerald-500/50 shadow-md"
                    : "bg-slate-950/40 border-slate-850 opacity-80"
                }`}
              >
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-semibold text-slate-200 flex items-center gap-2">
                    {s.municipality}
                    {isCurrent && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Aktive Auswahl
                      </span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {rate > 0 ? `${rate.toFixed(1)} %` : "–"}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      rate > 5.0
                        ? "bg-amber-500"
                        : isCurrent
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "bg-emerald-500/70"
                    }`}
                    style={{ width: `${pctWidth}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>SGB II Empfänger: {s.sgb2_recipients?.toLocaleString("de-DE") ?? "–"}</span>
                  <span>Quote: {s.sgb2_quota_pct?.toFixed(1) ?? "–"}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Section: ZAKB Abfallmengen & Recycling (Kreislaufwirtschaft) */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
              <Recycle className="w-4 h-4" /> ZAKB Kreislaufwirtschaft & Bilanzen
            </div>
            <h3 className="text-xl font-bold text-slate-100">
              Abfallströme & Verwertungsquoten ({selectedMuni})
            </h3>
          </div>
          <Link
            href="/#karte"
            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium"
          >
            <MapPin className="w-3.5 h-3.5" /> Wertstoffhöfe auf der Karte
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recycling Highlights */}
          <div className="md:col-span-1 bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Regionale ZAKB Bilanz
              </div>
              <div className="text-4xl font-extrabold text-amber-400">
                {totalWasteFraction?.recycling_rate_percent?.toFixed(1) ?? "68.4"} %
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Über zwei Drittel aller Abfälle im Hessischen Ried werden stofflich
                oder energetisch wiederverwertet (Biogas, Kompost, Sekundärrohstoffe).
              </p>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Jahrestonnage gesamt:</span>
                <span className="font-mono font-bold">
                  {totalWasteFraction?.weight_tons.toLocaleString("de-DE") ?? "6.365"} t
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">Pro-Kopf-Menge:</span>
                <span className="font-mono font-bold">
                  {totalWasteFraction?.kg_per_capita.toFixed(1) ?? "373.9"} kg / Einw.
                </span>
              </div>
            </div>
          </div>

          {/* Fraction Breakdown */}
          <div className="md:col-span-2 space-y-3">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Zusammensetzung nach Fraktionen (kg pro Einwohner & Jahr)
            </h4>

            <div className="space-y-2.5">
              {currentWaste
                .filter((w) => w.fraction !== "total")
                .map((w) => {
                  const fractionLabels: Record<string, { label: string; color: string }> = {
                    biomuell: { label: "Biomüll (Grüne Tonne & Grünschnitt)", color: "bg-lime-500" },
                    restmuell: { label: "Restmüll (Graue Tonne)", color: "bg-slate-500" },
                    papier: { label: "Altpapier & Kartonage (Blaue Tonne)", color: "bg-sky-500" },
                    wertstoffe: { label: "Wertstoffe / Gelber Sack", color: "bg-amber-500" },
                    sperrmuell: { label: "Sperrmüll & Altholz", color: "bg-orange-500" },
                  };
                  const fInfo = fractionLabels[w.fraction] ?? {
                    label: w.fraction,
                    color: "bg-teal-500",
                  };
                  const totalKg = totalWasteFraction?.kg_per_capita || 380;
                  const pct = Math.round((w.kg_per_capita / totalKg) * 100);

                  return (
                    <div
                      key={w.fraction}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-200">{fInfo.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-slate-100">
                            {w.kg_per_capita.toFixed(1)} kg
                          </span>
                          <span className="text-[11px] text-slate-400">({pct} %)</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${fInfo.color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Section: Einrichtungen & POIs (Healthcare, KAMÜ, Tourismus) */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              <Building2 className="w-4 h-4" /> Regionale Einrichtungen & Kultur
            </div>
            <h3 className="text-xl font-bold text-slate-100">
              Ärzte, Apotheken, Kultur & Sehenswürdigkeiten
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFacilityCategoryFilter("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                facilityCategoryFilter === "all"
                  ? "bg-slate-100 text-slate-950 border-slate-100 font-semibold"
                  : "bg-slate-950 text-slate-400 border-slate-850 hover:text-white"
              }`}
            >
              Alle
            </button>
            <button
              onClick={() => setFacilityCategoryFilter("healthcare")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                facilityCategoryFilter === "healthcare"
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500 font-semibold"
                  : "bg-slate-950 text-slate-400 border-slate-850 hover:text-white"
              }`}
            >
              <Pill className="w-3 h-3" /> Gesundheit
            </button>
            <button
              onClick={() => setFacilityCategoryFilter("culture")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                facilityCategoryFilter === "culture"
                  ? "bg-purple-500/20 text-purple-300 border-purple-500 font-semibold"
                  : "bg-slate-950 text-slate-400 border-slate-850 hover:text-white"
              }`}
            >
              <Sparkles className="w-3 h-3" /> Kultur & Sport
            </button>
            <button
              onClick={() => setFacilityCategoryFilter("tourism")}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1 ${
                facilityCategoryFilter === "tourism"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500 font-semibold"
                  : "bg-slate-950 text-slate-400 border-slate-850 hover:text-white"
              }`}
            >
              <Landmark className="w-3 h-3" /> Tourismus
            </button>
          </div>
        </div>

        {/* Facilities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFacilities.map((f) => {
            const isKamue = f.id === "fac-kamue-kulturzentrum";
            const isNotdienst = f.extra_attributes?.emergency_duty;

            return (
              <div
                key={f.id}
                className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  isKamue
                    ? "bg-purple-950/20 border-purple-500/40 hover:border-purple-400"
                    : isNotdienst
                    ? "bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400"
                    : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                        f.category === "healthcare"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : f.category === "culture_sports"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      }`}
                    >
                      {f.extra_attributes?.badge || f.category}
                    </span>

                    {isNotdienst && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse">
                        Notdienst aktiv
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-slate-100 text-base leading-snug">
                    {f.name}
                  </h4>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {f.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{f.street_address}, {f.municipality}</span>
                  </div>

                  {f.phone && (
                    <div className="text-[11px] text-slate-400">
                      Tel: <span className="font-mono text-slate-300">{f.phone}</span>
                    </div>
                  )}

                  {f.website && (
                    <a
                      href={f.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 pt-1"
                    >
                      Website besuchen
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Section: Kultur- & Veranstaltungskalender (KAMÜ Spotlight) */}
      <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-wider">
              <Calendar className="w-4 h-4" /> Was ist los im Ried?
            </div>
            <h3 className="text-xl font-bold text-slate-100">
              Kultur- & Eventkalender (inkl. KAMÜ Kulturzentrum)
            </h3>
          </div>
          <a
            href="https://kamue.me"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-semibold"
          >
            KAMÜ Programm & Tickets
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    {evt.category}
                  </span>
                  {evt.is_free && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      Eintritt frei
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-slate-100">{evt.title}</h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {evt.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
                <div className="space-y-0.5">
                  <div className="text-slate-200 font-medium">{evt.venue_name}</div>
                  <div className="text-slate-500">Veranstalter: {evt.organizer}</div>
                </div>

                {evt.ticket_url && (
                  <a
                    href={evt.ticket_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-purple-300 hover:bg-slate-850 hover:text-white transition-colors shrink-0"
                  >
                    Details & Anmeldung
                    <ChevronRight className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Bottom Navigation Link to Map */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-slate-800 p-6 sm:p-8 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-lg font-bold text-slate-100">
            Standorte auf der interaktiven Karte erkunden
          </h4>
          <p className="text-sm text-slate-400">
            Apotheken, Ärzte, Kulturzentren und Tourismus-Attraktionen sind auch
            auf unserer Live-Karte mit Filtern verfügbar.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-400 text-slate-950 font-bold hover:bg-emerald-300 transition-colors shrink-0 shadow-lg"
        >
          <MapPin className="w-4 h-4" />
          Zur Karte wechseln
        </Link>
      </div>
    </div>
  );
}
