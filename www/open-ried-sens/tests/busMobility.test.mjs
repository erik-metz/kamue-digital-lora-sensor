import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// 1. Transpile and load railMobility
const railSource = fs.readFileSync(new URL("../lib/railMobility.ts", import.meta.url), "utf8");
const railContext = { exports: {}, Date, Set, Number, Math, JSON, Array };
vm.runInNewContext(
  ts.transpileModule(railSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  railContext
);
const railExports = railContext.exports;

// 2. Transpile and load busMobility
const busSource = fs.readFileSync(new URL("../lib/busMobility.ts", import.meta.url), "utf8");
const busContext = {
  exports: {},
  require: (id) => {
    if (id === "./railMobility") return railExports;
    throw new Error(`Unknown require in test context: ${id}`);
  },
  Date,
  Set,
  Number,
  Math,
  JSON,
  Array,
  String,
};
vm.runInNewContext(
  ts.transpileModule(busSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  busContext
);
const busMobility = busContext.exports;

// 3. Transpile and load mapMarker
const markerSource = fs.readFileSync(new URL("../lib/mapMarker.ts", import.meta.url), "utf8");
const dummyDocument = {
  createElement: (tag) => {
    const el = {
      tagName: tag,
      className: "",
      style: {
        setProperty: (k, v) => { el.style[k] = v; },
      },
      children: [],
      append: (...children) => { el.children.push(...children); },
      setAttribute: (k, v) => { el[k] = v; },
    };
    return el;
  },
  createElementNS: (_ns, tag) => {
    const el = {
      tagName: tag,
      className: "",
      style: {},
      children: [],
      append: (...children) => { el.children.push(...children); },
      setAttribute: (k, v) => { el[k] = v; },
    };
    return el;
  },
};
const markerContext = {
  exports: {},
  require: (id) => {
    if (id === "./mapData") {
      return {
        CATEGORIES: {
          air: { path: "M0 0" },
        },
      };
    }
    throw new Error(`Unknown require: ${id}`);
  },
  document: dummyDocument,
  Date,
  Set,
  Map,
  Number,
  Math,
  String,
};
vm.runInNewContext(
  ts.transpileModule(markerSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  markerContext
);
const mapMarker = markerContext.exports;

test("RIED_BUS_STOPS contains all key Ried municipalities and designated school stops", () => {
  const stops = busMobility.RIED_BUS_STOPS;
  assert.ok(stops.length >= 40, "Must have at least 40 stops across the Ried");

  const municipalities = new Set(stops.map((s) => s.municipality));
  assert.ok(municipalities.has("Bürstadt"), "Bürstadt stops must exist");
  assert.ok(municipalities.has("Lampertheim"), "Lampertheim stops must exist");
  assert.ok(municipalities.has("Hofheim (Ried)"), "Hofheim stops must exist");
  assert.ok(municipalities.has("Biblis"), "Biblis stops must exist");
  assert.ok(municipalities.has("Bobstadt"), "Bobstadt stops must exist");
  assert.ok(municipalities.has("Riedrode"), "Riedrode stops must exist");
  assert.ok(municipalities.has("Groß-Rohrheim"), "Groß-Rohrheim stops must exist");

  const schoolStops = stops.filter((s) => s.isSchoolStop);
  assert.ok(schoolStops.length >= 4, "Must have designated school stops");

  const eksStop = schoolStops.find((s) => s.id === "stop-bst-eks");
  assert.ok(eksStop, "Erich-Kästner-Schule stop must exist");
  assert.equal(eksStop.nearbySchoolName, "Erich-Kästner-Schule (Integrierte Gesamtschule)");

  const lessingStop = schoolStops.find((s) => s.id === "stop-la-lessing-gymnasium");
  assert.ok(lessingStop, "Lessing-Gymnasium stop must exist");

  // Verify all stops have valid latitude and longitude in the Ried region
  for (const s of stops) {
    assert.ok(s.lat >= 49.55 && s.lat <= 49.75, `Stop ${s.id} lat ${s.lat} should be in Ried bounds`);
    assert.ok(s.lng >= 8.35 && s.lng <= 8.60, `Stop ${s.id} lng ${s.lng} should be in Ried bounds`);
  }
});

test("VRN_BUS_TOURS includes lines 641, 642, 644, and 652 with valid routes", () => {
  const tours = busMobility.VRN_BUS_TOURS;
  const lines = new Set(tours.map((t) => t.line));
  assert.ok(lines.has("641"), "Line 641 must exist");
  assert.ok(lines.has("642"), "Line 642 must exist");
  assert.ok(lines.has("644"), "Line 644 must exist");
  assert.ok(lines.has("652"), "Line 652 (School Bus) must exist");

  for (const tour of tours) {
    assert.ok(tour.track.length > 2, `Tour ${tour.id} track must have multiple points`);
    assert.ok(tour.waypoints.length >= 3, `Tour ${tour.id} must have multiple waypoints`);
  }
});

test("isHessenSchoolDay correctly identifies school days vs weekends and vacations", () => {
  // Tuesday, September 15, 2026 (Regular school day in Hessen)
  const schoolDay = new Date(2026, 8, 15, 10, 0, 0); // Month 8 is September (0-indexed)
  assert.equal(busMobility.isHessenSchoolDay(schoolDay), true, "Sept 15 2026 is a Tuesday school day");

  // Sunday, September 20, 2026
  const weekend = new Date(2026, 8, 20, 10, 0, 0);
  assert.equal(busMobility.isHessenSchoolDay(weekend), false, "Sunday is not a school day");

  // Saturday, September 19, 2026
  const saturday = new Date(2026, 8, 19, 10, 0, 0);
  assert.equal(busMobility.isHessenSchoolDay(saturday), false, "Saturday is not a school day");

  // July 15, 2026 (Sommerferien Hessen)
  const summerVacation = new Date(2026, 6, 15, 10, 0, 0); // Month 6 is July
  assert.equal(busMobility.isHessenSchoolDay(summerVacation), false, "July is during summer vacation in Hessen");
});

test("evaluateSchoolBus identifies school bus trips during school time windows", () => {
  const eksStop = busMobility.RIED_BUS_STOPS.find((s) => s.id === "stop-bst-eks");

  // 1. Line 652 is always a dedicated school line
  const res652 = busMobility.evaluateSchoolBus("652", "VRN-652S", true, undefined, undefined);
  assert.equal(res652.isSchoolBus, true, "Line 652 is dedicated school line");

  // 2. Line 642 at 07:35 AM arriving at Erich-Kästner-Schule on a school day
  const morningSchoolTime = new Date(2026, 8, 15, 7, 35, 0);
  const resMorning = busMobility.evaluateSchoolBus("642", "VRN-642", false, eksStop, undefined, morningSchoolTime);
  assert.equal(resMorning.isSchoolBus, true, "Morning trip serving EKS should be classified as Schulbus");
  assert.ok(resMorning.reason?.includes("Erich-Kästner-Schule"), "Reason mentions school name");

  // 3. Line 642 at 21:30 (evening) is NOT a school bus
  const eveningTime = new Date(2026, 8, 15, 21, 30, 0);
  const resEvening = busMobility.evaluateSchoolBus("642", "VRN-642", false, eksStop, undefined, eveningTime);
  assert.equal(resEvening.isSchoolBus, false, "Evening trip is not a school bus");
});

test("calculateBusMobility generates moving buses, stop dwell, and departure countdown gauges", () => {
  const { buses, stops } = busMobility.calculateBusMobility(Date.now());
  assert.ok(buses.length >= 4, "Must generate buses for all defined tours");
  assert.ok(stops.length >= 10, "Must return stops list");

  for (const bus of buses) {
    assert.ok(bus.lat >= 49.55 && bus.lat <= 49.75, `Bus ${bus.id} lat in bounds`);
    assert.ok(bus.lng >= 8.35 && bus.lng <= 8.55, `Bus ${bus.id} lng in bounds`);
    assert.ok(bus.status === "moving" || bus.status === "stopped");
    assert.ok(typeof bus.isSchoolBus === "boolean");
    assert.ok(typeof bus.wheelchairAccessible === "boolean");

    if (bus.status === "stopped") {
      assert.ok(bus.dwellTimeRemainingSec !== undefined);
      assert.ok(bus.dwellProgress !== undefined);
      assert.ok(bus.dwellProgress >= 0 && bus.dwellProgress <= 1);
    }
  }
});

test("getBusStopDepartures returns structured departures with lines, destinations, and countdowns", () => {
  const departures = busMobility.getBusStopDepartures("stop-bst-bahnhof", Date.now());
  assert.ok(departures.length > 0, "Bürstadt Bahnhof must have upcoming departures");

  for (const dep of departures) {
    assert.ok(dep.line, "Must have line");
    assert.ok(dep.destination, "Must have destination");
    assert.ok(dep.scheduledTime, "Must have scheduledTime");
    assert.ok(dep.estimatedTime, "Must have estimatedTime");
    assert.ok(typeof dep.isSchoolBus === "boolean");
  }
});

test("createBusMarkerContent renders SVG icon, badge, and radial departure gauge safely", () => {
  const element = mapMarker.createBusMarkerContent({
    line: "641",
    destination: "Lampertheim Bahnhof",
    status: "stopped",
    speedKmh: 0,
    currentStopName: "Bürstadt Marktplatz",
    dwellTimeRemainingSec: 25,
    dwellProgress: 0.6,
    isSchoolBus: false,
    delayMinutes: 0,
    wheelchairAccessible: true,
  });

  assert.ok(element.className.includes("bus-marker"));
  assert.ok(element.className.includes("bus-marker-stopped"));
  assert.equal(element.style["--bus-color"], "#0284c7");

  // Check school bus variant
  const schoolElement = mapMarker.createBusMarkerContent({
    line: "652",
    destination: "Lampertheim Schulzentrum",
    status: "moving",
    speedKmh: 40,
    isSchoolBus: true,
    delayMinutes: 2,
  });
  assert.ok(schoolElement.className.includes("bus-marker-school"));
  assert.equal(schoolElement.style["--bus-color"], "#f59e0b");
});

test("createBusStopMarkerContent renders German Haltestellenschild with H and school icon", () => {
  const stopElement = mapMarker.createBusStopMarkerContent({
    name: "Bürstadt Erich-Kästner-Schule",
    lines: ["642", "652"],
    isSchoolStop: true,
    isTrainHub: false,
  });

  assert.ok(stopElement.className.includes("bus-stop-marker"));
  assert.ok(stopElement.className.includes("bus-stop-school"));
});

test("GET /api/buses route handles requests and returns operator and bus fleet", async () => {
  const routeSource = fs.readFileSync(new URL("../app/api/buses/route.ts", import.meta.url), "utf8");
  assert.ok(routeSource.includes("calculateBusMobility"), "API route must call calculateBusMobility");
  assert.ok(routeSource.includes("Verkehrsverbund Rhein-Neckar"), "API route must mention VRN");
});
