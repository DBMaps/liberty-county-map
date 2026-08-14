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
export const ATOMIC_TARGET_FIELDS=Object.freeze(['GlobalID','Name']);
export const WEST_SOURCE_FIELDS=Object.freeze(['GlobalID','Name']);
export const PATHS={identity:'reports/metro-child-area-evidence-governance-audit.json',working:'reports/san-antonio-sa-tomorrow-working-geometry-governance.json',west:'evidence/san-antonio-sa-tomorrow-derived-repairs/west-northwest/repaired.geojson'};
export const FAR_SOUTHWEST_RELEVANCE=Object.freeze({IRRELEVANT:'CERTIFIED_IRRELEVANT_BY_ENVELOPE_DISJOINT',POTENTIAL:'POTENTIALLY_RELEVANT_GOVERNANCE_HOLD'});
export const OVERLAP_SIGNIFICANCE=Object.freeze({TRACE:'TRACE_POSITIVE_AREA_OVERLAP',MINOR:'MINOR_POSITIVE_AREA_OVERLAP',MATERIAL:'MATERIAL_POSITIVE_AREA_OVERLAP'});
export const SIGNIFICANCE_THRESHOLDS=Object.freeze({traceAreaM2:100,tracePercentOfPlace:0.01,minorAreaM2:10000,minorPercentOfPlace:1});
export const CERTIFICATION_STATUS='CERTIFIED_WITH_SELECTIVE_FAR_SOUTHWEST_GOVERNANCE_HOLD';
export const REPORT_PATHS=Object.freeze({json:'reports/lp191/bexar-place-cdp-overlay.json',markdown:'reports/lp191/bexar-place-cdp-overlay.md'});
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p)));
const digest=p=>{const b=fs.readFileSync(p);return {bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}};
export const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const serialize=v=>JSON.stringify(canonical(v),null,2)+'\n';

export function gdalZipDatasource(sourcePath){
  if(typeof sourcePath!=='string'||sourcePath.startsWith('/vsizip/'))return sourcePath;
  if(!sourcePath.toLowerCase().endsWith('.zip'))return sourcePath;
  return `/vsizip/${sourcePath.replaceAll('\\','/')}`;
}

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
  if(positiveAreaCount===1)return 'SINGLE_ATOMIC_POSITIVE_AREA_OVERLAP';
  if(boundaryTouchCount>0)return 'BOUNDARY_TOUCH_ONLY';
  return 'OUTSIDE_USABLE_SA_TOMORROW_GEOGRAPHY';
}
export function classifySignificance({intersectionAreaM2,percentOfPlace}){
  if(!(intersectionAreaM2>0))return {relationshipSignificance:null,significanceReason:null};
  if(intersectionAreaM2<SIGNIFICANCE_THRESHOLDS.traceAreaM2&&percentOfPlace<SIGNIFICANCE_THRESHOLDS.tracePercentOfPlace)return {relationshipSignificance:OVERLAP_SIGNIFICANCE.TRACE,significanceReason:'AREA_LT_100_M2_AND_PERCENT_OF_PLACE_LT_0_01_PERCENT'};
  if(intersectionAreaM2<SIGNIFICANCE_THRESHOLDS.minorAreaM2||percentOfPlace<SIGNIFICANCE_THRESHOLDS.minorPercentOfPlace)return {relationshipSignificance:OVERLAP_SIGNIFICANCE.MINOR,significanceReason:'AREA_LT_10000_M2_OR_PERCENT_OF_PLACE_LT_1_PERCENT'};
  return {relationshipSignificance:OVERLAP_SIGNIFICANCE.MATERIAL,significanceReason:'AREA_GTE_10000_M2_AND_PERCENT_OF_PLACE_GTE_1_PERCENT'};
}
export function envelopesDisjoint(a,b){return a.maxX<b.minX||b.maxX<a.minX||a.maxY<b.minY||b.maxY<a.minY;}
export function classifyFarSouthwestRelevance(placeEnvelope,farEnvelope){const irrelevant=placeEnvelope&&farEnvelope&&envelopesDisjoint(placeEnvelope,farEnvelope);return {farSouthwestRelevance:irrelevant?FAR_SOUTHWEST_RELEVANCE.IRRELEVANT:FAR_SOUTHWEST_RELEVANCE.POTENTIAL,farSouthwestPreventsCompleteCertification:!irrelevant};}
export function geometryEnvelope(geometry){const envelope={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};const visit=value=>{if(Array.isArray(value)&&value.length>=2&&Number.isFinite(value[0])&&Number.isFinite(value[1])){envelope.minX=Math.min(envelope.minX,value[0]);envelope.minY=Math.min(envelope.minY,value[1]);envelope.maxX=Math.max(envelope.maxX,value[0]);envelope.maxY=Math.max(envelope.maxY,value[1]);}else if(Array.isArray(value))for(const child of value)visit(child);};visit(geometry?.coordinates);return Number.isFinite(envelope.minX)?envelope:null;}
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

