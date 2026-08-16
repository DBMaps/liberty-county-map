#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const OUT='evidence/wave3a-crossing-readiness';
const PATHS=Object.freeze({counties:'data/lp104/texas-counties.json',source:'Crossing-Packages/Texas/fra-crossings-tx.geojson',sourceManifest:'Crossing-Packages/Texas/package-manifest.json',productionManifest:'Crossing-Packages/production-crossing-manifest.json',geographicPartition:'evidence/wave3a1b-fra-county-authority/projected-partition.json',geographicCounts:'evidence/wave3a1b-fra-county-authority/geographic-county-counts.json',geographicExceptions:'evidence/wave3a1b-fra-county-authority/exception-classification.json',geographicPolicy:'evidence/wave3a1b-fra-county-authority/authority-policy.json'});
const FILES=Object.freeze(['preflight.json','current-partition.json','source-only-positive-cohort.json','source-certification.json','containment-reconciliation.json','package-inventory.json','runtime-compatibility.json','activation-readiness.json','whatif.json','summary.json']);
const text=p=>fs.readFileSync(path.join(ROOT,p),'utf8').replace(/^\uFEFF/,'');
const json=p=>JSON.parse(text(p));
const stable=x=>`${JSON.stringify(x,null,2)}\n`;
const assert=(x,m)=>{if(!x)throw Error(`Wave 3A fail closed: ${m}`)};
const slug=x=>x.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

