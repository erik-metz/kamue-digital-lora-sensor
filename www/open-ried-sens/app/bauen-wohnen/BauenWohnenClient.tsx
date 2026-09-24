"use client";

import {
  AGE_BRACKET_LABELS,
  HEATING_LABELS,
  formatEuro,
  getBorisZoneColor,
  type BorisZone,
  type ConstructionPermit,
  type DevelopmentPlan,
  type HousingStock,
  type MarketBenchmark,
  type RealEstateSummary,
} from "@/lib/realestateData";
import {
  AlertCircle,
  Building,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Factory,
  FileSpreadsheet,
  Flame,
  Fuel,
  Hammer,
  Home,
  Layers,
  MapPin,
  Maximize2,
  Percent,
  Search,
  Sparkles,
  Sun,
  TreePine,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  parseSubpageParams,
  serializeSubpageParams,
  updateUrlDebounced,
} from "@/lib/urlState";

interface Props {
  summaries: RealEstateSummary[];
  housingStock: HousingStock[];
  borisZones: BorisZone[];
  permits: ConstructionPermit[];
  benchmarks: MarketBenchmark[];
  developmentPlans: DevelopmentPlan[];
}

export default function BauenWohnenClient({
  summaries,
  housingStock,
  borisZones,
  permits,
  benchmarks,
  developmentPlans,
}: Props) {
  const [selectedMuni, setSelectedMuni] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"stock" | "energy" | "prices" | "construction">("stock");
  const [borisSearch, setBorisSearch] = useState<string>("");
  const [borisTypeFilter, setBorisTypeFilter] = useState<string>("all");
  const [mounted, setMounted] = useState(false);

  // Initial read from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = parseSubpageParams(window.location.search, {
      tab: "stock",
      muni: "all",
      q: "",
      boris_type: "all",
    });
    if (["stock", "energy", "prices", "construction"].includes(p.tab)) {
      setActiveTab(p.tab as any);
    }
    if (p.muni) setSelectedMuni(p.muni);
    if (p.q) setBorisSearch(p.q);
    if (p.boris_type) setBorisTypeFilter(p.boris_type);
    setMounted(true);
  }, []);

  // Listen to popstate
  useEffect(() => {
    const onPopState = () => {
      const p = parseSubpageParams(window.location.search, {
        tab: "stock",
        muni: "all",
        q: "",
        boris_type: "all",
      });
      if (["stock", "energy", "prices", "construction"].includes(p.tab)) {
        setActiveTab(p.tab as any);
      }
      setSelectedMuni(p.muni || "all");
      setBorisSearch(p.q || "");
      setBorisTypeFilter(p.boris_type || "all");
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
        q: borisSearch,
        boris_type: borisTypeFilter,
      },
      { tab: "stock", muni: "all", q: "", boris_type: "all" }
    );
    updateUrlDebounced(query);
  }, [mounted, activeTab, selectedMuni, borisSearch, borisTypeFilter]);

  const municipalities = useMemo(() => {
    return summaries.map(s => s.municipality);
  }, [summaries]);

  const activeSummary = useMemo(() => {
    if (selectedMuni === "all") {
      const totalDwellings = summaries.reduce((acc, s) => acc + s.total_dwellings, 0);
      const avgVacancy = Number(
        (summaries.reduce((acc, s) => acc + s.vacancy_rate_pct, 0) / (summaries.length || 1)).toFixed(1)
      );
      const avgLiving = Number(
        (summaries.reduce((acc, s) => acc + s.avg_living_space_sqm, 0) / (summaries.length || 1)).toFixed(1)
      );
      const avgLandVal = Math.round(
        summaries.reduce((acc, s) => acc + s.avg_land_value_residential, 0) / (summaries.length || 1)
      );
      const avgRent = Number(
        (summaries.reduce((acc, s) => acc + s.avg_rent_cold_sqm, 0) / (summaries.length || 1)).toFixed(2)
      );
      const totalPermits = summaries.reduce((acc, s) => acc + s.recent_permits_dwellings, 0);
      const totalCompletions = summaries.reduce((acc, s) => acc + s.recent_completions_dwellings, 0);
      const totalPlans = summaries.reduce((acc, s) => acc + s.active_bplaene_count, 0);

      return {
        municipality: "Hessisches Ried (Gesamtraum)",
        total_dwellings: totalDwellings,
        vacancy_rate_pct: avgVacancy,
        avg_living_space_sqm: avgLiving,
        avg_land_value_residential: avgLandVal,
        avg_rent_cold_sqm: avgRent,
        avg_apartment_buy_sqm: 3100.0,
        recent_permits_dwellings: totalPermits,
        recent_completions_dwellings: totalCompletions,
        active_bplaene_count: totalPlans,
      };
    }
    return summaries.find(s => s.municipality.toLowerCase() === selectedMuni.toLowerCase()) ?? summaries[0];
  }, [selectedMuni, summaries]);

  const activeStock = useMemo(() => {
    if (selectedMuni !== "all") {
      const found = housingStock.find(h => h.municipality.toLowerCase() === selectedMuni.toLowerCase());
      if (found) return found;
    }
    // Aggregate across all stock
    const ageKeys = Object.keys(AGE_BRACKET_LABELS);
    const aggAge: Record<string, number> = {};
    for (const k of ageKeys) aggAge[k] = 0;

    const bTypeKeys = ["single_family", "semi_detached_duplex", "multi_family"];
    const aggBTypes: Record<string, number> = {};
    for (const k of bTypeKeys) aggBTypes[k] = 0;

    let totalB = 0;
    let totalRes = 0;
    let totalD = 0;
    let totalVac = 0;

    for (const item of housingStock) {
      totalB += item.total_buildings;
      totalRes += item.residential_buildings;
      totalD += item.total_dwellings;
      totalVac += item.vacant_dwellings;
      for (const k of ageKeys) {
        aggAge[k] = (aggAge[k] || 0) + (item.age_distribution[k] || 0);
      }
      for (const k of bTypeKeys) {
        aggBTypes[k] = (aggBTypes[k] || 0) + (item.building_types[k] || 0);
      }
    }

    // Weighted average heating
    const heatingKeys = Object.keys(HEATING_LABELS);
    const aggHeating: Record<string, number> = {};
    for (const h of heatingKeys) {
      const sumWeighted = housingStock.reduce((acc, curr) => acc + (curr.heating_energy[h] || 0) * curr.total_dwellings, 0);
      aggHeating[h] = Number((sumWeighted / (totalD || 1)).toFixed(1));
    }

    return {
      id: "agg-ried",
      municipality: "Hessisches Ried",
      district: "Gesamtraum",
      reference_year: 2022,
      total_buildings: totalB,
      residential_buildings: totalRes,
      total_dwellings: totalD,
      avg_living_space_sqm: 100.8,
      vacant_dwellings: totalVac,
      vacancy_rate_pct: Number(((totalVac / (totalD || 1)) * 100).toFixed(1)),
      age_distribution: aggAge,
      building_types: aggBTypes,
      heating_energy: aggHeating,
      source: "Zensus 2022 (Statistik Hessen)",
    };
  }, [selectedMuni, housingStock]);

  const filteredBoris = useMemo(() => {
    return borisZones.filter(b => {
      const matchesMuni = selectedMuni === "all" || b.municipality.toLowerCase() === selectedMuni.toLowerCase();
      const matchesSearch =
        !borisSearch ||
        b.district?.toLowerCase().includes(borisSearch.toLowerCase()) ||
        b.zone_type.toLowerCase().includes(borisSearch.toLowerCase()) ||
        b.zone_code.includes(borisSearch);
      const matchesType = borisTypeFilter === "all" || b.zone_type === borisTypeFilter;
      return matchesMuni && matchesSearch && matchesType;
    });
  }, [borisZones, selectedMuni, borisSearch, borisTypeFilter]);

  const filteredPermits = useMemo(() => {
    return permits.filter(p => {
      return selectedMuni === "all" || p.municipality.toLowerCase() === selectedMuni.toLowerCase();
    });
  }, [permits, selectedMuni]);

  const filteredPlans = useMemo(() => {
    return developmentPlans.filter(d => {
      return selectedMuni === "all" || d.municipality.toLowerCase() === selectedMuni.toLowerCase();
    });
  }, [developmentPlans, selectedMuni]);

  const filteredBenchmarks = useMemo(() => {
    return benchmarks.filter(m => {
      return selectedMuni === "all" || m.municipality.toLowerCase() === selectedMuni.toLowerCase();
    });
  }, [benchmarks, selectedMuni]);

  return (
    <div className="space-y-10">
      {/* Municipality Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span>Kommune auswählen:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedMuni("all")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              selectedMuni === "all"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            Gesamtes Ried (Alle)
          </button>
          {municipalities.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedMuni(m.toLowerCase())}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                selectedMuni === m.toLowerCase()
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                  : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Wohnungsbestand */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Wohnungsbestand</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-100">
              {activeSummary.total_dwellings.toLocaleString("de-DE")}
            </div>
            <p className="text-xs text-slate-400">
              Wohnungen in {activeStock.residential_buildings.toLocaleString("de-DE")} Wohngebäuden
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Ø Wohnfläche</span>
            <span className="font-mono text-slate-300 font-medium">{activeSummary.avg_living_space_sqm} m² / Wg.</span>
          </div>
        </div>

        {/* Card 2: Leerstandsquote */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Leerstandsquote</span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-teal-300">
                {activeSummary.vacancy_rate_pct} %
              </span>
              <span className="text-xs text-slate-400">
                ({activeStock.vacant_dwellings.toLocaleString("de-DE")} Einheiten)
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Hessen-Vergleich: <strong className="text-slate-300">3,4 %</strong> (Angespannter Wohnungsmarkt)
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Marktlage</span>
            <span className="text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Hohe Auslastung
            </span>
          </div>
        </div>

        {/* Card 3: Bodenrichtwert Wohnen */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ø Bodenrichtwert</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-300">
              {formatEuro(activeSummary.avg_land_value_residential, true)}
            </div>
            <p className="text-xs text-slate-400">
              Amtlicher BORIS Hessen Stichtag 01.01.2024 für baureifes Wohnland
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Kaltmiete Ø</span>
            <span className="font-mono text-slate-300 font-medium">{formatEuro(activeSummary.avg_rent_cold_sqm, true)}</span>
          </div>
        </div>

        {/* Card 4: Bautätigkeit & B-Pläne */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bautätigkeit</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Hammer className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-300">
              +{activeSummary.recent_permits_dwellings}
            </div>
            <p className="text-xs text-slate-400">
              Neu genehmigte Wohnungen (zuletzt) · {activeSummary.recent_completions_dwellings} fertiggestellt
            </p>
          </div>
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Aktive B-Pläne</span>
            <span className="text-blue-400 font-medium font-mono">{activeSummary.active_bplaene_count} Neubaugebiete</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-slate-800 gap-2 sm:gap-6 overflow-x-auto text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("stock")}
          className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === "stock"
              ? "border-emerald-400 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Gebäudealter & Wohnbestand</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("energy")}
          className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === "energy"
              ? "border-emerald-400 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>Heizung & Energiewende</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("prices")}
          className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === "prices"
              ? "border-emerald-400 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Bodenrichtwerte & Preise</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("construction")}
          className={`pb-3 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
            activeTab === "construction"
              ? "border-emerald-400 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Hammer className="w-4 h-4" />
          <span>Bautätigkeit & Neubaugebiete</span>
        </button>
      </div>

      {/* TAB 1: GEBÄUDEALTER & WOHNUNGSBESTAND */}
      {activeTab === "stock" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Building Age Pyramid */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Building className="w-5 h-5 text-emerald-400" />
                    Gebäudealter-Struktur ({activeStock.municipality})
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Baujahresklassen aller Wohngebäude nach Zensus 2022 (Statistik Hessen)
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-mono bg-slate-950 border border-slate-800 text-slate-400">
                  Basis: {activeStock.residential_buildings.toLocaleString("de-DE")} Gebäude
                </span>
              </div>

              {/* Age Class Bars */}
              <div className="space-y-4">
                {Object.entries(AGE_BRACKET_LABELS).map(([key, meta]) => {
                  const count = activeStock.age_distribution[key] || 0;
                  const pct = Number(((count / (activeStock.residential_buildings || 1)) * 100).toFixed(1));
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{meta.label}</span>
                          <span className="text-slate-500 text-[11px] hidden sm:inline">({meta.period})</span>
                        </div>
                        <div className="flex items-center gap-3 font-mono text-xs">
                          <span className="text-slate-400">{count.toLocaleString("de-DE")} Gebäude</span>
                          <span className="font-bold text-emerald-400 w-12 text-right">{pct} %</span>
                        </div>
                      </div>
                      <div className="h-3 rounded-full bg-slate-950 overflow-hidden border border-slate-800/80">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: meta.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Age Insights Box */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-300 leading-relaxed space-y-1">
                <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Sanierungs- & Modernisierungsfokus im Ried:
                </span>
                <p>
                  Rund <strong>42–44 %</strong> der Wohngebäude im Ried stammen aus den Baujahren 1949–1978.
                  Dieser Nachkriegsbestand bildet den zentralen Hebel für energetische Gebäudesanierung, Dämmung und den
                  Umstieg von fossilen Heizkesseln auf moderne Wärmepumpen.
                </p>
              </div>
            </div>

            {/* Right 1 Col: Building Types & Vacancy Details */}
            <div className="space-y-6">
              {/* Building Types Card */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Home className="w-4 h-4 text-teal-400" />
                  Gebäudetypen
                </h3>

                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Freistehende Einfamilienhäuser</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {activeStock.building_types.single_family?.toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Dominierender Bautyp in den Wohnquartieren des Rieds
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Doppel- & Reihenhäuser</span>
                      <span className="font-mono text-teal-400 font-bold">
                        {activeStock.building_types.semi_detached_duplex?.toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Verbreitet in Neubaugebieten der 90er und 2000er Jahre
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">Mehrfamilienhäuser (3+ Wg.)</span>
                      <span className="font-mono text-blue-400 font-bold">
                        {activeStock.building_types.multi_family?.toLocaleString("de-DE")}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Zentren von Lampertheim und Bürstadt sowie Bahnhofsnähe
                    </div>
                  </div>
                </div>
              </div>

              {/* Vacancy & DSGVO Privacy Card */}
              <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  Leerstand & Datenschutz
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  In ganz Deutschland und Hessen unterliegen Leerstandsdaten strengen Datenschutzvorgaben (DSGVO).
                  Es werden daher <strong>keine Einzeladressen</strong> veröffentlicht, sondern aggregierte Quoten auf
                  Gemeinde- und 100m-Rasterebene.
                </p>
                <div className="pt-2 text-xs text-slate-300 font-mono flex items-center justify-between border-t border-slate-800">
                  <span>Leerstandsquote {activeStock.municipality}:</span>
                  <span className="text-teal-400 font-bold">{activeStock.vacancy_rate_pct} %</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: HEIZUNGSSTRUKTUR & ENERGIEWENDE */}
      {activeTab === "energy" && (
        <div className="space-y-8">
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-400" />
                  Energieträger & Heizungsstruktur ({activeStock.municipality})
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Verteilung der vorwiegend verwendeten Heizenergie nach Zensus 2022
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-orange-500/10 text-orange-300 border border-orange-500/20">
                Kommunale Wärmeplanung
              </span>
            </div>

            {/* Heating Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(HEATING_LABELS).map(([key, meta]) => {
                const val = activeStock.heating_energy[key] || 0;
                return (
                  <div
                    key={key}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{meta.label}</span>
                      <span className="font-mono text-sm font-extrabold text-slate-100">{val} %</span>
                    </div>

                    <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(val, 3)}%`, backgroundColor: meta.color }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-500">
                      {key === "gas" && "Überwiegend Niedertemperatur- und Brennwertkessel"}
                      {key === "oil" && "Häufig in Altbauten und ländlicheren Ortslagen"}
                      {key === "heat_pump" && "Starker Zuwachs in Neubaugebieten (Luft/Wasser & Erdwärme)"}
                      {key === "district_heating" && "Nahwärmenetze & kommunale Liegenschaften"}
                      {key === "wood_pellets" && "Biomasseheizungen und Pelletanlagen"}
                      {key === "solar_thermal" && "Solarthermische Heizungsunterstützung"}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Comparison Across Towns */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Vergleich: Wärmepumpen-Anteil im Ried
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {housingStock.map(h => (
                  <div key={h.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-1">
                    <div className="text-xs text-slate-400 truncate">{h.municipality}</div>
                    <div className="text-base font-extrabold text-emerald-400 font-mono">
                      {h.heating_energy.heat_pump}%
                    </div>
                    <div className="text-[10px] text-slate-500">Wärmepumpe</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BODENRICHTWERTE & IMMOBILIENPREISE */}
      {activeTab === "prices" && (
        <div className="space-y-8">
          {/* Market Purchase & Rent Benchmarks */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                  Immobilien- & Mietpreisniveau im Ried (2025/2026)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Transaktionsdaten des Gutachterausschusses Kreis Bergstraße & Zensus-Mietwertübersichten
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Eigentumswohnungen</span>
                  <span className="text-emerald-400 font-mono">Ø Kaufpreis</span>
                </div>
                <div className="text-2xl font-extrabold text-slate-100 font-mono">
                  {formatEuro(activeSummary.avg_apartment_buy_sqm ?? NaN, true)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Bestand: ca. 2.450 – 3.350 €/m² · Neubau Erstbezug bis 4.450 €/m²
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Einfamilienhäuser</span>
                  <span className="text-teal-400 font-mono">Ø Gesamtpreis</span>
                </div>
                <div className="text-2xl font-extrabold text-slate-100 font-mono">
                  {formatEuro(
                    filteredBenchmarks.find(b => b.metric_type === "house_buy_avg")?.avg_val ?? NaN
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Freistehend & Doppelhäuser im Ried (Spanne: 310.000 – 740.000 €)
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Nettokaltmiete</span>
                  <span className="text-amber-400 font-mono">Ø m² Kalt</span>
                </div>
                <div className="text-2xl font-extrabold text-amber-300 font-mono">
                  {formatEuro(activeSummary.avg_rent_cold_sqm, true)}
                </div>
                <p className="text-[11px] text-slate-500">
                  Bestandsmieten Ø 8,50 – 9,80 €/m² · Wiedervermietung 11,50 – 13,50 €/m²
                </p>
              </div>
            </div>
          </div>

          {/* BORIS Hessen Bodenrichtwert Zones Table */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  Amtliche Bodenrichtwerte (BORIS Hessen)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Stichtag 01.01.2024 (dl-zero-de/2.0) · Auf der Karte als interaktive Polygone sichtbar
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={borisSearch}
                    onChange={e => setBorisSearch(e.target.value)}
                    placeholder="Zone oder Ort suchen…"
                    className="pl-9 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <select
                  value={borisTypeFilter}
                  onChange={e => setBorisTypeFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="all">Alle Zonennutzungen</option>
                  <option value="Wohnbaufläche">Wohnbaufläche</option>
                  <option value="Gewerbefläche">Gewerbefläche</option>
                  <option value="Landwirtschaft">Landwirtschaft</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                    <th className="pb-3 px-3">Zone / Lage</th>
                    <th className="pb-3 px-3">Kommune</th>
                    <th className="pb-3 px-3">Nutzung</th>
                    <th className="pb-3 px-3">Entwicklungszustand</th>
                    <th className="pb-3 px-3 text-right">Bodenrichtwert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredBoris.map(zone => (
                    <tr key={zone.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-200">
                        <div>{zone.district ?? zone.zone_code}</div>
                        <span className="text-[10px] font-mono text-slate-500">{zone.zone_code}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">{zone.municipality}</td>
                      <td className="py-3 px-3">
                        <span
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium"
                          style={{
                            backgroundColor: `${getBorisZoneColor(zone.land_value_eur_sqm, zone.zone_type)}20`,
                            color: getBorisZoneColor(zone.land_value_eur_sqm, zone.zone_type),
                          }}
                        >
                          {zone.zone_type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {zone.development_status}
                        {zone.floor_space_index ? ` · WGFZ ${zone.floor_space_index}` : ""}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-sm text-slate-100">
                        {formatEuro(zone.land_value_eur_sqm, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BAUTÄTIGKEIT & NEUBAUGEBIETE */}
      {activeTab === "construction" && (
        <div className="space-y-8">
          {/* Permits vs Completions Bar Cards */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <Hammer className="w-5 h-5 text-blue-400" />
                  Bautätigkeits-Entwicklung ({activeSummary.municipality})
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Baugenehmigungen vs. Baufertigstellungen (Wohnungen) 2020 – 2025 (Statistik Hessen F II 1)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {filteredPermits.slice(-6).map(p => {
                const maxVal = 160;
                const permitWidth = Math.min(100, Math.round((p.residential_dwellings_count / maxVal) * 100));
                const compWidth = Math.min(100, Math.round((p.completions_dwellings_count / maxVal) * 100));
                return (
                  <div key={p.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-200 font-mono">{p.year} · {p.municipality}</span>
                      <div className="flex gap-4 font-mono">
                        <span className="text-blue-400">{p.residential_dwellings_count} genehmigt</span>
                        <span className="text-emerald-400">{p.completions_dwellings_count} fertiggestellt</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${permitWidth}%` }}
                        />
                      </div>
                      <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${compWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Development Plans (B-Pläne) */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
            <div>
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Aktive Bebauungspläne & Neubaugebiete (B-Pläne)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Bauleitplanung der Kommunen im Ried · Wohn- und Gewerbebauflächen
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPlans.map(plan => (
                <div
                  key={plan.id}
                  className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {plan.municipality}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          plan.status === "rechtskraeftig"
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                            : plan.status === "im_verfahren"
                            ? "bg-amber-950 text-amber-300 border border-amber-800"
                            : "bg-blue-950 text-blue-300 border border-blue-800"
                        }`}
                      >
                        {plan.status === "rechtskraeftig"
                          ? "Rechtskräftig"
                          : plan.status === "im_verfahren"
                          ? "Im Verfahren"
                          : "In Aufstellung"}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-slate-100">{plan.plan_name}</h4>
                    <p className="text-xs text-slate-400">
                      Nutzungsziel: <strong className="text-slate-200">{plan.target_use}</strong> · Plan-Nr.: {plan.plan_number}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono">
                      Fläche: <strong className="text-slate-300">{plan.area_hectares} ha</strong>
                    </span>
                    {plan.document_url && (
                      <a
                        href={plan.document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        <span>Gemeindeseite</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OPEN DATA BANNER */}
      <section className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-teal-950/40 border border-emerald-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Offene Geodaten für Hackathons & Analysen
          </h4>
          <p className="text-xs text-slate-400 max-w-2xl">
            Alle Bodenrichtwert-Polygone (BORIS), Zensus-2022-Wohnungsstatistiken und Bautätigkeits-Zeitreihen stehen als
            maschinenlesbare GeoJSON- und CSV-Dateien für die Community zur Verfügung.
          </p>
        </div>

        <Link
          href="/daten"
          className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5"
        >
          <span>Zu den Downloads & API</span>
          <ChevronRight className="w-4 h-4" />
        </Link>
      </section>
    </div>
  );
}
