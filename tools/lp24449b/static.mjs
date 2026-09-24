import fs from 'node:fs';
import path from 'node:path';
import {loadInventory,read,write,artifacts} from './inventory.mjs';
import {buildCertification} from '../lp239/build-statewide-crossing-certification.mjs';
const inv=loadInventory(),checks=[];
const check=(name,pass,detail)=>checks.push({name,pass,detail});
const unique=a=>new Set(a).size===a.length;
check('unique_county_ids',unique(inv.counties.map(c=>c.countyId)));
check('unique_county_fips',unique(inv.counties.map(c=>c.fips)));
check('unique_place_geoids',unique(inv.communities.map(c=>c.placeGeoid)));
check('unique_memberships',unique(inv.rows.map(r=>r.place_geoid+'|'+r.county_fips)));
for(const p of inv.communities)check('non_orphan:'+p.placeGeoid,p.countyMemberships.length>0);
for(const r of inv.rows){
  check('membership:'+r.place_geoid+':'+r.county_fips,Boolean(r.county_id&&inv.registry[r.county_id]));
  check('coordinate:'+r.place_geoid+':'+r.county_fips,Number.isFinite(r.presentation_lat)&&Number.isFinite(r.presentation_lng)&&r.presentation_lat>25&&r.presentation_lat<37&&r.presentation_lng>-107&&r.presentation_lng<-93);
}
const manifest=read('Crossing-Packages/production-crossing-manifest.json');
const packages=manifest.records.map(m=>{
  const county=inv.counties.find(c=>c.countyName===m.county+' County');
  const geo=read(m.packageFile),features=geo.features||[];
  const ids=features.map(f=>String(f.properties.CROSSING));
  const ownerMismatches=features.filter(f=>String(f.properties.STCYFIPS)!==county?.fips).map(f=>({id:f.properties.CROSSING,fips:f.properties.STCYFIPS}));
  const d={county_id:county?.countyId,county_fips:county?.fips,package_path:m.packageFile,manifest_status:m.status,declared:m.crossingCount,records:features.length,public_records:features.filter(f=>String(f.properties.TYPEXING).toLowerCase()==='public').length,state:features.length?'ACTIVE_POSITIVE':'ACTIVE_EMPTY',source_fips_differences:ownerMismatches,ids_unique:unique(ids)};
  // Source jurisdiction is preserved provenance, not package ownership.
  // Governed package assignment is independently checked against the certified
  // geographic reconciliation index in crossing-ownership.mjs.
  check('package:'+m.county,Boolean(county)&&features.length===m.crossingCount&&d.ids_unique,d);
  check('known_record_fips:'+m.county,features.every(f=>inv.counties.some(c=>c.fips===String(f.properties.STCYFIPS))));return d;
});
check('one_package_per_county',packages.length===inv.counties.length&&unique(packages.map(p=>p.county_id)));
const crossing=await buildCertification();
for(const r of crossing.rows)check('canonical_crossing_join:'+r.canonicalPlaceId,r.crossingAuthorityPass);
const membershipArtifact=read('data/runtime/canonical-crossing-memberships-v1.json');
const membershipCrossings=inv.rows.map(r=>{const p=membershipArtifact.places[r.place_geoid],ids=(p?.x||[]).filter(x=>String(x[1])===r.county_fips).map(x=>String(x[0]));return {place:r.place_geoid,county:r.county_id,countyFips:r.county_fips,selectedCountyIds:ids,canonicalAllMembershipCount:(p?.x||[]).length};});
const groups=new Map();for(const c of inv.communities){const k=c.displayName.toLowerCase().replace(/[^a-z0-9]/g,'');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}
const nameAudit={duplicates:[...groups.values()].filter(g=>g.length>1),punctuation:inv.communities.filter(c=>/[^a-zA-Z0-9 ]/.test(c.displayName)),directional:inv.communities.filter(c=>/^(North|South|East|West|Northeast|Northwest|Southeast|Southwest)\b/i.test(c.displayName)),saintFort:inv.communities.filter(c=>/\b(Saint|St\.?|Fort|Ft\.?)\b/i.test(c.displayName))};
const edge=new Map();const add=(r,reason)=>{let e=edge.get(r.place_geoid)||{...r,reasons:[]};e.reasons.push(reason);edge.set(r.place_geoid,e);};
for(const [key,reason,ascending]of [['presentation_lng','far-west',true],['presentation_lng','east-border',false],['presentation_lat','rio-grande-south',true],['presentation_lat','panhandle-north',false]])for(const r of [...inv.rows].sort((a,b)=>ascending?a[key]-b[key]:b[key]-a[key]).slice(0,12))add(r,reason);
for(const r of inv.rows)if(r.is_multi_county)add(r,'multi-county-boundary');
for(const list of Object.values(nameAudit))for(const p of list.flat())for(const r of inv.rows.filter(r=>r.place_geoid===p.placeGeoid))add(r,'name-edge');
for(const c of inv.counties){const rows=inv.rows.filter(r=>r.county_id===c.countyId);if(rows.length<=2)for(const r of rows)add(r,'sparse-county-rural-proxy');}
const historical=['Dayton','Cleveland','Crosby','Austin','Abilene','Dallas','San Antonio','Fredericksburg','Port Arthur','Midland','Sulphur Springs','Pecos','Town of Pecos'];
for(const r of inv.rows.filter(r=>historical.includes(r.community_name)))add(r,'historically-sensitive');
const result={totals:{counties:inv.counties.length,communities:inv.communities.length,memberships:inv.rows.length,multiCountyCommunities:inv.communities.filter(p=>p.countyMemberships.length>1).length,multiCountyMemberships:inv.rows.filter(r=>r.is_multi_county).length,positive:packages.filter(p=>p.records).length,empty:packages.filter(p=>!p.records).length,crossingRecords:packages.reduce((n,p)=>n+p.records,0)},checks,failures:checks.filter(c=>!c.pass),packages,canonicalCrossing:crossing,membershipCrossings,nameAudit,edgeSet:[...edge.values()],edgeMethod:'Coordinate extrema, all multi-county PLACE identities, name edges, sparse-community counties; sparse is a proxy, not population evidence.'};
write(path.join(artifacts,'static-certification.json'),result);
const returnCohort=new Set(result.edgeSet.map(r=>r.place_geoid));
for(const c of inv.counties){const rs=inv.rows.filter(r=>r.county_id===c.countyId);returnCohort.add((rs.find(r=>!r.is_multi_county)||rs[0]).place_geoid);}
write(path.join(artifacts,'return-cohort.json'),[...returnCohort].sort());
console.log(JSON.stringify({totals:result.totals,assertions:checks.length,failures:result.failures.map(f=>f.name),edgeCount:edge.size}));
