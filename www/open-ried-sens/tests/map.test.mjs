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

test("parking spots at the same station are combined into one station node with aggregate counts and x/y frei label", () => {
  const spots = [
    sensor([reading("parking_free", 1, "count"), reading("parking_occupied", 0, "count"), reading("parking_capacity", 1, "count")], { id: "p1", friendly_name: "Bahnhofsallee", latitude: 49.642, longitude: 8.451 }),
    sensor([reading("parking_free", 1, "count"), reading("parking_occupied", 0, "count"), reading("parking_capacity", 1, "count")], { id: "p2", friendly_name: "Bahnhofsallee", latitude: 49.642, longitude: 8.451 }),
    sensor([reading("parking_free", 1, "count"), reading("parking_occupied", 0, "count"), reading("parking_capacity", 1, "count")], { id: "p3", friendly_name: "Bahnhofsallee", latitude: 49.642, longitude: 8.451 }),
    sensor([reading("parking_free", 0, "count"), reading("parking_occupied", 1, "count"), reading("parking_capacity", 1, "count")], { id: "p4", friendly_name: "Bahnhofsallee", latitude: 49.642, longitude: 8.451 }),
    sensor([reading("parking_free", 1, "count"), reading("parking_occupied", 0, "count"), reading("parking_capacity", 1, "count")], { id: "p5", friendly_name: "Bahnhofsallee", latitude: 49.642, longitude: 8.451 }),
  ];
  const stations = model.toStationNodes(spots);
  assert.equal(stations.length, 1);
  assert.equal(stations[0].name, "Bahnhofsallee");
  assert.equal(stations[0].isAggregate, true);
  const free = stations[0].readings.find(r => r.metric === "parking_free");
  const occupied = stations[0].readings.find(r => r.metric === "parking_occupied");
  const capacity = stations[0].readings.find(r => r.metric === "parking_capacity");
  assert.equal(free?.value, 4);
  assert.equal(occupied?.value, 1);
  assert.equal(capacity?.value, 5);
  assert.equal(model.valueLabel(free, stations[0].readings), "4/5 frei");
  assert.equal(model.parkingSummary(stations[0].readings).summary, "4 von 5 Stellplätzen frei");
});

test("parking valueLabel formats x/y frei when capacity is available and preserves fallback", () => {
  const withCap = [reading("parking_free", 4, "count"), reading("parking_capacity", 5, "count"), reading("parking_occupied", 1, "count")];
  assert.equal(model.valueLabel(withCap[0], withCap), "4/5 frei");
  const zeroCap = [reading("parking_free", 0, "count"), reading("parking_capacity", 5, "count"), reading("parking_occupied", 5, "count")];
  assert.equal(model.valueLabel(zeroCap[0], zeroCap), "0/5 frei");
  const noCap = [reading("parking_free", 3, "count")];
  assert.equal(model.valueLabel(noCap[0], noCap), "3 frei");
  // Backward compatibility when second argument is omitted
  assert.equal(model.valueLabel(withCap[0]), "4 frei");
});

test("normalizeParkingName strips spot numbers, letters and prefixes", () => {
  assert.equal(model.normalizeParkingName("Kaiserstraße Nr. 2"), "Kaiserstraße");
  assert.equal(model.normalizeParkingName("Kaiserstraße Nr. 15"), "Kaiserstraße");
  assert.equal(model.normalizeParkingName("Wilhelmstraße 42 L"), "Wilhelmstraße");
  assert.equal(model.normalizeParkingName("Wilhelmstraße 46 R"), "Wilhelmstraße");
  assert.equal(model.normalizeParkingName("Hallenbadparkplatz Links"), "Hallenbadparkplatz");
  assert.equal(model.normalizeParkingName("lub2-parking-81"), "lub2-parking");
  assert.equal(model.normalizeParkingName("Bodentemperatur Kaiserstraße Nr. 2"), "Kaiserstraße");
});

