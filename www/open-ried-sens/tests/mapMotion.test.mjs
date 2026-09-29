import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/mapMotion.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const { nextMotion, motionPoint } = context.exports;
const a = { lat: 49.6, lng: 8.4 }, b = { lat: 49.601, lng: 8.402 };

test('movement spans the data interval instead of one second and stops at the received endpoint', () => {
  const initial = nextMotion(undefined, a, 10000, 0);
  const motion = nextMotion(initial, b, 20000, 10000);
  assert.equal(motion.duration, 10000);
  assert.ok(Math.abs(motionPoint(motion, 15000).lat - 49.6005) < 1e-9);
  assert.equal(motionPoint(motion, 50000).lat, b.lat);
});
test('cached and older snapshots do not restart or rewind movement', () => {
  const motion = nextMotion(nextMotion(undefined, a, 10000, 0), b, 20000, 10000);
  assert.equal(nextMotion(motion, b, 20000, 15000), motion);
  assert.equal(nextMotion(motion, a, 10000, 15000), motion);
});
test('a new target starts at the currently displayed point without a jump', () => {
  const motion = nextMotion(nextMotion(undefined, a, 10000, 0), b, 20000, 10000);
  const next = nextMotion(motion, { lat: 49.602, lng: 8.403 }, 30000, 15000);
  assert.equal(next.from.lat, motionPoint(motion, 15000).lat);
  assert.equal(motionPoint(next, 15000).lat, next.from.lat);
});
test('long gaps and large corrections snap rather than simulate an unsupported journey', () => {
  const initial = nextMotion(undefined, a, 10000, 0);
  assert.equal(nextMotion(initial, b, 100000, 90000).duration, 0);
  assert.equal(nextMotion(initial, { lat: 50, lng: 9 }, 20000, 10000).duration, 0);
});
test('stationary vehicles do not run an animation loop', () => {
  const initial = nextMotion(undefined, a, 10000, 0);
  assert.equal(nextMotion(initial, a, 20000, 10000).duration, 0);
});
