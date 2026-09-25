import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {loadInventory,root,out,artifacts,read,write} from './inventory.mjs';
const require=createRequire(import.meta.url),inv=loadInventory();
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex');
const failures=read('reports/lp24449a/original-in-scope-failures.json');
const edges=new Set(read('reports/lp24449a/certification-cohorts.json').returnCohort);
const representatives=new Set(inv.counties.map(c=>{const rows=inv.rows.filter(r=>r.county_id===c.countyId);const r=rows.find(r=>!r.is_multi_county)||rows[0];return `${r.county_id}|${r.place_geoid}`;}));
const failureKeys=new Set(failures.map(r=>`${r.county_id}|${r.place_geoid}`));
let cohort=inv.rows.filter(r=>r.is_multi_county||edges.has(r.place_geoid)||representatives.has(`${r.county_id}|${r.place_geoid}`)||failureKeys.has(`${r.county_id}|${r.place_geoid}`)).sort((a,b)=>a.county_fips.localeCompare(b.county_fips)||a.place_geoid.localeCompare(b.place_geoid));
cohort=['hamilton-tx|4833548','harris-tx|4801696'].map(k=>inv.rows.find(r=>`${r.county_id}|${r.place_geoid}`===k));
process.argv.push('--await-weather','--diagnostic-weather');
fs.mkdirSync(`${artifacts}/home-timeout-diagnostic`,{recursive:true});
write(`${out}/home-timeout-diagnostic/browser-cohort.json`,{total:cohort.length,counties:new Set(cohort.map(r=>r.county_id)).size,multi:cohort.filter(r=>r.is_multi_county).length,rows:cohort});
const shard=process.argv.find(a=>a.startsWith('--shard='))?.split('=')[1];
const [shardIndex,shardCount]=shard?shard.split('/').map(Number):[0,1];
const file=`${artifacts}/home-timeout-diagnostic/home-progress${shard?'-'+shardIndex:''}.jsonl`;
const readLines=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const records=[...new Map(['home-progress','home-progress-0','home-progress-1'].flatMap(name=>readLines(`${artifacts}/home-timeout-diagnostic/${name}.jsonl`)).map(row=>[`${row.sourceHash}|${row.county_id}|${row.place_geoid}`,row])).values()];
const done=new Set(records.filter(r=>!r.error&&r.sourceHash===sourceHash).map(r=>`${r.county_id}|${r.place_geoid}`));
const limit=Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1]||Infinity);
const only=process.argv.find(a=>a.startsWith('--only='))?.slice(7),force=process.argv.includes('--force'),awaitWeather=process.argv.includes('--await-weather');
if(force&&!only)throw Error('Forced retries require one explicit membership');
const diagnosticWeather=process.argv.includes('--diagnostic-weather');
const weatherReady=async(entry,stage)=>{if(!awaitWeather)return;if(!diagnosticWeather){await p.waitForFunction(()=>{const r=gridlyWeatherConnectorRuntimeAudit();return r.pointsRequestAttempted===true&&r.requestAttempted===true&&r.requestInFlight===false;},null,{timeout:30000});return;}
 const start=Date.now(),samples=[];entry.weatherWaitDiagnostics??=[];entry.weatherWaitDiagnostics.push({stage,samples,policy:'Passive observation only; no fetch, refresh or count mutation. Extended diagnostic window records why the earlier 30-second completion wait expired.'});
 while(Date.now()-start<180000){const state=await p.evaluate(()=>{const r=gridlyWeatherConnectorRuntimeAudit();return {at:Date.now(),context:lp24449b1.identity(),point:r.selectedPoint,requestInFlight:r.requestInFlight,requestAttempted:r.requestAttempted,pointsRequestAttempted:r.pointsRequestAttempted,requestSucceeded:r.requestSucceeded,responseIdentity:r.responseIdentity,currentAwarenessIdentity:r.currentAwarenessIdentity,freshnessStatus:r.freshnessStatus,forecastRequestSucceeded:r.forecastRequestSucceeded,lastRequestAt:r.lastRequestAt,lastSuccessAt:r.lastSuccessAt,lastFailureAt:r.lastFailureAt,lastError:r.lastError,pointEndpoint:r.pointEndpoint,pointsLookupEndpoint:r.pointsLookupEndpoint};});samples.push({elapsedMs:Date.now()-start,...state});if(state.pointsRequestAttempted&&state.requestAttempted&&!state.requestInFlight)return;await p.waitForTimeout(1000);}
 throw Error(`Passive weather diagnostic did not complete: ${JSON.stringify(samples.at(-1))}`);
};
const session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true});
let ctx,p,lastCounty;const networkRuns=[];
const hydrate=async()=>{await p.waitForFunction(()=>typeof gridlyGetCurrentAwarenessContext==='function'&&window.gridlyCanonicalCrossingRuntime?.state?.records);await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});await p.evaluate(async()=>{await gridlyLoadStatewidePlacePresentation();await lp24449b1.settle();window.lp24449b1.homeSnapshot=()=>({activeCounty:gridlyGetActiveCountyId(),weatherPoint:gridlyResolveGovernedWeatherPoint(),weatherRuntime:window.gridlyWeatherConnectorRuntimeAudit?.(),driveArea:window.gridlyLp028DriveTexasAreaLifecycleAudit?.(),crossing:{owner:gridlyCrossingInventoryCountyId},location:document.getElementById('mobileAwarenessPanelKicker')?.textContent,kbyg:document.getElementById('gridlyBriefLocation')?.textContent,alertsAuthority:gridlyReadAlertsFamilyAuthority(),undefinedm:document.body.innerText.includes('undefinedm')});});};
try {for(const row of cohort.filter((r,index)=>index%shardCount===shardIndex&&(!only||only===`${r.county_id}|${r.place_geoid}`)&&(force||!done.has(`${r.county_id}|${r.place_geoid}`))).slice(0,limit)){
 const started=Date.now(),entry={...row,sourceHash,startedAt:new Date().toISOString(),browserPartition:'Alternating membership index',browserLifecycle:'Reused isolated session; real page reload for every saved Home membership'};
 try {
  if(!ctx){ctx=await session.newPage();p=ctx.page;await hydrate();}
  if(lastCounty!==row.county_id){write(`${out}/home-timeout-diagnostic/home-network-${shardIndex}.json`,[{county:'multiple',...ctx.evidence}]);lastCounty=row.county_id;}
  // Invoke real rendered controls and their production listeners. The pointer
  // pilot covers actionability; this statewide batch avoids repeated locator
  // layout polling over thousands of map nodes.
  await p.evaluate(()=>{document.querySelector('#gridlySettingsDockButton').click();const summary=document.querySelector('.settings-section-awareness > summary');if(!summary.parentElement.open)summary.click();document.querySelector('[data-v2-action="settings-change-home-area"]').click();});
  await p.locator('[data-gridly-manual-awareness-search]:visible').fill(row.county_name);
  const option=await p.evaluate(row=>getGridlyManualAwarenessAreaOptions().find(g=>g.countyId===row.county_id)?.communities.find(o=>o.placeGeoid===row.place_geoid),row);
  if(!option)throw Error('Governed option absent');
  const button=p.locator('.settings-manual-area-result:visible').filter({has:p.locator('span')});
  const dom=await button.evaluateAll(ns=>ns.map(n=>({text:n.innerText,value:n.dataset.gridlyManualAwarenessValue,county:n.dataset.gridlyManualAwarenessCountyId})));
  const index=dom.findIndex(d=>d.value===option.value&&d.county===row.county_id);
  if(index<0)throw Error('Bound county option not rendered');
  entry.optionDOM=dom[index];await button.nth(index).evaluate(n=>n.click());await p.locator('[data-gridly-manual-awareness-apply]:visible').evaluate(n=>n.click());
  await p.evaluate(()=>lp24449b1.settle());
  entry.saved=await p.evaluate(()=>({identity:lp24449b1.identity(),bytes:lp24449b1.bytes()}));
  await p.locator('#gridlyPortraitV2SheetClose:visible, #closeSettingsModalBtn:visible').first().evaluate(n=>n.click());
  await p.reload({waitUntil:'domcontentloaded'});await hydrate();await weatherReady(entry,'reloaded');
  entry.reloaded=await p.evaluate(()=>({identity:lp24449b1.identity(),bytes:lp24449b1.bytes(),snapshot:lp24449b1.homeSnapshot()}));
  const target=inv.rows.find(r=>r.county_id===row.county_id&&r.place_geoid!==row.place_geoid)||inv.rows.find(r=>r.county_id!==row.county_id);
  entry.transition=await p.evaluate(async target=>{const before=lp24449b1.bytes();const results=await gridlySearchAddress(`${target.community_name}, ${target.county_name}, TX`);const result=results.find(r=>r.placeGeoid===target.place_geoid);if(!result)throw Error('Transition Search missing');selectGridlySearchResult(result);await lp24449b1.settle();return {target,context:lp24449b1.identity(),homeUnchanged:JSON.stringify(before)===JSON.stringify(lp24449b1.bytes())};},target);
  await p.locator('#gridlyTemporaryContextReturnHome').evaluate(n=>n.click());await p.evaluate(()=>lp24449b1.settle());
  await weatherReady(entry,'returned');
  entry.returned=await p.evaluate(()=>({identity:lp24449b1.identity(),bytes:lp24449b1.bytes(),snapshot:lp24449b1.homeSnapshot()}));
  const matches=c=>c.type==='HOME'&&c.place===row.place_geoid&&c.county===row.county_id&&Math.abs(c.lat-row.presentation_lat)<1e-6&&Math.abs(c.lng-row.presentation_lng)<1e-6;
  entry.checks={save:matches(entry.saved.identity),reload:matches(entry.reloaded.identity),returnHome:matches(entry.returned.identity),search:entry.transition.context.place===target.place_geoid&&entry.transition.context.county===target.county_id,storage:entry.transition.homeUnchanged&&JSON.stringify(entry.reloaded.bytes)===JSON.stringify(entry.returned.bytes),weather:entry.returned.snapshot.weatherPoint?.placeGeoid===row.place_geoid&&entry.returned.snapshot.weatherPoint?.countyId===row.county_id,activeCounty:entry.returned.snapshot.activeCounty===row.county_id,crossingOwner:entry.returned.snapshot.crossing.owner===row.county_id,driveOwner:entry.returned.snapshot.driveArea?.currentAwarenessViewCounty===row.county_id,noUndefined:!entry.returned.snapshot.undefinedm};
  if(awaitWeather)entry.checks.weatherCompleted=['reloaded','returned'].every(stage=>entry[stage].snapshot.weatherRuntime.requestAttempted===true&&entry[stage].snapshot.weatherRuntime.requestInFlight===false);
  entry.weatherCompletionWait=awaitWeather;entry.pass=Object.values(entry.checks).every(Boolean);
  if(!entry.pass||failureKeys.has(`${row.county_id}|${row.place_geoid}`))await p.screenshot({path:`${artifacts}/home-timeout-diagnostic/home-${row.place_geoid}-${row.county_id}.png`});
 }catch(error){entry.error=String(error.stack);entry.pass=false;try{entry.errorState=await p.evaluate(()=>({identity:lp24449b1.identity(),weather:gridlyWeatherConnectorRuntimeAudit()}));}catch(diagnosticError){entry.diagnosticError=String(diagnosticError);}}
 entry.runtimeMs=Date.now()-started;records.push(entry);fs.appendFileSync(file,JSON.stringify(entry)+'\n');console.log(JSON.stringify({done:records.length,total:cohort.length,place:row.place_geoid,county:row.county_id,pass:entry.pass,error:entry.error,checks:entry.checks}));
 if(entry.error)break;
 }
 write(`${out}/home-timeout-diagnostic/home-browser-results${shard?'-'+shardIndex:''}.json`,{shard,completed:records.filter(r=>!r.error).length===cohort.length,count:records.length,passed:records.filter(r=>r.pass).length,records});
}finally{if(ctx)networkRuns.push({county:'multiple',...ctx.evidence});write(`${out}/home-timeout-diagnostic/home-network-${shardIndex}.json`,networkRuns);await session.close();}
