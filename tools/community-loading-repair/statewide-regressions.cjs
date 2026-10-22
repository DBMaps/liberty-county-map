// Sequential non-release test gate. Run apart from timed browser cohorts.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const BASE='faac47368da3137b50d53813b7f0299a2f4b1830';
const dir=path.resolve(process.env.STATEWIDE_OUTPUT_DIR||'.artifacts/community-loading-statewide'),mode=process.argv[2]||'combined',testDir=path.join(dir,mode+'-tests');fs.mkdirSync(testDir,{recursive:true});
const execute=(name,args)=>{const result=cp.spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,REPAIR_BASELINE_REF:BASE,REPAIR_OUTPUT_DIR:testDir,STATEWIDE_OUTPUT_DIR:testDir},timeout:600000});const output=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(path.join(testDir,name+'.tap'),output);const count=key=>Number(output.match(new RegExp('^# '+key+' (\\d+)','m'))?.[1]);const row={name,status:result.status,tests:count('tests'),pass:count('pass'),fail:count('fail'),failures:[...output.matchAll(/^not ok \d+ - (.*)$/gm)].map(m=>m[1])};console.log(JSON.stringify(row));return row;};
const rows=[];
for(const phase of ['before','after'])for(const suite of ['investigation','expanded']){
 const result=cp.spawnSync(process.execPath,[path.join(__dirname,'run-tests.cjs'),phase,suite],{encoding:'utf8',maxBuffer:64*1024*1024,env:{...process.env,REPAIR_BASELINE_REF:BASE,REPAIR_OUTPUT_DIR:testDir},timeout:600000});console.log(result.stdout||result.stderr);
 const output=fs.readFileSync(path.join(testDir,phase+'-'+suite+'.tap'),'utf8'),count=key=>Number(output.match(new RegExp('^# '+key+' (\\d+)','m'))?.[1]);rows.push({name:phase+'-'+suite,status:result.status,tests:count('tests'),pass:count('pass'),fail:count('fail'),failures:[...output.matchAll(/^not ok \d+ - (.*)$/gm)].map(m=>m[1])});
}
const testArgs=['--test','--test-reporter=tap'];
rows.push(execute('focused',[...testArgs,'tests/community-loading-performance-repair.test.cjs','tests/community-loading-production-integration.test.cjs',...(mode==='combined'?['tests/community-loading-nws-safety.test.cjs']:[])]));
rows.push(execute('statewide',[...testArgs,'tests/community-loading-statewide.test.cjs',...(mode==='combined'?['tests/community-loading-statewide-nws.test.cjs']:[])]));
rows.push(execute('paid-authority',[...testArgs,'tests/lp24461-subscription-entitlement.test.mjs','tests/lp24463-apple-storekit.test.mjs','tests/lp24465-continuity.test.mjs','tests/lp24465-paid-access.test.mjs','tests/lp24466s-apple-node.test.mjs','tests/paid-report-authorization.test.mjs']));
rows.push(execute('paid-browser',[...testArgs,'tests/android-paid-startup.test.mjs','tests/android-production12-subscription.test.mjs','tests/lp24465-paid-startup-browser.test.mjs']));
const authority=['tests/lp239-crossing-statewide-certification.test.mjs','tests/lp239-san-antonio-multi-county-consumer-convergence.test.mjs','tests/lp214-drivetexas-statewide-community-certification.test.mjs','tests/lp2021-statewide-crossing-runtime-source-resolution.test.mjs','tests/lp2022-statewide-crossing-awareness-ownership-repair.test.mjs','tests/lp220-statewide-crossing-viewport-eligibility.test.mjs'];
for(const phase of ['before','after'])rows.push(execute(phase+'-statewide-authority',[...(phase==='before'?['--require',path.join(__dirname,'baseline-source.cjs')]:[]),...testArgs,...authority]));
fs.writeFileSync(path.join(testDir,'summary.json'),JSON.stringify({date:new Date().toISOString(),mode,baselineRef:BASE,head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),shippingSources:Object.fromEntries(['js/app.js','js/gridlyWeatherLiveConnector.js','js/gridlyWeatherAuthoritySourceIntegration.js','js/gridlyAlertsWeatherAuthorityHandoff.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),rows},null,2));
const failures=[];
for(const row of rows)if(!Number.isSafeInteger(row.tests)||row.tests<=0||row.pass+row.fail!==row.tests||row.status===null)failures.push(row.name+': invalid/incomplete test run');
for(const phase of ['before','after'])for(const[suite,count,failed]of [['investigation',339,0],['expanded',107,1]]){const row=rows.find(row=>row.name===phase+'-'+suite);if(row.tests!==count||row.fail!==failed||row.pass!==count-failed)failures.push(row.name+': differs from certified integration totals');if(failed&&!(row.failures.length===1&&/^LP241\.8C generic artifact contains every local deployed-entrypoint reference$/.test(row.failures[0])))failures.push(row.name+': differs from the known generic web baseline failure');}
for(const[name,count]of [['focused',mode==='combined'?56:34],['statewide',mode==='combined'?2:1],['paid-authority',87],['paid-browser',21],['before-statewide-authority',37],['after-statewide-authority',37]])if(rows.find(row=>row.name===name)?.tests!==count)failures.push(name+': unexpected test count');
for(const row of rows.filter(row=>row.name.endsWith('-statewide-authority')))if(row.fail!==0||row.status!==0)failures.push(row.name+': authority contracts must pass');
for(const suite of ['investigation','expanded','statewide-authority']){
 const b=rows.find(row=>row.name==='before-'+suite),a=rows.find(row=>row.name==='after-'+suite);if(JSON.stringify(a.failures)!==JSON.stringify(b.failures))failures.push(suite+': new/different failure');
}
for(const row of rows.filter(row=>!/^before-|^after-/.test(row.name)))if(row.fail!==0||row.status!==0)failures.push(row.name+': failed');
if(failures.length){console.error(failures.join('\n'));process.exitCode=1;}
