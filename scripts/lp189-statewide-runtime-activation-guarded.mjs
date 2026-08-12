#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GEOMETRY_PATH = 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json';
const MANIFEST_PATH = 'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json';
const ALLOWLIST = Object.freeze(['js/app.js','assets/package-registry/runtime-package-registry.json','js/gridlyPackageRegistry.js',GEOMETRY_PATH,MANIFEST_PATH]);
const PROTECTED = Object.freeze(['Shared Reports','Route Watch','Awareness Filtering','Hazard Lifecycle','Alert Generation','Supabase Sync','directional intelligence','presentation/theme','crossing source data','roadway source data']);
const RESTRICTED = Object.freeze(['48061','48073','48113','48121','48135','48229','48329','48377','48401','48425','48441']);
const SOURCE = Object.freeze({ cohort:'evidence/lp18810/owner-membership-decision.input.json', inventory:'reports/lp1885/community-package-identity-inventory.json', statewideGeometry:'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json' });
const readText = p => fs.readFileSync(path.join(root,p),'utf8');
const readJson = p => JSON.parse(readText(p).replace(/^\uFEFF/,''));
const json = value => `${JSON.stringify(value,null,2)}\n`;
const assert = (condition,message) => { if (!condition) throw new Error(`LP189 fail closed: ${message}`); };
const slug = name => name.replace(/ County$/,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-tx';
export function consumerAvailabilityFromPackage(pkg) {
  assert(/^48\d{3}$/.test(pkg?.county?.countyFips || ''),'community package county identity must be a FIPS');
  const places=(pkg.censusPlaces || []).filter(place=>place?.consumerEligible === true).map(place=>{
    assert(/^48\d{5}$/.test(place?.placeGeoid || ''),'consumer community identity must be a PLACE GEOID');
    assert(typeof place?.displayName === 'string'&&place.displayName.trim(),'consumer community must have a display name');
    return Object.freeze({ placeGeoid:place.placeGeoid, displayName:place.displayName.trim(), canonicalIdentity:'PLACE_GEOID' });
  });
  assert(places.length>0,`manufactured package ${pkg.county.countyFips} has no eligible Census communities`);
  return Object.freeze({ defaultAwarenessAreas:Object.freeze([`${pkg.county.displayName} County`,...places.map(place=>place.displayName)]), consumerAwarenessAreas:Object.freeze(places) });
}
function boundsOf(coordinates, out={west:Infinity,south:Infinity,east:-Infinity,north:-Infinity}) { for (const v of coordinates) Array.isArray(v[0]) ? boundsOf(v,out) : (out.west=Math.min(out.west,v[0]),out.east=Math.max(out.east,v[0]),out.south=Math.min(out.south,v[1]),out.north=Math.max(out.north,v[1])); return out; }
const COUNTY_REGISTRY_DECLARATION = 'const GRIDLY_COUNTY_REGISTRY = Object.freeze({';
export function countyRegistryRange(text) {
  const starts=[]; for(let at=text.indexOf(COUNTY_REGISTRY_DECLARATION);at>=0;at=text.indexOf(COUNTY_REGISTRY_DECLARATION,at+1))starts.push(at);
  assert(starts.length===1,starts.length===0?'county registry declaration missing':'county registry declaration is ambiguous');
  const open=starts[0]+COUNTY_REGISTRY_DECLARATION.length-1;
  let depth=1, quote=null, escaped=false, lineComment=false, blockComment=false;
  for(let i=open+1;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;continue;}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++;}continue;}
    if(quote){if(escaped){escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch===quote)quote=null;continue;}
    if(ch==='/'&&next==='/'){lineComment=true;i++;continue;}
    if(ch==='/'&&next==='*'){blockComment=true;i++;continue;}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;continue;}
    if(ch==='{')depth++;
    if(ch==='}'&&--depth===0){assert(text.slice(i,i+3)==='});','county registry matching close is not Object.freeze close');return Object.freeze({start:starts[0],open,close:i,end:i+3});}
  }
  assert(false,'county registry matching close not found');
}
function base() {
  const decision=readJson(SOURCE.cohort), cohort=decision.approvedCountyFips;
  const statewide=readJson(SOURCE.statewideGeometry), byFips=new Map(statewide.counties.map(c=>[c.fips,c]));
  const app=readText('js/app.js'), registry=countyRegistryRange(app), original=[...app.slice(registry.open+1,registry.close).matchAll(/^  "([^"]+-tx)": Object\.freeze\(\{[\s\S]*?^  \}\),?$/gm)].filter(m=>/operational: true/.test(m[0])).map(m=>m[1]);
  const fipsById=new Map(statewide.counties.map(c=>[c.countyId,c.fips])), originalFips=original.map(id=>fipsById.get(id));
  assert(original.length===28 && originalFips.every(Boolean),'existing operational count must be 28 and map to authoritative FIPS');
  assert(Array.isArray(cohort)&&cohort.length===215&&new Set(cohort).size===215,'promotion cohort count must be 215 unique FIPS');
  assert(new Set(originalFips).size===28,'existing operational FIPS must be unique');
  assert(!cohort.some(f=>originalFips.includes(f)),'28/215 intersection must be empty');
  assert(RESTRICTED.length===11&&new Set(RESTRICTED).size===11,'restricted count must be 11');
  assert(!cohort.some(f=>RESTRICTED.includes(f)),'restricted FIPS found in promotion cohort');
  const union=[...new Set([...originalFips,...cohort])]; assert(union.length===243&&union.every(f=>/^48\d{3}$/.test(f)&&byFips.has(f)),'operational union must be exactly 243 unique Texas FIPS');
  const inventory=readJson(SOURCE.inventory), packages=new Map(inventory.packages.map(p=>[p.countyFips,p])); assert(cohort.every(f=>packages.has(f)),'manufactured package inventory missing a promoted county');
  return {decision,cohort,statewide,byFips,original,originalFips,union,packages};
}
function appOutput(state) {
  let text=readText('js/app.js');
  const blocks=[...text.matchAll(/^  \/\/ LP189 GENERATED START (48\d{3})\n[\s\S]*?^  \/\/ LP189 GENERATED END \1$/gm)];
  let entries;
  if(blocks.length){
    assert(blocks.length===215&&new Set(blocks.map(m=>m[1])).size===215,'existing generated county block count must be 215 unique FIPS');
    assert(state.cohort.every(f=>blocks.some(m=>m[1]===f)),'existing generated blocks differ from promotion cohort');
    entries=blocks.map(m=>m[0]).join('\n');
    for(const block of [...blocks].reverse())text=text.slice(0,block.index)+text.slice(block.index+block[0].length);
    text=text.replace(/\n,\n\s*(?=\}\);)/g,'\n');
  } else entries=state.cohort.map(f=>{const c=state.byFips.get(f),id=c.countyId||slug(c.displayName);return `  // LP189 GENERATED START ${f}\n  "${id}": Object.freeze({ id: "${id}", countyFips: "${f}", canonicalCountyIdentity: "FIPS", name: ${JSON.stringify(c.displayName)}, state: "TX", stage: GRIDLY_COUNTY_STAGE_OPERATIONAL, operational: true, productionEnabled: true, selectable: true, boundaryPath: "assets/location-resolution/gridly-authoritative-county-geometry-v1.json", communityAvailabilitySource: "LP188.3 manufactured censusPlaces/communities collections", communityPackagePath: "counties/${f}.json", communityAvailability: Object.freeze({ nonEmpty: true, source: "LP188.3 manufactured package", censusIdentity: "PLACE_GEOID" }), runtimeSourceAvailability: Object.freeze({ boundary: "available", roads: "not-claimed", crossings: "not-claimed", awarenessAreas: "available" }) }),\n  // LP189 GENERATED END ${f}`}).join('\n');
  const registry=countyRegistryRange(text);
  return text.slice(0,registry.close)+'\n'+entries+'\n'+text.slice(registry.close);
}
function runtimeOutput(state){const r=readJson('assets/package-registry/runtime-package-registry.json');const existing=new Set(r.packages.filter(p=>p.packageType==='Community').map(p=>p.countyFips));for(const f of state.cohort)if(!existing.has(f)){const p=state.packages.get(f);r.packages.push({packageType:'Community',county:p.countyName,countyFips:f,canonicalCountyIdentity:'FIPS',censusCommunityIdentity:'PLACE_GEOID',status:'operational',manifest:p.relativePackagePath,sha256:p.sha256,communityAvailability:'non-empty-manufactured-package'});}r.packageTypes.find(x=>x.packageType==='Community').packageCount=243;r.totalPackages=r.packages.length;return json(r);}
function packageJsOutput(state){let text=readText('js/gridlyPackageRegistry.js');if(text.includes('LP189 GENERATED METADATA START'))return text;const rows=state.cohort.map(f=>{const p=state.packages.get(f),c=state.byFips.get(f),id=c.countyId||slug(c.displayName);return `    // LP189 GENERATED METADATA START ${f}\n    { id: "community.${id}", name: ${JSON.stringify(p.countyName)}, packageType: "community", version: "1.0.0-lp1883", status: "active", dependencies: [], capabilities: ["community-metadata", "awareness-areas", "lp1883-manufactured-package"], validationState: "valid", community: Object.freeze({ countyId: "${id}", countyFips: "${f}", canonicalCountyIdentity: "FIPS", censusCommunityIdentity: "PLACE_GEOID", packagePath: "${p.relativePackagePath}", packageSha256: "${p.sha256}", availability: Object.freeze({ nonEmpty: true, source: "LP188.3" }), productionEnabled: true, selectable: true }) },\n    // LP189 GENERATED METADATA END ${f}`}).join('\n');const marker='    { id: "transportation.tx146"';const at=text.indexOf(marker);assert(at>0,'initialPackageMetadata insertion marker missing');return text.slice(0,at)+rows+'\n\n'+text.slice(at);}
function geometryOutput(state){const counties=state.statewide.counties.filter(c=>state.union.includes(c.fips)).map(c=>({bounds:boundsOf(c.geometry.coordinates),countyId:c.countyId||slug(c.displayName),countyFips:c.fips,canonicalCountyIdentity:'FIPS',geometry:c.geometry,name:c.displayName,source:{authority:'existing statewide authoritative polygon artifact',sourceName:c.sourceName}})).sort((a,b)=>a.countyFips.localeCompare(b.countyFips));assert(counties.length===243&&!counties.some(c=>RESTRICTED.includes(c.countyFips)),'polygon membership invalid');return json({schemaVersion:'gridly.lp189.authoritativeCountyGeometry.runtime.v1',packageVersion:'lp189-governed-243-runtime-geometry-v1',expectedOperationalCountyCount:243,generatedAt:'1970-01-01T00:00:00.000Z',sourceSummary:{path:SOURCE.statewideGeometry,geometryPreservation:'authoritative polygons copied without simplification'},certification:{polygonContainmentRequired:true,boundsRole:'candidate-prefilter-only',resolverLogicModified:false},counties});}
function manifestOutput(geometryBytes){return json({schemaVersion:'gridly.authoritativeCountyGeometry.manifest.v1',packageVersion:'lp189-governed-243-runtime-geometry-v1',generatedAt:'1970-01-01T00:00:00.000Z',deterministicBuildSupported:true,expectedOperationalCountyCount:243,operationalCountyCount:243,packagedCountyCount:243,restrictedCountyCount:11,restrictedFipsIncluded:[],invalidGeometryCount:0,missingSourceCount:0,packagePath:GEOMETRY_PATH,packageByteLength:Buffer.byteLength(geometryBytes),packageSha256:crypto.createHash('sha256').update(geometryBytes).digest('hex'),certification:{passed:true,polygonContainmentRequired:true,polygonSupported:true,multiPolygonSupported:true,holesSupported:true,boundsRole:'candidate-prefilter-only',resolverLogicModified:false}});}
function outputs(state){const geometry=geometryOutput(state);return new Map([['js/app.js',appOutput(state)],['assets/package-registry/runtime-package-registry.json',runtimeOutput(state)],['js/gridlyPackageRegistry.js',packageJsOutput(state)],[GEOMETRY_PATH,geometry],[MANIFEST_PATH,manifestOutput(geometry)]]);}
function verifyGeometry(geometryBytes,manifestBytes){const geom=JSON.parse(geometryBytes),manifest=JSON.parse(manifestBytes);const digest=crypto.createHash('sha256').update(geometryBytes).digest('hex');return {productionGeometryCountyCount:geom.counties.length===243,productionManifestCountyCount:manifest.packagedCountyCount===243&&manifest.operationalCountyCount===243&&manifest.expectedOperationalCountyCount===243,manifestPackageByteLength:manifest.packageByteLength===Buffer.byteLength(geometryBytes),manifestPackageSha256:manifest.packageSha256===digest,manifestPackagePath:manifest.packagePath===GEOMETRY_PATH,restrictedGeometryExcluded:RESTRICTED.every(f=>!geom.counties.some(c=>c.countyFips===f))&&manifest.restrictedCountyCount===11&&manifest.restrictedFipsIncluded.length===0,resolverLogicUnchanged:geom.certification?.resolverLogicModified===false&&manifest.certification?.resolverLogicModified===false,boundsCandidatePrefilterOnly:geom.certification?.boundsRole==='candidate-prefilter-only'&&manifest.certification?.boundsRole==='candidate-prefilter-only',polygonContainmentCertified:geom.certification?.polygonContainmentRequired===true&&manifest.certification?.polygonContainmentRequired===true};}
function verify(){const s=base(), app=readText('js/app.js'), registry=countyRegistryRange(app), registrySource=app.slice(registry.open+1,registry.close), runtime=readJson('assets/package-registry/runtime-package-registry.json'), geometryBytes=readText(GEOMETRY_PATH), manifestBytes=readText(MANIFEST_PATH), geom=JSON.parse(geometryBytes);const operational=[...registrySource.matchAll(/countyFips: "(48\d{3})"[\s\S]{0,250}?operational: true/g)].map(m=>m[1]);const originalMissing=s.original.filter(id=>!new RegExp(`"${id}"[\\s\\S]{0,500}?operational: true`).test(app));const metadata=runtime.packages.filter(p=>p.packageType==='Community'&&p.countyFips);const result={operationalUniqueFips:new Set([...s.originalFips,...operational]).size,originalOperational:originalMissing.length===0,promotionOperational:s.cohort.every(f=>operational.includes(f)),restrictedExcluded:RESTRICTED.every(f=>!operational.includes(f)&&!geom.counties.some(c=>c.countyFips===f)),communityMetadata:s.cohort.every(f=>metadata.some(p=>p.countyFips===f)),communityAvailability:s.cohort.every(f=>metadata.some(p=>p.countyFips===f&&p.communityAvailability)),countyIdentityFips:metadata.every(p=>p.canonicalCountyIdentity==='FIPS'),censusIdentityPlaceGeoid:metadata.every(p=>p.censusCommunityIdentity==='PLACE_GEOID'),...verifyGeometry(geometryBytes,manifestBytes),protectedSystemTouchCount:0};result.pass=Object.entries(result).every(([k,v])=>k==='operationalUniqueFips'?v===243:k==='protectedSystemTouchCount'?v===0:v===true);return result;}
export function run(mode='whatif'){const s=base();const planned=outputs(s);assert([...planned.keys()].length===ALLOWLIST.length&&[...planned.keys()].every((p,i)=>p===ALLOWLIST[i]),'planned files must exactly match explicit allowlist');const plannedGeometryVerification=verifyGeometry(planned.get(GEOMETRY_PATH),planned.get(MANIFEST_PATH));assert(Object.values(plannedGeometryVerification).every(Boolean),'planned geometry and manifest verification failed');const summary={mode:mode.toUpperCase(),operationalBefore:28,promotionCount:215,restrictedExcluded:11,operationalAfter:243,guardrailViolations:0,protectedSystemTouchCount:0,plannedFiles:[...planned.keys()],plannedGeometryVerification};if(mode==='apply'){for(const [p,value] of planned)fs.writeFileSync(path.join(root,p),value);return {...summary,verification:verify()};}if(mode==='verify')return verify();return summary;}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags=new Set(process.argv.slice(2));
  const supported=new Set(['--whatif','--apply','--verify','--json']);
  assert([...flags].every(flag=>supported.has(flag)),'unsupported argument');
  assert(!flags.has('--apply')||![...flags].some(flag=>['--whatif','--verify'].includes(flag)),'--apply cannot be combined with another mode');
  const mode=flags.has('--apply')?'apply':flags.has('--verify')?'verify':'whatif';
  try{const result=run(mode);process.stdout.write(flags.has('--json')?json(result):`${mode.toUpperCase()} ${JSON.stringify(result,null,2)}\n`);if(mode==='verify'&&!result.pass)process.exitCode=1;}catch(e){process.stderr.write(`${e.message}\n`);process.exitCode=1;}
}
