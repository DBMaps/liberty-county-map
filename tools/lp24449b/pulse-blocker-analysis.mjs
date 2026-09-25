import {read,write,out} from './inventory.mjs';
const files=['pulse-statewide','pulse-sequence-diagnostic','pulse-writer-diagnostic'];
const runs=files.map(file=>({file:`${file}.json`,...read(`reports/lp24449b/${file}.json`)}));
const findings=runs.flatMap(run=>run.records.filter(row=>!row.pass).map(row=>({
 code:'PULSE_PUBLISHED_COUNT_STALE_AFTER_CLEAR',county_id:row.county_id,place_geoid:row.place_geoid,community:row.community_name,
 evidence:run.file,checks:row.checks,immediateCount:row.cleared?.published,settledCount:row.settled?.published,
 visible:row.settled?.dom,groupedCount:row.settled?.groupedSnapshot?.active.length,markerCount:row.settled?.markers.length,
 governedConsumerRows:Object.fromEntries(Object.entries(row.model?.rows||{}).map(([name,rows])=>[name,rows.length])),
 timing:row.timing?.map(sample=>({ms:sample.ms,count:sample.published})),writerDiagnostic:row.diagnostic||null
 })));
const isolated=read('reports/lp24449b/pulse-diagnostic-current.json');
write(`${out}/pulse-blocker-analysis.json`,{
 decision:'HOLD',classification:'E/H candidate: stale retained candidate/shared publication defect; upstream candidate origin and safe repair are not yet unambiguously established.',
 currentFindings:findings,runs:runs.map(run=>({file:run.file,count:run.records.length,passed:run.records.filter(row=>row.pass).length,failed:run.records.filter(row=>!row.pass).length})),
 isolated:{completed:isolated.records.length,converged:isolated.records.filter(row=>row.immediate.count===0&&row.settled.count===0).length,execution:isolated.execution},
 observed:'Primary run: Conroe. Independent timed sequence: Bowie, count 1 through 2000 ms. Writer-instrumented sequence: Alamo Heights, newly built lightweight/Pulse model and shared summary all retain count 1 while raw hazards, grouped incidents, governed consumer rows and markers are empty. Visible Pulse/Location copy is cleared.',
 firstDivergence:'refreshReportHazardViews -> refreshGridlyCommunityPulseSharedModel -> buildGridlyCommunityPulseModel/buildGridlyLightweightActiveAwareness -> published activeAwareness count; subsequent shared-model reuse republishes the stale count.',
 unknown:'The stale candidate provenance and minimum correction preserving retained active reports during unavailable/loading providers remain unproven. No claim that the old ten observations were merely test/timing artifacts.',
 repairPerformed:false,reasonNotPatched:'User requires unambiguous Pulse RCA before a product patch. Broad invalidation or overriding counts would risk masking active evidence and is not justified by these traces.',
 originalWitnesses:'Ten original baseline and repaired-source isolated/timed replays converge. Their closure classification remains STILL_FAIL because the same family reproduces in statewide sequence; replay observation success is reported separately.',
 noCommit:true
});
console.log(JSON.stringify({decision:'HOLD',findings:findings.map(r=>({county:r.county_id,place:r.place_geoid})),isolated:isolated.records.length}));
