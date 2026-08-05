import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CONTROLLED_TEST_FIXTURE, manufactureLp1601jFromJsonl, validateLp1601jRecord, texasMembershipForPoint, assignLp1601jCounty, rejectLp1601jFalseResults, LP1601J_FAILURES } from '../tools/lp1601f-streaming-manufacture.mjs';

test('LP160.1J streams controlled JSONL through membership, counties, categories, community, dedupe, and reconciliation', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lp1601j-'));
  const file=join(dir,'CONTROLLED_TEST_FIXTURE.jsonl');
  await writeFile(file,[
    {id:`${CONTROLLED_TEST_FIXTURE}-liberty`,display_name:'Liberty Grocery',longitude:-94.8,latitude:30.05,primary_category:'grocery_store',source_locality:'Liberty',geometry_valid:true},
    {id:`${CONTROLLED_TEST_FIXTURE}-liberty`,display_name:'Liberty Grocery',longitude:-94.8,latitude:30.05,primary_category:'grocery_store',source_locality:'Liberty',geometry_valid:true},
    {id:`${CONTROLLED_TEST_FIXTURE}-houston-fuel`,display_name:'Houston Fuel',longitude:-95.36,latitude:29.76,primary_category:'gas_station',source_locality:'Houston',geometry_valid:true},
    {id:`${CONTROLLED_TEST_FIXTURE}-mx`,display_name:'Mexico TX Text',longitude:-100.3,latitude:25.9,primary_category:'restaurant',region:'TX',geometry_valid:true},
    {id:`${CONTROLLED_TEST_FIXTURE}-ok`,display_name:'Oklahoma TX Text',longitude:-97.5,latitude:35.47,primary_category:'restaurant',region:'TX',geometry_valid:true},
    {id:`${CONTROLLED_TEST_FIXTURE}-bad`,display_name:'Bad Coordinates',longitude:-95,latitude:99,primary_category:'hospital',geometry_valid:true}
  ].map(JSON.stringify).join('\n')+'\n');
  const artifacts=await manufactureLp1601jFromJsonl({stagingFile:file,write:false});
  const final=artifacts['reports/lp1601j/final-jsonl-county-manufacturing-assessment.json'];
  assert.equal(final.stagedRows,6);
  assert.equal(final.texasConfirmedRows,3);
  assert.equal(final.countyAssignedRows,3);
  assert.equal(final.retainedDestinations,2);
  assert.equal(final.duplicatesRemoved,1);
  assert.equal(artifacts['reports/lp1601j/end-to-end-manufacturing-reconciliation-report.json'].status,'PASS');
  assert.equal(artifacts['data/lp1601/texas-destination-candidate-registry-manifest.json'].counties.length,254);
  assert.equal(artifacts['reports/lp1601j/category-mapping-execution-report.json'].categoryTotals.Retail,1);
  assert.equal(artifacts['reports/lp1601j/category-mapping-execution-report.json'].categoryTotals.Fuel,1);
  assert.equal(artifacts['reports/lp1601j/community-association-execution-report.json'].methodTotals.SOURCE_PROVIDED,2);
  assert.equal(artifacts['reports/lp1601j/membership-processing-scale-report.json'].fullStagingStringCreated,false);
  assert.equal(artifacts['reports/lp1601j/membership-processing-scale-report.json'].statewideRecordArrayCreated,false);
});

test('LP160.1J coordinate and geometry membership guards reject text overrides',()=>{
  assert.equal(validateLp1601jRecord({id:'x',longitude:-95,latitude:99}).reason,'INVALID_COORDINATES');
  assert.equal(texasMembershipForPoint(-100.3,25.9),'OUTSIDE_TEXAS');
  assert.equal(texasMembershipForPoint(-97.5,35.47),'OUTSIDE_TEXAS');
  assert.equal(assignLp1601jCounty(-94.8,30.05).countyFips,'48291');
});

test('LP160.1J false manufacturing failures are explicit',()=>{
  assert.equal(rejectLp1601jFalseResults({stagedRows:10,texasMembershipExecuted:false}),LP1601J_FAILURES.texasNotExecuted);
  assert.equal(rejectLp1601jFalseResults({stagedRows:10,texasMembershipExecuted:true,governedExclusions:10,exclusionReasonRows:0}),LP1601J_FAILURES.placeholderExclusion);
  assert.equal(rejectLp1601jFalseResults({texasConfirmedRows:1,countyAssignmentExecuted:false}),LP1601J_FAILURES.countyNotExecuted);
  assert.equal(rejectLp1601jFalseResults({countyAssignedRows:1,candidateRows:0}),LP1601J_FAILURES.candidateNotExecuted);
  assert.equal(rejectLp1601jFalseResults({retainedDestinations:1,candidateRows:0}),LP1601J_FAILURES.candidateMismatch);
  assert.equal(rejectLp1601jFalseResults({ownerSourceRead:true,ownerStagingRead:true,lp1601iHasSourceUnavailable:true}),LP1601J_FAILURES.staleReports);
});
