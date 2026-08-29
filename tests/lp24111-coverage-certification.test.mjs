import test from 'node:test';
import assert from 'node:assert/strict';
import {artifacts} from '../tools/lp24111/manufacture.mjs';
import {haversineMiles,radiusCounts,metadataClassification,shardFanout,RURAL_TAIL,validateEnvelope} from '../tools/lp24111/coverage-certification.mjs';

test('D.4 governed inventories and fail-closed boundaries are preserved',()=>{
 const a=artifacts();
 assert.equal(a['county-coverage.json'].rows.length,254);
 assert.equal(a['community-radius-coverage.json'].rows.length,1859);
 assert.equal(a['governed-non-place-coverage.json'].expectedCount,29);
 assert.equal(a['governed-non-place-coverage.json'].tarkington.identityType,'GOVERNED_NON_PLACE');
 assert.equal(a['governed-non-place-coverage.json'].tarkington.placeGeoid,null);
 assert.equal(a['lp24110-cohort-reconciliation.json'].rows.length,22);
 assert.equal(RURAL_TAIL.length,15);
 assert.equal(a['metadata-conflicts.json'].retainedSample.classification,'SPATIAL_METADATA_CONFLICT');
 assert.equal(a['metadata-conflicts.json'].retainedSample.sourceRegion,'MO');
 assert.equal(a['attribution-source-inventory.json'].reviewState,'LEGAL_REVIEW_REQUIRED');
 assert.equal(a['osm-supplement-evaluation.json'].merged,false);
 assert.equal(a['certification.json'].productionPoiSearch,'NOT_LAUNCHED_NOT_CERTIFIED');
 assert.equal(a['certification.json'].executiveResult,'PHASE_D4_MEASUREMENT_INCOMPLETE');
});

test('radius, nearest category, metadata, and fanout calculations are deterministic',()=>{
 const anchor={latitude:30,longitude:-95},pois=[{latitude:30,longitude:-95,category:'FUEL'},{latitude:30.1,longitude:-95,category:'GROCERY'}];
 assert.equal(haversineMiles(anchor,anchor),0);
 assert.deepEqual(radiusCounts(anchor,pois,'FUEL'),{nearestMiles:0,within5:1,within10:1,within25:1});
 assert.equal(radiusCounts(anchor,pois,'GROCERY').nearestMiles,haversineMiles(anchor,pois[1]));
 assert.equal(metadataClassification({sourceRegion:'MO',sourceLocality:'Jefferson City',sourcePostcode:'65101-5032'}),'SPATIAL_METADATA_CONFLICT');
 assert.equal(shardFanout(anchor,25),shardFanout(anchor,25));
});

test('certification envelope fails closed when measurements are absent',()=>{
 const result=validateEnvelope({reports:{}});
 assert.equal(result.passed,false);
 assert.ok(Object.values(result.gates).some(value=>!value));
});
