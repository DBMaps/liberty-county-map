import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {loadInventory,root,out,artifacts,read,write} from './inventory.mjs';
const inv=loadInventory(),require=createRequire(import.meta.url),session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true});
const prior=read('reports/lp24449a/original-in-scope-failures.json').filter(r=>r.code.startsWith('SEARCH_'));
const collisions=read('reports/lp24449a/certification-cohorts.json').collisionGroups;
const keys=new Set(prior.map(r=>r.place_geoid));collisions.flat().forEach(r=>keys.add(r.placeGeoid));
const rows=inv.communities.filter(r=>keys.has(r.placeGeoid)).map(r=>inv.rows.find(m=>m.place_geoid===r.placeGeoid)).sort((a,b)=>a.county_fips.localeCompare(b.county_fips));
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex');
const previous=process.argv.includes('--resume')&&fs.existsSync(`${out}/visible-search.json`)?read('reports/lp24449b1/visible-search.json'):null;
const records=previous?.sourceHash===sourceHash?previous.records:[];let ctx,p;
const limit=Number(process.argv.find(a=>a.startsWith('--limit='))?.split('=')[1]||Infinity);
try {
 ctx=await session.newPage();p=ctx.page;await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});await p.evaluate(()=>lp24449b1.settle());
 async function query(q){
  await p.locator('#mobileDestinationCommandBtn').evaluate(n=>n.click());await p.locator('#gridlyAddressSearchInput').fill(q);await p.locator('#gridlyRemoteSearchBtn').evaluate(n=>n.click());
  await p.waitForTimeout(350);await p.waitForFunction(()=>gridlySearchUiState.isSearching===false);
  return p.evaluate(()=>({results:gridlySearchUiState.lastRenderedResults.map((r,index)=>({index,place:r.placeGeoid,county:r.requestedOperationalCountyId,title:r.title,provider:r.provider})),dom:[...document.querySelectorAll('#gridlySearchResults .gridly-search-result-item')].map(n=>({index:Number(n.dataset.resultIndex),text:n.innerText})),status:[...document.querySelectorAll('#gridlySearchResults .gridly-search-results-status')].map(n=>n.textContent),audit:gridlySearchUiState.lastLiveSearchAudit}));
 }
 for(const row of rows.filter(r=>!records.some(old=>old.place_geoid===r.place_geoid&&old.pass)).slice(0,limit)){const entry={...row};try{
  entry.bare=await query('  '+row.community_name.toUpperCase()+'  ');
  const group=collisions.find(g=>g.some(c=>c.placeGeoid===row.place_geoid));
  // The prior audit's punctuation-free collision key conflates Lakeview with
  // Lake View. Exact-name Search preserves that meaningful word boundary;
  // each spelling must resolve independently, not masquerade as its neighbor.
  const exactName=name=>name.toLowerCase().trim().replace(/\s+/g,' ');
  entry.collisionKind=group&&new Set(group.map(r=>exactName(r.displayName))).size>1?'NORMALIZATION_ONLY_WORD_BOUNDARY':'EXACT_NAME';
  entry.collisionGroup=group?.map(r=>({place:r.placeGeoid,name:r.displayName}));
  entry.expectedBare=(group?group.filter(r=>exactName(r.displayName)===exactName(row.community_name)):[{placeGeoid:row.place_geoid}]).map(r=>r.placeGeoid);
  await p.locator('#gridlySearchCloseBtn').evaluate(n=>n.click());
  entry.qualified=await query(`${row.community_name}, ${row.county_name}, TX`);
  const result=entry.qualified.results.find(r=>r.place===row.place_geoid&&r.county===row.county_id);
  if(!result)throw Error('Expected county-qualified visible result missing');
  await p.screenshot({path:`${artifacts}/search-visible-${row.place_geoid}.png`});
  await p.locator(`#gridlySearchResults [data-result-index="${result.index}"]`).evaluate(n=>n.click());
  await p.evaluate(()=>lp24449b1.settle());entry.context=await p.evaluate(()=>lp24449b1.identity());
  await p.locator('#gridlySearchCloseBtn').evaluate(n=>n.click());
  entry.checks={bare:entry.expectedBare.every(id=>entry.bare.results.some(r=>r.place===id)),published:entry.context.place===row.place_geoid&&entry.context.county===row.county_id,noContradictoryFailureMessage:![...entry.bare.status,...entry.qualified.status].some(s=>/unavailable|couldn.t confirm/i.test(s)),distinctCollisionChoices:!group||new Set(entry.bare.dom.filter(d=>entry.bare.results.some(r=>r.index===d.index&&entry.expectedBare.includes(r.place))).map(d=>d.text)).size===entry.expectedBare.length};
  entry.pass=Object.values(entry.checks).every(Boolean);
 }catch(error){entry.error=String(error.stack);entry.pass=false;}
 const previousIndex=records.findIndex(r=>r.place_geoid===row.place_geoid);if(previousIndex<0)records.push(entry);else records[previousIndex]=entry;
 write(`${out}/visible-search.json`,{sourceHash,count:records.length,total:rows.length,collisionGroups:collisions.length,collisionIdentities:collisions.flat().length,records,network:ctx.evidence,priorNetwork:previous?.network});console.log(JSON.stringify({place:row.place_geoid,pass:entry.pass,error:entry.error}));if(entry.error)break;
 }
}finally{await session.close();}
