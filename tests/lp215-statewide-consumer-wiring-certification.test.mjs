import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCertification } from '../tools/lp215/build-statewide-consumer-wiring-certification.mjs';

const committed=JSON.parse(fs.readFileSync('reports/lp215/statewide-consumer-wiring-certification.json','utf8'));
test('LP215 evaluates exactly one deterministic governed representative in all 254 counties',()=>{
 const result=buildCertification();
 assert.equal(result.rows.length,254); assert.equal(new Set(result.rows.map(x=>x.countyFips)).size,254);
 assert.deepEqual(result.rows.map(x=>x.canonicalKey),committed.rows.map(x=>x.canonicalKey));
 assert.ok(result.rows.every(x=>x.selectionClassification==='CANONICAL_PLACE'));
 assert.ok(result.rows.every(x=>x.contextPass&&x.roadwayPass&&x.repositoryWiringPass));
});
test('LP215 fails closed rather than converting unexecuted live evidence to healthy empty',()=>{
 for(const row of committed.rows){assert.equal(row.driveTexasHealth,'NOT_STARTED');assert.equal(row.driveTexasPass,false);assert.equal(row.alertsPass,false);assert.equal(row.railPass,false);assert.equal(row.staleStatePass,false);assert.equal(row.overallPass,false);}
 assert.equal(committed.summary.overall.fail,254); assert.equal(committed.certificationBoundary.liveSourceCertified,false);
});
test('Fredericksburg proves authoritative Gillespie rail empty without claiming presentation parity',()=>{
 const row=committed.fredericksburgControl;
 assert.equal(row.representativeCommunity,'Fredericksburg');assert.equal(row.placeGeoid,'4827348');
 assert.equal(row.railManifestStatus,'ACTIVE_EMPTY');assert.equal(row.railGovernedCount,0);assert.equal(row.railRepositoryStatus,'RAIL_EXPECTED_EMPTY');assert.equal(row.railPass,false);
 assert.equal(row.roadwayStatus,'ROADWAY_WITH_DATA');assert.equal(row.roadwayFeatureCount,3725);
});
