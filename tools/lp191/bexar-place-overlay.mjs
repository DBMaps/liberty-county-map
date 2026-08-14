import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const PRECEDENCE='INDEPENDENT_GOVERNED_PLACE_WINS';
export const FAR_ID='0a54b85a-6d66-4887-8a12-19dff06070c8';
export const WEST_ID='4c5f3a02-22b0-4af8-8d74-b1bc35a8e03e';
export const SOURCE={bytes:1864489,sha256:'bf15d7d257d60970c894e590cacb996a15a8796d789e09335860fdb2a6a6e13d'};
export const PLACE_SOURCE={bytes:9782040,sha256:'5a0c4d49641f69028ee9f5c343bf09936ec00a378e5e6393115b106bab935e13'};
export const WEST={bytes:427909,sha256:'1eed04031d6a0ccb13c5749fbcc7af3c829e2bc959db065a2dd7b78c324ec181'};
export const PATHS={identity:'reports/metro-child-area-evidence-governance-audit.json',working:'reports/san-antonio-sa-tomorrow-working-geometry-governance.json',west:'evidence/san-antonio-sa-tomorrow-derived-repairs/west-northwest/repaired.geojson'};
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p)));
const digest=p=>{const b=fs.readFileSync(p);return {bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}};
export const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const serialize=v=>JSON.stringify(canonical(v),null,2)+'\n';

export function classifyPair({intersectionArea,placeWithinAtomic=false,atomicWithinPlace=false,boundariesTouch=false}){
  if(!Number.isFinite(intersectionArea)||intersectionArea<0)throw Error('INVALID_INTERSECTION_AREA');
  if(intersectionArea===0)return boundariesTouch?'BOUNDARY_TOUCH_ONLY':'DISJOINT';
  if(placeWithinAtomic)return 'PLACE_CONTAINED_WITHIN_ATOMIC_UNIT';
  if(atomicWithinPlace)return 'ATOMIC_UNIT_CONTAINED_WITHIN_PLACE';
  return 'PARTIAL_AREA_OVERLAP';
}
export function classifyAggregate({positiveAreaCount,boundaryTouchCount,farSouthwestPreventsCertification=false}){
  if(farSouthwestPreventsCertification)return 'INDETERMINATE_FAR_SOUTHWEST_GOVERNANCE_HOLD';
  if(positiveAreaCount>1)return 'MULTI_ATOMIC_POSITIVE_AREA_OVERLAP';
  if(positiveAreaCount===1)return 'SINGLE_ATOMIC_POSITIVE_AREA_RELATIONSHIP';
  if(boundaryTouchCount>0)return 'BOUNDARY_TOUCH_ONLY';
  return 'OUTSIDE_USABLE_SA_TOMORROW_GEOGRAPHY';
}
export function reconcileGovernance(){
  const identity=read(PATHS.identity),metro=identity.metros.find(x=>x.name==='San Antonio');
  const cohort=metro?.independentlyGovernedCommunities||[];
  if(cohort.length!==33||new Set(cohort.map(x=>x.placeGeoid)).size!==33||new Set(cohort.map(x=>x.name)).size!==33)throw Error('EXACT_33_UNIQUE_GOVERNED_PLACE_IDENTITIES_REQUIRED');
  if(cohort.some(x=>!/^48\d{5}$/.test(x.placeGeoid)||x.precedenceRequirement!=='PRESERVE_INDEPENDENT_CANONICAL_IDENTITY'))throw Error('PLACE_CANONICAL_IDENTITY_RECONCILIATION_FAILED');
  const records=read(PATHS.working).records;
  if(records.length!==30||new Set(records.map(x=>x.globalId)).size!==30)throw Error('EXACT_30_UNIQUE_ATOMIC_IDENTITIES_REQUIRED');
  const usable=records.filter(x=>x.workingGeometryAuthority);
  const far=records.find(x=>x.globalId===FAR_ID),west=records.find(x=>x.globalId===WEST_ID);
  if(usable.length!==29||far?.workingGeometryAuthority!==null||west?.workingGeometryAuthority!=='CERTIFIED_DERIVED_MAKEVALID')throw Error('WORKING_GEOMETRY_GOVERNANCE_RECONCILIATION_FAILED');
  return {cohort:cohort.sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid)),records:records.sort((a,b)=>a.globalId.localeCompare(b.globalId)),usable:usable.sort((a,b)=>a.globalId.localeCompare(b.globalId)),pairEvaluationCount:957,precedence:PRECEDENCE};
}
export function auditGovernedInputs({ownerPlaceGeometry=process.env.GRIDLY_TEXAS_PLACE_ZIP,ownerSaGeometry=process.env.GRIDLY_SA_TOMORROW_GEOJSON,westArtifact=path.join(ROOT,PATHS.west)}={}){
  const governance=reconcileGovernance();
  const westIdentity=digest(westArtifact);
  if(westIdentity.bytes!==WEST.bytes||westIdentity.sha256!==WEST.sha256)throw Error(`WEST_NORTHWEST_CERTIFIED_ARTIFACT_RECOVERY_OWNER_EXECUTION_REQUIRED: expected ${WEST.bytes}/${WEST.sha256}, received ${westIdentity.bytes}/${westIdentity.sha256}`);
  const missing=[];
  if(!ownerPlaceGeometry||!fs.existsSync(ownerPlaceGeometry))missing.push('GRIDLY_TEXAS_PLACE_ZIP');
  if(!ownerSaGeometry||!fs.existsSync(ownerSaGeometry))missing.push('GRIDLY_SA_TOMORROW_GEOJSON');
  if(ownerPlaceGeometry&&fs.existsSync(ownerPlaceGeometry)){const actual=digest(ownerPlaceGeometry);if(actual.bytes!==PLACE_SOURCE.bytes||actual.sha256!==PLACE_SOURCE.sha256)throw Error('TEXAS_PLACE_OWNER_SOURCE_IDENTITY_MISMATCH');}
  if(ownerSaGeometry&&fs.existsSync(ownerSaGeometry)){const actual=digest(ownerSaGeometry);if(actual.bytes!==SOURCE.bytes||actual.sha256!==SOURCE.sha256)throw Error('SA_TOMORROW_OWNER_SOURCE_IDENTITY_MISMATCH');}
  return {...governance,ownerPlaceGeometry,ownerSaGeometry,westArtifact,missing,ready:missing.length===0};
}
export function failClosedFarSouthwest(){return {method:'NO_CERTIFIED_FAR_SOUTHWEST_TOPOLOGY_OR_GOVERNED_EXCLUSION_GEOMETRY_AVAILABLE',relevant:true,preventsFullCertification:true,certificationState:'GEOMETRY_GOVERNANCE_HOLD_CITY_CLARIFICATION_REQUIRED',classification:'INDETERMINATE_FAR_SOUTHWEST_GOVERNANCE_HOLD'};}

