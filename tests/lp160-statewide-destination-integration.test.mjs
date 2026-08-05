import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { FAMILIES, P, buildArtifacts, norm, verify } from '../tools/lp160-build-statewide-destination-integration.mjs';
const artifacts=buildArtifacts();
const registry=JSON.parse(readFileSync(P.registry,'utf8'));
const summary=JSON.parse(readFileSync(P.summary,'utf8'));
const final=JSON.parse(readFileSync(P.final,'utf8'));
const manifest=JSON.parse(readFileSync(P.manifest,'utf8'));
const mapping=JSON.parse(readFileSync(P.mapping,'utf8'));
const rejected=JSON.parse(readFileSync(P.rejected,'utf8'));
const unmapped=JSON.parse(readFileSync(P.unmapped,'utf8'));
const dedupe=JSON.parse(readFileSync(P.dedupe,'utf8'));
const decisions=JSON.parse(readFileSync(P.dupeRegister,'utf8'));
const community=JSON.parse(readFileSync(P.community,'utf8'));
const search=JSON.parse(readFileSync(P.searchValidation,'utf8'));
const routing=JSON.parse(readFileSync(P.routing,'utf8'));
const awareness=JSON.parse(readFileSync(P.awareness,'utf8'));
const liberty=JSON.parse(readFileSync(P.liberty,'utf8'));
function sha(p){return createHash('sha256').update(readFileSync(p)).digest('hex')}
function snapshot(){return Object.fromEntries(Object.values(P).filter(existsSync).map(p=>[p,sha(p)]))}

test('LP160 recognizes all Texas counties and records approved source identity',()=>{
  const counties=JSON.parse(readFileSync('data/lp104/texas-counties.json','utf8')).counties;
  assert.equal(counties.length,254);
  assert.equal(manifest.sourceIdentity.sourceId,'overture-places');
  assert.ok(manifest.sourceIdentity.license.includes('CDLA'));
  assert.equal(manifest.performsRuntimeChange,false);
  assert.equal(manifest.performsDeploymentChange,false);
  assert.equal(manifest.performsActivationChange,false);
  assert.equal(manifest.protectedInfrastructureModified,false);
});

test('LP160 extracts Texas records, rejects non-Texas/invalid evidence, and preserves deterministic IDs',()=>{
  assert.ok(rejected.rejectedRecords.some(r=>r.reasons.includes('OUTSIDE_TEXAS_OR_INVALID_COORDINATES')));
  for (const d of registry.destinations) {
    assert.match(d.destinationId,/^txdest-[0-9a-f]{16}$/);
    assert.ok(d.latitude>=25.5&&d.latitude<=36.6,d.destinationId);
    assert.ok(d.longitude>=-106.7&&d.longitude<=-93.5,d.destinationId);
    assert.match(d.countyFips,/^48\d{3}$/);
  }
  assert.equal(new Set(registry.destinations.map(d=>d.destinationId)).size,registry.destinations.length);
  assert.deepEqual(buildArtifacts()[P.registry],registry);
});

test('LP160 category mapping is governed and unmapped categories are reported',()=>{
  assert.deepEqual(mapping.categoryFamilies,FAMILIES);
  assert.ok(mapping.mappings.some(m=>m.sourceCategory==='gas_station'&&m.categoryFamily==='Fuel'));
  assert.deepEqual(unmapped.unmappedCategories,['future_category']);
  assert.ok(summary.totalExcludedRecords>=2);
});

test('LP160 deduplication avoids over-merge and retains separate brand branches',()=>{
  assert.equal(dedupe.removedRecordTotals,1);
  assert.ok(decisions.decisions.some(d=>d.decision==='MERGE_EXACT_DUPLICATE'));
  const walmart=registry.destinations.filter(d=>d.brandIdentity==='Walmart');
  assert.equal(walmart.length,2);
  assert.equal(new Set(walmart.map(d=>`${d.latitude},${d.longitude}`)).size,2);
});

test('LP160 county/community relationships, aliases, search, routing, and Route Watch fields are preserved',()=>{
  assert.ok(community.relationships.every(r=>['SOURCE_PROVIDED','UNRESOLVED'].includes(r.method)));
  const tokenText=JSON.stringify(JSON.parse(readFileSync(P.searchIndex,'utf8')));
  for (const q of ['heb','tamu','iah','cfa','buc ees']) assert.ok(tokenText.includes(norm(q)));
  for (const q of ['Buc-ee’s','Walmart','H-E-B','hospital','courthouse','George Bush Intercontinental Airport','Port of Houston','Galveston Beach']) assert.equal(search.validation.find(v=>v.query===q).pass,true,q);
  assert.equal(routing.status,'PASS');
  assert.ok(routing.validatedDestinations.every(r=>r.coordinates.latitude&&r.coordinates.longitude));
  assert.equal(awareness.routeWatchFieldsPreserved,true);
  assert.equal(awareness.activationModified,false);
});

test('LP160 preserves Liberty behavior and remains candidate-only',()=>{
  assert.equal(liberty.status,'PASS');
  assert.equal(liberty.runtimeBehaviorChanged,false);
  assert.ok(registry.destinations.some(d=>d.countyFips==='48291'&&d.consumerDisplayName.includes('Walmart')));
  assert.equal(final.classification,'CONDITIONALLY_READY');
  assert.equal(final.integrationReadyCriteriaSatisfied,false);
});

test('LP160 verification is read-only and protected artifacts remain unchanged',()=>{
  const protectedBefore={pkg:sha('package.json'), lp159:sha('data/lp159/destination-source-selection.json'), runtime:sha('data/roadway-runtime-manifest.json')};
  const before=snapshot();
  assert.deepEqual(verify(),final);
  execFileSync('node',['tools/lp160-build-statewide-destination-integration.mjs'],{stdio:'pipe'});
  assert.deepEqual(snapshot(),before);
  assert.deepEqual({pkg:sha('package.json'), lp159:sha('data/lp159/destination-source-selection.json'), runtime:sha('data/roadway-runtime-manifest.json')},protectedBefore);
});

test('LP160 fails closed when approved source evidence is unavailable',()=>{
  const unavailable=buildArtifacts({sourcePath:'data/source/lp160/missing-source.json'});
  assert.equal(unavailable[P.final].classification,'SOURCE_UNAVAILABLE');
  assert.equal(unavailable[P.summary].sourceUnavailable,true);
});
