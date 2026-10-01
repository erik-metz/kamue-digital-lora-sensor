"use client";

import {
  Activity,
  Briefcase,
  Building2,
  Coins,
  Database,
  ExternalLink,
  Layers,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function MunicipalDataCatalog() {
  return (
    <section id="themen-katalog" className="space-y-8">
      {/* SECTION HEADER */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5" /> Regionale Open-Data-Kataloge
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
          Kommunale Schnittstellen &amp; Themenspeicher
        </h2>
        <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
          Neben den Live-Sensordaten aggregiert Open Ried Sens amtliche Statistiken, Haushaltszahlen,
          Infrastruktur- und Verkehrsdaten für Bürstadt, Lampertheim und das gesamte Ried. Alle
          Endpunkte sind frei als JSON oder GeoJSON abrufbar.
        </p>
      </div>

      {/* CATALOG CARDS GRID */}
      <div className="space-y-6">
        {/* DEMOGRAPHICS & SOCIAL DATA */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-teal-400" />
                Demografie, Pendlerströme &amp; Bildungsdaten (HSL / BA)
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Offene sozio-ökonomische Daten und Geokoordinaten für Bürstadt, Lampertheim, Biblis,
                Groß-Rohrheim und Hofheim.
              </p>
            </div>
            <Link
              href="/demografie"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors shrink-0"
            >
              Visualisierter Sozialatlas <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Gemeinde-Scorecards
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/demographics/summary</p>
              <p className="text-slate-400 font-sans text-xs">
                Einwohnerzahlen, Dichte, Alterskohorten, Ausländeranteile und Wanderungssalden.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Pendleratlas
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/demographics/&#123;id&#125;/commuters</p>
              <p className="text-slate-400 font-sans text-xs">
                Ein- und Auspendler nach Arbeitsorten (Mannheim, Worms, BASF, Frankfurt, etc.).
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Schulen &amp; Kitas
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/demographics/facilities</p>
              <p className="text-slate-400 font-sans text-xs">
                Standorte, Kapazitäten, aktuelle Schülerzahlen, Träger und Betreuungsquoten.
              </p>
            </div>
          </div>
        </div>

        {/* REAL ESTATE & BUILDINGS */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-400" />
                Immobilien, Bauen &amp; Bodenrichtwerte (BORIS &amp; Zensus 2022)
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Amtliche Bodenrichtwerte (BORIS Hessen dl-zero-de/2.0), Gebäudealter, Heizungsenergieträger, Bautätigkeit und Neubaugebiete.
              </p>
            </div>
            <Link
              href="/bauen-wohnen"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors shrink-0"
            >
              Immobilien-Atlas <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Bodenrichtwerte (BORIS)
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/realestate/boris</p>
              <p className="text-slate-400 font-sans text-xs">
                Amtliche Bodenrichtwertzonen (€/m²), Nutzungsarten und WGFZ-Werte.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Gebäudealter &amp; Heizung
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/realestate/housing-stock</p>
              <p className="text-slate-400 font-sans text-xs">
                Zensus 2022 Altersklassen, Heizungsarten (Wärmepumpe, Gas, Öl) und Leerstände.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Bautätigkeit (Genehmigt / Fertig)
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/realestate/construction-activity</p>
              <p className="text-slate-400 font-sans text-xs">
                Statistik Hessen F II 1 Zeitreihen: Genehmigte Wohnungen vs. fertiggestellte Gebäude.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Neubaugebiete &amp; B-Pläne
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/realestate/development-plans</p>
              <p className="text-slate-400 font-sans text-xs">
                Aktive Bebauungspläne mit Rechtsstatus, Hektar und Gemeindeverweisen.
              </p>
            </div>
          </div>
        </div>

        {/* PUBLIC FINANCE, BUDGETS & ELECTIONS */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-400" />
                Öffentliche Finanzen, Haushalte &amp; Wahlergebnisse (Open Data)
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Gemeindehaushalte, Gewerbesteuer- und Grundsteuer-Erträge, Hebesätze, Aufgabenbereiche und Wahlergebnisse.
              </p>
            </div>
            <Link
              href="/haushalt"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors shrink-0"
            >
              Finanz-Dashboard <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Gemeindehaushalte &amp; Steuern
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/finance/budgets</p>
              <p className="text-slate-400 font-sans text-xs">
                Haushaltsvolumen, Gewerbesteuer, Grundsteuer A/B, Hebesätze und Schuldenstand.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Produkthaushalt / Ausgaben
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/finance/spending</p>
              <p className="text-slate-400 font-sans text-xs">
                Ausgaben nach Bereichen: Schulen, Straßen, Kitas, Kultur (KAMÜ) und Verwaltung.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Kommunalvergleich
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/finance/compare</p>
              <p className="text-slate-400 font-sans text-xs">
                Vergleich Bürstadt, Lampertheim, Biblis: Hebesätze, Pro-Kopf-Schulden &amp; Rücklagen.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Wahlergebnisse &amp; Stimmbezirke
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/elections</p>
              <p className="text-slate-400 font-sans text-xs">
                Kommunal- &amp; Europawahlen inkl. Stimmbezirke, Wahlbeteiligung und Mandaten.
              </p>
            </div>
          </div>
        </div>

        {/* ECONOMY & TRADE TAXES */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-emerald-400" />
                Wirtschaft, Unternehmen &amp; Gewerbesteuer (Statistik Hessen &amp; Bundesanzeiger)
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Gewerbeanmeldungen, Netto-Gewerbesaldo, Gewerbesteuer-Hebesätze aller 22 Kommunen im Kreis Bergstraße und Branchenstrukturen.
              </p>
            </div>
            <Link
              href="/wirtschaft"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-colors shrink-0"
            >
              Wirtschaftsportal <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Gewerbedynamik &amp; Saldo
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/economy/registrations</p>
              <p className="text-slate-400 font-sans text-xs">
                Anmeldungen, Gründungen, Abmeldungen, Aufgaben und Netto-Wachstum.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Hebesätze (22 Gemeinden)
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/economy/taxes</p>
              <p className="text-slate-400 font-sans text-xs">
                Gewerbesteuer- und Grundsteuerhebesätze für den gesamten Kreis Bergstraße.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Top-Arbeitgeber
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/economy/companies</p>
              <p className="text-slate-400 font-sans text-xs">
                Standorte mit Geokoordinaten, Branchen und Mitarbeitergrößenklassen.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Branchen &amp; Startups
              </span>
              <p className="text-emerald-400 font-bold">GET /api/v1/economy/industry-structure</p>
              <p className="text-slate-400 font-sans text-xs">
                Beschäftigung nach WZ 2008 Sektoren und regionale Förderprogramme.
              </p>
            </div>
          </div>
        </div>

        {/* INFRASTRUCTURE, ENERGY & ENVIRONMENT */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Infrastruktur, Energie &amp; Umwelt (Open Data)
              </h3>
              <p className="text-sm text-slate-400 mt-1">
                Echtzeit-Schnittstellen für regenerative Erzeugung, Ladesäulen, freies WLAN, Grundwasser (HLNUG) und Rheinpegel (WSV).
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold self-start sm:self-auto">
              REST &amp; GeoJSON
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Grundwasser &amp; Nitrat
              </span>
              <p className="text-amber-400 font-bold">GET /api/v1/environment/groundwater</p>
              <p className="text-slate-400 font-sans text-xs">
                Flurabstand (Tiefe in m) und Nitratkonzentration (mg/l) der HLNUG-Messstellen.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Flusspegelstände
              </span>
              <p className="text-amber-400 font-bold">GET /api/v1/environment/flood/gauges</p>
              <p className="text-slate-400 font-sans text-xs">
                Echtzeit-Wasserstände vom Rheinpegel Worms und Weschnitzpegel Lorsch.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-xs">
              <span className="text-[10px] text-slate-500 font-sans uppercase font-bold">
                Regenerative Energie
              </span>
              <p className="text-amber-400 font-bold">GET /api/infrastructure/energy</p>
              <p className="text-slate-400 font-sans text-xs">
                ZAKB Biogas/Solar-Erzeugung und vermiedene CO₂-Emissionen.
              </p>
            </div>
          </div>
        </div>

        {/* SENSOR PARAMETERS GLOSSARY */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Erfasste Umweltparameter &amp; Maßeinheiten
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Physikalische Messgrößen der Multisensor-Stationen im Feld.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Klima</span>
              <h4 className="font-bold text-slate-200 text-sm">Temperatur</h4>
              <p className="text-xs text-emerald-400 font-mono">°C (celsius)</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Klima</span>
              <h4 className="font-bold text-slate-200 text-sm">Luftfeuchtigkeit</h4>
              <p className="text-xs text-emerald-400 font-mono">% r.F. (percent)</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Niederschlag</span>
              <h4 className="font-bold text-slate-200 text-sm">Regenmenge</h4>
              <p className="text-xs text-emerald-400 font-mono">mm (mm)</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Sonne</span>
              <h4 className="font-bold text-slate-200 text-sm">UV-Index</h4>
              <p className="text-xs text-emerald-400 font-mono">0 - 11+ (uv_index)</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Luftqualität</span>
              <h4 className="font-bold text-slate-200 text-sm">VOC-Index</h4>
              <p className="text-xs text-emerald-400 font-mono">0 - 500 (voc_index)</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Luftqualität</span>
              <h4 className="font-bold text-slate-200 text-sm">NOx-Index</h4>
              <p className="text-xs text-emerald-400 font-mono">0 - 500 (nox_index)</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Partikel</span>
              <h4 className="font-bold text-slate-200 text-sm">Feinstaub PM2.5</h4>
              <p className="text-xs text-emerald-400 font-mono">µg/m³ (ug/m3)</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">Akustik</span>
              <h4 className="font-bold text-slate-200 text-sm">Schallpegel</h4>
              <p className="text-xs text-emerald-400 font-mono">dB (db)</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
