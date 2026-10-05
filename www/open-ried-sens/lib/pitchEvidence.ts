/** A preview of an actual collected response, never a generated measurement. */
export interface EvidencePreview {
  fields: { name: string; value: string }[];
  entries: number | null;
}

export function previewCollectedData(data: unknown): EvidencePreview | null {
  if (data === null || typeof data !== "object") return null;
  if (!Array.isArray(data) && "error" in data) return null;
  if (Object.keys(data).length === 0) return null;
  if (!Array.isArray(data) && "stations" in data && Array.isArray(data.stations)) {
    const station = data.stations.find((entry: unknown) => entry && typeof entry === "object" &&
      "municipality" in entry && typeof entry.municipality === "string" &&
      /Bürstadt|Lampertheim|Biblis|Groß-Rohrheim/i.test(entry.municipality)) ?? data.stations[0];
    if (!station || typeof station !== "object") return null;
    const fields = [
      { name: "Betreiber", value: station.operator },
      { name: "Adresse", value: station.address },
      { name: "Ort", value: station.municipality },
    ].filter((field): field is { name: string; value: string } => typeof field.value === "string" && field.value.length > 0);
    if (fields.length) return { fields, entries: data.stations.length };
  }
  const first = Array.isArray(data) ? data[0] : data;
  if (first && typeof first === "object" && typeof first.name === "string" &&
      typeof first.current_level_m === "number" && Number.isFinite(first.current_level_m)) {
    const fields = [{ name: "Messstation", value: first.name },
      { name: "Wasserstand (m)", value: String(first.current_level_m) }];
    if (typeof first.updated_at === "string") fields.push({ name: "Messzeit", value: first.updated_at });
    return { fields, entries: Array.isArray(data) ? data.length : null };
  }
  const fields: EvidencePreview["fields"] = [];
  function visit(value: unknown, prefix: string, depth: number) {
    if (fields.length >= 3 || depth > 4) return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      if (typeof value === "number" && !Number.isFinite(value)) return;
      if (value === "") return;
      fields.push({ name: prefix, value: String(value).slice(0, 140) });
    } else if (Array.isArray(value)) {
      for (let index = 0; index < Math.min(value.length, 3); index++) visit(value[index], `${prefix}[${index}]`, depth + 1);
    } else if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (/url|token|secret|password/i.test(key)) continue;
        visit(entry, prefix ? `${prefix}.${key}` : key, depth + 1);
        if (fields.length >= 3) break;
      }
    }
  }
  visit(data, "", 0);
  return fields.length ? { fields, entries: Array.isArray(data) ? data.length : null } : null;
}

export function evidenceExpired(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const expires = Date.parse(expiresAt);
  return !Number.isFinite(expires) || expires <= now;
}
