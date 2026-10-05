import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function route(fetch) {
  const source = fs.readFileSync(new URL("../app/api/data-download/route.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, URL, URLSearchParams, Date, Response, AbortSignal, AbortController, Request, setTimeout, clearTimeout, fetch,
    require: () => ({ env: { BACKEND_API_URL: "https://backend.example" } }),
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

test("sample requests related tables without a station or dates", async () => {
  const urls = [];
  const api = route(async url => {
    urls.push(url);
    return new Response("zip", { headers: { "Content-Type": "application/zip" } });
  });
  const response = await api.GET(new Request("https://app.example/api/data-download?sample=1"));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "zip");
  assert.equal(urls[0].pathname, "/api/v1/downloads");
  assert.equal(urls[0].searchParams.get("sample"), "true");
  assert.equal(urls[0].searchParams.has("sensor_id"), false);
  assert.match(response.headers.get("Content-Disposition"), /sample\.zip/);
});

test("31 inclusive days and a broad topic are accepted", async () => {
  const api = route(async url => {
    assert.equal(url.searchParams.get("topic"), "mobility");
    assert.equal(url.searchParams.get("end"), "2030-01-31");
    return new Response("zip", { headers: { "Content-Type": "application/zip" } });
  });
  const response = await api.GET(new Request("https://app.example/api/data-download?topic=mobility&start=2030-01-01&end=2030-01-31"));
  assert.equal(response.status, 200);
});

test("invalid dates, reversed ranges, oversized ranges and unknown topics never reach backend", async () => {
  const api = route(async () => { throw new Error("Should not be fetched"); });
  for (const query of ["topic=station", "start=2030-02-30&end=2030-03-01", "start=2030-01-02&end=2030-01-01", "start=2030-01-01&end=2030-02-01", "start=2030-01-01"]) {
    assert.equal((await api.GET(new Request(`https://app.example/api/data-download?${query}`))).status, 400);
  }
});

test("backend overflow is surfaced without an incomplete download", async () => {
  const api = route(async () => Response.json({ detail: "Auswahl zu groß, nicht abgeschnitten." }, { status: 422 }));
  const response = await api.GET(new Request("https://app.example/api/data-download?sample=1"));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, "Auswahl zu groß, nicht abgeschnitten.");
  assert.equal(response.headers.has("Content-Disposition"), false);
});

test("backend deployment and unavailable errors remain actionable", async () => {
  const api = route(async () => new Response("Not found", { status: 404 }));
  const response = await api.GET(new Request("https://app.example/api/data-download?sample=1"));
  assert.equal(response.status, 404);
  assert.match((await response.json()).error, /Daten/);
});

test("successful JSON cannot be mislabelled as a ZIP", async () => {
  const api = route(async () => Response.json({ unexpected: true }));
  assert.equal((await api.GET(new Request("https://app.example/api/data-download?sample=1"))).status, 502);
});


test("availability check returns JSON before starting a native ZIP download", async () => {
  const api = route(async url => {
    assert.equal(url.searchParams.get("check"), "true");
    return Response.json({ available: true });
  });
  const response = await api.GET(new Request("https://app.example/api/data-download?sample=1&check=1"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { available: true });
  assert.equal(response.headers.has("Content-Disposition"), false);
});
