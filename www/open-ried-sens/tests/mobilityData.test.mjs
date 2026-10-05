import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const context = { exports: {}, Date, Math, Number, Set };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../lib/mobilityData.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const model = context.exports;
const now = Date.parse('2026-10-05T10:00:00Z');
const crossing = { id:'a',entity_id:'crossing:a',name:'Gate',barrier:'half',latitude:49.64,longitude:8.45,
  status:'closed',timestamp:new Date(now).toISOString(),valid_until:new Date(now+30000).toISOString(),members:['a','b'] };
const feature = (id, barrier, longitude=8.45) => ({geometry:{type:'Point',coordinates:[longitude,49.64]},properties:{id,barrier,name:'Gate'}});
test('unbarriered and unmapped crossings are excluded, track nodes are grouped', () => {
  const geometry = {features:[feature('a','half'),feature('b','half',8.4501),feature('c','no'),feature('d','nicht erfasst'),feature('e','half',8.451)]};
  const sites=model.crossingSites(geometry,[crossing],now);
  assert.equal(sites.length,2);
  assert.equal(sites[0].status,'closed');
  assert.equal(sites[1].status,'unknown');
});
test('expired barrier estimate becomes unknown and cannot produce an open reading', () => {
  assert.equal(model.crossingStatus(crossing,now+30000),'unknown');
  assert.equal(model.mobilityNodes([], [crossing], now+30000)[0].readings.length,0);
  assert.equal(model.mobilityNodes([], [crossing], now)[0].readings[0].value,2);
});
test('vehicle clicks use canonical entities and offer speed, delay and paired coordinates', () => {
  const nodes=model.mobilityNodes([{id:'trip',kind:'train',latitude:49.64,longitude:8.45,timestamp:crossing.timestamp,valid_until:crossing.valid_until,basis:'schedule_prediction',speed_kmh:80,delay_seconds:120}],[],now);
  assert.equal(nodes[0].id,'movement:trip');
  assert.deepEqual(Array.from(nodes[0].readings,r=>r.metric),['speed','delay','latitude','longitude']);
  assert.match(nodes[0].address,/prognose/);
});