const truncate=s=>String(s||'').trim().slice(0,1200);
export function createGdalRunner(spawn=spawnSync){return (program,args,operation)=>{const result=spawn(program,args,{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});if(result.error||result.status!==0)throw Error(`GDAL_OPERATION_FAILED[${operation}]: ${truncate(result.error?.message||result.stderr||result.stdout||`exit ${result.status}`)}`);return result.stdout||'';};}
export function requireGdal(run=createGdalRunner()){
  const version=run('ogrinfo',['--version'],'version check');
  const match=/GDAL\s+(\d+)\.(\d+)\.(\d+)/.exec(version);
  if(!match||Number(match[1])!==3||Number(match[2])!==13)throw Error(`GDAL_3_13_REQUIRED: received ${truncate(version)}`);
  run('ogr2ogr',['--version'],'ogr2ogr availability');
  return version.trim();
}
const sqlString=s=>`'${String(s).replaceAll("'","''")}'`;
const loadFeatures=p=>JSON.parse(fs.readFileSync(p)).features;
const bool=v=>Number(v)===1;
const number=v=>Number(v||0);

export function validateIdentitySet(actual,expected,label){
  if(actual.length!==expected.length)throw Error(`${label}_CARDINALITY_REQUIRED_${expected.length}`);
  if(new Set(actual).size!==actual.length)throw Error(`${label}_DUPLICATE_IDENTITY`);
  const wanted=new Set(expected),got=new Set(actual);
  if(expected.some(x=>!got.has(x)))throw Error(`${label}_GOVERNED_IDENTITY_MISSING`);
  if(actual.some(x=>!wanted.has(x)))throw Error(`${label}_UNEXPECTED_IDENTITY`);
}

