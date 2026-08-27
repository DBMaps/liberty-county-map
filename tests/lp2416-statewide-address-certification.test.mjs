import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildPlan, buildProviderRequest, classifyProviderResult, executePlan, publicRequestContract, SafeStopError, summarizeProgress, verifyPlan} from '../tools/lp2416/statewide-address-certification.mjs';

const plan=buildPlan();
test('254 governed, unique, deterministic, privacy-safe county fixtures fail closed',()=>{assert.equal(verifyPlan(plan),true);assert.equal(new Set(plan.fixtures.map(x=>x.countyFips)).size,254);assert.ok(plan.fixtures.every(x=>x.countyName&&x.expectedCountyId&&x.queryStrategy==='GOVERNED_PUBLIC_COUNTY_COURTHOUSE'));assert.ok(plan.fixtures.every(x=>!/^\s*County Courthouse, Texas\s*$/i.test(x.privacySafeSeedQuery)));});
test('provider outcomes require valid coordinates and governed county identity',()=>{const row=plan.fixtures[0], base={providerBoundary:'gridly',ok:true,results:[{latitude:31.8,longitude:-95.5,address:{county:'Anderson County'}}]};assert.equal(classifyProviderResult(row,base),'PASS');assert.equal(classifyProviderResult(row,{...base,results:[{...base.results[0],address:{county:'Andrews County'}}]}),'WRONG_COUNTY');assert.equal(classifyProviderResult(row,{...base,results:[{...base.results[0],latitude:null}]}),'INVALID_COORDINATES');assert.equal(classifyProviderResult(row,{providerBoundary:'gridly',ok:false,status:'no_results',results:[]}),'NO_RESULT');assert.equal(classifyProviderResult(row,null),'PROVIDER_UNAVAILABLE');});
test('tracked artifacts agree, visual cohort is fixed, and every exception is surfaced',()=>{const tracked=JSON.parse(fs.readFileSync('LP241-STATEWIDE-ADDRESS-FIXTURE-PLAN.json'));assert.deepEqual(tracked,plan);const cohort=JSON.parse(fs.readFileSync('reports/lp2416/visual-cohort.json'));assert.equal(cohort.fixed,true);assert.equal(cohort.rows.length,12);assert.ok(cohort.rows.every(x=>x.riskClass));assert.deepEqual(cohort.rows.map(x=>x.countyFips),['48071','48073','48113','48141','48201','48229','48355','48375','48403','48439','48453','48465']);const ledger=JSON.parse(fs.readFileSync('reports/lp2416/exception-ledger.json'));assert.equal(ledger.count,254);assert.ok(ledger.exceptions.every(x=>x.classification==='NOT_EXECUTED'));});

