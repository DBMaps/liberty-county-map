import fs from 'node:fs';
import {createRequire} from 'node:module';
import {root,out,artifacts,loadInventory,write} from './inventory.mjs';
const require=createRequire(import.meta.url), baseline=process.argv.includes('--baseline');
const session=await require('./session.cjs')({baseline});
const inv=loadInventory(),records=[];
try {
 const {page:p}=await session.newPage();
 await p.addScriptTag({path:`${root}/tools/lp24449b/runtime-probe.js`});
 await p.evaluate(()=>{
  window.pulseTrace=[];
  const original=publishGridlyCommunityPulseAuditState;
  publishGridlyCommunityPulseAuditState=function(patch,publication){
   const result=original(patch,publication);
   window.pulseTrace.push({time:performance.now(),count:patch?.activeAwareness?.activeAwarenessCount,result:result?.activeAwareness?.activeAwarenessCount,reused:patch?.v734SharedModelReuseApplied,signature:patch?.v734SharedModelSignature,stack:new Error().stack});
   if(window.pulseTrace.length>30)window.pulseTrace.shift();
   return result;
  };
 });
 for(let index=0;index<30;index++){
  const row=inv.rows.find(r=>r.county_id==='montgomery-tx'&&r.community_name===(index%2?'Cut and Shoot':'Conroe'));
  const record=await p.evaluate(async({row,index})=>{
   const results=await gridlySearchAddress(`${row.community_name}, ${row.county_name}, TX`);
   selectGridlySearchResult(results.find(r=>r.placeGeoid===row.place_geoid));await lp24449b.settle();
   const capture=()=>({count:gridlyCommunityPulseAuditState?.activeAwareness?.activeAwarenessCount,headline:document.getElementById('gridlyCommunityPulseHeadline')?.innerText,subline:document.getElementById('gridlyCommunityPulseSubline')?.innerText,grouped:gridlyAuthoritativeIncidentSnapshotState.snapshot?.activeUnifiedIncidents?.length,cacheCount:gridlyV734RefreshReuseState.communityPulseModel?.activeAwareness?.activeAwarenessCount,signature:gridlyV734RefreshReuseState.communityPulseSignature});
   const fixture=gridlyLocalTestReports.add('flooded-roadway',{lat:row.presentation_lat,lng:row.presentation_lng,ageMinutes:0});await lp24449b.settle();
   const active=capture(),activeModel=lp24449b.snapshot();window.pulseTrace=[];
   gridlyLocalTestReports.clearOne(fixture.id);const immediate=capture();await lp24449b.settle();const settled=capture();
   const samples=[];if(immediate.count!==0||settled.count!==0){for(const ms of [100,250,500,1000,2000]){await new Promise(r=>setTimeout(r,ms-(samples.at(-1)?.ms||0)));samples.push({ms,...capture()});}}
   const trace=window.pulseTrace.slice(),model=lp24449b.snapshot(),afterModel=capture();
   return {index,row,active,activeCount:activeModel.pulse.count,immediate,settled,samples,trace,modelCount:model.pulse.count,afterModel};
  },{row,index});
  records.push(record);write(`${out}/pulse-diagnostic-${baseline?'baseline':'current'}.json`,{baseline,records});
  console.log(JSON.stringify({index,place:row.community_name,active:record.active.count,immediate:record.immediate.count,settled:record.settled.count,model:record.modelCount}));
 }
}finally{await session.close();}
