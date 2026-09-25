import fs from 'node:fs';
import {spawn} from 'node:child_process';
const slot=Number(process.argv[2]),dir='.artifacts/lp24449b1',log=`${dir}/queue-${slot}.jsonl`;
const record=value=>fs.appendFileSync(log,JSON.stringify({at:new Date().toISOString(),...value})+'\n');
async function waitFile(file){while(!fs.existsSync(file))await new Promise(r=>setTimeout(r,5000));}
async function run(name,args=[],env={}){record({name,args,status:'started'});const output=fs.openSync(`${dir}/queue-${slot}-${name}.log`,'a');const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[`tools/lp24449b1/${name}`,...args],{stdio:['ignore',output,output],env:{...process.env,...env}});child.on('error',reject);child.on('exit',resolve);});fs.closeSync(output);record({name,args,status:'finished',code});console.log(JSON.stringify({slot,name,code}));if(code!==0)throw Error(`${name} failed: ${code}`);}
if(slot===0){
 await waitFile('reports/lp24449b1/home-browser-results-0.json');
 for(const name of ['search.mjs','profiles.mjs','visible-search.mjs','label-baseline.mjs','home-read-performance.mjs'])await run(name);
}else{
 await waitFile('reports/lp24449b1/active-clear-statewide.json');
 const active=JSON.parse(fs.readFileSync('reports/lp24449b1/active-clear-statewide.json'));if(active.passed!==254)throw Error('Statewide clear gate failed');
 await run('home-browser.mjs',['--shard=1/2','--await-weather']);
 await run('baseline-replay.mjs',['--current','--pulse']);
 await run('original-ten-provenance.mjs');
 await run('control-group.mjs');
 await run('provider-matrix.mjs');
 for(const shard of ['0/2','1/2'])await run('transitions.mjs',[`--shard=${shard}`]);
 for(const name of ['contracts.mjs','nueces-baseline.mjs','filter-lifecycle.mjs','rail-lifecycle.mjs','freeze-three-hazards.mjs','freeze-verify-settings.cjs','freeze-geometry.cjs','freeze-saved-places.mjs','freeze-clear-compare.cjs','text-size-baseline.mjs','ui-messages.mjs','weather-tests.mjs'])await run(name);
 for(const width of [320,360,390,440])await run('freeze-verify-browser.cjs',[],{GRIDLY_H1_WIDTH:String(width),GRIDLY_49A_COMBINED_ONLY:'1'});
}
record({status:'complete'});
