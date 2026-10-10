import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(new URL("../lib/trafficPresentation.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { trafficFeatureVisible, corridorLabel } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("planned measures are opt-in; category and current corridor summaries stay independent", () => {
  const planned = { event_status: "planned", source_category: "closure" };
  assert.equal(trafficFeatureVisible(planned, "active", "all"), false);
  assert.equal(trafficFeatureVisible(planned, "planned", "closure"), true);
  assert.equal(trafficFeatureVisible(planned, "all", "roadworks"), false);
  assert.equal(trafficFeatureVisible({ kind: "corridor" }, "planned", "closure"), true);
  assert.equal(trafficFeatureVisible({ event_status: "active", source_category: "roadworks" }, "active", "roadworks"), true);
  assert.equal(trafficFeatureVisible({ closure_type: "partial" }, "planned", "all"), true);
});
test("unknown values do not become zero-minute delays or full closures", () => {
  assert.equal(corridorLabel("unknown", null), "⚪ Unbekannt");
  assert.equal(corridorLabel("sluggish", null), "🟡 Einschränkung");
  assert.equal(corridorLabel("closure", null), "⛔ Gesperrt");
  assert.equal(corridorLabel("congestion", 15), "🔴 +15 Min.");
  assert.match(corridorLabel("clear", null), /Keine Störung gemeldet/);
});
