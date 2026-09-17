"use client";

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Palette,
  SlidersHorizontal,
  Thermometer,
  RotateCcw,
  Check,
} from "lucide-react";
import type { MapMode } from "@/lib/mapData";
import { MAP_LAYER_IDS, type MapLayerId, DEFAULT_MAP_LAYERS } from "@/lib/urlState";
import {
  LAYER_CATEGORIES,
  LAYER_DEFINITIONS,
  LAYER_PRESETS,
  PRESET_IDS,
  type LayerCategory,
  type LayerPresetId,
  countActiveLayers,
  countCategoryActiveLayers,
  detectActivePreset,
  getLayersByCategory,
} from "@/lib/mapPresets";

interface MapDarstellungBarProps {
  mode: MapMode;
  onModeChange: (mode: MapMode) => void;
  layers: Record<MapLayerId, boolean>;
  onLayerToggle: (id: MapLayerId, enabled: boolean) => void;
  onSetLayers: (layers: Record<MapLayerId, boolean>) => void;
  readingsAvailable?: boolean;
  activeClosuresCount?: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  filteredCount: number;
  totalCount: number;
  zoom?: number;
}

export default function MapDarstellungBar({
  mode,
  onModeChange,
  layers,
  onLayerToggle,
  onSetLayers,
  readingsAvailable = true,
  activeClosuresCount = 7,
  isOpen,
  onToggleOpen,
  filteredCount,
  totalCount,
  zoom = 12,
}: MapDarstellungBarProps) {
  const activePreset = detectActivePreset(layers);
  const totalActive = countActiveLayers(layers);

  const applyPreset = (presetId: LayerPresetId) => {
    onSetLayers(LAYER_PRESETS[presetId].layers);
  };

  const toggleCategoryAll = (category: LayerCategory) => {
    const items = getLayersByCategory(category);
    const { active, total } = countCategoryActiveLayers(category, layers);
    const setAllTo = active < total;
    const next = { ...layers };
    for (const item of items) {
      next[item.id] = setAllTo;
    }
    onSetLayers(next);
  };

  const enableAllLayers = () => {
    const next = Object.fromEntries(MAP_LAYER_IDS.map((id) => [id, true])) as Record<MapLayerId, boolean>;
    onSetLayers(next);
  };

  const disableAllLayers = () => {
    const next = Object.fromEntries(MAP_LAYER_IDS.map((id) => [id, false])) as Record<MapLayerId, boolean>;
    onSetLayers(next);
  };

  const resetToDefaultLayers = () => {
    onSetLayers(DEFAULT_MAP_LAYERS);
  };

  const categories: LayerCategory[] = ["mobility", "environment", "infrastructure", "planning"];

  return (
    <div
      id="darstellung-control-panel"
      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 sm:p-4 shadow-lg transition-all duration-200"
      aria-label="Darstellung und Ebenen-Steuerung"
    >
      {/* Top Primary Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: View Mode Segmented Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider mr-1">
            <Palette className="size-3.5 text-emerald-400" />
            <span>Darstellung:</span>
          </div>

          <div
            className="inline-flex rounded-xl bg-slate-950/70 p-1 border border-slate-800 shadow-inner"
            role="group"
            aria-label="Darstellungsmodus"
          >
            <button
              type="button"
              aria-pressed={mode === "category"}
              onClick={() => onModeChange("category")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all ${
                mode === "category"
                  ? "bg-slate-800 text-emerald-300 shadow-sm border border-emerald-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Stationen nach Themengebieten farbig und mit Symbolen darstellen"
            >
              <Palette className="size-3.5" />
              <span>Themenfarben</span>
            </button>
            <button
              type="button"
              aria-pressed={mode === "temperature"}
              disabled={!readingsAvailable}
              onClick={() => onModeChange("temperature")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all ${
                mode === "temperature"
                  ? "bg-slate-800 text-amber-300 shadow-sm border border-amber-500/40"
                  : "text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              }`}
              title={
                readingsAvailable
                  ? "Flächige Temperatur-Interpolation und Hitzekarte im Ried"
                  : "Temperaturdaten derzeit nicht verfügbar"
              }
            >
              <Thermometer className="size-3.5 text-amber-400" />
              <span>Temperatur · °C</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="hidden sm:flex items-center gap-1 border-l border-slate-800 pl-3">
            <span className="text-[11px] text-slate-400 mr-1 hidden xl:inline">Schnellfilter:</span>
            {PRESET_IDS.map((pId) => {
              const preset = LAYER_PRESETS[pId];
              const isActive = activePreset === pId;
              return (
                <button
                  key={pId}
                  type="button"
                  onClick={() => applyPreset(pId)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    isActive
                      ? "bg-slate-800 text-white font-medium border border-slate-600 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                  }`}
                  title={`${preset.label}: ${preset.description}`}
                >
                  <span>{preset.icon}</span>
                  <span>{preset.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Layer Drawer Trigger & Summary */}
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-800/80">
          <div className="text-xs text-slate-400">
            <span className="text-slate-200 font-medium">{filteredCount}</span> von {totalCount} Stationen
          </div>

          <button
            type="button"
            onClick={onToggleOpen}
            aria-expanded={isOpen}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
              isOpen
                ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-300 shadow-sm"
                : "bg-slate-950/70 border-slate-700 text-slate-200 hover:border-slate-500 hover:text-white"
            }`}
            title="Ebenen und Geodaten-Overlays ein- oder ausblenden"
          >
            <Layers className="size-3.5 text-emerald-400" />
            <span>Ebenen ({totalActive} aktiv)</span>
            {isOpen ? (
              <ChevronUp className="size-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="size-3.5 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile presets fallback */}
      <div className="flex sm:hidden items-center gap-1 overflow-x-auto pt-2.5 mt-2 border-t border-slate-800/70 pb-1">
        <span className="text-[11px] text-slate-400 mr-1 shrink-0">Filter:</span>
        {PRESET_IDS.map((pId) => {
          const preset = LAYER_PRESETS[pId];
          const isActive = activePreset === pId;
          return (
            <button
              key={pId}
              type="button"
              onClick={() => applyPreset(pId)}
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] ${
                isActive
                  ? "bg-slate-800 text-white font-medium border border-slate-600"
                  : "text-slate-400 hover:text-slate-200 bg-slate-950/50 border border-slate-800"
              }`}
            >
              <span>{preset.icon}</span>
              <span>{preset.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Expandable Layer Management Drawer */}
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 animate-in fade-in-50 duration-200">
          {/* Quick global layer action toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/50 rounded-xl p-2.5 border border-slate-800/80">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-slate-400" />
              <span className="text-xs font-semibold text-slate-300">Kartenebenen verwalten</span>
              <span className="text-[11px] text-slate-400">
                ({totalActive} von 19 aktiv)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={enableAllLayers}
                className="text-xs text-slate-400 hover:text-emerald-300 transition-colors"
                title="Alle 19 Ebenen auf der Karte anzeigen"
              >
                Alle an
              </button>
              <span className="text-slate-700">·</span>
              <button
                type="button"
                onClick={disableAllLayers}
                className="text-xs text-slate-400 hover:text-rose-300 transition-colors"
                title="Alle Overlays deaktivieren (nur Sensoren)"
              >
                Alle aus
              </button>
              <span className="text-slate-700">·</span>
              <button
                type="button"
                onClick={resetToDefaultLayers}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                title="Standard-Ebenen wiederherstellen"
              >
                <RotateCcw className="size-3" />
                <span>Standard</span>
              </button>
            </div>
          </div>

          {/* 4 Thematic Columns / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {categories.map((catKey) => {
              const catInfo = LAYER_CATEGORIES[catKey];
              const catLayers = getLayersByCategory(catKey);
              const { active, total } = countCategoryActiveLayers(catKey, layers);
              const allCategoryActive = active === total;

              return (
                <div
                  key={catKey}
                  className="flex flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2.5 hover:border-slate-700/80 transition-colors"
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{catInfo.icon}</span>
                      <h4 className="text-xs font-semibold text-slate-200">
                        {catInfo.label}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                        {active}/{total}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleCategoryAll(catKey)}
                      className="text-[11px] font-medium text-slate-400 hover:text-emerald-300 transition-colors"
                      title={`${catInfo.label}: Alle ${allCategoryActive ? "aus" : "an"}`}
                    >
                      {allCategoryActive ? "Aus" : "An"}
                    </button>
                  </div>

                  {/* Layer Toggle Chips */}
                  <div className="flex flex-col gap-1.5">
                    {catLayers.map((layerMeta) => {
                      const isEnabled = Boolean(layers[layerMeta.id]);
                      const isZoomRestricted = layerMeta.minZoom && zoom < layerMeta.minZoom;

                      let extraBadge = "";
                      if (layerMeta.id === "closures" && activeClosuresCount > 0) {
                        extraBadge = ` (${activeClosuresCount})`;
                      } else if (layerMeta.minZoom) {
                        extraBadge = zoom >= layerMeta.minZoom ? "" : ` ≥Z${layerMeta.minZoom}`;
                      }

                      return (
                        <button
                          key={layerMeta.id}
                          type="button"
                          onClick={() => onLayerToggle(layerMeta.id, !isEnabled)}
                          className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-all text-left ${
                            isEnabled
                              ? `bg-slate-900 border ${layerMeta.highlightColor || "border-emerald-500/50 text-emerald-300"} font-medium shadow-sm`
                              : "bg-slate-950/40 border border-slate-800/70 text-slate-400 hover:bg-slate-900 hover:text-slate-300"
                          }`}
                          title={`${layerMeta.label}: ${layerMeta.description}${
                            isZoomRestricted ? ` (Zoomstufe ${zoom} < ${layerMeta.minZoom})` : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0">{layerMeta.icon}</span>
                            <span className="truncate">
                              {layerMeta.label}
                              {extraBadge && (
                                <span className="text-[10px] opacity-80 font-normal ml-0.5">
                                  {extraBadge}
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="shrink-0 ml-2">
                            {isEnabled ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                                An
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-slate-900 text-slate-500 border border-slate-800">
                                Aus
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
