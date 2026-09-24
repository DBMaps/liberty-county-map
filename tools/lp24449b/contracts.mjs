import crypto from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {loadInventory,root,out,write,read} from './inventory.mjs';
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex');
const require=createRequire(import.meta.url);
const session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true});
try {
  const {page,evidence}=await session.newPage();
  const inventory=loadInventory();
  const records=await page.evaluate(rows=>{
    const options=getGridlyManualAwarenessAreaOptions();
    return rows.map(row=>{
      const group=options.find(g=>g.countyId===row.county_id);
      const option=group?.communities.find(o=>o.placeGeoid===row.place_geoid);
      const resolution=option?.canonicalResolution;
      const record={zip:'',countyId:row.county_id,countyName:row.county_name,
        countyMemberships:resolution?.countyMemberships,communityKey:row.place_geoid,
        communityLabel:row.community_name,awarenessAreaKey:`place-${row.place_geoid}`,
        consumerLabel:row.community_name,identityType:'PLACE_GEOID',canonicalRegionId:null,
        resolutionStatus:'manual_confirmed',resolutionMethod:'lp24449b-contract',sourceVersion:'LP217',
        confirmedAt:'2026-09-24T00:00:00.000Z',schemaVersion:GRIDLY_LP0517_HOME_PERSONALIZATION_SCHEMA_VERSION};
      const validation=gridlyLp0517ValidateHomeRecord(JSON.parse(JSON.stringify(record)));
      const area=validation.area;
      const checks={optionExists:!!option,optionPlace:resolution?.placeGeoid===row.place_geoid,
        optionCounty:option?.requestedOperationalCountyId===row.county_id,
        stableValue:option?.value===option?.key,roundtripValid:validation.valid,
        roundtripPlace:area?.placeGeoid===row.place_geoid,roundtripCounty:area?.countyId===row.county_id,
        latitude:Math.abs(area?.lat-row.presentation_lat)<0.000001,
        longitude:Math.abs(area?.lng-row.presentation_lng)<0.000001};
      return {...row,checks,pass:Object.values(checks).every(Boolean),option:{value:option?.value,resolution},record,area};
    });
  },inventory.rows);
  const regionProtection=await page.evaluate(regions=>regions.map(region=>{
    const option=getGridlyManualAwarenessAreaOptions().find(group=>group.countyId===region.countyId)?.communities.find(option=>option.key===region.regionId);
    const area=gridlyResolveStableHomeSelectionArea(region.regionId,region.countyId);
    const checks={optionPreserved:!!option&&!option.canonicalResolution,stableKey:area?.key===region.regionId,county:area?.countyId===region.countyId,regionIdentity:area?.sanAntonioRegion===true,noPlacePromotion:!gridlyResolveCanonicalPlaceGeoid(area)};
    return {regionId:region.regionId,checks,pass:Object.values(checks).every(Boolean)};
  }),read('data/runtime/san-antonio-consumer-regions.json').regions);
  write(`${out}/home-identity-summary.json`,{sourceHash,scope:'All governed membership option and production validation JSON roundtrip contracts; browser save/reload recorded separately',count:records.length,passed:records.filter(r=>r.pass).length,records,regionProtection,evidence});
  fs.writeFileSync(`${out}/home-identity-summary.csv`,'county_id,place_geoid,pass,failed_checks\n'+records.map(r=>`${r.county_id},${r.place_geoid},${r.pass},${Object.entries(r.checks).filter(([,v])=>!v).map(([k])=>k).join('|')}`).join('\n')+'\n');
  console.log(JSON.stringify({total:records.length,pass:records.filter(r=>r.pass).length,failures:records.filter(r=>!r.pass).slice(0,12)}));
} finally {await session.close();}
