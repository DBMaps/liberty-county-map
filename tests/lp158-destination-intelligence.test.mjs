import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CATEGORY_FAMILIES, P, buildArtifacts, norm, verify } from '../tools/lp158-build-destination-intelligence.mjs';
const artifacts=buildArtifacts();
const registry=JSON.parse(readFileSync(P.registry,'utf8'));
const search=JSON.parse(readFileSync(P.search,'utf8'));
const routing=JSON.parse(readFileSync(P.routing,'utf8'));
const community=JSON.parse(readFileSync(P.community,'utf8'));
const context=JSON.parse(readFileSync(P.context,'utf8'));
const quality=JSON.parse(readFileSync(P.quality,'utf8'));
const coverage=JSON.parse(readFileSync(P.coverage,'utf8'));
function sha(path){return createHash('sha256').update(readFileSync(path)).digest('hex')}
function snapshot(){return Object.fromEntries(Object.values(P).map(path=>[path,sha(path)]))}
test('LP158 produces governed destination deliverables without activation or protected infrastructure changes',()=>{assert.deepEqual(artifacts.registry,registry); assert.equal(registry.milestone,'LP158'); assert.equal(registry.performsRuntimeChange,false); assert.equal(registry.performsDeploymentChange,false); assert.equal(registry.performsActivationChange,false); assert.equal(registry.rebuildsCertifiedPackages,false); assert.equal(registry.protectedInfrastructureModified,false); assert.deepEqual(registry.categoryFamilies,CATEGORY_FAMILIES)});
test('LP158 registry covers all 254 Texas counties and required category families',()=>{assert.equal(coverage.texasCountyCoverageComplete,true); assert.equal(coverage.countyCount,254); assert.equal(community.countyCount,254); for(const c of CATEGORY_FAMILIES) assert.ok(registry.destinations.some(d=>d.category===c),c); assert.equal(quality.categoryFilteringPass,true)});
test('LP158 destinations have deterministic identity, valid coordinates, and community resolution',()=>{assert.equal(new Set(registry.destinations.map(d=>d.id)).size,registry.destinations.length); assert.deepEqual(quality.duplicateIds,[]); assert.deepEqual(quality.invalidCoordinates,[]); for(const d of registry.destinations){assert.equal(d.deterministicIdentity,`tx-destination:${d.id}`); assert.match(d.countyFips,/^48\d{3}$/); assert.equal(d.state,'Texas'); assert.ok(d.community); assert.ok(d.coordinates.lat>=25&&d.coordinates.lat<=37,d.id); assert.ok(d.coordinates.lon>=-107&&d.coordinates.lon<=-93,d.id)}});
test('LP158 satisfies consumer search expectations and aliases',()=>{assert.ok(search.consumerExpectations.every(row=>row.status==='PASS')); const tokens=new Map(); for(const d of registry.destinations) for(const t of d.searchTokens) tokens.set(norm(t),d.id); assert.equal(tokens.get('heb'),'heb-temple-48027'); assert.equal(tokens.get('tamu'),'texas-am-college-station-48041'); assert.equal(tokens.get('iah'),'iah-houston-48201'); assert.equal(tokens.get('cfa'),'chick-fil-a-college-station-48041'); assert.equal(quality.aliasResolutionPass,true)});
test('LP158 verifies routing, favorites, Route Watch, awareness, and notification context',()=>{assert.equal(routing.status,'PASS'); assert.equal(routing.routingEligibleCount,routing.destinationCount); assert.equal(community.status,'PASS'); assert.equal(context.status,'PASS'); assert.ok(context.preferredNotificationExamples.some(x=>x.includes("Buc-ee's, Luling")))});
test('LP158 preserves Liberty benchmark and deterministic verification is read-only',()=>{assert.equal(quality.libertyBenchmark.status,'PASS'); assert.equal(quality.libertyBenchmark.unchangedBehavior,true); assert.ok(quality.libertyBenchmark.libertyDestinationIds.includes('walmart-liberty-48291')); const before=snapshot(); assert.deepEqual(verify(),coverage); execFileSync('node',['tools/lp158-build-destination-intelligence.mjs'],{stdio:'pipe'}); assert.deepEqual(snapshot(),before)});
