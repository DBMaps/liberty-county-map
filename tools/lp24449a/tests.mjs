import fs from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {root,out,artifacts,write} from './inventory.mjs';
const files=[
 'lp0517-statewide-governed-manual-apply.test.mjs','lp196-multi-county-place-identity-resolution.test.mjs',
 'lp2171-multi-county-result-selection-identity.test.mjs','lp217-canonical-multi-county-authority.test.mjs',
 'lp240x1-governed-home-identity-repair.test.mjs','lp2419-home-area-selection-simplification.test.mjs',
 'multi-county-exit-transition.test.mjs','shared-multi-county-operational-ownership.test.mjs',
 'lp2445-bare-texas-place-destination.test.mjs','lp2445-saved-address-integrity.test.mjs',
 'lp2447-saved-place-revalidation-ownership.test.mjs','lp244-native-poi-and-saved-place-closure.test.mjs',
 'lp2413-weather-startup-authority.test.cjs','lp2401g2-safe-startup-weather.test.cjs',
 'lp24428-weather-kbyg-consistency.test.mjs','lp24445-unified-awareness-context.test.cjs',
 'lp24445a-temporary-context-controls.test.cjs','lp24445b-repeated-search-map-focus.test.cjs',
 'lp24448h1-freeze-closure.test.cjs','lp24448h-freeze-presentation.test.cjs',
 'lp24448f2-map-visibility.test.cjs','lp24448f1-functional-closure.test.cjs',
 'lp24448a-local-test-reports.test.cjs','lp24447-marker-system.test.cjs',
 'statewide-home-area-map-focus.test.mjs','statewide-county-mode-context-ownership.test.mjs',
 'statewide-consumer-community-runtime-parity.test.mjs','lp239-statewide-place-membership-certification.test.mjs',
 'lp2022-statewide-active-county-runtime-synchronization.test.mjs','lp214-statewide-crossing-runtime-repair.test.mjs'
].map(f=>'tests/'+f);
const result={files,runs:[],baselinePolicy:'Captured starting app with original starting-HEAD versions of updated test fixtures'};
const updatedFixtures=new Set(['tests/lp196-multi-county-place-identity-resolution.test.mjs','tests/multi-county-exit-transition.test.mjs','tests/lp24445-unified-awareness-context.test.cjs']);
fs.mkdirSync(`${artifacts}/baseline-tests`,{recursive:true});
const baselineFiles=files.map(file=>{
 if(!updatedFixtures.has(file))return file;
 let source=execFileSync('git',['show',`02fe47fd1b76a4bd52d8f8487a96cdc8e5c804e8:${file}`],{cwd:root,encoding:'utf8'});
 const originalUrl=pathToFileURL(path.join(root,file)).href;
 source=source.replace(/from (['"])(\.\.[^'"]+)\1/g,(_,quote,spec)=>`from ${quote}${new URL(spec,originalUrl).href}${quote}`).replaceAll('import.meta.url',JSON.stringify(originalUrl));
 const target=`${artifacts}/baseline-tests/${path.basename(file)}`;fs.writeFileSync(target,source);return target;
});
for(const baseline of [false,true]){
 const args=[...(baseline?['--require','./tools/lp24449a/baseline-test-loader.cjs']:[]),'--test','--test-concurrency=2',...(baseline?baselineFiles:[...files,'tests/lp24449a-home-cache.test.cjs','tests/lp24449a-search-publication.test.cjs','tests/lp24449a-canonical-home-resolution-cache.test.cjs'])];
 const run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:100*1024*1024});
 const log=run.stdout+'\n'+run.stderr;
 fs.writeFileSync(`${artifacts}/${baseline?'baseline':'repaired'}-suite.log`,log);
 result.runs.push({baseline,status:run.status,error:run.error?.message,summary:log.split('\n').filter(l=>/^ℹ (tests|suites|pass|fail|cancelled|skipped|duration)/.test(l)),failures:log.split('\n').filter(l=>/^✖ /.test(l))});
 write(`${out}/test-comparison.json`,result);
 console.log(JSON.stringify(result.runs.at(-1)));
}
