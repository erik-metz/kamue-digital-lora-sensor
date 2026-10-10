/** Traffic filters apply to reported events; corridor summaries always show current conditions. */
export type TrafficPeriod = "active" | "planned" | "all";
export type TrafficCategory = "all" | "warning" | "roadworks" | "closure";

export function trafficFeatureVisible(values: Record<string, unknown>, period: TrafficPeriod, category: TrafficCategory): boolean {
  if (values.kind === "corridor") return true;
  // Municipal closures have their own status model and remain independently visible.
  if (!values.event_status) return true;
  return (period === "all" || values.event_status === period)
    && (category === "all" || values.source_category === category);
}

export function corridorLabel(status: string, delay: number | null | undefined): string {
  if (status === "closure") return "⛔ Gesperrt";
  if (status === "unknown") return "⚪ Unbekannt";
  if (status === "clear") return "🟢 Keine Störung gemeldet";
  if (delay == null) return status === "congestion" ? "🔴 Stau gemeldet" : "🟡 Einschränkung";
  return `${status === "congestion" ? "🔴" : "🟡"} +${delay} Min.`;
}
