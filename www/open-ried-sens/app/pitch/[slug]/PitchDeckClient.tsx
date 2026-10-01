"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Mic,
  ScrollText,
  Presentation,
  Share2,
  Printer,
  Sparkles,
  ExternalLink,
  Check,
  CheckCircle2,
  HelpCircle,
  MapPin,
  TrendingUp,
  Cpu,
  Layers,
  Shield,
  FileText,
  Wrench,
  Activity,
  Users,
  Building,
  Target,
  BarChart3,
  Server,
  Radio,
  Clock,
  Compass,
} from "lucide-react";
import type {
  PitchDeck,
  PitchSlide,
  SpecificAskItem,
} from "@/lib/pitchData";
import MapEvidenceViewer from "../MapEvidenceViewer";
import HandoutModal from "../HandoutModal";

interface PitchDeckClientProps {
  deck: PitchDeck;
}

export default function PitchDeckClient({ deck }: PitchDeckClientProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"slides" | "scroll">("slides");
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showHandoutModal, setShowHandoutModal] = useState(false);

  // Interactive meeting checklist for commitments
  const [agreedAsks, setAgreedAsks] = useState<Record<string, boolean>>({});

  const currentSlide: PitchSlide =
    deck.slides[currentSlideIndex] || deck.slides[0];
  const totalSlides = deck.slides.length;

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  function toggleAskCommitment(id: string) {
    setAgreedAsks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName))
        return;

      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        nextSlide();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        prevSlide();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowSpeakerNotes((prev) => !prev);
      } else if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowHandoutModal(true);
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentSlideIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentSlideIndex(totalSlides - 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextSlide, prevSlide, toggleFullscreen, totalSlides]);

  function handleCopyLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  }

  // Render Visual Slide Layouts
  function renderSlideBody(slide: PitchSlide) {
    switch (slide.layout) {
      case "one-pager-hero":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
            <div className="lg:col-span-6 space-y-4">
              {slide.imageVisual && (
                <div className="relative aspect-[16/10] w-full rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950">
                  <Image
                    src={slide.imageVisual.src}
                    alt={slide.imageVisual.alt}
                    fill
                    className="object-cover object-center"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                  {slide.imageVisual.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-4 text-xs text-slate-300 font-medium">
                      {slide.imageVisual.caption}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 space-y-4">
              <div className="grid grid-cols-1 gap-3.5">
                {slide.bullets?.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        {b.tag}
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <h4 className="text-base font-bold text-slate-100">
                      {b.title}
                    </h4>
                    <p className="text-xs text-slate-300 font-light leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Pitch Metadata Bar */}
              <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kulturzentrum KAMÜ · Bürstadt</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>10–12 Min. Pitch + Q&A</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "blindspot-evidence":
        return slide.mapEvidence ? (
          <div className="pt-2">
            <MapEvidenceViewer items={slide.mapEvidence} />
          </div>
        ) : null;

      case "value-prop-split":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
            <div className="lg:col-span-5 space-y-4">
              {slide.imageVisual && (
                <div className="relative aspect-[16/10] w-full rounded-3xl overflow-hidden border border-slate-800 shadow-xl bg-slate-950">
                  <Image
                    src={slide.imageVisual.src}
                    alt={slide.imageVisual.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 45vw"
                  />
                  {slide.imageVisual.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 backdrop-blur-sm p-3 text-[11px] text-slate-300 font-medium">
                      {slide.imageVisual.caption}
                    </div>
                  )}
                </div>
              )}

              {slide.stats && (
                <div className="grid grid-cols-3 gap-2">
                  {slide.stats.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-center"
                    >
                      <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                        {s.value}
                      </div>
                      <div className="text-[11px] font-bold text-slate-300">
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {slide.bullets?.map((b, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {b.tag}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-100">
                      {b.title}
                    </h4>
                    <p className="text-sm text-slate-300 font-light leading-relaxed">
                      {b.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "product-architecture":
        return (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
            <div className="lg:col-span-6 space-y-3">
              {slide.imageVisual && (
                <div className="relative aspect-[16/10] w-full rounded-3xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950">
                  <Image
                    src={slide.imageVisual.src}
                    alt={slide.imageVisual.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  {slide.imageVisual.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/90 backdrop-blur-sm p-3 text-xs text-slate-300 font-medium">
                      {slide.imageVisual.caption}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                End-to-End Open-Source Architektur
              </h4>

              {/* 4-Layer Architecture Diagram */}
              <div className="space-y-2.5">
                <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-100">
                        1. Sensor Node (Hardware)
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        RAK3113 LoRa-Modul · Sensirion SCD41 (CO2) & SPS30 (PM2.5)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    3,3V / I²C
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-sky-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-100">
                        2. Funkübertragung (LoRaWAN)
                      </h5>
                      <p className="text-[11px] text-sky-300">
                        The Things Network (TTN) · EU868 Frequenz · Bis zu 10 km
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                    0 € Funkkosten
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-violet-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-100">
                        3. VPS & TimescaleDB
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        Echtzeit-Ingestion · Aggregation · Open-Data REST & OpenAPI
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                    Hessen-Server
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-100">
                        4. Web-Plattform open-ried.de
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        Live-Dashboard · Hitze-Karten · Export für Bürger & Ämter
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                    Next.js / Leaflet
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case "tam-sam-som":
        return slide.marketFunnel ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 relative overflow-hidden">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Compass className="w-4 h-4" />
                <span>TAM (Gesamtmarkt)</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-slate-100 font-mono">
                {slide.marketFunnel.tam.number}
              </div>
              <h4 className="text-sm font-bold text-slate-200">
                {slide.marketFunnel.tam.title}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                {slide.marketFunnel.tam.desc}
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-700 space-y-3 relative overflow-hidden">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                <span>SAM (Zielregion)</span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-sky-400 font-mono">
                {slide.marketFunnel.sam.number}
              </div>
              <h4 className="text-sm font-bold text-slate-200">
                {slide.marketFunnel.sam.title}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">
                {slide.marketFunnel.sam.desc}
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-emerald-950/40 border border-emerald-500/40 space-y-3 relative overflow-hidden shadow-lg shadow-emerald-500/10">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>SOM (18-Monate-Fokus)</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                {slide.marketFunnel.som.number}
              </div>
              <h4 className="text-sm font-bold text-slate-100">
                {slide.marketFunnel.som.title}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                {slide.marketFunnel.som.desc}
              </p>
            </div>
          </div>
        ) : null;

      case "unit-economics":
        return slide.costComparison ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="p-4 font-semibold">Kriterium / Feature</th>
                      <th className="p-4 font-bold text-emerald-400">
                        Open Ried Sens (Bürger-DIY)
                      </th>
                      <th className="p-4 font-semibold text-rose-400">
                        Kommerzielle Smart-City Säulen
                      </th>
                      <th className="p-4 font-semibold text-slate-300">
                        Ihr Vorteil
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {slide.costComparison.map((row, idx) => (
                      <tr
                        key={idx}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-4 font-medium text-slate-200">
                          {row.feature}
                        </td>
                        <td className="p-4 font-bold text-emerald-300 font-mono">
                          {row.openRiedSens}
                        </td>
                        <td className="p-4 text-slate-400 font-mono">
                          {row.commercialSolution}
                        </td>
                        <td className="p-4 font-semibold text-sky-300">
                          {row.advantage}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-slate-400 italic text-center">
              Kalkulationsbasis: Reichelt/Mouser Hardwarepreise 2026 vs. öffentliche Vergabedaten kommerzieller Smart-City-Stele.
            </p>
          </div>
        ) : null;

      case "competitive-matrix":
        return slide.competitivePoints ? (
          <div className="space-y-4 pt-2">
            <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Achse Y: Bürgernähe & MINT-Bildung</span>
                <span>Achse X: Datenoffenheit & Souveränität</span>
              </div>

              {/* Visual 2x2 Matrix Grid */}
              <div className="relative aspect-[16/8] sm:aspect-[16/7] w-full bg-slate-950 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-[1px] bg-slate-800/60" />
                  <div className="absolute h-full w-[1px] bg-slate-800/60" />
                </div>

                {/* Quadrant Labels */}
                <div className="flex justify-between text-[10px] text-slate-400 pointer-events-none uppercase">
                  <span>Hohe Bürgernähe / Geschlossene Daten</span>
                  <span className="text-emerald-400 font-bold">
                    ★ Sweet Spot: Open Ried Sens
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 pointer-events-none uppercase">
                  <span>Geringe Daten / Konzerne</span>
                  <span>Hohe Daten / Reine Nerd-Projekte</span>
                </div>

                {/* Data Points */}
                {slide.competitivePoints.map((pt, idx) => (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${pt.x}%`, top: `${100 - pt.y}%` }}
                  >
                    <div
                      className={`p-2 rounded-xl flex items-center gap-1.5 shadow-lg transition-transform group-hover:scale-105 ${
                        pt.isSelf
                          ? "bg-emerald-500 text-slate-950 font-black border-2 border-emerald-300 ring-4 ring-emerald-500/20"
                          : "bg-slate-800/90 text-slate-300 border border-slate-700 text-xs"
                      }`}
                    >
                      {pt.isSelf ? (
                        <Sparkles className="w-3.5 h-3.5" />
                      ) : (
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span className="text-xs whitespace-nowrap">{pt.name}</span>
                    </div>

                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-slate-900 border border-slate-700 rounded-xl text-[11px] text-slate-200 w-48 shadow-xl z-20 pointer-events-none">
                      {pt.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null;

      case "stem-learning-matrix":
        return slide.stemSkills ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {slide.stemSkills.map((col, idx) => (
              <div
                key={idx}
                className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      Säule {idx + 1}
                    </span>
                    {col.category === "handwerk" && (
                      <Wrench className="w-4 h-4 text-emerald-400" />
                    )}
                    {col.category === "sensorik" && (
                      <Activity className="w-4 h-4 text-sky-400" />
                    )}
                    {col.category === "informatik" && (
                      <Cpu className="w-4 h-4 text-violet-400" />
                    )}
                    {col.category === "multiplikator" && (
                      <Users className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-slate-100">
                    {col.title}
                  </h4>

                  <ul className="text-xs space-y-1.5 text-slate-300 list-disc pl-3 font-light">
                    {col.skills.map((s, sIdx) => (
                      <li key={sIdx}>{s}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-1 text-[11px]">
                  <div className="text-emerald-400 font-medium">
                    👶 Schüler: {col.targetKids}
                  </div>
                  <div className="text-sky-300 font-medium">
                    🎓 Erwachsene: {col.targetAdults}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null;

      case "traction-timeline":
        return slide.bullets ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
            {slide.bullets.map((b, idx) => (
              <div
                key={idx}
                className="p-5 rounded-3xl bg-slate-900/70 border border-slate-800 relative space-y-2 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      b.tag === "Erreicht"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-sky-500/20 text-sky-300 border-sky-500/30"
                    }`}
                  >
                    {b.tag}
                  </span>
                  <h4 className="text-base font-bold text-slate-100">
                    {b.title}
                  </h4>
                  <p className="text-xs text-slate-300 font-light leading-relaxed">
                    {b.description}
                  </p>
                </div>
                <div className="text-right text-xs font-mono text-slate-400 pt-2">
                  0{idx + 1}
                </div>
              </div>
            ))}
          </div>
        ) : null;

      case "team-showcase":
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {slide.bullets?.map((b, idx) => (
              <div
                key={idx}
                className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-3"
              >
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  {b.tag}
                </span>
                <h4 className="text-lg font-bold text-slate-100">{b.title}</h4>
                <p className="text-xs text-slate-300 font-light leading-relaxed">
                  {b.description}
                </p>
              </div>
            ))}
          </div>
        );

      case "the-ask-commitment":
        return slide.specificAsks ? (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {slide.specificAsks.map((ask) => {
                const isChecked = !!agreedAsks[ask.id];
                return (
                  <div
                    key={ask.id}
                    onClick={() => toggleAskCommitment(ask.id)}
                    className={`p-5 rounded-3xl border transition-all cursor-pointer flex items-start gap-4 select-none ${
                      isChecked
                        ? "bg-emerald-950/40 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                        : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        isChecked
                          ? "bg-emerald-500 border-emerald-400 text-slate-950"
                          : "border-slate-600 bg-slate-950 text-transparent"
                      }`}
                    >
                      <Check className="w-4 h-4 font-bold" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {ask.tag}
                        </span>
                        {isChecked && (
                          <span className="text-[10px] font-bold text-emerald-400">
                            Commitment erteilt
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-slate-100">
                        {ask.title}
                      </h4>
                      <p className="text-xs text-slate-300 font-light leading-relaxed">
                        {ask.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <span>
                💡 <em>Tipp für das Gespräch:</em> Klicken Sie die Checkboxen an, wenn der Entscheider zustimmt!
              </span>
              <button
                onClick={() => setShowHandoutModal(true)}
                className="text-xs font-semibold text-emerald-400 hover:underline flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Als PDF-Handout mitnehmen</span>
              </button>
            </div>
          </div>
        ) : null;

      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Toolbar / Presentation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Back & Target Audience */}
          <div className="flex items-center gap-3">
            <Link
              href="/pitch"
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-100 hover:border-slate-700 transition-all"
              title="Zurück zum Pitch Hub"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border hidden sm:inline-block">
                  {deck.badge}
                </span>
                <h1 className="text-sm sm:text-base font-bold text-slate-100 truncate max-w-[200px] sm:max-w-md">
                  {deck.title}
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Zielgruppe: {deck.targetAudience}
              </p>
            </div>
          </div>

          {/* Right: Controls & Mode Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Handout PDF Generator Button */}
            <button
              onClick={() => setShowHandoutModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all shadow-sm"
              title="Druckbares Handout / One-Pager PDF erstellen (Shortcut: H)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1-Pager Handout</span>
            </button>

            {/* Mode Switcher */}
            <div className="flex items-center bg-slate-900/80 border border-slate-800 rounded-xl p-1 text-xs">
              <button
                onClick={() => setViewMode("slides")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  viewMode === "slides"
                    ? "bg-slate-800 text-slate-100 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Präsentations-Modus (Folie für Folie)"
              >
                <Presentation className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Slides</span>
              </button>
              <button
                onClick={() => setViewMode("scroll")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  viewMode === "scroll"
                    ? "bg-slate-800 text-slate-100 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Dossier / Scroll-Modus (One-Pager zum Durchscrollen)"
              >
                <ScrollText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Scrollen</span>
              </button>
            </div>

            {/* Speaker Notes Toggle Button */}
            <button
              onClick={() => setShowSpeakerNotes((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                showSpeakerNotes
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10"
                  : "bg-slate-900 border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700"
              }`}
              title="Tonspur & Sprechleitfaden für den Referenten anzeigen (Shortcut: N)"
            >
              <Mic className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Tonspur</span>
              <kbd className="hidden lg:inline text-[10px] bg-slate-800 text-slate-400 px-1 rounded">
                N
              </kbd>
            </button>

            {/* Share / Copy Link */}
            <button
              onClick={handleCopyLink}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all"
              title="Link zu dieser Präsentation kopieren"
            >
              {copiedLink ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all hidden sm:flex"
              title="Vollbild umschalten (Shortcut: F)"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Progress Bar (Slide Mode) */}
        {viewMode === "slides" && (
          <div className="w-full h-1 bg-slate-900 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${((currentSlideIndex + 1) / totalSlides) * 100}%`,
              }}
            />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {viewMode === "slides" ? (
          /* SLIDE MODE: Viewport Focused Single Slide */
          <div className="flex-1 flex flex-col justify-center space-y-6 animate-in fade-in duration-300">
            {/* Slide Header */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-emerald-400 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 font-mono">
                    {currentSlide.stepLabel}
                  </span>
                  <span>{currentSlide.eyebrow}</span>
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                  Folie {currentSlideIndex + 1} / {totalSlides}
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-100 tracking-tight leading-tight">
                {currentSlide.title}
              </h2>
              <p className="text-base sm:text-lg text-slate-300 font-light max-w-4xl leading-relaxed">
                {currentSlide.lead}
              </p>
            </div>

            {/* Slide Body based on Layout */}
            {renderSlideBody(currentSlide)}

            {/* Slide Call to Action Buttons */}
            {currentSlide.callToAction && (
              <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 shadow-xl">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-base font-bold text-slate-100 flex items-center gap-2 justify-center sm:justify-start">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Gemeinsam das Hessische Ried vernetzen
                  </h4>
                  <p className="text-xs text-slate-300">
                    Konkrete Umsetzung im Kulturzentrum KAMÜ Bürstadt & Partnerorten
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={currentSlide.callToAction.primaryHref}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    <span>{currentSlide.callToAction.primaryText}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  {currentSlide.callToAction.secondaryText && (
                    <Link
                      href={
                        currentSlide.callToAction.secondaryHref ||
                        "/sensor-bauen"
                      }
                      className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-semibold transition-all"
                    >
                      {currentSlide.callToAction.secondaryText}
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* SCROLL MODE: Continuous Multi-Slide Document (Dossier) */
          <div className="space-y-16 py-4 animate-in fade-in duration-300">
            {/* Dossier Intro Hero */}
            <div className="p-8 sm:p-10 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider px-3 py-1 rounded-full border">
                  {deck.badge}
                </span>
                <span className="text-xs text-slate-400">
                  Lesezeit ca. {deck.estimatedMinutes} Min.
                </span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-black text-slate-100 tracking-tight">
                {deck.title}
              </h2>
              <p className="text-lg text-slate-300 font-light max-w-3xl leading-relaxed">
                {deck.subtitle}
              </p>
              <div className="pt-2 text-xs text-slate-400 flex items-center gap-4">
                <span>Zielgruppe: {deck.targetAudience}</span>
                <span>•</span>
                <span>Standort: Kulturzentrum KAMÜ & Hessisches Ried</span>
              </div>
            </div>

            {/* Slides mapped as sections */}
            {deck.slides.map((slide, sIdx) => (
              <section
                key={slide.id}
                className="p-6 sm:p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 space-y-6 scroll-mt-20"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      {slide.stepLabel} · {slide.eyebrow}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Folie {sIdx + 1} von {totalSlides}
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-100">
                    {slide.title}
                  </h3>
                  <p className="text-base text-slate-300 font-light leading-relaxed">
                    {slide.lead}
                  </p>
                </div>

                {renderSlideBody(slide)}
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Speaker Notes Drawer / "Tonspur für den Referenten" */}
      {showSpeakerNotes && (
        <aside
          className="fixed bottom-16 sm:bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-xl z-50 bg-slate-900/95 border-2 border-emerald-500/50 rounded-3xl p-5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200"
          role="region"
          aria-label="Tonspur für den Referenten"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Mic className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-slate-100">
                Tonspur für den Referenten · Folie {currentSlideIndex + 1}
              </h4>
            </div>
            <button
              onClick={() => setShowSpeakerNotes(false)}
              className="text-xs text-slate-400 hover:text-slate-100 px-2 py-1 rounded bg-slate-800"
            >
              Schließen [N]
            </button>
          </div>

          <div className="mt-3.5 space-y-3.5 text-xs text-slate-300 max-h-[60vh] overflow-y-auto pr-1">
            {/* Elevator Pitch */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
              <span className="font-bold text-emerald-400 uppercase tracking-wide text-[10px] flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Mündliches Intro (Elevator Pitch)
              </span>
              <p className="italic text-slate-200 leading-relaxed">
                &ldquo;{currentSlide.speakerNotes.elevatorPitch}&rdquo;
              </p>
            </div>

            {/* Key Talking Points */}
            <div className="space-y-1.5">
              <span className="font-bold text-slate-200 uppercase tracking-wide text-[10px] flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-sky-400" />
                Wichtigste Sprechpunkte (Nicht auf den Slides!)
              </span>
              <ul className="space-y-1.5 pl-3 list-disc text-slate-300">
                {currentSlide.speakerNotes.talkingPoints.map((pt, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {pt}
                  </li>
                ))}
              </ul>
            </div>

            {/* Audience Engagement Question */}
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-1">
              <span className="font-bold text-sky-300 uppercase tracking-wide text-[10px] flex items-center gap-1">
                <HelpCircle className="w-3 h-3" />
                Publikums-Aktivierung / Fangfrage
              </span>
              <p className="text-sky-200">
                {currentSlide.speakerNotes.audienceEngagement}
              </p>
            </div>

            {/* Local Hook */}
            {currentSlide.speakerNotes.localHook && (
              <div className="flex items-center gap-2 text-[11px] text-amber-300/90 pt-1">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span>Ried-Bezug: {currentSlide.speakerNotes.localHook}</span>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Slide Navigation Bottom Bar (Slide Mode) */}
      {viewMode === "slides" && (
        <footer className="sticky bottom-0 z-30 border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-xl py-3 px-4 sm:px-6 print:hidden">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Slide Index & Keyboard Hints */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-slate-300">
                {currentSlideIndex + 1} / {totalSlides}
              </span>
              <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>Navigation:</span>
                <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                  ←
                </kbd>
                <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                  →
                </kbd>
                <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">
                  Space
                </kbd>
              </div>
            </div>

            {/* Quick jump slide buttons */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-xs sm:max-w-md hidden sm:flex">
              {deck.slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlideIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    currentSlideIndex === idx
                      ? "w-8 bg-emerald-400"
                      : "w-2 bg-slate-800 hover:bg-slate-700"
                  }`}
                  title={`Zu Folie ${idx + 1} springen`}
                />
              ))}
            </div>

            {/* Prev / Next Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={prevSlide}
                disabled={currentSlideIndex === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 disabled:opacity-40 disabled:hover:text-slate-300 transition-all text-xs font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Zurück</span>
              </button>

              <button
                onClick={nextSlide}
                disabled={currentSlideIndex === totalSlides - 1}
                className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold transition-all text-xs shadow-md shadow-emerald-500/20"
              >
                <span>Weiter</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Handout Modal */}
      {showHandoutModal && (
        <HandoutModal
          deck={deck}
          onClose={() => setShowHandoutModal(false)}
        />
      )}
    </div>
  );
}
