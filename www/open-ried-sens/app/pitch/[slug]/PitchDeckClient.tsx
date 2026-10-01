"use client";

import { useEffect, useState, useCallback } from "react";
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
  Lightbulb,
} from "lucide-react";
import type { PitchDeck, PitchSlide } from "@/lib/pitchData";
import MapEvidenceViewer from "../MapEvidenceViewer";

interface PitchDeckClientProps {
  deck: PitchDeck;
}

export default function PitchDeckClient({ deck }: PitchDeckClientProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"slides" | "scroll">("slides");
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentSlide: PitchSlide = deck.slides[currentSlideIndex] || deck.slides[0];
  const totalSlides = deck.slides.length;

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : prev));
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't handle if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;

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

  function handlePrint() {
    if (typeof window !== "undefined") {
      setViewMode("scroll");
      setTimeout(() => window.print(), 200);
    }
  }

  // Accent color classes
  const accentBorderColor =
    deck.accentColor === "emerald"
      ? "border-emerald-500/30"
      : deck.accentColor === "sky"
      ? "border-sky-500/30"
      : deck.accentColor === "violet"
      ? "border-violet-500/30"
      : deck.accentColor === "teal"
      ? "border-teal-500/30"
      : "border-amber-500/30";

  const accentBadgeBg =
    deck.accentColor === "emerald"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : deck.accentColor === "sky"
      ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
      : deck.accentColor === "violet"
      ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
      : deck.accentColor === "teal"
      ? "bg-teal-500/20 text-teal-300 border-teal-500/30"
      : "bg-amber-500/20 text-amber-300 border-amber-500/30";

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
              <kbd className="hidden lg:inline text-[10px] bg-slate-800 text-slate-400 px-1 rounded">N</kbd>
            </button>

            {/* Share / Copy Link */}
            <button
              onClick={handleCopyLink}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all"
              title="Link zu dieser Präsentation kopieren"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>

            {/* Print / PDF Export */}
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all hidden sm:flex"
              title="Als PDF drucken oder exportieren"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all hidden sm:flex"
              title="Vollbild umschalten (Shortcut: F)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Progress Bar (Slide Mode) */}
        {viewMode === "slides" && (
          <div className="w-full h-1 bg-slate-900 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${((currentSlideIndex + 1) / totalSlides) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {viewMode === "slides" ? (
          /* SLIDE MODE: Viewport Focused Single Slide */
          <div className="flex-1 flex flex-col justify-center space-y-8 animate-in fade-in duration-300">
            {/* Slide Header */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-emerald-400">
                  {currentSlide.eyebrow}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                  Folie {currentSlideIndex + 1} / {totalSlides}
                </span>
              </div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-100 tracking-tight leading-tight">
                {currentSlide.title}
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-slate-300 font-light max-w-4xl leading-relaxed">
                {currentSlide.lead}
              </p>
            </div>

            {/* Slide Visual / Map Evidence */}
            {currentSlide.mapEvidence && (
              <div className="my-2">
                <MapEvidenceViewer items={currentSlide.mapEvidence} />
              </div>
            )}

            {/* Slide Stats (if present) */}
            {currentSlide.stats && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {currentSlide.stats.map((stat, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-lg space-y-1"
                  >
                    <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">
                      {stat.value}
                    </div>
                    <div className="text-sm font-bold text-slate-200">
                      {stat.label}
                    </div>
                    {stat.subtext && (
                      <div className="text-xs text-slate-400 font-light">
                        {stat.subtext}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Slide Bullets Cards Grid */}
            {currentSlide.bullets && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {currentSlide.bullets.map((bullet, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {bullet.tag || `Punkt ${idx + 1}`}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <h3 className="text-base font-bold text-slate-100">
                      {bullet.title}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed font-light">
                      {bullet.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Slide Call to Action Buttons */}
            {currentSlide.callToAction && (
              <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 shadow-xl">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-lg font-bold text-slate-100 flex items-center gap-2 justify-center sm:justify-start">
                    <Sparkles className="w-5 h-5 text-emerald-400" />
                    Gemeinsam das Hessische Ried vernetzen
                  </h4>
                  <p className="text-xs text-slate-300">
                    Konkrete Umsetzung im Kulturzentrum KAMÜ Bürstadt & Partnerorten
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <a
                    href={currentSlide.callToAction.primaryHref}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                  >
                    <span>{currentSlide.callToAction.primaryText}</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>

                  {currentSlide.callToAction.secondaryText && (
                    <Link
                      href={currentSlide.callToAction.secondaryHref || "/sensor-bauen"}
                      className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-sm font-semibold transition-all"
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
                      {slide.eyebrow}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Abschnitt {sIdx + 1} von {totalSlides}
                    </span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-slate-100">
                    {slide.title}
                  </h3>
                  <p className="text-base text-slate-300 font-light leading-relaxed">
                    {slide.lead}
                  </p>
                </div>

                {slide.mapEvidence && (
                  <div className="pt-2">
                    <MapEvidenceViewer items={slide.mapEvidence} />
                  </div>
                )}

                {slide.stats && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {slide.stats.map((stat, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800"
                      >
                        <div className="text-3xl font-black text-emerald-400 font-mono">
                          {stat.value}
                        </div>
                        <div className="text-sm font-bold text-slate-200">
                          {stat.label}
                        </div>
                        {stat.subtext && (
                          <div className="text-xs text-slate-400 font-light">
                            {stat.subtext}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {slide.bullets && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {slide.bullets.map((bullet, idx) => (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2"
                      >
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                          {bullet.tag || `Punkt ${idx + 1}`}
                        </span>
                        <h4 className="text-base font-bold text-slate-100">
                          {bullet.title}
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed font-light">
                          {bullet.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {slide.callToAction && (
                  <div className="p-6 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-slate-100">
                        Nächster Schritt
                      </h4>
                      <p className="text-xs text-slate-300">
                        Starten wir die Initiative gemeinsam vor Ort.
                      </p>
                    </div>
                    <a
                      href={slide.callToAction.primaryHref}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all shrink-0"
                    >
                      {slide.callToAction.primaryText}
                    </a>
                  </div>
                )}
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
              <p className="text-sky-200">{currentSlide.speakerNotes.audienceEngagement}</p>
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
                <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">←</kbd>
                <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">→</kbd>
                <kbd className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded text-[10px]">Space</kbd>
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
    </div>
  );
}
