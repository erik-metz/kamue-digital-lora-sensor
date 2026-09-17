"use client";

import { useState } from "react";
import Link from "next/link";
import HeaderLogo from "./HeaderLogo";
import { Menu, X, Radio, ShieldCheck, Database } from "lucide-react";
import { cn } from "cn";

interface SiteHeaderProps {
  /** Number of active stations to display in the status badge. */
  activeStations?: number;
  totalStations?: number;
}

const NAV_LINKS = [
  { href: "/bauen-wohnen", label: "Bauen & Wohnen", highlight: false },
  { href: "/demografie", label: "Demografie & Bildung", highlight: false },
  { href: "/statistik", label: "Regionalstatistik & Leben", highlight: false },
  { href: "/daten", label: "Offene Daten & API", highlight: true },
];

export default function SiteHeader({
  activeStations = 5,
  totalStations = 5,
}: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="shrink-0">
            <HeaderLogo />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "hover:text-emerald-300 transition-colors",
                  link.highlight
                    ? "text-emerald-400 font-semibold"
                    : "text-slate-300"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side: status badge + hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Network status badge */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-full text-xs sm:text-sm text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-medium text-emerald-400 whitespace-nowrap">
                <span className="hidden xs:inline">{activeStations}/{totalStations} Stationen </span>
                <span className="xs:hidden">{activeStations}/{totalStations} </span>
                <span className="hidden sm:inline">Aktiv</span>
              </span>
            </div>

            {/* Hamburger (mobile only) */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menü öffnen"
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700 transition-colors"
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-72 max-w-[85vw] z-50 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl transition-transform duration-300 md:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Navigationsmenü"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <span className="text-slate-200 font-bold text-sm">Navigation</span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Nav Links */}
        <nav className="flex flex-col gap-1 p-4">
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:text-emerald-400 hover:bg-slate-800/60 transition-colors text-sm font-medium"
          >
            <Radio className="w-4 h-4 text-slate-500" />
            Dashboard
          </Link>
          <Link
            href="/daten"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-sm font-semibold border border-emerald-500/20"
          >
            <Database className="w-4 h-4" />
            Offene Daten &amp; API
          </Link>
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800/60 transition-colors text-sm font-medium"
          >
            <ShieldCheck className="w-4 h-4 text-slate-500" />
            Admin-Bereich
          </Link>
        </nav>

        {/* Drawer Footer */}
        <div className="mt-auto p-4 border-t border-slate-800">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">
              {activeStations}/{totalStations} Stationen aktiv
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-3 px-1">
            Open Ried Sens · KAMÜ Bürstadt
          </p>
        </div>
      </aside>
    </>
  );
}
