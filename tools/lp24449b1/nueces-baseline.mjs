import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {root,out,loadInventory,read,write} from './inventory.mjs';
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex');
const inv=loadInventory(),require=createRequire(import.meta.url),session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true});
const failures=read('reports/lp24449a/original-in-scope-failures.json').filter(r=>r.code==='HOME_BASELINE_WRONG_CONTEXT');
const home=inv.rows.find(r=>r.place_geoid==='4801396'&&r.county_id==='nueces-tx'),records=[];
try {
 const {page,context,evidence}=await session.newPage();
 await page.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});
 await page.evaluate(async home=>{const group=getGridlyManualAwarenessAreaOptions().find(g=>g.countyId===home.county_id),option=group.communities.find(o=>o.placeGeoid===home.place_geoid);if(!gridlySaveCanonicalMultiCountyPlaceHome(option.canonicalResolution,'lp24449b1-original-nueces-baseline',home.county_id))throw Error('Home save failed');await lp24449b1.settle();},home);
 for(const failure of failures){const target=inv.rows.find(r=>r.place_geoid===failure.place_geoid&&r.county_id===failure.county_id);
  const proof=await page.evaluate(async target=>{const before=lp24449b1.bytes(),baseline=lp24449b1.identity();const results=await gridlySearchAddress(`${target.community_name}, ${target.county_name}, TX`);const result=results.find(r=>r.placeGeoid===target.place_geoid);if(!result)throw Error('Search missing');selectGridlySearchResult(result);await lp24449b1.settle();const searched=lp24449b1.identity();document.getElementById('gridlyTemporaryContextReturnHome').click();await lp24449b1.settle();return {baseline,searched,returned:lp24449b1.identity(),weather:gridlyResolveGovernedWeatherPoint(),storageUnchanged:JSON.stringify(before)===JSON.stringify(lp24449b1.bytes())};},target);
  const isHome=c=>c.place===home.place_geoid&&c.county===home.county_id&&c.type==='HOME';
  const checks={baseline:isHome(proof.baseline),search:proof.searched.place===target.place_geoid&&proof.searched.county===target.county_id,returnHome:isHome(proof.returned),weather:proof.weather?.placeGeoid===home.place_geoid&&proof.weather?.countyId===home.county_id,storage:proof.storageUnchanged};
  records.push({originalFailureId:failure.originalFailureId,target,proof,checks,pass:Object.values(checks).every(Boolean)});
 }
 write(`${out}/nueces-baseline-replay.json`,{sourceHash,home,count:records.length,passed:records.filter(r=>r.pass).length,records,network:evidence});
 console.log(JSON.stringify({count:records.length,passed:records.filter(r=>r.pass).length}));await context.close();
}finally{await session.close();}
