import fs from 'fs';import vm from'vm';import{countyRegistryRange}from'../../scripts/lp189-statewide-runtime-activation-guarded.mjs';const s=fs.readFileSync('js/app.js','utf8');
function expr(name){let p=s.indexOf(`const ${name} =`), st=s.indexOf('=',p)+1,i=st,dep=0,q=null;for(;i<s.length;i++){let c=s[i],prev=s[i-1];if(q){if(c===q&&prev!=='\\')q=null;continue}if("'\"`".includes(c)){q=c;continue}if('([{'.includes(c))dep++;if(')]}'.includes(c))dep--;if(c===';'&&dep===0)return s.slice(st,i)}throw 0}
const rr=countyRegistryRange(s),ctx={};vm.createContext(ctx);vm.runInContext(s.slice(0,rr.end)+';this.r=GRIDLY_COUNTY_REGISTRY',ctx);const registry=ctx.r,norm=x=>String(x||'').trim().toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const names=['GRIDLY_COUNTY_WIDE_AWARENESS_LABEL','GRIDLY_COUNTY_WIDE_HOME_TOWN','GRIDLY_MONTGOMERY_COUNTY_WIDE_AWARENESS_LABEL','GRIDLY_MONTGOMERY_COUNTY_WIDE_HOME_TOWN','GRIDLY_SAN_JACINTO_COUNTY_WIDE_AWARENESS_LABEL','GRIDLY_SAN_JACINTO_COUNTY_WIDE_HOME_TOWN','GRIDLY_CHAMBERS_COUNTY_WIDE_AWARENESS_LABEL','GRIDLY_CHAMBERS_COUNTY_WIDE_HOME_TOWN'];let vals={};for(let n of names) vals[n]=vm.runInNewContext(expr(n));let starters=vm.runInNewContext(expr('GRIDLY_AWARENESS_AREA_DEFINITIONS'),vals);const selectable=Object.entries(registry).filter(([,x])=>x.operational&&x.selectable&&x.productionEnabled);
for(let[cid,x]of selectable)if(!starters.some(a=>a.countyId===cid&&a.countyWide))starters.push({key:cid.replace(/-tx$/,'-county'),label:x.name,storageValue:x.name,countyId:cid,countyWide:true,source:'V819 operational county registry selector bridge'});
const hou=vm.runInNewContext(expr('GRIDLY_LP035_HOUSTON_REGION_MODEL'));for(let x of hou)if(!starters.some(a=>a.key===x.id))starters.push({key:x.id,label:x.label,storageValue:`Houston — ${x.label}`,countyId:'harris-tx',houstonRegion:true,source:'LP035.1 Houston regional awareness model'});
const sa=vm.runInNewContext(expr('GRIDLY_LP194_SAN_ANTONIO_REGION_MODEL'));for(let x of sa)if(!starters.some(a=>a.key===x.id))starters.push({key:x.id,label:x.label,storageValue:`San Antonio — ${x.label}`,countyId:x.countyId,sanAntonioRegion:true,source:'LP194 certified LP193 geometry activation'});
for(let[cid,x]of selectable){let inv=[...(x.consumerAwarenessAreas||[]).map(a=>a.displayName),...(x.defaultAwarenessAreas||[])];for(let [i,name]of inv.entries()){let n=norm(name),cl=norm(x.name);if(!n||n==='other'||n===cl||/ county$/.test(n)||/^entire .+ county$/.test(n))continue;if(starters.some(a=>a.countyId===cid&&norm(a.storageValue||a.label)===n))continue;let can=(x.consumerAwarenessAreas||[]).find(a=>norm(a.displayName)===n);starters.push({key:`${cid}-${String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`,label:name,storageValue:name,countyId:cid,communityId:can?.placeGeoid||null,placeGeoid:can?.placeGeoid||null,canonicalCommunityIdentity:can?.canonicalIdentity||null,source:can?.focus?.source||'V904R6 runtime registry community bridge'})}}
function pg(a){let ex=String(a.placeGeoid||a.communityId||'');if(/^48\d{5}$/.test(ex))return ex;if(a.countyWide||a.fallback)return null;let c=(registry[a.countyId]?.consumerAwarenessAreas||[]).filter(x=>norm(x.displayName)===norm(a.label||a.storageValue));return c.length===1&&/^48\d{5}$/.test(c[0].placeGeoid)?c[0].placeGeoid:null}
function placeGeoid(a){let ex=String(a.placeGeoid||a.communityId||'');if(/^48\d{5}$/.test(ex))return ex;if(a.countyWide||a.fallback)return null;let c=(registry[a.countyId]?.consumerAwarenessAreas||[]).filter(x=>norm(x.displayName)===norm(a.label||a.storageValue));return c.length===1&&/^48\d{5}$/.test(c[0].placeGeoid)?c[0].placeGeoid:null}
let areas = starters.map((area) => ({ ...area, placeGeoid: placeGeoid(area), canonicalKey: area.canonicalKey || (/^place-48\d{5}$/.test(area.key) ? area.key : null) }));
const bySource = Object.fromEntries(Object.entries(Object.groupBy(areas, (area) => area.source)).map(([source, rows]) => [source, rows.length]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
const canonicalRows = areas.filter((area) => area.placeGeoid);
const countyWideRows = areas.filter((area) => area.countyWide === true);
const fallbackRows = areas.filter((area) => area.fallback === true);
const nonPlaceRows = areas.filter((area) => !area.placeGeoid && !area.countyWide && !area.fallback);
const acceptedNonPlaceRows = nonPlaceRows.filter((area) => area.sanAntonioRegion === true);
const rejectedNonPlaceRows = nonPlaceRows.filter((area) => area.sanAntonioRegion !== true);
const uniquePlaceGeoids = new Set(canonicalRows.map((area) => area.placeGeoid));
const report = Object.freeze({
  schemaVersion: "gridly.lp240x.supported-area-identity-audit.v1",
  auditOnly: true,
  productionBehaviorChanged: false,
  counts: Object.freeze({
    supportedAwarenessAreaCount: areas.length,
    withPlaceGeoidCount: canonicalRows.length,
    withoutPlaceGeoidCount: areas.length - canonicalRows.length,
    withCanonicalKeyCount: areas.filter((area) => area.canonicalKey).length,
    withoutCanonicalKeyCount: areas.filter((area) => !area.canonicalKey).length,
    countyWideCount: countyWideRows.length,
    fallbackCount: fallbackRows.length,
    safeApproximateCommunityAnchorCount: areas.filter((area) => area.source === "safe approximate community anchor").length,
    canonicalPlaceMembershipProjectionCount: canonicalRows.length,
    canonicalPlaceUniqueCount: uniquePlaceGeoids.size,
    multiCountyAdditionalMembershipProjectionCount: canonicalRows.length - uniquePlaceGeoids.size,
    governedNonPlaceCount: nonPlaceRows.length,
    homeAreaEligibleCount: areas.length - fallbackRows.length,
    canonicalPlaceHomeAreaEligibleCount: canonicalRows.length,
    nonPlaceHomeAreaEligibleCount: nonPlaceRows.length,
    currentValidatorAcceptedCount: canonicalRows.length + countyWideRows.length + acceptedNonPlaceRows.length,
    currentValidatorRejectedEligibleCount: rejectedNonPlaceRows.length,
    tarkingtonDefectCohortCount: rejectedNonPlaceRows.length
  }),
  classifications: Object.freeze({ CANONICAL_PLACE_MEMBERSHIP_PROJECTION: canonicalRows.length, GOVERNED_NON_PLACE: nonPlaceRows.length, COUNTY_WIDE: countyWideRows.length, FALLBACK: fallbackRows.length, UNRESOLVED: 0 }),
  bySource: Object.freeze(bySource),
  byCounty: Object.freeze(Object.fromEntries(Object.entries(Object.groupBy(areas, (area) => area.countyId)).map(([countyId, rows]) => [countyId, rows.length]).sort())),
  governedNonPlace: Object.freeze(nonPlaceRows.map((area) => Object.freeze({ key: area.key, label: area.label, countyId: area.countyId, source: area.source, validatorAccepted: area.sanAntonioRegion === true, stableIdentity: `${area.countyId}:${area.key}` }))),
  fallback: Object.freeze(fallbackRows.map((area) => ({ key: area.key, label: area.label, countyId: area.countyId, source: area.source })))
});
export { areas, registry, report };
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.includes("--write")) fs.writeFileSync("reports/lp240x/supported-area-identity-audit.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}
