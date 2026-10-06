import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const context = { exports: {}, Date, Number, Math, String, Array, Error };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../lib/satelliteData.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { decodeSatellites, satelliteFresh, satelliteDetails } = context.exports;
const now = Date.parse("2026-10-06T08:00:00Z");
const sample = { id: "satellite:25544", norad_id: 25544, name: "ISS", latitude: 49.65, longitude: 8.45,
  altitude_km: 420, speed_km_s: 7.66, timestamp: new Date(now).toISOString(), element_epoch: "2026-10-06T07:00:00Z",
  element_age_seconds: 3600, basis: "model", source: "space-track" };
const body = positions => ({ positions, timestamp: sample.timestamp, last_import: sample.element_epoch });
test("satellite model coordinates remain at their real ground position, including outside the Ried", () => {
  const result = decodeSatellites(body([sample, { ...sample, id: "satellite:12345", norad_id: 12345, latitude: -30, longitude: 140 }]), now);
  assert.equal(result.positions.length, 2);
  assert.equal(result.positions[1].longitude, 140);
  assert.match(satelliteDetails(sample).join(" "), /berechnete Bodenprojektion/);
});
test("invalid geometry, wrong identity and non-model positions cannot reach Leaflet", () => {
  for (const change of [{ latitude: NaN }, { longitude: Infinity }, { latitude: 91 }, { id: "sensor:25544" },
    { basis: "observed" }, { element_age_seconds: 864001 }, { element_epoch: "invalid" }]) {
    assert.equal(decodeSatellites(body([{ ...sample, ...change }]), now).positions.length, 0);
  }
});
test("stale cached snapshots and expired positions cannot remain live", () => {
  assert.equal(satelliteFresh(sample, now + 4999), true);
  assert.equal(satelliteFresh(sample, now + 5000), false);
  assert.throws(() => decodeSatellites(body([sample]), now + 6000), /stale/);
  assert.equal(decodeSatellites(body([{ ...sample, timestamp: new Date(now-6000).toISOString() }]), now).positions.length, 0);
  assert.throws(() => decodeSatellites({ positions: [], timestamp: "invalid" }, now));
});

test("an empty regional view is ready when the backend has valid orbital data", () => {
  const empty = decodeSatellites({ ...body([]), status: "ready", catalog_count: 15000 }, now);
  assert.equal(empty.available, true);
  assert.equal(empty.catalog_count, 15000);
  assert.equal(empty.positions.length, 0);
  assert.equal(decodeSatellites({ ...body([]), status: "unavailable", catalog_count: 15000 }, now).available, false);
});
