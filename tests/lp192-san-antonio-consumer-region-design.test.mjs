import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { outputs,run } from '../tools/lp192/build-san-antonio-consumer-region-design.mjs';

const report=JSON.parse(outputs()['reports/lp192/san-antonio-consumer-region-consolidation-design.json']);
test('governed inputs and holds are preserved',()=>{assert.equal(report.atomicUnitInventory.length,30);assert.equal(report.frameworkCounts.usableGovernedWorkingGeometries,29);assert.equal(report.farSouthwestHold.workingAuthorityGranted,false);assert.equal(report.farSouthwestHold.certifiedGeometricMembership,false);assert.equal(report.atomicUnitInventory.find(x=>x.name==='West Northwest').workingGeometryAuthority,'CERTIFIED_DERIVED_MAKEVALID');assert.deepEqual(report.farSouthwestHold.selectivePlaceHolds.map(x=>x.geoid),['4868708','4875764']);});
test('all independent places remain independent',()=>{const p=report.placeCdpPrecedencePolicy.places;assert.equal(p.length,33);assert.ok(p.every(x=>x.precedence==='INDEPENDENT_GOVERNED_PLACE_WINS'&&!x.consumerRegionMember));});
test('each option covers 29 eligible atomic units exactly once',()=>{const eligible=report.atomicUnitInventory.filter(x=>x.name!=='Far Southwest').map(x=>x.name).sort();for(const o of Object.values(report.options)){const actual=o.regions.flatMap(r=>r.atomicUnits).sort();assert.deepEqual(actual,eligible,o.optionId);assert.equal(new Set(actual).size,29);assert.ok(!actual.includes('Far Southwest'));}});
test('Option A has the exact owner-approved labels and unchanged memberships',()=>{assert.deepEqual(report.options.A.regions.map(({candidateConsumerLabel,atomicUnits})=>[candidateConsumerLabel,atomicUnits]),[
  ['Central San Antonio',['Downtown','Eastside','Midtown','Near North','Westside']],
  ['Medical Region',['Medical Center','Near Northwest','North Central']],
  ['Airport / Fort Sam',['Fort Sam Houston','Greater Airport Area','Near Northeast']],
  ['Stone Oak / Far North',['Far North','Stone Oak']],
  ['UTSA / Northwest',['Northwest','UTSA','West Northwest']],
  ['Far West / Alamo Ranch',['Far West','Highway 151 and Loop 1604']],
  ['Northeast San Antonio',['Far East','NE I-35 and Loop 410','Northeast','Rolling Oaks']],
  ['Southside / Brooks',['Brooks','Far South','South','Southeast','Texas AM - San Antonio']],
  ['Southwest / Port San Antonio',['Port San Antonio','Southwest']]
]);assert.equal(report.ownerDecision.atomicMemberships,'APPROVED_UNCHANGED_DO_NOT_REOPEN_OR_SPLIT');});
test('owner label governance and alternative selection are explicit',()=>{const a=report.options.A.regions;assert.equal(a.filter(x=>x.labelStatus==='OWNER_APPROVED_DESIGN_LABEL').length,8);assert.equal(a.find(x=>x.candidateConsumerLabel==='Airport / Fort Sam').labelStatus,'OWNER_APPROVED_PROVISIONAL_DESIGN_LABEL');assert.equal(report.ownerDecision.airportFortSamNamingStatus,'PROVISIONAL_LABEL_FINAL_RUNTIME_NAMING_REVIEW_ALLOWED');assert.equal(report.options.A.selectionStatus,'OWNER_APPROVED_RECOMMENDED_OPTION');assert.equal(report.options.B.selectionStatus,'EVALUATED_ALTERNATIVE_NOT_SELECTED');assert.equal(report.options.C.selectionStatus,'EVALUATED_ALTERNATIVE_NOT_SELECTED');});
test('design identifiers cannot be runtime identities',()=>{for(const o of Object.values(report.options))for(const r of o.regions){assert.equal(r.identifierClassification,'NON_RUNTIME_DESIGN_IDENTIFIER');assert.ok(!('runtimeId' in r));}assert.ok(report.prohibitedRuntimeClaims.includes('NO_RUNTIME_IDS'));});
test('recommended option and reports are deterministic',()=>{assert.equal(report.recommendedOption,'A');assert.equal(report.recommendedConsumerRegionCount,9);assert.equal(report.options.A.regions.length,9);assert.equal(report.ownerDecision.runtimeImplementationPerformed,false);assert.equal(report.overallStatus,'CONSUMER_REGION_CONSOLIDATION_DESIGN_OWNER_APPROVED_WITH_PROVISIONAL_NAMING_AND_FAR_SOUTHWEST_HOLD');assert.doesNotThrow(()=>run('verify'));assert.deepEqual(outputs(),outputs());});
test('hard-scope protected files are not changed by LP192 commit',()=>{const changed=execFileSync('git',['diff','--name-only','f7954cf6','--'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);const forbidden=[/^js\/app\.js$/,/(awareness|zip|search|semantic-camera)/i,/houston/i,/reports\/lp191\//,/san-antonio-west-northwest-derived-repair-certification/,/san-antonio-far-southwest-governance-hold/];for(const f of changed)assert.ok(!forbidden.some(x=>x.test(f)),`protected mutation: ${f}`);});
test('canonical markdown states design-only safety',()=>{const md=fs.readFileSync('reports/lp192/san-antonio-consumer-region-consolidation-design.md','utf8');assert.match(md,/does not activate any region/);assert.match(md,/PROVISIONAL_DESIGN_INTENT/);assert.match(md,/invalid topology was not used/);});
