import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {loadInventory,root,out,artifacts,write} from './inventory.mjs';
const require=createRequire(import.meta.url),inventory=loadInventory();
const session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true});
const file=`${artifacts}/search-progress.jsonl`;
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex');
const metadataFile=`${artifacts}/search-source.json`;
const previousMetadata=fs.existsSync(metadataFile)?JSON.parse(fs.readFileSync(metadataFile)):null;
if(previousMetadata?.sourceHash!==sourceHash||previousMetadata?.canonicalHomeBaseline!==true){
 if(fs.existsSync(file))fs.copyFileSync(file,`${artifacts}/search-before-final-${Date.now()}.jsonl`);
 fs.writeFileSync(file,'');write(metadataFile,{sourceHash,canonicalHomeBaseline:true,startedAt:new Date().toISOString()});
}
const records=fs.existsSync(file)?fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const completed=new Set(records.map(r=>`${r.county_id}|${r.place_geoid}`));
try {
 const {page,evidence}=await session.newPage();
 await page.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});
 await page.evaluate(()=>lp24449b1.settle());
 await page.evaluate(async()=>{const group=getGridlyManualAwarenessAreaOptions().find(g=>g.countyId==='liberty-tx'),option=group.communities.find(o=>o.label==='Dayton');if(!gridlySaveCanonicalMultiCountyPlaceHome(option.canonicalResolution,'lp24449b1-search-home-baseline',group.countyId))throw Error('Canonical Search Home baseline failed');await lp24449b1.settle();});
 for(const row of inventory.rows.slice().sort((a,b)=>a.county_fips.localeCompare(b.county_fips)||a.place_geoid.localeCompare(b.place_geoid))){
  if(completed.has(`${row.county_id}|${row.place_geoid}`))continue;
  const started=Date.now();const entry=await page.evaluate(async row=>{
   const bytes=lp24449b1.bytes();
   const bare=await gridlySearchAddress(row.community_name);
   const query=`${row.community_name}, ${row.county_name}, TX`;
   const qualified=await gridlySearchAddress(query);
   const result=qualified.find(r=>r.placeGeoid===row.place_geoid);
   if(result) {selectGridlySearchResult(result);await lp24449b1.settle();}
   const filterBefore={context:lp24449b1.identity(),activeCounty:gridlyGetActiveCountyId(),inventoryOwner:gridlyCrossingInventoryCountyId,presentation:gridlyActiveGeographicPresentation,center:map.getCenter(),anchor:getGridlyAwarenessAnchor()};
   if(result&&row.is_multi_county){document.querySelector('#gridlyPortraitV2 .gridly-v2-segments [data-geo-filter="county"]').click();await lp24449b1.settle();}
   const filterAfter={context:lp24449b1.identity(),activeCounty:gridlyGetActiveCountyId(),inventoryOwner:gridlyCrossingInventoryCountyId,resolution:gridlyCountyModeContextResolution,center:map.getCenter(),anchor:getGridlyAwarenessAnchor(),alertsOwner:Object.values(gridlyReadAlertsFamilyAuthority()).map(f=>f.owner),driveOwner:gridlyLp028DriveTexasAreaLifecycleAudit().currentAwarenessViewCounty};
   const sourceCoverage=gridlyGetLocalSourceCoverage(),sourceCopy={location:document.getElementById('mobileAwarenessPanelIssues')?.innerText,top:document.querySelector('.gridly-v2-status-pill')?.innerText,pulseHeadline:document.getElementById('gridlyCommunityPulseHeadline')?.innerText,pulseSubline:document.getElementById('gridlyCommunityPulseSubline')?.innerText,kbyg:document.getElementById('gridlyBriefInteractionPanel')?.innerText,confidence:gridlyTravelBriefConfidenceLine(buildGridlyAwarenessStory())};
   const crossingProof={owner:gridlyCrossingInventoryCountyId,loaded:crossings.length,allOwned:crossings.every(c=>gridlyCrossingSampleMatchesCounty(c,row.county_id)),coverage:getGridlyAwarenessCoverageState(),inventoryIds:crossings.map(c=>c.id),publicIds:crossings.filter(c=>isGridlyPublicRoadwayCrossing(c)&&isGridlyReportableCrossing(c)).map(c=>c.id),eligibleIds:gridlySelectConsumerVisibleCrossings(getGridlySelectedAwarenessArea()).map(c=>c.id)};
   const context=lp24449b1.identity(),weather=gridlyResolveGovernedWeatherPoint();
   const checks={bareDiscoverable:bare.some(r=>r.placeGeoid===row.place_geoid),qualifiedDiscoverable:!!result,
    resultCounty:result?.requestedOperationalCountyId===row.county_id,
    publishedPlace:context.place===row.place_geoid,publishedCounty:context.county===row.county_id,
    activeCounty:gridlyGetActiveCountyId()===row.county_id,temporaryType:context.type==='SEARCH',
    latitude:Math.abs(context.lat-row.presentation_lat)<0.000001,longitude:Math.abs(context.lng-row.presentation_lng)<0.000001,
    weatherPlace:weather?.placeGeoid===row.place_geoid,weatherCounty:weather?.countyId===row.county_id,
    homeBytesPreserved:JSON.stringify(bytes)===JSON.stringify(lp24449b1.bytes())};
   checks.countyFilterOwner=!row.is_multi_county||(filterAfter.activeCounty===row.county_id&&filterAfter.inventoryOwner===row.county_id&&filterAfter.context.county===row.county_id);
   checks.crossingOwner=crossingProof.owner===row.county_id&&crossingProof.allOwned;
   checks.sourceTruth=!sourceCoverage.complete&&!/No active issues nearby|Community is quiet|Quiet conditions/i.test(Object.values(sourceCopy).join(' '));
   return {...row,query,filterBefore,filterAfter,sourceCoverage,sourceCopy,crossingProof,bare:bare.map(r=>({place:r.placeGeoid,county:r.requestedOperationalCountyId,title:r.title,provider:r.provider})),
    qualified:qualified.map(r=>({place:r.placeGeoid,county:r.requestedOperationalCountyId,title:r.title,provider:r.provider})),context,weather,checks,pass:Object.values(checks).every(Boolean)};
  },row);
  entry.sourceHash=sourceHash;entry.runtimeMs=Date.now()-started;entry.completedAt=new Date().toISOString();records.push(entry);fs.appendFileSync(file,JSON.stringify(entry)+'\n');
  if(records.length%25===0)console.log(JSON.stringify({done:records.length,total:inventory.rows.length,failed:records.filter(r=>!r.pass).length,last:row.county_id}));
 }
 write(`${out}/search-recertification.json`,{completed:true,sourceHash,canonicalHomeBaseline:'Dayton / Liberty County; configured saved Home and Work preserved',count:records.length,passed:records.filter(r=>r.pass).length,acquisition:'Local governed exact bare and county-qualified queries; external network blocked; actual returned result selected without injected county',records,evidence});
 fs.writeFileSync(`${out}/search-recertification.csv`,'county_id,place_geoid,pass,failed_checks\n'+records.map(r=>`${r.county_id},${r.place_geoid},${r.pass},${Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k).join('|')}`).join('\n')+'\n');
}finally{await session.close();}
