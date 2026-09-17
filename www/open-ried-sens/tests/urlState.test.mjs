import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Transpile mapData.ts first for dependencies
const mapDataSource = fs.readFileSync(new URL("../lib/mapData.ts", import.meta.url), "utf8");
const mapDataContext = { exports: {}, Date, Set, Number, JSON, Math, String, Object, Array, RegExp };
vm.runInNewContext(
  ts.transpileModule(mapDataSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  mapDataContext
);
const mapData = mapDataContext.exports;

// Transpile urlState.ts with require hook pointing to mapData
const urlStateSource = fs.readFileSync(new URL("../lib/urlState.ts", import.meta.url), "utf8");
const urlStateContext = {
  exports: {},
  require: (id) => {
    if (id === "./mapData" || id.endsWith("mapData")) return mapData;
    throw new Error(`Cannot find module '${id}'`);
  },
  Date,
  Set,
  Number,
  JSON,
  Math,
  String,
  Object,
  Array,
  URLSearchParams,
  parseFloat,
  parseInt,
  isNaN,
};
vm.runInNewContext(
  ts.transpileModule(urlStateSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  urlStateContext
);
const urlState = urlStateContext.exports;

test("MAP_LAYER_IDS contains all 19 domain layers", () => {
  const ids = urlState.MAP_LAYER_IDS;
  assert.equal(ids.length, 19);
  assert.ok(ids.includes("nature"));
  assert.ok(ids.includes("crops"));
  assert.ok(ids.includes("floods"));
  assert.ok(ids.includes("starkregen"));
  assert.ok(ids.includes("charging"));
  assert.ok(ids.includes("energy"));
  assert.ok(ids.includes("road"));
  assert.ok(ids.includes("wifi"));
  assert.ok(ids.includes("broadband"));
  assert.ok(ids.includes("boris"));
  assert.ok(ids.includes("devplans"));
  assert.ok(ids.includes("elections"));
  assert.ok(ids.includes("companies"));
  assert.ok(ids.includes("closures"));
  assert.ok(ids.includes("traffic"));
  assert.ok(ids.includes("buses"));
  assert.ok(ids.includes("stops"));
  assert.ok(ids.includes("waste"));
  assert.ok(ids.includes("trains"));
});

test("parseMapSessionState parses valid coordinates, zoom, and mode", () => {
  const parsed = urlState.parseMapSessionState("lat=49.635&lng=8.472&z=15&mode=temperature");
  assert.equal(parsed.lat, 49.635);
  assert.equal(parsed.lng, 8.472);
  assert.equal(parsed.z, 15);
  assert.equal(parsed.mode, "temperature");
});

test("parseMapSessionState handles alternate parameter names (zoom, darstellung)", () => {
  const parsed = urlState.parseMapSessionState("zoom=14&darstellung=category");
  assert.equal(parsed.z, 14);
  assert.equal(parsed.mode, "category");
});

test("parseMapSessionState rejects out-of-bound or invalid values", () => {
  const parsed = urlState.parseMapSessionState("lat=999&lng=abc&z=50&mode=invalid");
  assert.equal(parsed.lat, undefined);
  assert.equal(parsed.lng, undefined);
  assert.equal(parsed.z, undefined);
  assert.equal(parsed.mode, undefined);
});

test("parseMapSessionState parses categories and 'all' keyword", () => {
  const withCats = urlState.parseMapSessionState("cats=weather,air,parking");
  assert.deepEqual([...withCats.cats], ["weather", "air", "parking"]);

  const withAll = urlState.parseMapSessionState("cats=all");
  assert.equal(withAll.cats.length, mapData.CATEGORY_IDS.length);
});

test("parseMapSessionState parses explicit active layers", () => {
  const parsed = urlState.parseMapSessionState("layers=nature,charging,companies");
  assert.ok(parsed.layers);
  assert.equal(parsed.layers.nature, true);
  assert.equal(parsed.layers.charging, true);
  assert.equal(parsed.layers.companies, true);
  assert.equal(parsed.layers.trains, false);
  assert.equal(parsed.layers.boris, false);
});

test("parseMapSessionState parses delta layer mode (+broadband,-trains)", () => {
  const parsed = urlState.parseMapSessionState("layers=+broadband,-trains");
  assert.ok(parsed.layers);
  assert.equal(parsed.layers.broadband, true); // was default false
  assert.equal(parsed.layers.trains, false); // was default true
  assert.equal(parsed.layers.charging, true); // remains default true
});

test("parseMapSessionState parses selected node and metric", () => {
  const parsed = urlState.parseMapSessionState("node=bu-101&metric=pm25");
  assert.equal(parsed.node, "bu-101");
  assert.equal(parsed.metric, "pm25");
});

test("serializeMapSessionState omits default values for clean URLs", () => {
  const defaultState = {
    lat: 49.62,
    lng: 8.46,
    z: 12,
    mode: "category",
    cats: [...mapData.CATEGORY_IDS],
    layers: { ...urlState.DEFAULT_MAP_LAYERS },
  };
  const query = urlState.serializeMapSessionState(defaultState);
  assert.equal(query, "");
});

test("serializeMapSessionState serializes customized state cleanly", () => {
  const customState = {
    lat: 49.6350,
    lng: 8.4720,
    z: 15,
    mode: "temperature",
    cats: ["weather", "air"],
    node: "bu-101",
    metric: "temperature",
  };
  const query = urlState.serializeMapSessionState(customState);
  const sp = new URLSearchParams(query);
  assert.equal(sp.get("lat"), "49.6350");
  assert.equal(sp.get("lng"), "8.4720");
  assert.equal(sp.get("z"), "15");
  assert.equal(sp.get("mode"), "temperature");
  assert.equal(sp.get("cats"), "weather,air");
  assert.equal(sp.get("node"), "bu-101");
  assert.equal(sp.get("metric"), "temperature");
});

test("parseSubpageParams and serializeSubpageParams handle domain page parameters", () => {
  const defaults = { tab: "overview", muni: "all", q: "" };
  const parsed = urlState.parseSubpageParams("tab=taxes&muni=buerstadt", defaults);
  assert.equal(parsed.tab, "taxes");
  assert.equal(parsed.muni, "buerstadt");
  assert.equal(parsed.q, "");

  const serialized = urlState.serializeSubpageParams(parsed, defaults);
  assert.equal(serialized, "tab=taxes&muni=buerstadt");
});
