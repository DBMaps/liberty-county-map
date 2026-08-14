import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { build, outputs, run } from '../tools/lp195/build-texas-major-metro-consumer-coverage-audit.mjs';

const report=build();
const expected=['dallas-fort-worth','austin','el-paso','corpus-christi','laredo','rio-grande-valley','beaumont-port-arthur','killeen-temple'];

test('all eight minimum metro systems are audited exactly once',()=>{
  assert.equal(report.auditedMetroCount,8);
  assert.deepEqual(report.metros.map(x=>x.id),expected);
});

test('DFW, RGV, and Killeen–Temple are explicitly multi-city',()=>{
  for(const id of ['dallas-fort-worth','rio-grande-valley','killeen-temple'])assert.equal(report.metros.find(x=>x.id===id).multi,true);
  const dfw=report.metros[0];
  for(const city of ['Dallas','Fort Worth','Arlington','Plano','Irving','Garland','Grand Prairie','Frisco','McKinney','Denton'])assert.ok(dfw.governedIdentityInventory.places.some(x=>x.displayName===city),city);
});

test('independent PLACE precedence is preserved everywhere',()=>{
  assert.ok(report.scope.principles.includes('INDEPENDENT_GOVERNED_PLACE_WINS'));
  for(const metro of report.metros){
    assert.equal(metro.currentRuntimeBehavior.independentPlacePrecedence,'INDEPENDENT_GOVERNED_PLACE_WINS');
    assert.ok(metro.governedIdentityInventory.places.every(x=>x.canonicalIdentity==='PLACE_GEOID'));
  }
});

test('vocabularies are exact and every decision is valid',()=>{
  assert.deepEqual(report.vocabularies.classifications,['ADEQUATE_EXISTING_CONSUMER_GEOGRAPHY','ZIP_COMMUNITY_REGIONALIZATION_RECOMMENDED','MULTI_CITY_METRO_MODEL_REQUIRED','GEOMETRY_GOVERNANCE_REQUIRED','NO_REGIONALIZATION_NEEDED','OWNER_REVIEW_REQUIRED']);
  assert.deepEqual(report.vocabularies.implementationMethods,['EXISTING_RUNTIME_ALREADY_SUFFICIENT','ZIP_COMMUNITY_PROJECTION','ZIP_COMMUNITY_PROJECTION_WITH_PRESENTATION_REGIONS','MULTI_CITY_INDEPENDENT_PLACE_MODEL','GOVERNED_POLYGON_REGIONALIZATION','OWNER_PRODUCT_DECISION_REQUIRED']);
  assert.deepEqual(report.vocabularies.priorities,['P0','P1','P2','P3']);
  for(const m of report.metros){assert.ok(report.vocabularies.classifications.includes(m.classification));assert.ok(report.vocabularies.implementationMethods.includes(m.method));assert.ok(report.vocabularies.priorities.includes(m.priority));}
});

test('ZIP evidence is copied only from governed records',()=>{
  const governed=JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-zip-index-v1.json','utf8')).records;
  const byZip=new Map(governed.map(x=>[x.zip,x]));
  for(const m of report.metros)for(const rec of m.zipCommunityEvidence.records){assert.ok(byZip.has(rec.zip));for(const county of rec.countyCandidates)for(const c of county.communities)assert.ok(byZip.get(rec.zip).countyCandidates.some(x=>x.countyFips===county.countyFips&&x.communities.some(y=>y.placeGeoid===c.placeGeoid)));}
});

test('audit creates no runtime identity, mapping, geometry, or activation',()=>{
  assert.equal(report.scope.auditOnly,true);assert.equal(report.scope.runtimeMutation,false);assert.deepEqual(report.scope.newConsumerRegionIds,[]);assert.equal(report.scope.newMetroGeometry,false);
  const serialized=JSON.stringify(report);assert.ok(!serialized.includes('consumerRegionId'));assert.ok(report.metros.every(x=>x.currentRuntimeBehavior.consumerRegionMachinery==='NONE_FOR_THIS_METRO'));
});

test('reports are deterministic and final table is complete',()=>{
  assert.deepEqual(outputs(),outputs());assert.doesNotThrow(()=>run('verify'));assert.equal(report.decisionTable.length,8);
  const md=outputs()['reports/lp195/texas-major-metro-consumer-coverage-audit.md'];assert.match(md,/## Final decision table/);assert.match(md,/REPOSITORY-GOVERNED FACTS/);
});
