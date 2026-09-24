"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import HeaderLogo from "./HeaderLogo";
import {
  Menu,
  X,
  Radio,
  Building2,
  Users,
  BarChart3,
  Coins,
  Briefcase,
  Database,
  FileText,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SiteHeaderProps {
  /** Number of sensors / locations or active stations to display */
  sensorCount?: number;
  activeStations?: number;
  totalStations?: number;
}

interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}

const MAIN_NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Sensor-Karte",
    shortLabel: "Karte",
    icon: Radio,
  },
  {
    href: "/bauen-wohnen",
    label: "Bauen & Wohnen",
    shortLabel: "Bauen",
    icon: Building2,
  },
  {
    href: "/demografie",
    label: "Demografie & Bildung",
    shortLabel: "Demografie",
    icon: Users,
  },
  {
    href: "/statistik",
    label: "Regionalstatistik",
    shortLabel: "Statistik",
    icon: BarChart3,
  },
  {
    href: "/haushalt",
    label: "Finanzen & Haushalt",
    shortLabel: "Haushalt",
    icon: Coins,
  },
  {
    href: "/wirtschaft",
    label: "Wirtschaft & Gewerbe",
    shortLabel: "Wirtschaft",
    icon: Briefcase,
  },
  {
    href: "/daten",
    label: "Offene Daten & API",
    shortLabel: "Offene Daten",
    icon: Database,
    highlight: true,
  },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  {
    href: "/quellen",
    label: "Datenquellen & Pipeline",
    shortLabel: "Quellen",
    icon: FileText,
  },
  {
    href: "/admin",
    label: "Admin-Bereich",
    shortLabel: "Admin",
    icon: ShieldCheck,
  },
];

export default function SiteHeader({
  sensorCount,
  activeStations,
  totalStations,
}: SiteHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Handle Escape key and disable background scrolling when drawer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };

    if (mobileOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Determine status badge display count
  const displayCount = sensorCount ?? "–";
  const hasStationFraction =
    activeStations !== undefined && totalStations !== undefined;

  return (
    <>
      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="shrink-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <HeaderLogo />
          </Link>

          {/* Desktop Navigation (>= lg / 1024px) */}
          <nav
            className="hidden lg:flex items-center gap-1 xl:gap-1.5 text-xs xl:text-sm font-medium"
            aria-label="Hauptnavigation"
          >
            {MAIN_NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-2.5 xl:px-3 py-1.5 rounded-lg transition-all duration-150 whitespace-nowrap",
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                      : item.highlight
                      ? "text-emerald-400/95 hover:text-emerald-300 hover:bg-emerald-500/10 font-medium"
                      : "text-slate-300 hover:text-emerald-300 hover:bg-slate-800/60"
                  )}
                >
                  <span className="hidden xl:inline">{item.label}</span>
                  <span className="xl:hidden">{item.shortLabel}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right side: Status badge + mobile hamburger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Network status badge */}
            <div
              className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/90 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-sm text-slate-300 select-none shadow-sm"
              title={
                hasStationFraction
                  ? `${activeStations} von ${totalStations} Stationen aktiv`
                  : sensorCount === undefined ? "Sensoranzahl hier nicht geladen" : `${displayCount} gespeicherte Sensorstandorte im Ried`
              }
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-medium text-emerald-400 whitespace-nowrap">
                {hasStationFraction ? (
                  <>
                    <span className="hidden sm:inline">
                      {activeStations}/{totalStations} Stationen aktiv
                    </span>
                    <span className="sm:hidden">
                      {activeStations}/{totalStations}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">
                      {displayCount} Sensorstandorte
                    </span>
                    <span className="sm:hidden">{displayCount} Standorte</span>
                  </>
                )}
              </span>
            </div>

            {/* Hamburger Button (< lg) */}
            <button
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Menü schließen" : "Menü öffnen"}
              aria-expanded={mobileOpen}
              className="lg:hidden flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700 active:scale-95 transition-all"
            >
              {mobileOpen ? (
                <X className="w-5 h-5 text-emerald-400" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-Out Drawer */}
      <aside
        className={cn(
          "fixed top-0 right-0 h-full w-80 max-w-[85vw] z-50 bg-slate-900 border-l border-slate-800 flex flex-col shadow-2xl transition-transform duration-300 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full"
        )}
        aria-label="Navigationsmenü"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm text-slate-100 tracking-tight">
              Open Ried Sens
            </span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Menü schließen"
            className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Navigation Links */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          {/* Main sections */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 block">
              Themen &amp; Daten
            </span>
            <nav className="flex flex-col gap-1">
              {MAIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold"
                        : "text-slate-300 hover:bg-slate-800/70 hover:text-emerald-300"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-emerald-400" : "text-slate-400"
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Secondary sections */}
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 block">
              System &amp; Transparenz
            </span>
            <nav className="flex flex-col gap-1">
              {SECONDARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = pathname?.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-semibold"
                        : "text-slate-400 hover:bg-slate-800/70 hover:text-emerald-300"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-emerald-400" : "text-slate-500"
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 space-y-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-400">
              {displayCount} Sensorstandorte
            </span>
          </div>
          <div className="text-[11px] text-slate-500 leading-relaxed px-1">
            Initiative von{" "}
            <a
              href="https://kamue.me"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 font-medium hover:underline inline-flex items-center gap-0.5"
            >
              KAMÜ Kulturzentrum <ExternalLink className="w-2.5 h-2.5" />
            </a>{" "}
            &amp; Bürgerinnen/Bürgern Bürstadt &amp; Lampertheim.
          </div>
        </div>
      </aside>
    </>
  );
}
