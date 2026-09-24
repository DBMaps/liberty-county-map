import fs from 'node:fs';
// Independent replay: preserve the original failed statewide result and JSONL.
let source=fs.readFileSync(new URL('./pulse-statewide.mjs',import.meta.url),'utf8');
source=source.replaceAll('pulse-statewide-progress','pulse-sequence-diagnostic-progress').replaceAll('/pulse-statewide.json','/pulse-sequence-diagnostic.json');
source=source.replace('const cleared=capture();await lp24449b.settle();const settled=capture(),model=lp24449b.snapshot();return {fixture,active,activeModel,cleared,settled,model};',
 'const cleared=capture();await lp24449b.settle();const settled=capture();const timing=[];if(cleared.published!==0||settled.published!==0){let previous=0;for(const ms of [100,250,500,1000,2000]){await new Promise(resolve=>setTimeout(resolve,ms-previous));previous=ms;timing.push({ms,...capture()});}}const model=lp24449b.snapshot();return {fixture,active,activeModel,cleared,settled,timing,model};');
if(!source.includes('timing.push'))throw Error('Diagnostic seam absent');
const generated=new URL('./pulse-sequence-diagnostic.generated.mjs',import.meta.url);
fs.writeFileSync(generated,source);
await import(generated.href);
