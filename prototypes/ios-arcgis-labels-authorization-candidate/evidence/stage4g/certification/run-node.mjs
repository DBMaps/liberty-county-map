import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const here=fileURLToPath(new URL('./',import.meta.url)),candidate=resolve(here,'../../..'),repo=resolve(candidate,'../..');
const output=resolve(process.env.GRIDLY_CERT_OUTPUT??resolve(here,'../local-results'));mkdirSync(output,{recursive:true});
const f=resolve(candidate,'evidence/stage4f/package'),guard=resolve(f,'tests/no-network.mjs'),root=JSON.parse(readFileSync(resolve(here,'root-source.json')));
const suites=[
 ['interface',78,0,['interface','timing','lease-commit','provider'].map(n=>resolve(f,'tests/'+n+'.test.mjs'))],
 ['protected',114,0,root.tests.map(p=>resolve(repo,p))],
 ['candidate',19,0,['server','preservation-and-reporting','certification-readiness'].map(n=>resolve(candidate,'tests/'+n+'.test.mjs'))],
 ['gateway',39,1,[resolve(candidate,'reference/prototypes/ios-arcgis-labels-gateway-deploy/edge.test.mjs'),resolve(candidate,'reference/prototypes/ios-arcgis-labels-live-candidate/foundation.test.mjs')]]
];
const summary=[];
for(const [name,passes,skips,files] of suites){
 const r=spawnSync(process.execPath,['--import',pathToFileURL(guard).href,'--test','--test-concurrency=1','--test-reporter=tap',...files],{cwd:repo,encoding:'utf8',maxBuffer:16e6,timeout:120000,windowsHide:true});
 const log=(r.stdout??'')+(r.stderr??'');writeFileSync(resolve(output,name+'.tap'),log);
 assert.equal(r.status,0,name+' failed; diagnostics retained');
 const value=k=>Number(log.match(new RegExp('^# '+k+' (\\d+)','m'))?.[1]);
 assert.equal(value('pass'),passes,name);assert.equal(value('fail'),0,name);assert.equal(value('skipped'),skips,name);assert.equal(value('cancelled'),0,name);
 summary.push({suite:name,pass:passes,fail:0,skip:skips});console.log('CERTIFIED_SUITE '+name+' PASS='+passes+' FAIL=0 SKIP='+skips);
}
writeFileSync(resolve(output,'node-summary.json'),JSON.stringify(summary,null,2)+'\n');

