#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = 'evidence/wave3a-crossing-readiness';
const PATHS = Object.freeze({
  counties: 'data/lp104/texas-counties.json',
  source: 'Crossing-Packages/Texas/fra-crossings-tx.geojson',
  sourceManifest: 'Crossing-Packages/Texas/package-manifest.json',
  productionManifest: 'Crossing-Packages/production-crossing-manifest.json',
  geometry: 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json'
});
const FILES = Object.freeze(['preflight.json','current-partition.json','source-only-positive-cohort.json','source-certification.json','containment-reconciliation.json','package-inventory.json','runtime-compatibility.json','activation-readiness.json','whatif.json','summary.json']);
const readText = p => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/^\uFEFF/, '');
const readJson = p => JSON.parse(readText(p));
const digest = body => crypto.createHash('sha256').update(body).digest('hex');
const stable = value => `${JSON.stringify(value, null, 2)}\n`;
const assert = (value, message) => { if (!value) throw new Error(`Wave 3A fail closed: ${message}`); };
const countySlug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function rings(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
}
function bounds(geometry) {
  const out = [Infinity, Infinity, -Infinity, -Infinity];
  for (const polygon of rings(geometry)) for (const ring of polygon) for (const [x,y] of ring) {
    out[0]=Math.min(out[0],x); out[1]=Math.min(out[1],y); out[2]=Math.max(out[2],x); out[3]=Math.max(out[3],y);
  }
  return out;
}
function onSegment([x,y],[a,b],[c,d]) {
  const cross=(x-a)*(d-b)-(y-b)*(c-a);
  return Math.abs(cross)<=1e-10 && x>=Math.min(a,c)-1e-10 && x<=Math.max(a,c)+1e-10 && y>=Math.min(b,d)-1e-10 && y<=Math.max(b,d)+1e-10;
}
function ringLocation(point, ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    if(onSegment(point,ring[j],ring[i])) return 'boundary';
    const [x,y]=point,[xi,yi]=ring[i],[xj,yj]=ring[j];
    if(((yi>y)!==(yj>y)) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside?'inside':'outside';
}
function polygonLocation(point, polygon) {
  const outer=ringLocation(point,polygon[0]);
  if(outer==='outside') return 'outside';
  if(outer==='boundary') return 'boundary';
  for(const hole of polygon.slice(1)) { const hit=ringLocation(point,hole); if(hit==='boundary') return 'boundary'; if(hit==='inside') return 'outside'; }
  return 'inside';
}
function resolve(point, indexed) {
  const hits=[];
  for(const county of indexed) {
    const [w,s,e,n]=county.bounds; if(point[0]<w||point[0]>e||point[1]<s||point[1]>n) continue;
    for(const polygon of rings(county.geometry)) { const location=polygonLocation(point,polygon); if(location!=='outside'){hits.push({fips:county.fips,location});break;} }
  }
  const inside=hits.filter(x=>x.location==='inside');
  return { resolvedFips: inside.length===1?inside[0].fips:hits.length===1?hits[0].fips:null, boundary: hits.some(x=>x.location==='boundary'), hits };
}

export function buildEvidence() {
  const countyInventory=readJson(PATHS.counties), geometry=readJson(PATHS.geometry), sourceBody=readText(PATHS.source), source=JSON.parse(sourceBody), sourceManifest=readJson(PATHS.sourceManifest), production=readJson(PATHS.productionManifest);
  assert(countyInventory.count===254 && countyInventory.counties.length===254, 'governed county inventory is not 254');
  assert(geometry.counties.length===254, 'authoritative geometry is not 254 counties');
  assert(source.type==='FeatureCollection' && Array.isArray(source.features), 'FRA source is not GeoJSON');
  const byFips=new Map(countyInventory.counties.map(c=>[c.fips,c])); assert(byFips.size===254,'duplicate governed county FIPS');
  const geometryFips=new Set(geometry.counties.map(c=>c.fips)); assert(geometryFips.size===254 && [...byFips.keys()].every(f=>geometryFips.has(f)),'geometry/county identity drift');
  const activeByName=new Map(production.records.map(r=>[r.county.toLowerCase(),r]));
  const rowsByFips=new Map([...byFips.keys()].map(f=>[f,[]]));
  const invalidCountyRows=[];
  for(const feature of source.features) { const fips=String(feature?.properties?.STCYFIPS||feature?.properties?.CountyCode||''); if(rowsByFips.has(fips)) rowsByFips.get(fips).push(feature); else invalidCountyRows.push(String(feature?.properties?.CROSSING||'')); }
  const counties=[...byFips].map(([fips,c])=>{const count=rowsByFips.get(fips).length,active=activeByName.get(c.countyName.toLowerCase());return {...c,sourceCount:count,active:Boolean(active),runtimeCount:active?.crossingCount??null};}).sort((a,b)=>a.fips.localeCompare(b.fips));
  const groups={ACTIVE_POSITIVE:counties.filter(c=>c.active&&c.sourceCount>0),ACTIVE_EMPTY:counties.filter(c=>c.active&&c.sourceCount===0),SOURCE_ONLY_POSITIVE:counties.filter(c=>!c.active&&c.sourceCount>0),SOURCE_ZERO_NOT_ACTIVATED:counties.filter(c=>!c.active&&c.sourceCount===0)};
  assert(Object.values(groups).flat().length===254,'partition union is not 254'); assert(groups.ACTIVE_EMPTY.some(c=>c.fips==='48457'),'Tyler ACTIVE_EMPTY is not preserved');
  const candidate=groups.SOURCE_ONLY_POSITIVE;
  const ids=new Map(), coordinateKeys=new Map(); let missingIdentity=0, invalidCoordinates=0, missingConsumerFields=0;
  for(const feature of source.features) {
    const p=feature.properties||{}, id=String(p.CROSSING||'').trim(), xy=feature.geometry?.coordinates;
    if(!id) missingIdentity++; else ids.set(id,[...(ids.get(id)||[]),String(p.STCYFIPS||p.CountyCode||'')]);
    if(!Array.isArray(xy)||xy.length<2||!xy.slice(0,2).every(Number.isFinite)) invalidCoordinates++;
    else {const key=`${xy[0]},${xy[1]}`;coordinateKeys.set(key,(coordinateKeys.get(key)||0)+1);}
    if(!String(p.RAILROAD||p.OPERATINGR||'').trim() || (!String(p.STREET||'').trim()&&!String(p.HIGHWAY||'').trim())) missingConsumerFields++;
  }
  const duplicateIds=[...ids].filter(([,v])=>v.length>1).map(([crossingId,fips])=>({crossingId,fips,count:fips.length}));
  const indexed=geometry.counties.map(c=>({...c,bounds:bounds(c.geometry)}));
  const containmentRows=[]; let exactMatches=0,boundaryAmbiguities=0,crossCountyMismatches=0,outsideTexas=0,unresolved=0;
  for(const county of candidate) for(const feature of rowsByFips.get(county.fips)) {
    const xy=feature.geometry?.coordinates; const result=Array.isArray(xy)&&xy.slice(0,2).every(Number.isFinite)?resolve(xy,indexed):{resolvedFips:null,boundary:false,hits:[]};
    let status;if(result.boundary){status='BOUNDARY_AMBIGUITY';boundaryAmbiguities++;}else if(!result.hits.length){status='OUTSIDE_TEXAS';outsideTexas++;}else if(!result.resolvedFips){status='UNRESOLVED';unresolved++;}else if(result.resolvedFips!==county.fips){status='CROSS_COUNTY_MISMATCH';crossCountyMismatches++;}else{status='EXACT_MATCH';exactMatches++;}
    if(status!=='EXACT_MATCH') containmentRows.push({crossingId:String(feature.properties?.CROSSING||''),sourceFips:county.fips,resolvedFips:result.resolvedFips,status,hits:result.hits});
  }
  const packageRows=candidate.map(c=>{const slug=countySlug(c.countyName),base=`Crossing-Packages/${slug}`;const sourceArtifact=`${base}/${slug}-crossings.geojson`,runtime=`${base}/Production/${slug}-production-crossings.geojson`,manifest=`${base}/package-manifest.json`;const present=[sourceArtifact,manifest,runtime].filter(p=>fs.existsSync(path.join(ROOT,p)));return {countyFips:c.fips,countyId:`${c.countyId}-tx`,countyName:`${c.countyName} County`,sourceArtifact,manifest,runtimePackage:runtime,presentArtifacts:present,packageStatus:present.length===3?'PACKAGE_READY':'PACKAGE_BUILD_REQUIRED',certificationEvidence:null,supabaseObject:'not repository-verifiable'};});
  const defectiveFips=new Set(containmentRows.filter(x=>x.status!=='BOUNDARY_AMBIGUITY').map(x=>x.sourceFips));
  const sourceDefect = missingIdentity||invalidCoordinates||invalidCountyRows.length||duplicateIds.length||crossCountyMismatches||outsideTexas||unresolved;
  const cohort=candidate.map(c=>({countyId:`${c.countyId}-tx`,countyFips:c.fips,countyName:`${c.countyName} County`,fraSourceCount:c.sourceCount,sourceArtifact:PATHS.source,sourceIdentity:'FRA Texas statewide crossing GeoJSON governed by Crossing-Packages/Texas/package-manifest.json',packageStatus:packageRows.find(p=>p.countyFips===c.fips).packageStatus,runtimeStatus:'NOT_ACTIVE',reasonNotCurrentlyActive:'No governed county production crossing package/runtime registration'}));
  const counts=candidate.map(c=>c.sourceCount).sort((a,b)=>a-b), activeRows=groups.ACTIVE_POSITIVE.reduce((n,c)=>n+c.sourceCount,0), candidateRows=counts.reduce((a,b)=>a+b,0);
  const blockers=[]; if(packageRows.some(p=>p.packageStatus!=='PACKAGE_READY')) blockers.push('MISSING_PACKAGE_ARTIFACTS'); if(sourceDefect) blockers.push('SOURCE_OR_CONTAINMENT_DEFECT');
  const partition={schemaVersion:'gridly.wave3a.partition.v1',counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),activeRuntime:groups.ACTIVE_POSITIVE.length+groups.ACTIVE_EMPTY.length,positiveFraSource:groups.ACTIVE_POSITIVE.length+candidate.length,zeroFraSource:groups.ACTIVE_EMPTY.length+groups.SOURCE_ZERO_NOT_ACTIVATED.length,union:254,duplicates:0,missing:0,countyFipsByClass:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.map(c=>c.fips)]))};
  const evidence={
    'preflight.json':{schemaVersion:'gridly.wave3a.preflight.v1',generatedAt:'1970-01-01T00:00:00.000Z',scope:'PREFLIGHT_AND_READINESS_ONLY',activationApplied:false,paths:PATHS,source:{name:'FRA Texas statewide crossing GeoJSON',vintage:{manifestGenerated:sourceManifest.generated,latestSourceLastUpdate:[...new Set(source.features.map(f=>f.properties?.LASTUPDATE).filter(Boolean))].sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)},format:'GeoJSON FeatureCollection',path:PATHS.source,bytes:Buffer.byteLength(sourceBody),sha256:digest(sourceBody),upstreamOwnerPath:sourceManifest.source},governedBuildPipeline:{script:'tools/lp115/manufacture-candidate-crossings.mjs',command:'node tools/lp115/manufacture-candidate-crossings.mjs --fips <comma-separated-FIPS> --candidate',arbitraryTexasFips:true,batchCapable:true,output:'reports/lp115/<FIPS> candidate source, production package, manifest, certification',activationAuthorized:false},protectedSystemsModified:[]},
    'current-partition.json':partition,
    'source-only-positive-cohort.json':{schemaVersion:'gridly.wave3a.cohort.v1',count:cohort.length,sort:'countyFips',counties:cohort},
    'source-certification.json':{schemaVersion:'gridly.wave3a.source-certification.v1',candidateCountyCount:candidate.length,candidateRowCount:candidateRows,statewide:{rowCount:source.features.length,missingIdentity,invalidCoordinates,invalidCountyRows,duplicateCrossingIds:duplicateIds,duplicateCoordinateGroups:[...coordinateKeys.values()].filter(n=>n>1).length,missingConsumerFields},classification:sourceDefect?'SOURCE_DEFECT':'SOURCE_CERTIFIED',countyClassifications:candidate.map(c=>({countyFips:c.fips,sourceCount:c.sourceCount,classification:defectiveFips.has(c.fips)?'SOURCE_DEFECT':'SOURCE_CERTIFIED',containmentExceptionCount:containmentRows.filter(x=>x.sourceFips===c.fips).length}))},
    'containment-reconciliation.json':{schemaVersion:'gridly.wave3a.containment.v1',geometryPath:PATHS.geometry,boundaryPolicy:'point on ring is reported as ambiguity; no reassignment',candidateRows,exactMatches,boundaryAmbiguities,crossCountyMismatches,outsideTexas,unresolved,exceptions:containmentRows},
    'package-inventory.json':{schemaVersion:'gridly.wave3a.package-inventory.v1',counts:{PACKAGE_READY:packageRows.filter(x=>x.packageStatus==='PACKAGE_READY').length,PACKAGE_BUILD_REQUIRED:packageRows.filter(x=>x.packageStatus==='PACKAGE_BUILD_REQUIRED').length,PACKAGE_MISSING_SOURCE:0,PACKAGE_INVALID:0},counties:packageRows},
    'runtime-compatibility.json':{schemaVersion:'gridly.wave3a.runtime-compatibility.v1',controls:['Liberty County','Harris County','Bexar County','Galveston County'],candidateAssessment:'BLOCKED_NO_RUNTIME_PACKAGES',requiredFields:['CROSSING','Point coordinates','RAILROAD or OPERATINGR','STREET or HIGHWAY','gridlyId','gridlyDisplayName','gridlyClassification','gridlyProductionCertified'],consumerSurfaces:['marker rendering','Nearby','Area','County','Delays','All'],roadRuntimeDependency:false,protectedSurfaces:['generic reporting','Alerts','Awareness','Route Watch'],schemaChanged:false},
    'activation-readiness.json':{schemaVersion:'gridly.wave3a.activation-readiness.v1',ready:false,decision:'POSITIVE-SOURCE CROSSING ACTIVATION BLOCKED — REPOSITORY REPAIR REQUIRED',blockers,representativeControls:[{county:'Dallas County',reason:'major metro/high count'},{county:'Brewster County',reason:'rural/border'},{county:'Cameron County',reason:'border/coastal'},{county:'Kenedy County',reason:'low positive count'}],guardedExecutorPrepared:false,reason:'The if-and-only-if repository-ready condition is false; no activation executor or production write surface was implemented.'},
    'whatif.json':{schemaVersion:'gridly.wave3a.whatif.v1',mode:'WHAT_IF',applied:false,eligible:false,current:partition.counts,target:null,plannedWrites:[],writeAllowlist:[],failClosed:true,blockers,tylerActiveEmptyPreserved:true,zeroSourceCandidatesIncluded:0},
    'summary.json':{schemaVersion:'gridly.wave3a.summary.v1',decision:'POSITIVE-SOURCE CROSSING ACTIVATION BLOCKED — REPOSITORY REPAIR REQUIRED',statewideRows:source.features.length,activePositiveRows:activeRows,sourceOnlyPositiveRows:candidateRows,zeroSourceRows:0,candidateStatistics:{countyCount:candidate.length,totalRows:candidateRows,minimum:counts[0],maximum:counts.at(-1),median:counts[Math.floor(counts.length/2)]},duplicateCrossingIdsStatewide:duplicateIds.length,duplicateCrossingIdsAcrossCountyBoundaries:duplicateIds.filter(x=>new Set(x.fips).size>1).length,activationApplied:false,ownerLocalActionsRequired:[],repositoryRepairsRequired:['Manufacture, certify, and govern production crossing packages for every PACKAGE_BUILD_REQUIRED county before activation design.'],exactProductionWriteAllowlist:'UNDETERMINED_UNTIL_PACKAGES_EXIST'}
  };
  assert(candidate.length===173,'current source-only-positive cohort differs from 173');
  return evidence;
}

export function writeEvidence() { const evidence=buildEvidence(), dir=path.join(ROOT,OUT); fs.mkdirSync(dir,{recursive:true}); for(const file of FILES) fs.writeFileSync(path.join(dir,file),stable(evidence[file])); return evidence; }
export function verifyEvidence() { const expected=buildEvidence(); const mismatches=FILES.filter(file=>!fs.existsSync(path.join(ROOT,OUT,file))||readText(`${OUT}/${file}`)!==stable(expected[file])); return {pass:mismatches.length===0,evidenceFiles:FILES.length,mismatches,activationApplied:false}; }
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) { const flags=new Set(process.argv.slice(2)); assert([...flags].every(x=>['--write','--verify','--json'].includes(x)),'unsupported argument'); const result=flags.has('--verify')?verifyEvidence():writeEvidence(); process.stdout.write(`${JSON.stringify(result,null,flags.has('--json')?0:2)}\n`); if(flags.has('--verify')&&!result.pass)process.exitCode=1; }