export function buildAggregate(place,rows,placeEnvelope,farEnvelope){
  const positive=rows.filter(x=>x.positiveAreaIntersection),boundary=rows.filter(x=>x.classification==='BOUNDARY_TOUCH_ONLY');
  const byDominance=(a,b)=>b.percentOfPlace-a.percentOfPlace||a.atomicGlobalId.localeCompare(b.atomicGlobalId);
  const dominant=[...positive].sort(byDominance)[0]||null;
  const material=positive.filter(x=>x.relationshipSignificance===OVERLAP_SIGNIFICANCE.MATERIAL);
  const dominantMaterial=[...material].sort(byDominance)[0]||null;
  const relevance=classifyFarSouthwestRelevance(placeEnvelope,farEnvelope);
  const unit=x=>({globalId:x.atomicGlobalId,name:x.atomicName,percentOfPlace:x.percentOfPlace});
  return {placeName:place.name,placeGeoid:place.placeGeoid,independentGovernanceStatus:place.evidenceClassification,precedence:PRECEDENCE,totalPlaceAreaM2:rows[0]?.placeAreaM2||0,positiveAreaIntersectingAtomicUnits:positive.map(unit),boundaryOnlyAtomicUnits:boundary.map(x=>({globalId:x.atomicGlobalId,name:x.atomicName})),dominantAtomicUnit:dominant?unit(dominant):null,positiveAreaAtomicCount:positive.length,crossesMultipleAtomicUnits:positive.length>1,traceOverlapCount:positive.filter(x=>x.relationshipSignificance===OVERLAP_SIGNIFICANCE.TRACE).length,minorOverlapCount:positive.filter(x=>x.relationshipSignificance===OVERLAP_SIGNIFICANCE.MINOR).length,materialOverlapCount:material.length,materialPositiveAreaAtomicUnits:material.map(unit),hasOnlyTraceOrMinorPositiveAreaOverlap:positive.length>0&&material.length===0,dominantMaterialAtomicUnit:dominantMaterial?unit(dominantMaterial):null,...relevance,farSouthwestCertificationState:'GEOMETRY_GOVERNANCE_HOLD_CITY_CLARIFICATION_REQUIRED',aggregateClassification:classifyAggregate({positiveAreaCount:positive.length,boundaryTouchCount:boundary.length,farSouthwestPreventsCertification:relevance.farSouthwestPreventsCompleteCertification})};
}

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

export function westNorthwestAppendArgs(gpkg,westArtifact){
  if(ATOMIC_TARGET_FIELDS.length!==WEST_SOURCE_FIELDS.length||ATOMIC_TARGET_FIELDS.some((field,index)=>field!==WEST_SOURCE_FIELDS[index]))throw Error('WEST_NORTHWEST_APPEND_SCHEMA_MAPPING_UNSAFE');
  const fieldMap=WEST_SOURCE_FIELDS.map(field=>ATOMIC_TARGET_FIELDS.indexOf(field));
  if(fieldMap.some(index=>index<0)||new Set(fieldMap).size!==fieldMap.length)throw Error('WEST_NORTHWEST_APPEND_SCHEMA_MAPPING_UNSAFE');
  return ['-f','GPKG','-update','-append',gpkg,westArtifact,'-nln','atomic_3083','-t_srs','EPSG:3083','-fieldmap',fieldMap.join(',')];
}

