import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {loadInventory,root,out,artifacts,write} from './inventory.mjs';
const inv=loadInventory(),require=createRequire(import.meta.url);
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex');
const shard=process.argv.find(arg=>arg.startsWith('--shard='))?.split('=')[1]||'0/2';
const [shardIndex,shardCount]=shard.split('/').map(Number);
// A finishing Home queue may reach the same ring shard while another worker
// already owns it. Avoid a duplicate browser and duplicate checkpoint writer.
const lock=`${artifacts}/transitions-${shardIndex}.lock`;
try{fs.closeSync(fs.openSync(lock,'wx'));}catch(error){if(error.code!=='EEXIST')throw error;console.log(`Ring shard ${shardIndex} already has an active worker.`);process.exit(0);}
let session;
try{session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true});}catch(error){fs.unlinkSync(lock);throw error;}
const representatives=inv.counties.map(c=>{const rows=inv.rows.filter(r=>r.county_id===c.countyId);return rows.find(r=>!r.is_multi_county)||rows[0];});
const file=`${artifacts}/transitions-progress-${shardIndex}.jsonl`,records=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
let ctx,p;const networkOffsets={};
try {for(let i=0;i<representatives.length;i++){
 if(i%shardCount!==shardIndex)continue;
 const home=representatives[i],target=representatives[(i+1)%representatives.length];if(records.some(r=>r.home.county_id===home.county_id&&r.pass&&r.sourceHash===sourceHash))continue;
 const started=Date.now(),entry={home,target,sourceHash,startedAt:new Date().toISOString(),browserLifecycle:'Reused isolated session; production Home save, cross-county Search and Return Home for every ring edge'};
 try{
  if(!ctx){ctx=await session.newPage();p=ctx.page;await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});}
  entry.proof=await p.evaluate(async({home,target})=>{
   const option=getGridlyManualAwarenessAreaOptions().find(g=>g.countyId===home.county_id)?.communities.find(o=>o.placeGeoid===home.place_geoid);
   const saved=gridlySaveCanonicalMultiCountyPlaceHome(option.canonicalResolution,'lp24449b1-ring',home.county_id);await lp24449b1.settle();
   const before=lp24449b1.bytes(),start=lp24449b1.identity();
   const results=await gridlySearchAddress(`${target.community_name}, ${target.county_name}, TX`),result=results.find(r=>r.placeGeoid===target.place_geoid);
   if(!result)throw Error('Ring target missing');selectGridlySearchResult(result);await lp24449b1.settle();
   const searched=lp24449b1.identity();document.getElementById('gridlyTemporaryContextReturnHome').click();await lp24449b1.settle();
   return {saved,start,searched,returned:lp24449b1.identity(),weather:gridlyResolveGovernedWeatherPoint(),homeUnchanged:JSON.stringify(before)===JSON.stringify(lp24449b1.bytes()),activeCounty:gridlyGetActiveCountyId(),crossingOwner:gridlyCrossingInventoryCountyId,driveOwner:window.gridlyLp028DriveTexasAreaLifecycleAudit?.().currentAwarenessViewCounty};
  },{home,target});
  const q=entry.proof;entry.checks={saved:q.saved,start:q.start.place===home.place_geoid&&q.start.county===home.county_id,search:q.searched.place===target.place_geoid&&q.searched.county===target.county_id&&q.searched.type==='SEARCH',returnHome:q.returned.place===home.place_geoid&&q.returned.county===home.county_id&&q.returned.type==='HOME',weather:q.weather?.placeGeoid===home.place_geoid&&q.weather?.countyId===home.county_id,storage:q.homeUnchanged,active:q.activeCounty===home.county_id,crossing:q.crossingOwner===home.county_id,drive:q.driveOwner===home.county_id};entry.pass=Object.values(entry.checks).every(Boolean);
  entry.network=Object.fromEntries(Object.entries(ctx.evidence).map(([key,values])=>{const observed=values.slice(networkOffsets[key]||0);networkOffsets[key]=values.length;return [key,observed];}));
 }catch(error){entry.error=String(error.stack);entry.pass=false;}
 entry.runtimeMs=Date.now()-started;records.push(entry);fs.appendFileSync(file,JSON.stringify(entry)+'\n');console.log(JSON.stringify({done:records.length,county:home.county_id,pass:entry.pass,error:entry.error}));if(entry.error)break;
 }
 const finalRecords=[...new Map(records.filter(r=>r.sourceHash===sourceHash).map(r=>[r.home.county_id,r])).values()];
 const required=representatives.filter((row,index)=>index%shardCount===shardIndex).length;
 write(`${out}/cross-county-transitions-${shardIndex}.json`,{sourceHash,shard,required,completed:finalRecords.length===required,passed:finalRecords.filter(r=>r.pass).length,records:finalRecords});
}finally{try{await session.close();}finally{fs.unlinkSync(lock);}}
