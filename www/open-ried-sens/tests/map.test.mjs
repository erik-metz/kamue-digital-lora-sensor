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

test("parking popup combines counts, preserves zero and derives missing availability", () => {
  const counts = (free, occupied, capacity) => [reading("parking_free", free, "count"), reading("parking_occupied", occupied, "count"), reading("parking_capacity", capacity, "count")];
  assert.equal(model.parkingSummary(counts(3, 7, 10)).summary, "3 von 10 Stellplätzen frei");
  assert.equal(model.parkingSummary(counts(0, 10, 10)).summary, "0 von 10 Stellplätzen frei");
  assert.equal(model.parkingSummary(counts(1, 0, 1)).summary, "1 von 1 Stellplatz frei");
  assert.equal(model.parkingSummary(counts(3, 7, 10).slice(1)).summary, "3 von 10 Stellplätzen frei");
  assert.equal(model.parkingSummary(counts(3, 7, 10).slice(0, 2)).summary, "3 von 10 Stellplätzen frei");
});

test("parking popup does not invent a total from asynchronous or invalid counts", () => {
  const free = reading("parking_free", 3, "count");
  const occupied = reading("parking_occupied", 7, "count", "2026-09-13T11:30:00Z");
  assert.equal(model.parkingSummary([free, occupied]).summary, "3 Stellplätze frei");
  assert.ok(model.parkingSummary([free]).details.includes("Gesamtzahl nicht gemeldet"));
  const bad = model.parkingSummary([free, reading("parking_capacity", 2, "count")]);
  assert.equal(bad.summary, "3 Stellplätze frei");
  assert.ok(bad.details.includes("Die gemeldeten Anzahlen sind widersprüchlich."));
  assert.equal(model.parkingSummary([reading("parking_free", -1, "count")]), undefined);
  assert.equal(model.parkingSummary([reading("parking_free", 1.5, "count")]), undefined);
  assert.equal(model.parkingSummary([reading("temperature")]), undefined);
});

test("station inventory includes parking groups without placing them at invented coordinates", () => {
  const input = [sensor([reading("parking_free", 3, "count")], { latitude: null, longitude: null })];
  assert.equal(model.toStationNodes(input).length, 1);
  assert.equal(model.toMapNodes(input).length, 0);
  assert.equal(model.toStationNodes([sensor([], {is_hidden:true})]).length, 0);
});
test("traffic and all soil metrics have dedicated categories", () => {
  assert.deepEqual([...model.categoriesFor(sensor([reading("traffic_cars_hourly", 10, "count")]))], ["traffic"]);
  assert.deepEqual([...model.categoriesFor(sensor([reading("soil_tension_30cm", 10, "kPa")]))], ["soil"]);
});

const telemetryContext = { exports: {}, Date, Map, Number, JSON };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../lib/telemetryData.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, telemetryContext);
const telemetry = telemetryContext.exports;
test("all measurements remain visible from inventory when history or latest request fails", () => {
  const snapshot = [reading("parking_free", 0, "count"), reading("parking_capacity", 10, "count"), reading("soil_tension", 20, "kPa")];
  assert.equal(telemetry.mergeReadings(snapshot, []).length, 3);
  const merged = telemetry.mergeReadings(snapshot, [reading("parking_free", 4, "count", "2026-09-14T11:45:00Z")]);
  assert.equal(merged.length, 3);
  assert.equal(merged.find(r => r.metric === "parking_free").value, 4);
  assert.equal(telemetry.metricLabel(reading("traffic_cars_hourly", 2, "count")), "PKW · Stundensumme");
  assert.equal(telemetry.unitLabel("count"), "Anzahl");
});