export function executeOwnerOverlay({audit=auditGovernedInputs(),run=createGdalRunner(),tempRoot=os.tmpdir()}={}){
  if(!audit.ready)throw Error(`AUTHORITATIVE_GEOMETRY_INPUTS_MISSING: ${audit.missing.join(', ')}`);
  const gdalVersion=requireGdal(run),workspace=fs.mkdtempSync(path.join(tempRoot,'lp191-overlay-'));
  const gpkg=path.join(workspace,'lp191.gpkg'),placesJson=path.join(workspace,'places.json'),atomicJson=path.join(workspace,'atomic.json'),pairsJson=path.join(workspace,'pairs.json');
  try{
    run('ogrinfo',['-ro','-so',audit.ownerPlaceGeometry,'tl_2025_48_place'],'PLACE layer contract');
    const placeIds=audit.cohort.map(x=>x.placeGeoid);
    const placeWhere=`GEOID IN (${placeIds.map(sqlString).join(',')})`;
    run('ogr2ogr',['-f','GPKG',gpkg,audit.ownerPlaceGeometry,'tl_2025_48_place','-nln','places_3083','-t_srs','EPSG:3083','-where',placeWhere,'-select','GEOID,NAME'],'extract 33 governed PLACE geometries');
    run('ogr2ogr',['-f','GeoJSON',placesJson,gpkg,'places_3083','-sql','SELECT GEOID, NAME, ST_IsValid(geom) AS valid_geometry, ST_IsEmpty(geom) AS empty_geometry, ST_Area(geom) AS area_m2 FROM places_3083','-dialect','SQLite'],'validate PLACE geometries');
    const places=loadFeatures(placesJson).map(x=>x.properties);
    validateIdentitySet(places.map(x=>String(x.GEOID)),placeIds,'PLACE_EXTRACTION');
    if(places.some(x=>!bool(x.valid_geometry)||bool(x.empty_geometry)||number(x.area_m2)<=0))throw Error('PLACE_GEOMETRY_INVALID_EMPTY_OR_ZERO_AREA');

    const originalIds=audit.usable.filter(x=>x.globalId!==WEST_ID).map(x=>x.globalId);
    const atomicWhere=`GlobalID IN (${originalIds.map(sqlString).join(',')})`;
    run('ogr2ogr',['-f','GPKG','-update',gpkg,audit.ownerSaGeometry,'-nln','atomic_3083','-t_srs','EPSG:3083','-where',atomicWhere,'-select','GlobalID,Name'],'extract 28 governed original atomic geometries');
    run('ogr2ogr',['-f','GPKG','-update','-append',gpkg,audit.westArtifact,'-nln','atomic_3083','-t_srs','EPSG:3083','-select','GlobalID,Name'],'append certified West Northwest geometry');
    run('ogr2ogr',['-f','GeoJSON',atomicJson,gpkg,'atomic_3083','-sql','SELECT GlobalID, Name, ST_IsValid(geom) AS valid_geometry, ST_IsEmpty(geom) AS empty_geometry, ST_Area(geom) AS area_m2 FROM atomic_3083','-dialect','SQLite'],'validate usable atomic geometries');
    const atomics=loadFeatures(atomicJson).map(x=>x.properties);
    const usableIds=audit.usable.map(x=>x.globalId);
    validateIdentitySet(atomics.map(x=>String(x.GlobalID).toLowerCase()),usableIds,'USABLE_ATOMIC');
    if(atomics.some(x=>String(x.GlobalID).toLowerCase()===FAR_ID))throw Error('FAR_SOUTHWEST_MUST_NOT_ENTER_USABLE_OVERLAY');
    if(atomics.some(x=>!bool(x.valid_geometry)||bool(x.empty_geometry)||number(x.area_m2)<=0))throw Error('ATOMIC_GEOMETRY_INVALID_EMPTY_OR_ZERO_AREA');

    const pairSql=`SELECT p.GEOID AS placeGeoid, p.NAME AS placeName, a.GlobalID AS atomicGlobalId, a.Name AS atomicName, ST_Disjoint(p.geom,a.geom) AS disjoint, ST_Intersects(p.geom,a.geom) AS intersects, ST_Touches(p.geom,a.geom) AS boundariesTouch, ST_Within(p.geom,a.geom) AS placeWithinAtomic, ST_Within(a.geom,p.geom) AS atomicWithinPlace, ST_Dimension(ST_Intersection(p.geom,a.geom)) AS intersectionDimension, ST_Area(ST_Intersection(p.geom,a.geom)) AS intersectionAreaM2, ST_Area(p.geom) AS placeAreaM2, ST_Area(a.geom) AS atomicAreaM2 FROM places_3083 p CROSS JOIN atomic_3083 a`;
    run('ogr2ogr',['-f','GeoJSON',pairsJson,gpkg,'-nln','pair_evidence','-nlt','NONE','-sql',pairSql,'-dialect','SQLite'],'compute complete 957-pair topology matrix');
    const pairs=loadFeatures(pairsJson).map(({properties:x})=>{const measuredArea=number(x.intersectionAreaM2),intersectionDimension=Number(x.intersectionDimension),intersectionAreaM2=intersectionDimension===2?measuredArea:0,placeAreaM2=number(x.placeAreaM2),atomicAreaM2=number(x.atomicAreaM2);return {placeGeoid:String(x.placeGeoid),placeName:x.placeName,atomicGlobalId:String(x.atomicGlobalId).toLowerCase(),atomicName:x.atomicName,disjoint:bool(x.disjoint),intersects:bool(x.intersects),boundariesTouch:bool(x.boundariesTouch),intersectionDimension,positiveAreaIntersection:intersectionDimension===2&&intersectionAreaM2>0,placeWithinAtomic:bool(x.placeWithinAtomic),atomicWithinPlace:bool(x.atomicWithinPlace),intersectionAreaM2,intersectionAreaSquareMiles:intersectionAreaM2/2589988.110336,placeAreaM2,atomicAreaM2,percentOfPlace:placeAreaM2?intersectionAreaM2/placeAreaM2*100:0,percentOfAtomic:atomicAreaM2?intersectionAreaM2/atomicAreaM2*100:0,classification:classifyPair({intersectionArea:intersectionAreaM2,placeWithinAtomic:bool(x.placeWithinAtomic),atomicWithinPlace:bool(x.atomicWithinPlace),boundariesTouch:bool(x.boundariesTouch)})};}).sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid)||a.atomicGlobalId.localeCompare(b.atomicGlobalId));
    if(pairs.length!==957||new Set(pairs.map(x=>`${x.placeGeoid}/${x.atomicGlobalId}`)).size!==957)throw Error('EXACT_957_UNIQUE_PAIR_EVALUATIONS_REQUIRED');
    const far=failClosedFarSouthwest();
    const aggregates=audit.cohort.map(place=>{const rows=pairs.filter(x=>x.placeGeoid===place.placeGeoid),positive=rows.filter(x=>x.positiveAreaIntersection),boundary=rows.filter(x=>x.classification==='BOUNDARY_TOUCH_ONLY'),dominant=[...positive].sort((a,b)=>b.percentOfPlace-a.percentOfPlace||a.atomicGlobalId.localeCompare(b.atomicGlobalId))[0]||null;return {displayName:place.name,placeGeoid:place.placeGeoid,independentGovernanceStatus:place.evidenceClassification,precedence:PRECEDENCE,totalPlaceAreaM2:rows[0]?.placeAreaM2||0,positiveAreaIntersectingAtomicUnits:positive.map(x=>({globalId:x.atomicGlobalId,name:x.atomicName,percentOfPlace:x.percentOfPlace})),boundaryOnlyAtomicUnits:boundary.map(x=>({globalId:x.atomicGlobalId,name:x.atomicName})),dominantAtomicUnit:dominant?{globalId:dominant.atomicGlobalId,name:dominant.atomicName,percentOfPlace:dominant.percentOfPlace}:null,positiveAreaAtomicCount:positive.length,crossesMultipleAtomicUnits:positive.length>1,farSouthwestRelevanceState:far.method,farSouthwestCertificationState:far.certificationState,aggregateClassification:classifyAggregate({positiveAreaCount:positive.length,boundaryTouchCount:boundary.length,farSouthwestPreventsCertification:true})};}).sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid));
    const counts={};for(const x of aggregates)counts[x.aggregateClassification]=(counts[x.aggregateClassification]||0)+1;
    return {milestone:'LP191.4',status:'OWNER_WHATIF_COMPLETE',workingCrs:'EPSG:3083',gdalVersion,placeSourceIdentity:PLACE_SOURCE,saTomorrowSourceIdentity:SOURCE,westNorthwestIdentity:WEST,placeCount:33,officialAtomicCount:30,usableAtomicCount:29,pairEvaluationCount:pairs.length,deterministicMatrixComplete:true,runtimeMutationPerformed:false,governedReportWritesPerformed:false,aggregateClassificationCounts:counts,multiAtomicPlaces:aggregates.filter(x=>x.crossesMultipleAtomicUnits).map(x=>({name:x.displayName,placeGeoid:x.placeGeoid})),boundaryTouchOnlyFindings:pairs.filter(x=>x.classification==='BOUNDARY_TOUCH_ONLY').map(x=>({placeGeoid:x.placeGeoid,placeName:x.placeName,atomicGlobalId:x.atomicGlobalId,atomicName:x.atomicName})),farSouthwestIndeterminatePlaces:aggregates.map(x=>({name:x.displayName,placeGeoid:x.placeGeoid})),unusualGeometryResults:pairs.filter(x=>x.intersects&&x.disjoint).map(x=>({placeGeoid:x.placeGeoid,atomicGlobalId:x.atomicGlobalId})),pairs,aggregates};
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
}

export function main(argv=process.argv){
  const modes=['--whatif','--verify','--apply'].filter(x=>argv.includes(x));if(modes.length!==1)throw Error('EXACTLY_ONE_GUARDED_MODE_REQUIRED');
  if(!argv.includes('--whatif'))throw Error('LP191_GOVERNED_OUTPUT_NOT_YET_COMMITTED_OWNER_WHATIF_REQUIRED');
  return executeOwnerOverlay();
}
if(process.argv[1]===fileURLToPath(import.meta.url))try{const out=main();console.log(serialize(out));}catch(e){const out={milestone:'LP191',status:'FAIL_CLOSED',error:e.message,runtimeMutationPerformed:false};(process.argv.includes('--json')?console.log:console.error)(serialize(out));process.exitCode=1;}
