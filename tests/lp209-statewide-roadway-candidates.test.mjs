import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONTROL_FIPS, loadPlan, summarize, verifyCommitted } from '../tools/lp209/statewide-roadway-candidates.mjs';

test('LP209 plan binds all LP206 counties to certified LP208 identities and protects runtime 28', async()=>{
  const before=await readFile('data/roadway-runtime-manifest.json'); const p=await loadPlan();
  assert.equal(p.rows.length,226); assert.equal(new Set(p.rows.map(x=>x.countyFips)).size,226);
  assert.equal(p.rows.every(x=>x.sourceSha256?.length===64&&x.sourceBytes>0),true);
  assert.equal(p.rows.every(x=>!x.protectedExistingRuntime&&x.manufacturingRequired),true);
  assert.deepEqual(await readFile('data/roadway-runtime-manifest.json'),before);
});
test('committed evidence is conservative and honestly blocked before owner manufacturing',async()=>{
  const v=await verifyCommitted(); assert.equal(v.accounting.planned,226); assert.equal(v.accounting.protectedOverlap,0);
  assert.equal(v.accounting.supabaseWrites,0); assert.equal(v.accounting.runtimeActivations,0);
  assert.equal(v.readiness,'BLOCKED_FOR_STATEWIDE_ROADWAY');
});
test('aggregate requires every owner result and never infers certification',async()=>{
  const p=await loadPlan(); const a=summarize(p.rows,[],p); assert.equal(a.accounting.lp118Successful,0); assert.equal(a.accounting.lp116Manufactured,0); assert.equal(a.accounting.pending,226); assert.equal(a.counties.length,226);
  assert.deepEqual(a.partitionLimits,{targetFeatureCount:35000,targetBytes:10485760,hardFeatureCount:45000,hardBytes:20971520});
  assert.equal(CONTROL_FIPS.length,11); assert.equal(a.readiness,'BLOCKED_FOR_STATEWIDE_ROADWAY');
});
