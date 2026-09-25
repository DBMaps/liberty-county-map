import fs from 'node:fs';import {spawn} from 'node:child_process';
const dir='.artifacts/lp24449b1',log=`${dir}/remaining-regressions.jsonl`;
const record=v=>fs.appendFileSync(log,JSON.stringify({at:new Date().toISOString(),...v})+'\n');
async function run(name,args=[],env={}){record({name,args,status:'started'});const output=fs.openSync(`${dir}/remaining-${name}.log`,'a');const code=await new Promise((resolve,reject)=>{const c=spawn(process.execPath,[`tools/lp24449b1/${name}`,...args],{stdio:['ignore',output,output],env:{...process.env,...env}});c.on('error',reject);c.on('exit',resolve);});fs.closeSync(output);record({name,args,status:'finished',code});console.log(JSON.stringify({name,code}));if(code!==0)throw Error(`${name} failed`);}
await run('control-group.mjs');
for(const name of ['generation-races.mjs','home-timeout-diagnostic.mjs','provider-matrix.mjs'])await run(name);
for(const shard of ['0/2','1/2'])await run('transitions.mjs',[`--shard=${shard}`]);
for(const name of ['contracts.mjs','nueces-baseline.mjs','filter-lifecycle.mjs','rail-lifecycle.mjs','freeze-three-hazards.mjs','freeze-verify-settings.cjs','freeze-geometry.cjs','freeze-saved-places.mjs','freeze-clear-compare.cjs','text-size-baseline.mjs','ui-messages.mjs','weather-tests.mjs'])await run(name);
for(const width of [320,360,390,440])await run('freeze-verify-browser.cjs',[],{GRIDLY_H1_WIDTH:String(width),GRIDLY_49A_COMBINED_ONLY:'1'});
record({status:'complete'});
