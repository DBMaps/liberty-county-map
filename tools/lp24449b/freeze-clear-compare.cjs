const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const result={purpose:'Compare the historical crossing-clear timeout on starting and repaired source; no LP244.49B repair or live-provider certification.',runs:[]};
for(const baseline of [true,false]){
 const run=spawnSync(process.execPath,['tools/lp24449b/freeze-verify-browser.cjs'],{env:{...process.env,GRIDLY_49A_BASELINE:baseline?'1':'0',GRIDLY_49A_CLEAR_ONLY:'1',GRIDLY_49A_COMBINED_ONLY:'0'},encoding:'utf8',maxBuffer:10*1024*1024});
 fs.writeFileSync(`.artifacts/lp24449b/freeze-clear-${baseline?'baseline':'repaired'}.log`,run.stdout+'\n'+run.stderr);
 const evidence=JSON.parse(fs.readFileSync(`.artifacts/lp24449b/freeze-clear-${baseline?'baseline':'repaired'}/browser-390.json`));
 result.runs.push({baseline,exitCode:run.status,sourceHash:evidence.sourceHash,passed:evidence.passed===true,completedStates:evidence.matrix?.map(s=>s.label),failure:evidence.failure});
 console.log(JSON.stringify(result.runs.at(-1)));
}
result.newFailure=result.runs[0].passed&&!result.runs[1].passed;
result.sameFailure=result.runs.every(r=>!r.passed)&&JSON.stringify(result.runs[0].completedStates)===JSON.stringify(result.runs[1].completedStates)&&result.runs[0].failure?.split('\n')[0]===result.runs[1].failure?.split('\n')[0];
result.classification=result.runs.every(r=>r.passed)?'BOTH_PASS_ON_REPLAY':result.runs.every(r=>!r.passed)?'BOTH_FAIL_IN_HISTORICAL_HARNESS':result.newFailure?'REPAIRED_ONLY_FAILURE':'BASELINE_ONLY_FAILURE';
result.comparisonPass=result.runs[1].passed||result.sameFailure;
fs.writeFileSync('reports/lp24449b/freeze-clear-comparison.json',JSON.stringify(result,null,2)+'\n');
if(!result.comparisonPass)process.exitCode=1;
