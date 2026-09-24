import fs from 'node:fs';import vm from 'node:vm';
import {read,write,out,loadInventory} from './inventory.mjs';
const inv=loadInventory(),app=fs.readFileSync('js/app.js','utf8'),st=read('.artifacts/lp24449b1/static-certification.json');
const source=name=>{const match=app.match(new RegExp(`function ${name}\\([^]*?^\\}`,'m'));if(!match)throw Error(name);return match[0];};
const membership=read('data/runtime/canonical-crossing-memberships-v1.json'),index=read('evidence/wave3a2-crossing-package-manufacture/reconciliation-index.json');
const owners=new Map(index.entries.map(x=>[x.crossingId,x.gridlyCountyFips]));
const names=['gridlyNormalizeCrossingEligibilityId','gridlyGetCrossingReportEligibility','isGridlyReportableCrossing','isGridlyPublicRoadwayCrossing','gridlyCrossingSampleMatchesCounty','gridlyGetActiveCountyCrossingInventory','gridlyResolveCrossingRenderInventory','getGridlyRegionalCrossingVisibilityPolicy'];
const policy=app.slice(app.indexOf('const GRIDLY_REGIONAL_CROSSING_VISIBILITY_POLICY'),app.indexOf('\n});',app.indexOf('const GRIDLY_REGIONAL_CROSSING_VISIBILITY_POLICY'))+4);
const box={GRIDLY_COUNTY_REGISTRY:inv.registry,gridlyNormalizeCountyId:x=>x,gridlyNormalizeCountyAssetOwnerToken:x=>x.replace(/-tx$/,'')};vm.createContext(box);vm.runInContext(policy+'\n'+names.map(source).join('\n'),box);
const rows=[];
for(const county of inv.counties){const pkg=st.packages.find(p=>p.county_id===county.countyId),features=read(pkg.package_path).features;
 // normalizeGridlyCrossingFeatures assigns countyId/sourceCounty from the
 // governed requested package. Source STCYFIPS remains untouched in props.
 const inventory=features.map(f=>({id:'FRA-'+f.properties.CROSSING,lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0],name:f.properties.STREET||'',props:f.properties,countyId:county.countyId,sourceCounty:county.countyId,county:county.countyName}));
 box.crossings=inventory;box.gridlyCrossingInventoryCountyId=county.countyId;box.gridlyGetActiveCountyId=()=>county.countyId;
 for(const row of inv.rows.filter(r=>r.county_id===county.countyId)){
  const canonical=membership.places[row.place_geoid].x,sourceCountyIds=canonical.filter(x=>String(x[1])===county.fips).map(x=>String(x[0]));
  const ownedIds=[...new Set(canonical.map(x=>String(x[0])).filter(id=>owners.get(id)===county.fips))];
  const byId=new Map(inventory.map(c=>[c.id.replace(/^FRA-/,''),c]));
  const eligible=ownedIds.map(id=>byId.get(id)).filter(c=>c&&box.isGridlyPublicRoadwayCrossing(c)&&box.isGridlyReportableCrossing(c));
  // Match gridlyCanonicalCrossingRuntime.resolveRecords exactly: canonical
  // record IDs are bare FRA IDs; package adapter IDs carry the FRA- prefix.
  // The existing render resolver's governed-inventory fallback preserves them.
  const rendered=box.gridlyResolveCrossingRenderInventory({authorityAvailable:true,records:canonical.map(x=>({id:String(x[0])}))});
  const policy=box.getGridlyRegionalCrossingVisibilityPolicy({zoom:15,inventoryCount:rendered.length,bounds:{contains:()=>true},activeCountyId:county.countyId});
  const checks={allOwnedCanonicalIdentitiesPresent:ownedIds.every(id=>byId.has(id)),eligibleRenderInventory:eligible.every(c=>rendered.some(x=>x.id===c.id)),renderOwner:rendered.every(c=>c.countyId===county.countyId),streetPolicy:eligible.length===0||(policy.allowMarkers&&policy.renderMode==='viewport-all'&&policy.markerLimit===null)};
  rows.push({...row,originalClassification:pkg.state==='ACTIVE_EMPTY'?'ACTIVE_EMPTY_COUNTY':sourceCountyIds.length?'WITH_COMMUNITY_CROSSINGS':'WITHOUT_COMMUNITY_CROSSINGS',sourceCountyIds,governedOwnedCanonicalIds:ownedIds,sourceLineageOutsideOperationalPackage:sourceCountyIds.filter(id=>owners.get(id)!==county.fips),eligibleIds:eligible.map(c=>c.id),renderInventoryIds:rendered.map(c=>c.id),checks,pass:Object.values(checks).every(Boolean)});
 }
}
write(`${out}/crossing-statewide-recertification.json`,{scope:'All package ownership and source lineage joins, plus actual production reportability/render selection functions. Permissive viewport proves per-identity potential visibility when panned; actual browser loading and discoverability must additionally pass.',sourceFunctions:names,packageAudit:read('reports/lp24449b1/crossing-package-audit.json'),canonicalJoin:st.canonicalCrossing.summary,summary:{counties:254,memberships:rows.length,classificationCounts:Object.fromEntries(['WITH_COMMUNITY_CROSSINGS','WITHOUT_COMMUNITY_CROSSINGS','ACTIVE_EMPTY_COUNTY'].map(k=>[k,rows.filter(r=>r.originalClassification===k).length])),passed:rows.filter(r=>r.pass).length},rows});
console.log(JSON.stringify({rows:rows.length,failed:rows.filter(r=>!r.pass).map(r=>({county:r.county_id,place:r.place_geoid,checks:r.checks}))}));