test("parking spots with individual spot numbers are grouped by street and merge companion puck temperatures", () => {
  const sensors = [
    sensor([reading("parking_free", 1, "count"), reading("parking_occupied", 0, "count"), reading("parking_capacity", 1, "count")], {
      id: "p1", friendly_name: "Kaiserstraße Nr. 1", latitude: 49.5941, longitude: 8.4677,
      description: "Smart City; urn:ngsi-ld:ParkingSpotSum:IoT-Plan-Nwave-lub-parking-62"
    }),
    sensor([reading("parking_free", 0, "count"), reading("parking_occupied", 1, "count"), reading("parking_capacity", 1, "count")], {
      id: "p2", friendly_name: "Kaiserstraße Nr. 2", latitude: 49.5942, longitude: 8.4679,
      description: "Smart City; urn:ngsi-ld:ParkingSpotSum:IoT-Plan-Nwave-lub-parking-67"
    }),
    sensor([reading("parking_free", 1, "count"), reading("parking_occupied", 0, "count"), reading("parking_capacity", 1, "count")], {
      id: "p3", friendly_name: "Kaiserstraße Nr. 3", latitude: 49.5943, longitude: 8.4678,
      description: "Smart City; urn:ngsi-ld:ParkingSpotSum:IoT-Plan-Nwave-lub-parking-71"
    }),
    // Companion puck temperature sensors
    sensor([reading("temperature", 14.5, "°C")], {
      id: "t1", friendly_name: "Bodentemperatur Kaiserstraße Nr. 2", latitude: 49.5942, longitude: 8.4679,
      description: "Smart City; urn:ngsi-ld:WeatherObserved:IoT-Plan-Nwave-lub-parking-67"
    }),
    sensor([reading("temperature", 15.5, "°C")], {
      id: "t2", friendly_name: "Bodentemperatur Kaiserstraße Nr. 3", latitude: 49.5943, longitude: 8.4678,
      description: "Smart City; urn:ngsi-ld:WeatherObserved:IoT-Plan-Nwave-lub-parking-71"
    }),
  ];

  const stations = model.toStationNodes(sensors);
  // All 3 parking spots + 2 temperature pucks should collapse into 1 clean station
  assert.equal(stations.length, 1);
  const station = stations[0];
  assert.equal(station.name, "Kaiserstraße");
  assert.deepEqual([...station.categories], ["parking", "soil"]);
  assert.equal(station.isAggregate, true);

  // Centroid latitude: (49.5941 + 49.5942 + 49.5943) / 3 = 49.5942
  assert.ok(Math.abs(station.lat - 49.5942) < 0.0001);
  assert.ok(Math.abs(station.lng - 8.4678) < 0.0001);

  const free = station.readings.find(r => r.metric === "parking_free");
  const occupied = station.readings.find(r => r.metric === "parking_occupied");
  const capacity = station.readings.find(r => r.metric === "parking_capacity");
  const soilTemp = station.readings.find(r => r.metric === "soil_temperature");

  assert.equal(free?.value, 2);
  assert.equal(occupied?.value, 1);
  assert.equal(capacity?.value, 3);
  assert.equal(model.valueLabel(free, station.readings), "2/3 frei");
  // Soil temperature is averaged: (14.5 + 15.5) / 2 = 15.0 °C
  assert.equal(soilTemp?.value, 15);
  assert.equal(soilTemp?.unit, "°C");
});

test("traffic and all soil metrics have dedicated categories", () => {
  assert.deepEqual([...model.categoriesFor(sensor([reading("traffic_cars_hourly", 10, "count")]))], ["traffic"]);
  assert.deepEqual([...model.categoriesFor(sensor([reading("soil_tension_30cm", 10, "kPa")]))], ["soil"]);
});

test("co-located traffic intersection sensors are offset along their respective directional road arms", () => {
  const sensors = [
    sensor([reading("traffic_cars_hourly", 180, "count")], { id: "t1", friendly_name: "Kaiserstr. Nord", latitude: 49.594875, longitude: 8.46886, entity_type: "TrafficFlowObservedSumHourly" }),
    sensor([reading("traffic_cars_hourly", 23, "count")], { id: "t2", friendly_name: "Wilhelmstr. Ost", latitude: 49.594875, longitude: 8.46886, entity_type: "TrafficFlowObservedSumHourly" }),
    sensor([reading("traffic_cars_hourly", 44, "count")], { id: "t3", friendly_name: "Wilhelmstr. West", latitude: 49.594875, longitude: 8.46886, entity_type: "TrafficFlowObservedSumHourly" }),
    sensor([reading("traffic_cars_hourly", 399, "count")], { id: "t4", friendly_name: "Kaiserstr. Süd", latitude: 49.594875, longitude: 8.46886, entity_type: "TrafficFlowObservedSumHourly" }),
  ];

  const nodes = model.toStationNodes(sensors);
  assert.equal(nodes.length, 4);

  const nord = nodes.find(n => n.name === "Kaiserstr. Nord");
  const sued = nodes.find(n => n.name === "Kaiserstr. Süd");
  const ost = nodes.find(n => n.name === "Wilhelmstr. Ost");
  const west = nodes.find(n => n.name === "Wilhelmstr. West");

  // All 4 sensors must now have distinct coordinates on their road arms
  assert.ok(nord.lat > 49.594875, "Nord arm should be offset North");
  assert.ok(sued.lat < 49.594875, "Süd arm should be offset South");
  assert.ok(ost.lng > 8.46886, "Ost arm should be offset East");
  assert.ok(west.lng < 8.46886, "West arm should be offset West");

  // Value labels are formatted compactly as / h
  assert.equal(model.valueLabel(nord.readings[0]), "180 / h");
  assert.equal(model.valueLabel(sued.readings[0]), "399 / h");
  assert.equal(model.valueLabel(reading("traffic_cars_daily_city", 5000, "count")), "5.000 / Tag");
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
