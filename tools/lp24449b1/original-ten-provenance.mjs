import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {root,out,artifacts,read,write} from './inventory.mjs';
const require=createRequire(import.meta.url),originals=read('reports/lp24449b1/original-residual-failures.json').filter(r=>r.code==='PULSE_PUBLISHED_COUNT_STALE_AFTER_CLEAR'),records=[];
for(const baseline of [true,false]){
 const session=await require('./session.cjs')({baseline});
 try{for(const original of originals){
  const historical=read(`.artifacts/lp24449/supplements/${original.county_id}.json`),row=historical.representative,kind=original.consumer==='synthetic_road'?'road':'delay';
  const {page:p,context,evidence}=await session.newPage();
  try{
   await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});await p.addScriptTag({path:`${root}/tools/lp24449b1/provenance-probe.js`});
   const proof=await p.evaluate(async({row,kind,target})=>{
    const results=await gridlySearchAddress(`${row.community_name}, ${row.county_name}, TX`);selectGridlySearchResult(results.find(r=>r.placeGeoid===row.place_geoid));await lp24449b1.settle();
    document.querySelector('#gridlyPortraitV2 [data-geo-filter="county"]').click();await lp24449b1.settle();if(target)map.setView([target.lat,target.lng],15,{animate:false});
    const fixture=gridlyLocalTestReports.add(kind==='road'?'flooded-roadway':'reported-crossing-delay',kind==='road'?{lat:row.presentation_lat,lng:row.presentation_lng,ageMinutes:0}:{crossingId:target.id});await lp24449b1.settle();
    gridlyOfficialProviderConsumerRefresh({providerId:'drivetexas',reason:'interval_live_refresh'});await lp24449b1.settle();const active=b1Provenance.passive();
    b1Provenance.start('original-fixture-provider-publication-clear');gridlyLocalTestReports.clearOne(fixture.id);const at=performance.now(),immediate=b1Provenance.passive(),samples=[];
    for(const ms of [50,100,250,500,1000,2000]){await new Promise(r=>setTimeout(r,Math.max(0,at+ms-performance.now())));samples.push({ms,actualMs:performance.now()-at,state:b1Provenance.passive()});}
    const full=b1Provenance.full(),events=b1Provenance.stop(),refreshes=[];for(const reason of ['interval_live_refresh','additional-normal-cycle']){refreshReportHazardViews(reason);gridlyOfficialProviderConsumerRefresh({providerId:'drivetexas',reason});await lp24449b1.settle();refreshes.push({state:b1Provenance.passive(),full:b1Provenance.full()});}
    const empty=s=>s.published.count===0&&s.raw.hazards.length===0&&s.raw.reports.length===0&&s.markers.length===0;
    const pass=active.published.count===1&&empty(immediate)&&samples.every(s=>empty(s.state))&&full.lightweight.count===0&&full.pulse.count===0&&refreshes.every(r=>empty(r.state)&&r.full.lightweight.count===0&&r.full.pulse.count===0);
    return {fixture,active,immediate,samples,full,events,refreshes,pass};
   },{row,kind,target:historical.render.target});
   records.push({originalFailureId:original.originalFailureId,original:{county:original.county_id,place:original.place_geoid,community:original.community,consumer:original.consumer,fixture:original.detail.fixture,clearedPulse:original.detail.clearedPulse,evidence:`.artifacts/lp24449/supplements/${original.county_id}.json`},baseline,row,kind,proof,network:evidence,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(baseline?`${artifacts}/baseline-app.js`:'js/app.js')).digest('hex')});write(`${out}/original-ten-provenance.json`,{records});console.log(JSON.stringify({originalFailureId:original.originalFailureId,baseline,kind,pass:proof.pass,stale:proof.full.lightweight.selectedDetail}));
  }finally{await context.close();}
 }}finally{await session.close();}
}