export function executeOwnerOverlay({audit=auditGovernedInputs(),run=createGdalRunner(),tempRoot=os.tmpdir()}={}){
  if(!audit.ready)throw Error(`AUTHORITATIVE_GEOMETRY_INPUTS_MISSING: ${audit.missing.join(', ')}`);
  const gdalVersion=requireGdal(run),workspace=fs.mkdtempSync(path.join(tempRoot,'lp191-overlay-'));
  const gpkg=path.join(workspace,'lp191.gpkg'),placesJson=path.join(workspace,'places.json'),atomicJson=path.join(workspace,'atomic.json'),pairsJson=path.join(workspace,'pairs.json'),farJson=path.join(workspace,'far-envelope.json');
  const placeDatasource=gdalZipDatasource(audit.ownerPlaceGeometry);
  try{
    run('ogrinfo',['-ro','-so',placeDatasource,'tl_2025_48_place'],'PLACE layer contract');
    const placeIds=audit.cohort.map(x=>x.placeGeoid);
    const placeWhere=`GEOID IN (${placeIds.map(sqlString).join(',')})`;
    run('ogr2ogr',['-f','GPKG',gpkg,placeDatasource,'tl_2025_48_place','-nln','places_3083','-t_srs','EPSG:3083','-where',placeWhere,'-select','GEOID,NAME'],'extract 33 governed PLACE geometries');
    run('ogr2ogr',['-f','GeoJSON',placesJson,gpkg,'places_3083','-sql','SELECT GEOID, NAME, ST_IsValid(geom) AS valid_geometry, ST_IsEmpty(geom) AS empty_geometry, ST_Area(geom) AS area_m2, ST_MinX(geom) AS min_x, ST_MinY(geom) AS min_y, ST_MaxX(geom) AS max_x, ST_MaxY(geom) AS max_y FROM places_3083','-dialect','SQLite'],'validate PLACE geometries');
    const places=loadFeatures(placesJson).map(x=>x.properties);
    validateIdentitySet(places.map(x=>String(x.GEOID)),placeIds,'PLACE_EXTRACTION');
    if(places.some(x=>!bool(x.valid_geometry)||bool(x.empty_geometry)||number(x.area_m2)<=0))throw Error('PLACE_GEOMETRY_INVALID_EMPTY_OR_ZERO_AREA');
    // Isolated coordinate reprojection supports envelope exclusion only. The held
    // polygon never enters the overlay GeoPackage or a topology SQL expression.
    run('ogr2ogr',['-f','GeoJSON',farJson,audit.ownerSaGeometry,'-t_srs','EPSG:3083','-where',`GlobalID = ${sqlString(FAR_ID)}`,'-select','GlobalID,Name'],'extract Far Southwest raw coordinates for envelope exclusion only');
    const farFeatures=loadFeatures(farJson),farEnvelope=farFeatures.length===1?geometryEnvelope(farFeatures[0].geometry):null;
    if(!farEnvelope||String(farFeatures[0].properties?.GlobalID).toLowerCase()!==FAR_ID)throw Error('FAR_SOUTHWEST_SOURCE_ENVELOPE_UNAVAILABLE');

    const originalIds=audit.usable.filter(x=>x.globalId!==WEST_ID).map(x=>x.globalId);
    const atomicWhere=`GlobalID IN (${originalIds.map(sqlString).join(',')})`;
    run('ogr2ogr',['-f','GPKG','-update',gpkg,audit.ownerSaGeometry,'-nln','atomic_3083','-t_srs','EPSG:3083','-where',atomicWhere,'-select',ATOMIC_TARGET_FIELDS.join(',')],'extract 28 governed original atomic geometries');
    run('ogr2ogr',westNorthwestAppendArgs(gpkg,audit.westArtifact),'append certified West Northwest geometry');
    run('ogr2ogr',['-f','GeoJSON',atomicJson,gpkg,'atomic_3083','-sql','SELECT GlobalID, Name, ST_IsValid(geom) AS valid_geometry, ST_IsEmpty(geom) AS empty_geometry, ST_Area(geom) AS area_m2 FROM atomic_3083','-dialect','SQLite'],'validate usable atomic geometries');
    const atomics=loadFeatures(atomicJson).map(x=>x.properties);
    const usableIds=audit.usable.map(x=>x.globalId);
    validateIdentitySet(atomics.map(x=>String(x.GlobalID).toLowerCase()),usableIds,'USABLE_ATOMIC');
    if(atomics.some(x=>String(x.GlobalID).toLowerCase()===FAR_ID))throw Error('FAR_SOUTHWEST_MUST_NOT_ENTER_USABLE_OVERLAY');
    const west=atomics.filter(x=>String(x.GlobalID).toLowerCase()===WEST_ID);
    if(west.length!==1||west[0].Name!=='West Northwest')throw Error('WEST_NORTHWEST_DESTINATION_IDENTITY_MAPPING_FAILED');
    if(atomics.some(x=>!bool(x.valid_geometry)||bool(x.empty_geometry)||number(x.area_m2)<=0))throw Error('ATOMIC_GEOMETRY_INVALID_EMPTY_OR_ZERO_AREA');

    const pairSql=`SELECT p.GEOID AS placeGeoid, p.NAME AS placeName, a.GlobalID AS atomicGlobalId, a.Name AS atomicName, ST_Disjoint(p.geom,a.geom) AS disjoint, ST_Intersects(p.geom,a.geom) AS intersects, ST_Touches(p.geom,a.geom) AS boundariesTouch, ST_Within(p.geom,a.geom) AS placeWithinAtomic, ST_Within(a.geom,p.geom) AS atomicWithinPlace, ST_Dimension(ST_Intersection(p.geom,a.geom)) AS intersectionDimension, ST_Area(ST_Intersection(p.geom,a.geom)) AS intersectionAreaM2, ST_Area(p.geom) AS placeAreaM2, ST_Area(a.geom) AS atomicAreaM2 FROM places_3083 p CROSS JOIN atomic_3083 a`;
    run('ogr2ogr',['-f','GeoJSON',pairsJson,gpkg,'-nln','pair_evidence','-nlt','NONE','-sql',pairSql,'-dialect','SQLite'],'compute complete 957-pair topology matrix');
    const pairs=loadFeatures(pairsJson).map(({properties:x})=>{const measuredArea=number(x.intersectionAreaM2),intersectionDimension=Number(x.intersectionDimension),intersectionAreaM2=intersectionDimension===2?measuredArea:0,placeAreaM2=number(x.placeAreaM2),atomicAreaM2=number(x.atomicAreaM2);return {placeGeoid:String(x.placeGeoid),placeName:x.placeName,atomicGlobalId:String(x.atomicGlobalId).toLowerCase(),atomicName:x.atomicName,disjoint:bool(x.disjoint),intersects:bool(x.intersects),boundariesTouch:bool(x.boundariesTouch),intersectionDimension,positiveAreaIntersection:intersectionDimension===2&&intersectionAreaM2>0,placeWithinAtomic:bool(x.placeWithinAtomic),atomicWithinPlace:bool(x.atomicWithinPlace),intersectionAreaM2,intersectionAreaSquareMiles:intersectionAreaM2/2589988.110336,placeAreaM2,atomicAreaM2,percentOfPlace:placeAreaM2?intersectionAreaM2/placeAreaM2*100:0,percentOfAtomic:atomicAreaM2?intersectionAreaM2/atomicAreaM2*100:0,classification:classifyPair({intersectionArea:intersectionAreaM2,placeWithinAtomic:bool(x.placeWithinAtomic),atomicWithinPlace:bool(x.atomicWithinPlace),boundariesTouch:bool(x.boundariesTouch)}),...classifySignificance({intersectionAreaM2,percentOfPlace:placeAreaM2?intersectionAreaM2/placeAreaM2*100:0})};}).sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid)||a.atomicGlobalId.localeCompare(b.atomicGlobalId));
    if(pairs.length!==957||new Set(pairs.map(x=>`${x.placeGeoid}/${x.atomicGlobalId}`)).size!==957)throw Error('EXACT_957_UNIQUE_PAIR_EVALUATIONS_REQUIRED');
    const placeById=new Map(places.map(x=>[String(x.GEOID),x]));
    const aggregates=audit.cohort.map(place=>{const p=placeById.get(place.placeGeoid);return buildAggregate(place,pairs.filter(x=>x.placeGeoid===place.placeGeoid),{minX:number(p?.min_x),minY:number(p?.min_y),maxX:number(p?.max_x),maxY:number(p?.max_y)},farEnvelope);}).sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid));
    const counts={};for(const x of aggregates)counts[x.aggregateClassification]=(counts[x.aggregateClassification]||0)+1;
    const certifiedIrrelevant=aggregates.filter(x=>!x.farSouthwestPreventsCompleteCertification),potentiallyRelevant=aggregates.filter(x=>x.farSouthwestPreventsCompleteCertification);
    const tracePairs=pairs.filter(x=>x.relationshipSignificance===OVERLAP_SIGNIFICANCE.TRACE).map(x=>({placeGeoid:x.placeGeoid,placeName:x.placeName,atomicGlobalId:x.atomicGlobalId,atomicName:x.atomicName,intersectionAreaM2:x.intersectionAreaM2,percentOfPlace:x.percentOfPlace}));
    const significanceCounts={trace:pairs.filter(x=>x.relationshipSignificance===OVERLAP_SIGNIFICANCE.TRACE).length,minor:pairs.filter(x=>x.relationshipSignificance===OVERLAP_SIGNIFICANCE.MINOR).length,material:pairs.filter(x=>x.relationshipSignificance===OVERLAP_SIGNIFICANCE.MATERIAL).length};
    return {milestone:'LP191.5',status:'OWNER_WHATIF_COMPLETE',workingCrs:'EPSG:3083',gdalVersion,placeSourceIdentity:PLACE_SOURCE,saTomorrowSourceIdentity:SOURCE,westNorthwestIdentity:WEST,placeCount:33,officialAtomicCount:30,usableAtomicCount:29,pairEvaluationCount:pairs.length,deterministicMatrixComplete:true,runtimeMutationPerformed:false,governedReportWritesPerformed:false,aggregateClassificationCounts:counts,farSouthwestCertifiedIrrelevantCount:certifiedIrrelevant.length,farSouthwestPotentiallyRelevantCount:potentiallyRelevant.length,farSouthwestPotentiallyRelevantPlaces:potentiallyRelevant.map(x=>({placeName:x.placeName,placeGeoid:x.placeGeoid})),traceOverlapCount:significanceCounts.trace,minorOverlapCount:significanceCounts.minor,materialOverlapCount:significanceCounts.material,tracePairs,multiAtomicPlaces:aggregates.filter(x=>x.crossesMultipleAtomicUnits).map(x=>({placeName:x.placeName,placeGeoid:x.placeGeoid})),multiAtomicPlacesByMaterialOverlap:aggregates.filter(x=>x.materialOverlapCount>1).map(x=>({placeName:x.placeName,placeGeoid:x.placeGeoid})),boundaryTouchOnlyFindings:pairs.filter(x=>x.classification==='BOUNDARY_TOUCH_ONLY').map(x=>({placeGeoid:x.placeGeoid,placeName:x.placeName,atomicGlobalId:x.atomicGlobalId,atomicName:x.atomicName})),farSouthwestIndeterminatePlaces:potentiallyRelevant.map(x=>({placeName:x.placeName,placeGeoid:x.placeGeoid})),unusualGeometryResults:pairs.filter(x=>x.intersects&&x.disjoint).map(x=>({placeGeoid:x.placeGeoid,atomicGlobalId:x.atomicGlobalId})),pairs,aggregates};
  }finally{fs.rmSync(workspace,{recursive:true,force:true});}
}

