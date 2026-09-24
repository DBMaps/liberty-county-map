import {createRequire} from 'node:module';import {root,out,loadInventory,write} from './inventory.mjs';
const require=createRequire(import.meta.url),inv=loadInventory(),session=await require('./session.cjs')(),records=[],suffix=process.argv.includes('--after')?'after':'before';
try{for(const [county,place] of [['montgomery-tx','4816432'],['montague-tx','4809640'],['bexar-tx','4801600'],['dallas-tx','4801240'],['mills-tx','4830056']]){
 const row=inv.rows.find(r=>r.county_id===county&&r.place_geoid===place)||inv.rows.find(r=>r.county_id===county);
 for(const publish of [false,true]){
  const {page:p,context,evidence}=await session.newPage();await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});await p.addScriptTag({path:`${root}/tools/lp24449b1/provenance-probe.js`});
  const proof=await p.evaluate(async({row,publish})=>{
   const results=await gridlySearchAddress(`${row.community_name}, ${row.county_name}, TX`);selectGridlySearchResult(results.find(r=>r.placeGeoid===row.place_geoid));await lp24449b1.settle();
   const fixture=gridlyLocalTestReports.add('flooded-roadway',{lat:row.presentation_lat,lng:row.presentation_lng,ageMinutes:0});await lp24449b1.settle();
   const activeBefore=b1Provenance.passive();
   if(publish){gridlyOfficialProviderConsumerRefresh({providerId:'drivetexas',reason:'interval_live_refresh'});await lp24449b1.settle();}
   const activeAfter=b1Provenance.passive(),publisher=gridlyAwarenessOfficialRoadwayPublisherRepairAudit();
   b1Provenance.start('clear-after-provider-publication');gridlyLocalTestReports.clearOne(fixture.id);const at=performance.now(),immediate=b1Provenance.passive();
   const samples=[];for(const ms of [50,100,250,500,1000,2000]){await new Promise(r=>setTimeout(r,Math.max(0,at+ms-performance.now())));samples.push({ms,actualMs:performance.now()-at,state:b1Provenance.passive()});}
   b1Provenance.phase('candidate-provenance');const full=b1Provenance.full(),events=b1Provenance.stop();
   const refreshes=[];for(const reason of ['interval_live_refresh','pulse-provenance-additional-cycle']){refreshReportHazardViews(reason);await lp24449b1.settle();refreshes.push({reason,state:b1Provenance.passive()});}
   return {fixture,activeBefore,activeAfter,publisher,immediate,samples,full,events,refreshes};
  },{row,publish});
  records.push({row,publish,proof,network:evidence});write(`${out}/publication-race-${suffix}.json`,{records});
  console.log(JSON.stringify({county,publish,before:proof.activeBefore.published.count,active:proof.activeAfter.published.count,cleared:proof.immediate.published.count,last:proof.samples.at(-1).state.published.count,candidate:proof.full.lightweight.selectedDetail}));await context.close();
 }
}}finally{await session.close();}
