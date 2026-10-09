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
  assert.equal(urls.find(url => url.pathname === '/api/v1/telemetry/raw').searchParams.get('start_time'), start);
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


test('everyday categories get their own station despite faster seismic readings', () => {
  const station = (id, category, timestamp = start) => ({ id, name: id, categories: [category], readings: [{ timestamp }] });
  const inventory = [station('shake-fast', 'seismic', new Date(now).toISOString()),
    ...Array.from({length: 12}, (_, i) => station(`weather-${i}`, 'weather')),
    station('parking', 'parking'), station('bikes', 'bikes'), station('air', 'air'), station('water', 'water'),
    station('forecast-weather', 'weather'), station('bu-test', 'traffic')];
  const selected = helpers.selectPitchStations(inventory);
  assert.equal(selected.length, 8);
  assert.deepEqual(new Set(selected.map(helpers.pitchStationCategory)), new Set(['weather', 'parking', 'bikes', 'air', 'water']));
  assert.ok(selected.every(s => !/shake|forecast|bu-test/.test(s.id)));
});

test('six categories remain visible even without new raw rows', async () => {
  const body = await (await route(async () => Response.json([]))(request())).json();
  assert.deepEqual(body.categories.map(c => c.id), ['crossings', 'parking', 'bikes', 'weather', 'air', 'water']);
  assert.equal(body.categories.find(c => c.id === 'weather').count, 0);
  assert.equal(body.categories.find(c => c.id === 'weather').unavailable, false);
  assert.equal(body.categories.find(c => c.id === 'parking').unavailable, true);
});

test('crossing estimates are labelled and excluded from raw totals', async () => {
  const crossing = { entity_id: 'crossing:test', name: 'Mainstraße', basis: 'model', status: 'closed',
    timestamp: new Date(now - 1000).toISOString(), valid_until: new Date(now + 60000).toISOString() };
  const GET = route(async url => url.pathname === '/api/v1/movements/latest'
    ? Response.json({crossings_available: true, crossings: [crossing]}) : Response.json([]));
  const body = await (await GET(request())).json();
  const category = body.categories[0];
  assert.equal(category.model, true); assert.equal(category.count, null);
  assert.equal(category.sample.value, 2); assert.equal(category.sample.station, 'Mainstraße');
  assert.equal(body.count, 0); assert.equal(body.samples.length, 0);
  for (const change of [{basis: 'observed'}, {status: 'unknown'}, {valid_until: start}, {timestamp: start}]) {
    assert.equal(helpers.pitchCrossingCategory({crossings_available: true, crossings: [{...crossing, ...change}]}, Date.parse(start), now).sample, undefined);
  }
});