const countBy=(items,key)=>Object.fromEntries([...new Set(items.map(x=>x[key]))].sort().map(value=>[value,items.filter(x=>x[key]===value).length]));
const namedPlace=x=>({placeGeoid:x.placeGeoid,placeName:x.placeName});
const same=(a,b)=>serialize(a)===serialize(b);
export function certifyOwnerResult(owner){
  const pairs=[...owner.pairs].sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid)||a.atomicGlobalId.localeCompare(b.atomicGlobalId));
  const aggregates=[...owner.aggregates].map(x=>({...x,placeName:x.placeName||x.displayName})).sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid));
  const rawClassificationCounts=countBy(pairs,'classification');
  const significanceCounts=countBy(pairs.filter(x=>x.relationshipSignificance),'relationshipSignificance');
  const farSouthwestRelevanceCounts=countBy(aggregates,'farSouthwestRelevance');
  const potentiallyRelevant=aggregates.filter(x=>x.farSouthwestRelevance===FAR_SOUTHWEST_RELEVANCE.POTENTIAL).map(namedPlace);
  const rawMultiAtomic=aggregates.filter(x=>x.positiveAreaAtomicCount>1).map(namedPlace);
  const materialMultiAtomic=aggregates.filter(x=>x.materialOverlapCount>1).map(namedPlace);
  const aggregateClassificationCounts=countBy(aggregates,'aggregateClassification');
  const expectedHeld=[{placeGeoid:'4868708',placeName:'Somerset'},{placeGeoid:'4875764',placeName:'Von Ormy'}];
  const requireFact=(condition,label)=>{if(!condition)throw Error(`LP191_CERTIFICATION_FACT_MISMATCH_${label}`);};
  requireFact(owner.status==='OWNER_WHATIF_COMPLETE','OWNER_STATUS');
  requireFact(owner.placeCount===33&&owner.officialAtomicCount===30&&owner.usableAtomicCount===29&&pairs.length===957&&aggregates.length===33,'CARDINALITIES');
  requireFact(new Set(pairs.map(x=>`${x.placeGeoid}/${x.atomicGlobalId}`)).size===957&&same(pairs,owner.pairs),'COMPLETE_SORTED_PAIR_MATRIX');
  requireFact(same(aggregates,owner.aggregates.map(x=>({...x,placeName:x.placeName||x.displayName})).sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid))),'SORTED_AGGREGATES');
  requireFact(rawClassificationCounts.DISJOINT===914&&rawClassificationCounts.PARTIAL_AREA_OVERLAP===43&&Object.values(rawClassificationCounts).reduce((a,b)=>a+b,0)===957,'RAW_COUNTS');
  requireFact(significanceCounts[OVERLAP_SIGNIFICANCE.TRACE]===2&&significanceCounts[OVERLAP_SIGNIFICANCE.MINOR]===39&&significanceCounts[OVERLAP_SIGNIFICANCE.MATERIAL]===2,'SIGNIFICANCE_COUNTS');
  requireFact(farSouthwestRelevanceCounts[FAR_SOUTHWEST_RELEVANCE.IRRELEVANT]===31&&farSouthwestRelevanceCounts[FAR_SOUTHWEST_RELEVANCE.POTENTIAL]===2&&same(potentiallyRelevant,expectedHeld),'SELECTIVE_FAR_SOUTHWEST_HOLD');
  requireFact(aggregateClassificationCounts.MULTI_ATOMIC_POSITIVE_AREA_OVERLAP===14&&aggregateClassificationCounts.SINGLE_ATOMIC_POSITIVE_AREA_OVERLAP===7&&aggregateClassificationCounts.OUTSIDE_USABLE_SA_TOMORROW_GEOGRAPHY===10&&aggregateClassificationCounts.INDETERMINATE_FAR_SOUTHWEST_GOVERNANCE_HOLD===2,'AGGREGATE_COUNTS');
  requireFact(rawMultiAtomic.length===14&&materialMultiAtomic.length===0,'MULTI_ATOMIC_COUNTS');
  requireFact(aggregates.every(x=>x.placeName&&x.precedence===PRECEDENCE),'NAMES_AND_PRECEDENCE');
  return {milestone:'LP191.6',certificationStatus:CERTIFICATION_STATUS,sourceIdentities:{texasPlace:owner.placeSourceIdentity,saTomorrow:owner.saTomorrowSourceIdentity,westNorthwest:owner.westNorthwestIdentity},gdalVersion:owner.gdalVersion,workingCrs:owner.workingCrs,placeCount:33,officialAtomicCount:30,usableAtomicCount:29,pairCount:957,pairs,aggregates,rawClassificationCounts,significanceCounts,farSouthwestRelevanceCounts,potentiallyRelevantPlaces:potentiallyRelevant,rawMultiAtomicPlaces:rawMultiAtomic,materialMultiAtomicPlaces:materialMultiAtomic,aggregateClassificationCounts,unusualGeometryResults:owner.unusualGeometryResults,precedencePolicy:{value:PRECEDENCE,consumerRegionAssignmentEmitted:false},significanceGovernance:{interpretationOnly:true,createsConsumerMembership:false,trace:'area < 100 m² AND percent of PLACE < 0.01%',minor:'not TRACE AND (area < 10,000 m² OR percent of PLACE < 1%)',material:'area >= 10,000 m² AND percent of PLACE >= 1%'},protectedScopeAssertions:{runtimeMutation:false,consumerMembershipMutation:false,farSouthwestGeometryMutation:false,governedWritesLimitedTo:Object.values(REPORT_PATHS)},determinismEvidence:{canonicalKeySorting:true,pairSort:['placeGeoid','atomicGlobalId'],aggregateSort:['placeGeoid'],summaryPlaceListSort:['placeGeoid'],timestampsExcluded:true,ownerRunsSemanticallyEqual:true}};
}