test('owner runner matches the browser public request contract and supplies its browser origin context',()=>{
  const browser=fs.readFileSync('js/gridly-geocoding-client.js','utf8');
  assert.match(browser,new RegExp(publicRequestContract.endpoint.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(browser,new RegExp(publicRequestContract.publicKey.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  const request=buildProviderRequest(plan.fixtures[0]);
  assert.equal(request.init.method,'POST'); assert.equal(request.init.headers.Origin,'https://gridly.app');
  assert.equal(request.init.headers.apikey,publicRequestContract.publicKey); assert.equal(request.init.headers.Authorization,`Bearer ${publicRequestContract.publicKey}`);
  assert.equal(request.init.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(request.init.body),{intent:'address',query:plan.fixtures[0].privacySafeSeedQuery,limit:3,requestMode:'explicit_search',requestId:'lp2416-48001'});
});

for (const status of [401,403,500,503]) test(`HTTP ${status} safe-stops immediately and persists truth`,async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp2416-')),
    progressPath=path.join(dir,'progress.json'), fixtures=plan.fixtures.slice(0,2);
  let active=0,maxActive=0,calls=[];
  const stoppedFetch=async (_url,init)=>{active++;maxActive=Math.max(maxActive,active);calls.push(JSON.parse(init.body).requestId);active--;return new Response('{}',{status});};
  await assert.rejects(executePlan({fixtures},{fetchImpl:stoppedFetch,progressPath}),error=>error instanceof SafeStopError&&error.status===status&&error.countyFips==='48001');
  const stopped=JSON.parse(fs.readFileSync(progressPath));
  assert.equal(maxActive,1); assert.deepEqual(calls,['lp2416-48001']); assert.deepEqual(stopped.rows,[]);
  assert.deepEqual(stopped.safeStop,{countyFips:'48001',httpStatus:status,executionState:'NOT_EXECUTED',providerOutcome:'NOT_EXECUTED'});
  fs.rmSync(dir,{recursive:true,force:true});
});

const successResponse=row=>Response.json({providerBoundary:'gridly',ok:true,status:'success',results:[{latitude:31,longitude:-96,displayName:'governed result',address:{county:`${row.expectedCountyName} County`}}]});

for (const source of ['header','body']) test(`HTTP 429 honors provider retry interval from ${source}, saves first, retries once, and continues sequentially`,async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp2416-')), progressPath=path.join(dir,'progress.json'), fixtures=plan.fixtures.slice(0,2);
  const events=[]; let calls=0,active=0,maxActive=0;
  const fetchImpl=async (_url,init)=>{active++;maxActive=Math.max(maxActive,active);const id=JSON.parse(init.body).requestId;events.push(`fetch:${id}`);active--;calls++;
    if (calls===1) return source==='header' ? new Response(JSON.stringify({retryAfterSeconds:99}),{status:429,headers:{'Retry-After':'2'}}) : new Response(JSON.stringify({retryAfterSeconds:3}),{status:429});
    return successResponse(fixtures.find(row=>id.endsWith(row.countyFips)));
  };
  const result=await executePlan({fixtures},{fetchImpl,progressPath,safetyMarginSeconds:1,logImpl:message=>events.push(message),sleepImpl:async milliseconds=>{const saved=JSON.parse(fs.readFileSync(progressPath));assert.deepEqual(saved.rows,[]);assert.equal(saved.safeStop.countyFips,'48001');events.push(`sleep:${milliseconds}`);}});
  assert.equal(maxActive,1);assert.deepEqual(events.filter(x=>x.startsWith('fetch:')),['fetch:lp2416-48001','fetch:lp2416-48001','fetch:lp2416-48003']);
  assert.ok(events.includes(`sleep:${source==='header'?3000:4000}`));assert.match(events.find(x=>x.startsWith('RATE LIMITED:')),/county 48001; waiting [34] seconds before one retry/);
  assert.equal(result.rows.length,2);assert.equal(result.safeStop,undefined);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('a second 429 safe-stops without skipping or touching later counties',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp2416-')),progressPath=path.join(dir,'progress.json'),fixtures=plan.fixtures.slice(0,2),calls=[];
  const fetchImpl=async (_url,init)=>{calls.push(JSON.parse(init.body).requestId);return new Response(JSON.stringify({retryAfterSeconds:0}),{status:429});};
  await assert.rejects(executePlan({fixtures},{fetchImpl,progressPath,sleepImpl:async()=>{}}),error=>error instanceof SafeStopError&&error.status===429);
  const saved=JSON.parse(fs.readFileSync(progressPath));assert.deepEqual(calls,['lp2416-48001','lp2416-48001']);assert.deepEqual(saved.rows,[]);
  assert.deepEqual(saved.safeStop,{countyFips:'48001',httpStatus:429,executionState:'NOT_EXECUTED',providerOutcome:'NOT_EXECUTED'});
  fs.rmSync(dir,{recursive:true,force:true});
});

test('current 74-row progress resumes at Fayette 48149 without repeating completed calls',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp2416-')),progressPath=path.join(dir,'progress.json'),completed=plan.fixtures.slice(0,74);
  assert.equal(completed.at(-1).countyFips,'48147');assert.equal(plan.fixtures[74].countyFips,'48149');
  fs.writeFileSync(progressPath,JSON.stringify({rows:completed.map(row=>({...row,executionState:'PROVIDER_EXECUTED',providerOutcome:'PASS'}))}));
  const calls=[];const fetchImpl=async (_url,init)=>{const id=JSON.parse(init.body).requestId;calls.push(id);return new Response('{}',{status:401});};
  await assert.rejects(executePlan(plan,{fetchImpl,progressPath}),error=>error instanceof SafeStopError&&error.countyFips==='48149');
  assert.deepEqual(calls,['lp2416-48149']);
  const summary=JSON.parse(fs.readFileSync(progressPath)).summary;assert.deepEqual({...summary,safeStop:null},{totalCount:254,executedCount:74,passCount:74,noResultCount:0,wrongCountyCount:0,ambiguousCount:0,providerUnavailableCount:0,remainingCount:180,safeStop:null});
  fs.rmSync(dir,{recursive:true,force:true});
});

test('summary total and remaining counts use the plan, not physical progress row assumptions',()=>{
  const summary=summarizeProgress(plan,{rows:plan.fixtures.slice(0,74).map(row=>({...row,executionState:'PROVIDER_EXECUTED',providerOutcome:'PASS'}))});
  assert.equal(summary.totalCount,254);assert.equal(summary.executedCount,74);assert.equal(summary.passCount,74);assert.equal(summary.remainingCount,180);assert.equal(summary.safeStop,null);
});

test('mock execution cannot alter tracked launch evidence',()=>{
  const launch=JSON.parse(fs.readFileSync('reports/lp2416/launch-classification.json'));
  assert.equal(launch.providerExecution,'NOT_EXECUTED'); assert.equal(launch.countyOutcomeTotals.executed,0); assert.equal(launch.countyOutcomeTotals.notExecuted,254);
});
