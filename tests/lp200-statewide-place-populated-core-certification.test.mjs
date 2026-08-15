import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { build, outputs } from '../tools/lp200/build-statewide-place-populated-core-certification.mjs';

const d=build();
test('fails closed with exact governed inventory and provenance',()=>{assert.equal(d.classification,'NOT_READY_OWNER_GOVERNED_INPUT_REQUIRED');assert.equal(d.inventory.length,1859);assert.equal(d.inventory.reduce((n,x)=>n+x.countyMemberships.length,0),2058);assert.equal(new Set(d.inventory.map(x=>x.placeGeoid)).size,1859);assert.equal(d.coverage.ADDRESS_SIGNAL_UNAVAILABLE,1859);assert.ok(d.generatedFrom.manifest.sha256);});
test('multi-county identity is never label keyed or split',()=>{const x=d.inventory.find(x=>x.placeGeoid==='4819000');assert.equal(x.label,'Dallas');assert.deepEqual(x.countyMemberships,['48085','48113','48121','48257','48397']);assert.equal(d.inventory.filter(x=>x.placeGeoid==='4819000').length,1);});
test('algorithms, projection, grids, containment and fallback are explicit',()=>{assert.equal(d.algorithms.length,6);assert.ok(d.algorithms.every(x=>x.projection==='EPSG:3083'));assert.deepEqual(d.gridResolutionStudy.cellSizesMeters,[250,500,1000,2000]);assert.match(d.robustness.containment,/NOT_EVALUATED/);assert.match(d.fallbackModel,/EXISTING_CANONICAL_PLACE_CAMERA/);});
test('calibration, known-bad, small controls and Corpus Christi are preserved',()=>{assert.equal(d.calibration.truth.length,4);assert.equal(d.calibration.lp199Baseline.meanErrorMeters,4855.401);assert.equal(d.knownBadControls.length,5);assert.ok(d.smallPlaceControls.some(x=>x.label==='Marfa'));assert.equal(d.corpusChristiSearchFinding.repairIncluded,false);});
test('certification outputs are byte deterministic LF and candidate is absent',()=>{for(const [p,v] of Object.entries(outputs())){assert.equal(fs.readFileSync(p,'utf8'),v);assert.ok(!v.includes('\r'));}assert.equal(d.candidateArtifact.emitted,false);assert.equal(fs.existsSync(d.candidateArtifact.path),false);});
test('protected runtime surfaces are declared unchanged',()=>{for(const key of ['runtimeActivation','identityMutation','countyMembershipMutation','zipMutation','cameraRegistryMutation'])assert.equal(d.scope[key],false);});