export function renderMarkdown(report){
  return `# LP191.6 governed Bexar PLACE/CDP overlay certification\n\n**Status:** \`${report.certificationStatus}\`\n\n## Certified scope\n\n29 usable atomic units were fully analyzed. All 957 usable-unit pair relationships were deterministically certified. This does **not** claim certification against all 30 official units: Somerset (4868708) and Von Ormy (4875764) remain unresolved against the held Far Southwest unit, while their independent canonical identities remain fully preserved.\n\n## Findings\n\n- 33 governed PLACE/CDPs\n- 957 total usable-unit pair evaluations\n- 914 disjoint\n- 43 positive-area partial overlaps\n- 2 trace, 39 minor, and 2 material overlaps\n- 14 raw multi-atomic PLACE/CDPs; 0 material multi-atomic PLACE/CDPs\n- 7 single-atomic positive overlaps\n- 10 outside usable SA Tomorrow geography\n- 31 certified irrelevant to Far Southwest\n- 2 held: Somerset (4868708) and Von Ormy (4875764)\n\n## Governance\n\nEvery aggregate carries \`${PRECEDENCE}\`; no consumer-region assignment is emitted. TRACE means area < 100 m² **and** PLACE percentage < 0.01%. MINOR means not TRACE and area < 10,000 m² **or** PLACE percentage < 1%. MATERIAL means area >= 10,000 m² **and** PLACE percentage >= 1%. Significance is governance interpretation only; it does not create consumer membership. Raw topology remains unchanged.\n`;
}
export function writeGovernedReports(report,{root=ROOT}={}){const json=serialize(report),markdown=renderMarkdown(report);for(const relative of Object.values(REPORT_PATHS))fs.mkdirSync(path.dirname(path.join(root,relative)),{recursive:true});fs.writeFileSync(path.join(root,REPORT_PATHS.json),json);fs.writeFileSync(path.join(root,REPORT_PATHS.markdown),markdown);return {json,markdown};}
export function verifyGovernedReport(report,recomputed){const governed=certifyOwnerResult(recomputed);if(!same(report,governed))throw Error('LP191_GOVERNED_REPORT_DRIFT');return governed;}

export function main(argv=process.argv){
  const modes=['--whatif','--verify','--apply'].filter(x=>argv.includes(x));if(modes.length!==1)throw Error('EXACTLY_ONE_GUARDED_MODE_REQUIRED');
  if(argv.includes('--whatif'))return executeOwnerOverlay();
  const audit=auditGovernedInputs();
  const first=certifyOwnerResult(executeOwnerOverlay({audit})),second=certifyOwnerResult(executeOwnerOverlay({audit}));
  if(!same(first,second))throw Error('LP191_REPEATED_OWNER_EXECUTION_NOT_DETERMINISTIC');
  if(argv.includes('--verify')){const committed=JSON.parse(fs.readFileSync(path.join(ROOT,REPORT_PATHS.json)));return verifyGovernedReport(committed,executeOwnerOverlay({audit}));}
  writeGovernedReports(first);return {...first,governedReportWritesPerformed:true};
}
if(process.argv[1]===fileURLToPath(import.meta.url))try{const out=main();console.log(serialize(out));}catch(e){const out={milestone:'LP191',status:'FAIL_CLOSED',error:e.message,runtimeMutationPerformed:false};(process.argv.includes('--json')?console.log:console.error)(serialize(out));process.exitCode=1;}
