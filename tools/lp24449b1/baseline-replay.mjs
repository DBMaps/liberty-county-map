import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {root,artifacts,read,write,loadInventory} from './inventory.mjs';
const require=createRequire(import.meta.url),mode=process.argv.includes('--pulse')?'pulse':'filter',prefix=process.argv.includes('--current')?'current':'baseline',session=await require('./session.cjs')({baseline:prefix==='baseline'});
const ledger=read('reports/lp24449b1/original-residual-failures.json');
async function raw(p){return p.evaluate(()=>({at:performance.now(),context:lp24449b1.identity(),activeCounty:gridlyGetActiveCountyId(),crossingOwner:gridlyCrossingInventoryCountyId,publication:JSON.parse(JSON.stringify(gridlyCommunityPulseAuditState)),reports:activeReports.map(r=>({id:r.id,type:r.type,crossingId:r.crossingId})),groupedSnapshot:{generatedAt:gridlyAuthoritativeIncidentSnapshotState.snapshot?.generatedAt,incidents:(gridlyAuthoritativeIncidentSnapshotState.snapshot?.unifiedIncidents||[]).map(r=>({id:r.id,incidentId:r.incidentId,status:r.status,type:r.type})),active:(gridlyAuthoritativeIncidentSnapshotState.snapshot?.activeUnifiedIncidents||[]).map(r=>({id:r.id,incidentId:r.incidentId,status:r.status,type:r.type}))},hazards:activeHazards.map(r=>({id:r.id,status:r.status})),location:document.getElementById('mobileAwarenessPanelIssues')?.innerText,pulseDOM:document.querySelector('.gridly-v2-status-pill')?.innerText,kbyg:document.getElementById('gridlyBriefInteractionPanel')?.innerText,alertsDOM:[...document.querySelectorAll('[data-gridly-lp236-condition-id]')].map(n=>({id:n.dataset.gridlyLp236ConditionId,text:n.innerText})),hazardMarkers:unifiedIncidentLayer?.getLayers().map(m=>m.options.incidentId),crossingMarkers:[...crossingMarkers].filter(([,m])=>m.getElement()?.isConnected).map(([id])=>id)}));}
const records=[];
try{
 if(mode==='filter'){
  const s=await session.newPage(),p=s.page,row=loadInventory().rows.find(r=>r.place_geoid==='4803600'&&r.county_id==='aransas-tx');
  await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});await p.evaluate(()=>lp24449b1.settle());
  const search=await p.evaluate(async r=>{const results=await gridlySearchAddress(`${r.community_name}, ${r.county_name}, TX`),selected=results.find(x=>x.placeGeoid===r.place_geoid);selectGridlySearchResult(selected);await lp24449b1.settle();return {selected,context:lp24449b1.identity(),presentation:gridlyActiveGeographicPresentation};},row);
  const before=await raw(p);await p.locator('#gridlyPortraitV2 .gridly-v2-segments [data-geo-filter="county"]').first().click();await p.evaluate(()=>lp24449b1.settle());
  const after=await raw(p),snapshot=await p.evaluate(()=>lp24449b1.snapshot());
  await p.screenshot({path:`${artifacts}/${prefix}-aransas-filter.png`});
  write(`${artifacts}/${prefix}-filter.json`,{search,before,after,snapshot,network:s.evidence});console.log(JSON.stringify({mode,before:before.activeCounty,after:after.activeCounty,owner:after.crossingOwner,context:after.context}));
 }else{
  for(const county of [...new Set(ledger.filter(r=>r.code==='PULSE_PUBLISHED_COUNT_STALE_AFTER_CLEAR').map(r=>r.county_id))]){
   const original=read(`.artifacts/lp24449/supplements/${county}.json`),row=original.representative,s=await session.newPage(),p=s.page;
   try{
    await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});await p.addScriptTag({path:`${root}/tools/lp24449b1/original-sequence-probe.js`});
    await p.evaluate(r=>lp24449.home(r),row);
    await p.evaluate(async r=>{const q=await gridlySearchAddress(`${r.community_name}, ${r.county_name}, TX`);selectGridlySearchResult(q.find(x=>x.placeGeoid===r.place_geoid));await lp24449b1.settle();},row);
    const filterObservations=[];
    for(const key of ['nearby','town','county','active-delays','all','county']){await p.locator(`#gridlyPortraitV2 .gridly-v2-segments [data-geo-filter="${key}"]`).first().click();await p.evaluate(()=>lp24449b1.settle());filterObservations.push({key,originalSnapshot:await p.evaluate(()=>lp24449.snapshot())});}
    if(original.render.target){await p.evaluate(t=>map.setView([t.lat,t.lng],15,{animate:false}),original.render.target);await p.waitForTimeout(400);}
    const originalRenderObservation=await p.evaluate(()=>({snapshot:lp24449.snapshot(),audit:gridlyCrossingVisibilityAudit()}));
    for(const kind of ['road','delay']){
     const fixture=await p.evaluate(async({kind,row,target})=>{const f=gridlyLocalTestReports.add(kind==='road'?'flooded-roadway':'reported-crossing-delay',kind==='road'?{lat:row.presentation_lat,lng:row.presentation_lng,ageMinutes:0}:{crossingId:target.id});await lp24449b1.settle();return f;},{kind,row,target:original.render.target});
     const originalActiveObservation=await p.evaluate(()=>lp24449.snapshot());
     await p.locator('#gridlyAlertsDockButton').click();const originalAlertsObservation=await p.evaluate(()=>lp24449.snapshot()),active=await raw(p),activeModel=await p.evaluate(()=>lp24449b1.snapshot());
     await p.evaluate(id=>gridlyLocalTestReports.clearOne(id),fixture.id);const start=Date.now(),samples=[];
     for(const elapsed of [0,100,250,500,1000,2000]){const wait=elapsed-(Date.now()-start);if(wait>0)await p.waitForTimeout(wait);samples.push({targetMs:elapsed,actualMs:Date.now()-start,raw:await raw(p)});}
     const beforeModel=await raw(p),model=await p.evaluate(()=>lp24449b1.snapshot()),afterModel=await raw(p);
     await p.evaluate(()=>gridlyRefreshUnifiedAwarenessContext('lp24449b1-normal-refresh'));await p.evaluate(()=>lp24449b1.settle());const refreshed=await raw(p);
     const originalFailureId=ledger.find(r=>r.county_id===county&&r.consumer===`synthetic_${kind}`)?.originalFailureId;
     records.push({originalFailureId,county,kind,row,fixture,filterObservations,originalRenderObservation,originalActiveObservation,originalAlertsObservation,active,activeModel,samples,beforeModel,model,afterModel,refreshed,network:s.evidence});
     write(`${artifacts}/${prefix}-pulse.json`,records);console.log(JSON.stringify({county,kind,active:active.publication?.activeAwareness?.activeAwarenessCount,samples:samples.map(x=>x.raw.publication?.activeAwareness?.activeAwarenessCount),model:model.pulse.count}));
     await p.locator('#gridlyPortraitV2SheetClose').click();
     // Separate exact original capture order from the raw timed observation.
     // The old snapshot helper invokes presentation builders; mixing it into
     // the 0..2000 ms raw series would itself alter what that series observes.
     const repeatFixture=await p.evaluate(async({kind,row,target})=>{const f=gridlyLocalTestReports.add(kind==='road'?'flooded-roadway':'reported-crossing-delay',kind==='road'?{lat:row.presentation_lat,lng:row.presentation_lng,ageMinutes:0}:{crossingId:target.id});await lp24449.settle();return {fixture:f,active:lp24449.snapshot()};},{kind,row,target:original.render.target});
     await p.locator('#gridlyAlertsDockButton').click();repeatFixture.alerts=await p.evaluate(()=>lp24449.snapshot());
     await p.evaluate(id=>gridlyLocalTestReports.clearOne(id),repeatFixture.fixture.id);await p.evaluate(()=>lp24449.settle());
     repeatFixture.beforeOriginalSnapshot=await raw(p);repeatFixture.cleared=await p.evaluate(()=>lp24449.snapshot());repeatFixture.afterOriginalSnapshot=await raw(p);
     records.at(-1).originalCaptureReplay=repeatFixture;write(`${artifacts}/${prefix}-pulse.json`,records);
     await p.locator('#gridlyPortraitV2SheetClose').click();
    }
    await p.locator('#gridlyTemporaryContextReturnHome').evaluate(n=>n.click());await p.evaluate(()=>lp24449b1.settle());const returned=await raw(p);
    const originalRouteProtection=await p.evaluate(r=>lp24449.protection(r),row);
    const originalTransition=original.synthetic?.afterCountySwitch?.resolution?.qualifiedQuery;
    let afterCountyTransition=null;
    if(originalTransition){afterCountyTransition=await p.evaluate(async query=>{const results=await gridlySearchAddress(query);if(!results[0])throw Error('Original county-transition query no longer resolves');selectGridlySearchResult(results[0]);await lp24449b1.settle();const searched=lp24449b1.snapshot();document.getElementById('gridlyTemporaryContextReturnHome').click();await lp24449b1.settle();return {query,searched,returned:lp24449b1.snapshot()};},originalTransition);}
    for(const entry of records.filter(x=>x.county===county)){entry.originalContextReturn=returned;entry.originalRouteProtection=originalRouteProtection;entry.originalCountyTransition=afterCountyTransition;}
    write(`${artifacts}/${prefix}-pulse.json`,records);
   }finally{await s.context.close();}
  }
 }
}finally{await session.close();}
// Keep the initial replay, then repeat starting-source witnesses with the same
// model-read observation points now recorded for the final source. Sequential,
// so this occupies only the queue's existing single browser-worker slot.
if(prefix==='current'&&mode==='pulse'){
 const baselineFile=`${artifacts}/baseline-pulse.json`;
 if(fs.existsSync(baselineFile))fs.copyFileSync(baselineFile,`${artifacts}/baseline-pulse-initial-${Date.now()}.json`);
 const replay=spawnSync(process.execPath,['tools/lp24449b1/baseline-replay.mjs','--pulse'],{stdio:'inherit'});
 if(replay.status!==0)process.exitCode=replay.status||1;
}
