import fs from 'node:fs';import {createRequire} from 'node:module';import {root,out,artifacts,loadInventory,write} from './inventory.mjs';
const require=createRequire(import.meta.url),inv=loadInventory(),statewide=process.argv.includes('--statewide'),label=statewide?'statewide':'witness-controls';
const counties=['montgomery-tx','montague-tx','bexar-tx','dallas-tx','mills-tx','liberty-tx','el-paso-tx','potter-tx','galveston-tx','cameron-tx','aransas-tx','loving-tx','smith-tx'];
const selected=statewide?inv.counties.map(c=>c.countyId):counties;
const session=await require('./session.cjs')(),records=[];
try{
 const {page:p,evidence}=await session.newPage();await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});await p.addScriptTag({path:`${root}/tools/lp24449b1/provenance-probe.js`});await p.evaluate(()=>lp24449b1.settle());
 for(const county of selected){
  const candidates=inv.rows.filter(row=>row.county_id===county),row=candidates.find(row=>!row.is_multi_county)||candidates[0];
  const result=await p.evaluate(async({row,statewide})=>{
   b1Provenance.stop();for(const fixture of gridlyLocalTestReports.list().filter(r=>r.state!=='cleared'))gridlyLocalTestReports.clearOne(fixture.id);
   const results=await gridlySearchAddress(`${row.community_name}, ${row.county_name}, TX`);selectGridlySearchResult(results.find(r=>r.placeGeoid===row.place_geoid));await lp24449b1.settle();
   const before=b1Provenance.passive(),fixture=gridlyLocalTestReports.add('flooded-roadway',{lat:row.presentation_lat,lng:row.presentation_lng,ageMinutes:0});await lp24449b1.settle();
   const active=b1Provenance.passive(),activeConsumers=lp24449b1.snapshot();b1Provenance.start('clear');
   gridlyLocalTestReports.clearOne(fixture.id);const clearAt=performance.now(),immediate=b1Provenance.passive();await lp24449b1.settle();const settled=b1Provenance.passive();
   const failed=immediate.published.count!==0||settled.published.count!==0;
   const detailed=!statewide||failed||['montgomery-tx','montague-tx','bexar-tx'].includes(row.county_id);
   const samples=[];let full=null,refreshes=[];
   if(detailed){for(const ms of [50,100,250,500,1000,2000]){await new Promise(r=>setTimeout(r,Math.max(0,clearAt+ms-performance.now())));samples.push({targetMs:ms,actualMs:performance.now()-clearAt,state:b1Provenance.passive()});}b1Provenance.phase('post-clear-full-read');full=b1Provenance.full();
    for(const reason of ['interval_live_refresh','pulse-provenance-additional-cycle']){b1Provenance.phase(reason);refreshReportHazardViews(reason);await lp24449b1.settle();refreshes.push({reason,state:b1Provenance.passive(),full:b1Provenance.full()});}}
   const events=b1Provenance.stop(),model=lp24449b1.snapshot();
   return {row,fixture,before,active,activeConsumers,immediate,settled,samples,full,refreshes,events:detailed?events:[],model,failed,detailed};
  },{row,statewide});
  records.push(result);fs.appendFileSync(`${artifacts}/provenance-${label}.jsonl`,JSON.stringify(result)+'\n');
  console.log(JSON.stringify({done:records.length,county,place:row.community_name,failed:result.failed,count:result.settled.published.count,detail:result.full?.lightweight?.selectedDetail}));
 }
 write(`${out}/provenance-${label}.json`,{label,records,network:evidence});
}finally{await session.close();}
