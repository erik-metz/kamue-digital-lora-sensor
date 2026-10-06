import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, extra = {}, modules = {}) {
  const context = { exports: {}, Date, Number, Map, Set, Array, Object, Response, URL,
    require(id) { if (id in modules) return modules[id]; throw new Error(`Unexpected dependency ${id}`); }, ...extra };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context);
  return context.exports;
}
const data = load("../lib/bahnData.ts");
const now = Date.now();
const expiry = new Date(now + 60000).toISOString();
const object = { id: "lift", provider_id: "diid:lift", name: null, type: "LiftEquipment", coordinates: null };
const station = { id: "station", provider_id: "dhid:station", name: "Biblis", type: "StopPlace", coordinates: null,
  eva_numbers: ["8000503"], ds100_codes: ["FBL"], eva_number: "8000503", station_number: "1", components: [object] };
const facility = { ...object, station_id: "station", eva_number: "8000503", status: "available", status_basis: "reported", description: null };
function response(kind, items, overrides = {}) {
  return Response.json({ [kind]: items }, { headers: {
    "x-source-updated-at": new Date(now - 1000).toISOString(),
    "x-collected-at": new Date(now).toISOString(), "x-data-expires-at": expiry,
    ...overrides,
  } });
}

test("unknown and missing facility reports never imply availability; expiration wins", () => {
  assert.equal(data.facilityStatus(undefined, expiry, now).tone, "unknown");
  assert.equal(data.facilityStatus({ ...facility, status_basis: "not_reported" }, expiry, now).tone, "unknown");
  assert.equal(data.facilityStatus({ ...facility, status: "unknown" }, expiry, now).tone, "unknown");
  assert.equal(data.facilityStatus(facility, expiry, now).label, "Verfügbar");
  assert.equal(data.facilityStatus(facility, expiry, Date.parse(expiry)).tone, "stale");
  assert.equal(data.facilityStatus(facility, "invalid", now).tone, "stale");
  assert.equal(data.facilityStatus({ ...facility, status: "notAvailable" }, expiry, now).label, "Nicht verfügbar");
  assert.equal(data.facilityStatus({ ...facility, status: "partiallyAvailable" }, expiry, now).label, "Teilweise verfügbar");
});

test("map positions use only own reported coordinates, without assigning a platform to a station or lift", () => {
  const positioned = { ...object, id: "equipment-place", type: "EquipmentPlace", coordinates: { latitude: 49.68, longitude: 8.44 } };
  const markers = data.infrastructureMarkers([{ ...station, components: [object, positioned] }], {
    data: [facility], expiresAt: expiry,
  }, now);
  assert.equal(markers.length, 1);
  assert.equal(markers[0].id, "equipment-place");
  assert.equal(markers[0].statusLabel, "Keine Statusmeldung");
  assert.equal(markers[0].latitude, 49.68);
  for (const coordinate of [{ latitude: NaN, longitude: 8 }, { latitude: 91, longitude: 8 }, { latitude: "49", longitude: 8 }]) {
    assert.equal(data.validCoordinates(coordinate), false);
  }
});

test("search finds station names and official identifiers, including no matches", () => {
  for (const query of [" bIbLiS ", "8000503", "fbl"]) assert.equal(data.filterStations([station], query).length, 1);
  assert.equal(data.filterStations([station], "missing").length, 0);
});

test("client uses same-origin API and retains source metadata", async () => {
  let requested;
  const lib = load("../lib/bahnData.ts", { fetch: async path => { requested = path; return response("stations", [station]); } });
  const snapshot = await lib.fetchBahn("stations");
  assert.equal(requested, "/api/bahn/stations");
  assert.equal(snapshot.data[0].eva_numbers[0], "8000503");
  assert.equal(snapshot.expiresAt, expiry);
});

test("expired, future, malformed and failed responses are rejected", async () => {
  const cases = [
    () => response("facilities", [facility], { "x-data-expires-at": new Date(now - 1000).toISOString() }),
    () => response("facilities", [facility], { "x-source-updated-at": new Date(now + 600000).toISOString() }),
    () => Response.json({ facilities: [facility] }),
    () => Response.json({ detail: "expired" }, { status: 503 }),
    () => response("facilities", [{ ...facility, status: "invented" }]),
    () => response("facilities", [facility, facility]),

  ];
  for (const makeResponse of cases) {
    const lib = load("../lib/bahnData.ts", { fetch: async () => makeResponse() });
    await assert.rejects(lib.fetchBahn("facilities"));
  }
  const invalidInventory = load("../lib/bahnData.ts", { fetch: async () => response("stations", [
    { ...station, components: [{ ...object, coordinates: { latitude: 500, longitude: 8 } }] },
  ]) });
  await assert.rejects(invalidInventory.fetchBahn("stations"));
});

test("Next proxies preserve the publication boundary and distinct cache lifetimes", async () => {
  for (const [kind, ttl] of [["stations", 300], ["facilities", 0]]) {
    const expected = response(kind, []);
    const route = load(`../app/api/bahn/${kind}/route.ts`, {}, {
      "@/lib/collectedBackend": { proxyBackend(path, seconds) {
        assert.equal(path, `collected/transport/bahn/${kind}`);
        assert.equal(seconds, ttl);
        return expected;
      } },
    });
    assert.equal(await route.GET(), expected);
  }
});
