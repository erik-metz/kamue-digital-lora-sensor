import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, mocks, globals = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = { exports: {}, Date, URL, URLSearchParams, Response, AbortSignal, ...globals, require(name) { if (!(name in mocks)) throw new Error(name); return mocks[name]; } };
  vm.runInNewContext(code, context); return context.exports;
}
const helpers = load('lib/pitchWindow.ts', {});
const now = Date.now();
const start = new Date(now - 60000).toISOString();
const nodes = ['a', 'b'].map(id => ({ id, name: `Station ${id}`, categories: ['weather'], readings: [{ timestamp: start }] }));
function route(fetch, inventory = nodes) {
  return load('app/api/pitch-window/route.ts', {
    '@/env': { env: { BACKEND_API_URL: 'https://backend.example' } },
    '@/lib/mapBackend': { fetchMapData: async () => ({ nodes: inventory }) },
    '@/lib/pitchWindow': helpers,
  }, { fetch }).GET;
}
function request(query = `start=${encodeURIComponent(start)}`) { return new Request(`http://localhost/api/pitch-window?${query}`); }
test('partial failures preserve actual zero raw values and query window', async () => {
  const urls = [];
  const response = await route(async url => {
    urls.push(url);
    return url.searchParams.get('sensor_id') === 'b' ? new Response('', { status: 503 }) : Response.json([{ sensor_id: 'a', timestamp: new Date(now - 1000).toISOString(), metric: 'temperature', value: 0, unit: '°C' }]);
  })(request());
  const body = await response.json();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(body.count, 1); assert.equal(body.samples[0].value, 0);
  assert.equal(body.stations.find(s => s.id === 'b').unavailable, true);
  assert.equal(urls[0].searchParams.get('start_time'), start);
});
test('malformed or unavailable responses produce errors, never a fake zero', async () => {
  for (const payload of [{ error: 'unavailable' }, [{ sensor_id: 'wrong' }]]) {
    const response = await route(async () => Response.json(payload))(request());
    assert.equal(response.status, 503); assert.equal((await response.json()).count, undefined);
  }
});
test('empty successes and truncated responses are distinguished', async () => {
  assert.equal((await (await route(async () => Response.json([]))(request())).json()).count, 0);
  const row = { sensor_id: 'a', timestamp: new Date(now - 1000).toISOString(), metric: 'temperature', value: 12, unit: '°C' };
  const body = await (await route(async () => Response.json(Array(1000).fill(row)), [nodes[0]])(request())).json();
  assert.equal(body.count, 1); assert.equal(body.stations[0].truncated, true);
});
test('invalid start and oversized selection never request raw data', async () => {
  let calls = 0;
  const GET = route(async () => { calls++; return Response.json([]); });
  assert.equal((await GET(request('start=invalid'))).status, 400);
  assert.equal((await GET(request(`start=${encodeURIComponent(start)}&stations=a,b,c,d,e,f,g,h,i`))).status, 400);
  assert.equal(calls, 0);
});
