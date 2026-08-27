import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildPlan, buildProviderRequest, classifyProviderResult, executePlan, publicRequestContract, SafeStopError, verifyPlan} from '../tools/lp2416/statewide-address-certification.mjs';

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

for (const status of [401,403,429]) test(`HTTP ${status} safe-stops sequential execution, persists truth, and resumes deterministically`,async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp2416-')),
    progressPath=path.join(dir,'progress.json'), fixtures=plan.fixtures.slice(0,2);
  let active=0,maxActive=0,calls=[];
  const stoppedFetch=async (_url,init)=>{active++;maxActive=Math.max(maxActive,active);calls.push(JSON.parse(init.body).requestId);active--;return new Response('{}',{status});};
  await assert.rejects(executePlan({fixtures},{fetchImpl:stoppedFetch,progressPath}),error=>error instanceof SafeStopError&&error.status===status&&error.countyFips==='48001');
  const stopped=JSON.parse(fs.readFileSync(progressPath));
  assert.equal(maxActive,1); assert.deepEqual(calls,['lp2416-48001']); assert.deepEqual(stopped.rows,[]);
  assert.deepEqual(stopped.safeStop,{countyFips:'48001',httpStatus:status,executionState:'NOT_EXECUTED',providerOutcome:'NOT_EXECUTED'});
  const successFetch=async (_url,init)=>{calls.push(JSON.parse(init.body).requestId);const row=fixtures.find(x=>`lp2416-${x.countyFips}`===JSON.parse(init.body).requestId);return Response.json({providerBoundary:'gridly',ok:true,status:'success',results:[{latitude:31,longitude:-96,displayName:'governed result',address:{county:`${row.expectedCountyName} County`}}]});};
  await executePlan({fixtures},{fetchImpl:successFetch,progressPath});
  const resumed=JSON.parse(fs.readFileSync(progressPath));
  assert.deepEqual(calls.slice(1),['lp2416-48001','lp2416-48003']); assert.equal(resumed.rows.length,2); assert.equal(resumed.safeStop,undefined);
  fs.rmSync(dir,{recursive:true,force:true});
});

test('mock execution cannot alter tracked launch evidence',()=>{
  const launch=JSON.parse(fs.readFileSync('reports/lp2416/launch-classification.json'));
  assert.equal(launch.providerExecution,'NOT_EXECUTED'); assert.equal(launch.countyOutcomeTotals.executed,0); assert.equal(launch.countyOutcomeTotals.notExecuted,254);
});
