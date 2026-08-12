import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url)));
const contract = read('reports/lp18812/wave0-remaining-fixture-contract.json');
const expectedAssertions = ['CERTIFIED_ARTIFACT_STABILITY','COUNTY_BOUNDARY_ISOLATION','CONSUMER_RESULT_STABILITY','FALLBACK_BEHAVIOR_STABILITY','ROUTE_AWARENESS_STABILITY'];

function polygons(geometry) { return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates; }
function pointInRing([x,y], ring) { let inside=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++) { const [xi,yi]=ring[i], [xj,yj]=ring[j]; if (((yi>y)!==(yj>y)) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside; } return inside; }
function pointInGeometry(point, geometry) { return polygons(geometry).some(poly => pointInRing(point,poly[0]) && !poly.slice(1).some(ring=>pointInRing(point,ring))); }
function geometry(file) { return read(file).features[0].geometry; }

test('design preserves immutable owner state and has no execution evidence',()=>{
  assert.equal(contract.milestone,'LP188.12'); assert.equal(contract.designOnly,true); assert.equal(contract.ownerExecutionEvidenceCreated,false);
  assert.equal(contract.authoritativeOwnerState.wave0Result,'PENDING'); assert.deepEqual(contract.authoritativeOwnerState.completedWave0Assertions,['OPERATIONAL_COUNTY_RESULT_STABILITY']);
  assert.deepEqual(contract.authoritativeOwnerState.missingWave0Assertions,expectedAssertions);
  assert.equal(contract.controls.operationalJourneyMustNotRerun,true); assert.equal(contract.controls.operationalCountyCount,28); assert.equal(contract.controls.restrictionCount,11);
});

test('every fixture has the governed contract fields and exact family counts',()=>{
  assert.deepEqual(contract.fixtureCountByAssertion,{CERTIFIED_ARTIFACT_STABILITY:28,COUNTY_BOUNDARY_ISOLATION:4,CONSUMER_RESULT_STABILITY:28,FALLBACK_BEHAVIOR_STABILITY:1,ROUTE_AWARENESS_STABILITY:1});
  for (const fixture of contract.fixtures) for (const field of ['assertionId','fixtureId','input','expectedResult','prohibitedResult','applicableFips','authoritativeSource','executionMechanism','browserRequired','evidenceFieldsRequired']) assert.ok(fixture[field] !== undefined, `${fixture.fixtureId}.${field}`);
  assert.equal(new Set(contract.fixtures.map(x=>x.fixtureId)).size,contract.fixtures.length);
  assert.equal(contract.fixtures.some(x=>x.assertionId==='OPERATIONAL_COUNTY_RESULT_STABILITY'),false);
});

test('artifact authority binds every protected URL to both length and SHA-256',()=>{
  const prior=read('reports/lp18811f4/wave0-fixture-authority.json').priorFixtures.filter(x=>x.assertionId==='CERTIFIED_ARTIFACT_STABILITY');
  const fixtures=contract.fixtures.filter(x=>x.assertionId==='CERTIFIED_ARTIFACT_STABILITY');
  assert.equal(fixtures.length,28);
  for(const fixture of fixtures){ const source=prior.find(x=>x.fixtureId===fixture.fixtureId); assert.ok(source); assert.equal(fixture.input.protectedRelativeUrl,`/${source.input.relativeUrl}`); assert.equal(fixture.expectedResult.byteLength,source.expectedResult.byteLength); assert.equal(fixture.expectedResult.sha256,source.expectedResult.sha256); assert.match(fixture.expectedResult.sha256,/^sha256:[a-f0-9]{64}$/); assert.equal(fixture.browserRequired,false); }
});

test('boundary offsets are interior to expected county and outside the prohibited adjacent county',()=>{
  const files={48291:'Gridly-Source-Data/Census/liberty-county-2025-wgs84.geojson',48199:'Gridly-Source-Data/Census/hardin-county-2025-wgs84.geojson',48071:'Gridly-Source-Data/Census/chambers-county-2025-wgs84.geojson'};
  for(const fixture of contract.fixtures.filter(x=>x.assertionId==='COUNTY_BOUNDARY_ISOLATION')) { const p=[fixture.input.coordinate.longitude,fixture.input.coordinate.latitude], expected=fixture.expectedResult.resolvedCountyFips, prohibited=fixture.prohibitedResult.resolvedCountyFips; assert.equal(pointInGeometry(p,geometry(files[expected])),true,fixture.fixtureId); assert.equal(pointInGeometry(p,geometry(files[prohibited])),false,fixture.fixtureId); assert.notDeepEqual(p,fixture.input.sharedBoundaryCoordinate); }
});

test('consumer and fallback fixtures are resolve-only and prohibit substitution',()=>{
  const consumers=contract.fixtures.filter(x=>x.assertionId==='CONSUMER_RESULT_STABILITY'); assert.equal(consumers.length,28); assert.equal(new Set(consumers.map(x=>x.expectedResult.consumerCountyFips)).size,28);
  for(const fixture of consumers){ assert.match(fixture.input.surface,/resolve only/i); assert.equal(fixture.prohibitedResult.applyCountySelection,true); assert.equal(fixture.prohibitedResult.nearbyCountySubstitution,true); }
  const fallback=contract.fixtures.find(x=>x.assertionId==='FALLBACK_BEHAVIOR_STABILITY'); assert.equal(fallback.input.query,'00000'); assert.equal(fallback.expectedResult.status,'manual_fallback'); assert.equal(fallback.prohibitedResult.countySubstitution,true);
});

test('route fixture keeps route relevance separate from awareness and execution stays minimal',()=>{
  const route=contract.fixtures.find(x=>x.assertionId==='ROUTE_AWARENESS_STABILITY'); assert.deepEqual(route.expectedResult.routeRelevantIncidentIds,['goodrich-road-closed']); assert.deepEqual(route.expectedResult.routeIrrelevantIncidentIds,['remote-community']); assert.equal(route.expectedResult.awarenessAreaUnchanged,true); assert.equal(route.prohibitedResult.externalProviderRequired,true);
  assert.equal(contract.executionPlan.futureOwnerExecutionCount,2); assert.deepEqual(contract.executionPlan.executions.map(x=>x.timeoutBudgetMs),[120000,300000]); assert.deepEqual(contract.executionPlan.executions[1].viewport,{width:390,height:844});
  assert.match(contract.reconciliation.preserveAssertionOutcome,/wave0-owner-execution-migration\.json/); assert.match(contract.reconciliation.wave0PassRule,/All six owned families/);
});
