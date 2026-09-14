import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../lib/mapData.ts", import.meta.url), "utf8");
const context = { exports: {}, Date, Set, Number, JSON };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const model = context.exports;
const now = Date.parse("2026-09-14T12:00:00Z");
const reading = (metric, value = 18, unit = "°C", timestamp = "2026-09-14T11:30:00Z") => ({ metric, value, unit, timestamp });
const sensor = (readings, extras = {}) => ({ id: "station", friendly_name: "Station", latitude: 49.6, longitude: 8.4, readings, ...extras });

test("multi-metric station belongs to several themes but appears only once", () => {
  const nodes = model.toMapNodes([sensor([reading("temperature"), reading("air_quality_index", 1, "index")])]);
  assert.deepEqual([...nodes[0].categories], ["weather", "air"]);
  assert.equal(model.visibleNodes(nodes, ["weather", "air"], "category").length, 1);
  assert.equal(model.visibleNodes(nodes, ["parking"], "category").length, 0);
  assert.equal(model.visibleNodes(nodes, [], "category").length, 0);
});
test("soil temperatures are distinguished from air temperatures", () => {
  const nodes = model.toMapNodes([sensor([reading("temperature")], { friendly_name: "Bodentemperatur Domwiese" })]);
  assert.deepEqual([...nodes[0].categories], ["soil"]);
});
test("legacy metadata fallback has unknown freshness and usable source categories", () => {
  const nodes = model.toMapNodes([sensor([], { description: "Smart City; urn:ngsi-ld:ParkingSpotSum:123" })]);
  assert.deepEqual([...nodes[0].categories], ["parking"]);
  assert.equal(model.readingFreshness(undefined, now), "unknown");
});
test("measurement age is independent of fetch time; parking is a state, never online", () => {
  assert.equal(model.readingFreshness(reading("temperature"), now), "fresh");
  assert.equal(model.readingFreshness(reading("temperature", 18, "°C", "2026-01-01T00:00:00Z"), now), "stale");
  assert.equal(model.readingFreshness(reading("parking_free", 0, "count", "2026-01-01T00:00:00Z"), now), "state");
  assert.equal(model.readingFreshness(reading("temperature", 18, "°C", "2027-01-01T00:00:00Z"), now), "unknown");
});
test("temperature mode excludes incompatible units and respects categories", () => {
  const nodes = model.toMapNodes([sensor([reading("temperature")]), sensor([reading("temperature", 70, "F")], { id: "fahrenheit" })]);
  assert.equal(model.visibleNodes(nodes, ["weather"], "temperature").length, 1);
  assert.equal(model.visibleNodes(nodes, ["soil"], "temperature").length, 0);
});
test("hidden and invalid-coordinate sensors are not exposed on the map", () => {
  assert.equal(model.toMapNodes([sensor([], { is_hidden: true }), sensor([], { latitude: null }), sensor([], { longitude: 200 })]).length, 0);
});
test("stored filters are validated and support an intentionally empty selection", () => {
  assert.deepEqual([...model.parseStoredCategories('["weather","weather"]')], ["weather"]);
  assert.equal(model.parseStoredCategories('["nonexistent"]') .length, model.CATEGORY_IDS.length);
  assert.equal(model.parseStoredCategories("[]").length, 0);
  assert.equal(model.parseStoredCategories("bad json").length, model.CATEGORY_IDS.length);
});
test("temperature bins agree with the displayed legend, parking zero stays visible", () => {
  const bins = [-1, 0, 10, 20, 30].map(model.temperatureColor);
  assert.equal(new Set(bins).size, 5);
  assert.equal(model.valueLabel(reading("parking_free", 0, "count")), "0 frei");
});
