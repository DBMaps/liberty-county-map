import fs from 'node:fs';import {spawnSync} from 'node:child_process';
// Run only when a browser-worker slot is free. The initial record is retained
// in JSONL; this retry appends a full save/reload/Search/Return transaction.
fs.copyFileSync('reports/lp24449b/home-browser-results-0.json','.artifacts/lp24449b/home-before-weather-completion-retry.json');
const args=['tools/lp24449b/home-browser.mjs','--shard=0/2','--only=harris-tx|4877956','--force','--await-weather'];
const startedAt=new Date().toISOString(),run=spawnSync(process.execPath,args,{stdio:'inherit'});
fs.writeFileSync('reports/lp24449b/home-weather-completion-retry.json',JSON.stringify({membership:'harris-tx|4877956',reason:'Original Return Home snapshot recorded correct-place requestInFlight=true and pointsRequestAttempted=true, but requestAttempted=false before acquisition completed; full transaction repeated with explicit controlled-weather completion wait.',startedAt,finishedAt:new Date().toISOString(),exitCode:run.status,args},null,2)+'\n');
process.exitCode=run.status||0;