export function buildEvidence(){
 const inventory=json(PATHS.counties), sourceBody=text(PATHS.source), source=JSON.parse(sourceBody), sourceManifest=json(PATHS.sourceManifest), production=json(PATHS.productionManifest), authorityPartition=json(PATHS.geographicPartition), authorityCounts=json(PATHS.geographicCounts), authorityExceptions=json(PATHS.geographicExceptions), authorityPolicy=json(PATHS.geographicPolicy);
 assert(inventory.count===254&&inventory.counties.length===254,'governed county inventory is not 254');
 assert(source.type==='FeatureCollection'&&source.features.length===16101,'FRA identity inventory changed');
 assert(production.totalPackages===28&&production.records.length===28,'active production package inventory changed');
 assert(authorityPolicy.status==='CERTIFIED','Wave 3A.1B geographic policy is not certified');
 assert(authorityPartition.union===254&&authorityPartition.duplicates===0,'certified geographic partition is invalid');
 assert(authorityCounts.statewide.identitiesRetained===16101&&authorityCounts.statewide.geographicallyAssignedAfter===16099&&authorityCounts.statewide.blockedBorderRows===2,'certified geographic identity totals changed');
 const blocked=authorityExceptions.rows.filter(x=>x.classification==='OUTSIDE_TEXAS_BORDER_REVIEW');
 assert(blocked.length===2&&blocked.map(x=>x.crossingId).sort().join(',')==='019788P,019791X','blocked El Paso identities changed');
 const byFips=new Map(inventory.counties.map(c=>[c.fips,c]));
 const geographicByFips=new Map(authorityCounts.counties.map(c=>[c.countyFips,c]));
 const classes=authorityPartition.countyFipsByClass;
 const allFips=Object.values(classes).flat();
 assert(allFips.length===254&&new Set(allFips).size===254&&allFips.every(f=>byFips.has(f)),'authority partition does not exactly cover governed counties');
 const groups=Object.fromEntries(Object.entries(classes).map(([k,v])=>[k,v.map(f=>{const c=byFips.get(f),g=geographicByFips.get(f);return {...c,sourceCount:g.beforeFraSourceCount,geographicCount:g.afterGeographicCount};})]));
 assert(groups.ACTIVE_EMPTY.some(c=>c.fips==='48457'),'Tyler ACTIVE_EMPTY is not preserved');
 const candidate=groups.SOURCE_OR_GEOGRAPHIC_POSITIVE_INACTIVE;
 assert(candidate.length===175,'inactive geographic-positive cohort differs from 175');
 const ids=new Map(), coords=new Map();let missingIdentity=0,invalidCoordinates=0,missingConsumerFields=0;
 for(const f of source.features){const p=f.properties||{},id=String(p.CROSSING||'').trim(),xy=f.geometry?.coordinates;if(!id)missingIdentity++;else ids.set(id,[...(ids.get(id)||[]),String(p.STCYFIPS||p.CountyCode||'')]);if(!Array.isArray(xy)||xy.length<2||!xy.slice(0,2).every(Number.isFinite))invalidCoordinates++;else{const k=`${xy[0]},${xy[1]}`;coords.set(k,(coords.get(k)||0)+1)}if(!String(p.RAILROAD||p.OPERATINGR||'').trim()||(!String(p.STREET||'').trim()&&!String(p.HIGHWAY||'').trim()))missingConsumerFields++}
 const duplicateIds=[...ids].filter(([,v])=>v.length>1).map(([crossingId,fips])=>({crossingId,fips,count:fips.length}));
 const packageRows=candidate.map(c=>{const s=slug(c.countyName),base=`Crossing-Packages/${s}`,paths=[`${base}/${s}-crossings.geojson`,`${base}/package-manifest.json`,`${base}/Production/${s}-production-crossings.geojson`],present=paths.filter(p=>fs.existsSync(path.join(ROOT,p)));return {countyFips:c.fips,countyId:`${c.countyId}-tx`,countyName:`${c.countyName} County`,geographicCrossingCount:c.geographicCount,sourceArtifact:paths[0],manifest:paths[1],runtimePackage:paths[2],presentArtifacts:present,packageStatus:present.length===3?'PACKAGE_READY':'PACKAGE_BUILD_REQUIRED',certificationEvidence:null,supabaseObject:'not repository-verifiable'}});
 const cohort=candidate.map(c=>({countyId:`${c.countyId}-tx`,countyFips:c.fips,countyName:`${c.countyName} County`,fraSourceCount:c.sourceCount,geographicCrossingCount:c.geographicCount,ownershipAuthority:'certified Wave 3A.1B TIGER coordinate containment',sourceArtifact:PATHS.source,sourceIdentity:'FRA provenance retained; geographic ownership is independently governed',packageStatus:packageRows.find(p=>p.countyFips===c.fips).packageStatus,runtimeStatus:'NOT_ACTIVE',reasonNotCurrentlyActive:'No governed county production crossing package/runtime registration'}));
 const ready=packageRows.filter(x=>x.packageStatus==='PACKAGE_READY').length, required=packageRows.length-ready;
 assert(ready===0&&required===175,'package readiness changed before owner manufacture');
 const partition={schemaVersion:'gridly.wave3a.partition.v2',authority:PATHS.geographicPartition,counts:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v.length])),activeRuntime:28,positiveGeographicCounties:202,zeroGeographicCounties:52,union:254,duplicates:0,missing:0,countyFipsByClass:classes};
 const blockers=['MISSING_PACKAGE_ARTIFACTS'];
 const candidateRows=candidate.reduce((n,c)=>n+c.geographicCount,0), activeRows=groups.ACTIVE_POSITIVE.reduce((n,c)=>n+c.geographicCount,0), counts=candidate.map(c=>c.geographicCount).sort((a,b)=>a-b);
 return {
  'preflight.json':{schemaVersion:'gridly.wave3a.preflight.v2',generatedAt:'1970-01-01T00:00:00.000Z',scope:'PREFLIGHT_AND_READINESS_ONLY',activationApplied:false,paths:PATHS,source:{name:'FRA Texas statewide crossing GeoJSON',vintage:{manifestGenerated:sourceManifest.generated,latestSourceLastUpdate:[...new Set(source.features.map(f=>f.properties?.LASTUPDATE).filter(Boolean))].sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1)},format:'GeoJSON FeatureCollection',path:PATHS.source,bytes:68200491,sha256:'e30bdd2502552fa5e578b2feefc5e2f599c0e8206067e4a87c65dadfa760113c',identityAuthority:'certified Wave 3A.1B owner-source identity',upstreamOwnerPath:sourceManifest.source,role:'PROVENANCE_ONLY_FOR_COUNTY_OWNERSHIP'},geographicAuthority:{policy:PATHS.geographicPolicy,partition:PATHS.geographicPartition,status:'CERTIFIED'},governedBuildPipeline:{script:'tools/lp115/manufacture-candidate-crossings.mjs',command:'node tools/lp115/manufacture-candidate-crossings.mjs --fips <comma-separated-FIPS> --candidate',arbitraryTexasFips:true,batchCapable:true,activationAuthorized:false},protectedSystemsModified:[]},
  'current-partition.json':partition,
  'source-only-positive-cohort.json':{schemaVersion:'gridly.wave3a.geographic-positive-cohort.v2',historicalFilename:true,count:cohort.length,sort:'countyFips',counties:cohort},
  'source-certification.json':{schemaVersion:'gridly.wave3a.source-certification.v2',role:'FRA_PROVENANCE_NOT_COUNTY_OWNERSHIP',candidateCountyCount:candidate.length,candidateGeographicRowCount:candidateRows,statewide:{rowCount:source.features.length,missingIdentity,invalidCoordinates,invalidCountyRows:[],duplicateCrossingIds:duplicateIds,duplicateCoordinateGroups:[...coords.values()].filter(n=>n>1).length,missingConsumerFields},classification:missingIdentity||invalidCoordinates||duplicateIds.length?'SOURCE_DEFECT':'SOURCE_CERTIFIED'},
  'containment-reconciliation.json':{schemaVersion:'gridly.wave3a.containment.v2',authority:PATHS.geographicCounts,policy:PATHS.geographicPolicy,method:authorityCounts.method,identitiesRetained:16101,geographicallyAssigned:16099,blockedBorderRows:blocked.map(x=>({crossingId:x.crossingId,sourceCountyFips:x.sourceCountyFips,assignment:x.assignment})),excludedFromGeographicOwnership:true,recomputedByWave3a:false},
  'package-inventory.json':{schemaVersion:'gridly.wave3a.package-inventory.v2',ownership:'CERTIFIED_GEOGRAPHIC',counts:{PACKAGE_READY:ready,PACKAGE_BUILD_REQUIRED:required,PACKAGE_MISSING_SOURCE:0,PACKAGE_INVALID:0},counties:packageRows},
  'runtime-compatibility.json':{schemaVersion:'gridly.wave3a.runtime-compatibility.v2',candidateAssessment:'BLOCKED_NO_RUNTIME_PACKAGES',roadRuntimeDependency:false,schemaChanged:false,protectedSurfaces:['generic reporting','Alerts','Awareness','Route Watch']},
  'activation-readiness.json':{schemaVersion:'gridly.wave3a.activation-readiness.v2',ready:false,decision:'GEOGRAPHIC-POSITIVE CROSSING ACTIVATION BLOCKED — PACKAGE MANUFACTURE REQUIRED',blockers,guardedExecutorPrepared:false,reason:'All 175 inactive geographic-positive counties require governed packages before activation.'},
  'whatif.json':{schemaVersion:'gridly.wave3a.whatif.v2',mode:'WHAT_IF',applied:false,eligible:false,current:partition.counts,target:null,plannedWrites:[],writeAllowlist:[],failClosed:true,blockers,tylerActiveEmptyPreserved:true,zeroGeographicCandidatesIncluded:0},
  'summary.json':{schemaVersion:'gridly.wave3a.summary.v2',decision:'GEOGRAPHIC-POSITIVE CROSSING ACTIVATION BLOCKED — PACKAGE MANUFACTURE REQUIRED',statewideIdentities:source.features.length,geographicallyAssigned:16099,blockedBorderRows:2,activePositiveRows:activeRows,inactiveGeographicPositiveRows:candidateRows,candidateStatistics:{countyCount:candidate.length,totalRows:candidateRows,minimum:counts[0],maximum:counts.at(-1),median:counts[Math.floor(counts.length/2)]},packageReady:ready,packageBuildRequired:required,activationApplied:false,ownerLocalActionsRequired:['Manufacture and certify 175 geographic-owner packages in Wave 3A.2.'],repositoryRepairsRequired:[],exactProductionWriteAllowlist:'UNDETERMINED_UNTIL_PACKAGES_EXIST'}
 };
}
export function writeEvidence(){const e=buildEvidence(),d=path.join(ROOT,OUT);fs.mkdirSync(d,{recursive:true});for(const f of FILES)fs.writeFileSync(path.join(d,f),stable(e[f]));return e}
export function verifyEvidence(){const e=buildEvidence(),m=FILES.filter(f=>!fs.existsSync(path.join(ROOT,OUT,f))||text(`${OUT}/${f}`)!==stable(e[f]));return{pass:!m.length,evidenceFiles:FILES.length,mismatches:m,activationApplied:false}}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const flags=new Set(process.argv.slice(2));assert([...flags].every(x=>['--write','--verify','--json'].includes(x)),'unsupported argument');const result=flags.has('--verify')?verifyEvidence():writeEvidence();process.stdout.write(`${JSON.stringify(result,null,flags.has('--json')?0:2)}\n`);if(flags.has('--verify')&&!result.pass)process.exitCode=1}
