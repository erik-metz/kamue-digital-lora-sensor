import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// 1. Load mapData
const mapSource = fs.readFileSync(new URL("../lib/mapData.ts", import.meta.url), "utf8");
const mapContext = { exports: {}, Date, Set, Number, JSON, Math, Array, Object };
vm.runInNewContext(
  ts.transpileModule(mapSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  mapContext
);
const mapData = mapContext.exports;

// 2. Load regionalStats
const statsSource = fs.readFileSync(new URL("../lib/regionalStats.ts", import.meta.url), "utf8");
const statsContext = {
  exports: {},
  require: (id) => {
    if (id === "./collectedBackend") return { collectedFetch: globalThis.fetch };
    if (id === "@/env") return { env: { BACKEND_API_URL: "http://localhost:8000" } };
    if (id === "./mapData") return mapData;
    throw new Error(`Unknown require in test context: ${id}`);
  },
  Date,
  Set,
  Number,
  JSON,
  Math,
  Array,
  Object,
  fetch: globalThis.fetch,
  AbortSignal: globalThis.AbortSignal,
  URL: globalThis.URL,
};
vm.runInNewContext(
  ts.transpileModule(statsSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  statsContext
);
const regionalStats = statsContext.exports;

test("BASELINE_EVENTS covers all 4 core Ried municipalities with authentic events", () => {
  const events = regionalStats.BASELINE_EVENTS;
  assert.ok(events.length >= 10, "Expected comprehensive event catalog");

  const municipalities = new Set(events.map((e) => e.municipality));
  assert.ok(municipalities.has("Bürstadt"), "Must include Bürstadt");
  assert.ok(municipalities.has("Lampertheim"), "Must include Lampertheim");
  assert.ok(municipalities.has("Biblis"), "Must include Biblis");
  assert.ok(municipalities.has("Groß-Rohrheim"), "Must include Groß-Rohrheim");
});

test("BASELINE_EVENTS contains authentic festivals, stage acts and KAMÜ events", () => {
  const events = regionalStats.BASELINE_EVENTS;

  // Major traditional festivals
  const kerwe = events.find((e) => e.title.includes("Bürstädter Kerwe"));
  assert.ok(kerwe, "Must include Bürstädter Kerwe");
  assert.equal(kerwe.category, "festival");
  assert.equal(kerwe.is_free, true);

  const spargelfest = events.find((e) => e.title.includes("Lampertheimer Spargelfest"));
  assert.ok(spargelfest, "Must include Lampertheimer Spargelfest");
  assert.equal(spargelfest.status, "past");

  const gurkenfest = events.find((e) => e.title.includes("Bibliser Gurkenfest"));
  assert.ok(gurkenfest, "Must include Bibliser Gurkenfest");

  const rohremerKerb = events.find((e) => e.title.includes("Rohremer Kerb"));
  assert.ok(rohremerKerb, "Must include Rohremer Kerb");

  // Stage comedy & concert
  const chako = events.find((e) => e.title.includes("CHAKO"));
  assert.ok(chako, "Must include Chako Habekost at Bürgerhaus Bürstadt");
  assert.equal(chako.category, "theater");
  assert.equal(chako.is_free, false);

  const irishDance = events.find((e) => e.title.includes("Irish Dance"));
  assert.ok(irishDance, "Must include Dance Masters at Hans-Pfeiffer-Halle");

  // KAMÜ spotlight
  const kamue = events.find((e) => e.organizer === "KAMÜ Kulturzentrum");
  assert.ok(kamue, "Must include KAMÜ Kulturzentrum");
});

test("all event URLs are valid and do not have broken placeholder subpaths", () => {
  const events = regionalStats.BASELINE_EVENTS;
  for (const evt of events) {
    const url = evt.ticket_url || evt.event_url;
    if (url) {
      assert.doesNotThrow(() => new URL(url), `${evt.title} must have a valid URL`);
      assert.ok(!url.includes("/events/hackathon-kickoff"), "No broken placeholder paths");
      assert.ok(!url.includes("kamue.me/tickets"), "No fake ticket paths");
    }
  }
});

// Fetch failure and empty-state contracts are tested in collectedData.test.mjs.

test("generateIcsCalendar produces valid RFC 5545 calendar format", () => {
  const event = regionalStats.BASELINE_EVENTS.find((e) => e.title.includes("Bürstädter Kerwe"));
  assert.ok(event, "Bürstädter Kerwe event exists");

  const ics = regionalStats.generateIcsCalendar(event);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR"), "Starts with BEGIN:VCALENDAR");
  assert.ok(ics.includes("VERSION:2.0"), "Includes VERSION:2.0");
  assert.ok(ics.includes(`SUMMARY:${event.title}`), "Includes SUMMARY");
  assert.ok(ics.includes(`LOCATION:${event.venue_name}`), "Includes LOCATION");
  assert.ok(ics.includes("DTSTART:"), "Includes DTSTART");
  assert.ok(ics.endsWith("END:VCALENDAR"), "Ends with END:VCALENDAR");
});
