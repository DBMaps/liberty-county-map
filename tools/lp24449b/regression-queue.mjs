import fs from 'node:fs';import {spawn} from 'node:child_process';
const shard=Number(process.argv.find(a=>a.startsWith('--shard='))?.split('=')[1]||0),root=process.cwd();
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const home=`reports/lp24449b/home-browser-results-${shard}.json`;
while(!fs.existsSync(home))await wait(1000);
await wait(3000);
const jobs=shard===0?[['search.mjs'],['transitions.mjs','--shard=0/2'],['profiles.mjs'],['visible-search.mjs'],['label-baseline.mjs'],['home-read-performance.mjs']]:[['transitions.mjs','--shard=1/2'],['contracts.mjs'],['provider-matrix.mjs'],['baseline-replay.mjs','--current','--pulse'],['freeze-three-hazards.mjs'],['freeze-verify-settings.cjs'],['freeze-geometry.cjs'],['freeze-saved-places.mjs'],['freeze-clear-compare.cjs'],['text-size-baseline.mjs']];
const output=`reports/lp24449b/queue-${shard}.json`,runs=[];
for(const job of jobs){const startedAt=new Date().toISOString();console.log(JSON.stringify({queue:shard,job,phase:'START'}));const log=fs.openSync(`.artifacts/lp24449b/queue-${shard}-${job[0]}.log`,'w');const child=spawn(process.execPath,[`tools/lp24449b/${job[0]}`,...job.slice(1)],{cwd:root,stdio:['ignore',log,log]});const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});fs.closeSync(log);runs.push({job,startedAt,finishedAt:new Date().toISOString(),exitCode:code});fs.writeFileSync(output,JSON.stringify({shard,runs,completed:runs.length===jobs.length},null,2)+'\n');console.log(JSON.stringify({queue:shard,job,phase:'END',exitCode:code}));}
