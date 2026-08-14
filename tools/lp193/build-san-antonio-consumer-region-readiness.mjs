import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const JSON_PATH='reports/lp193/san-antonio-consumer-region-implementation-readiness.json';
const MD_PATH='reports/lp193/san-antonio-consumer-region-implementation-readiness.md';
export const GEOMETRY_PATH='evidence/lp193/san-antonio-consumer-region-design-geometry.geojson';
export const SOURCE_IDENTITY=Object.freeze({bytes:1864489,sha256:'bf15d7d257d60970c894e590cacb996a15a8796d789e09335860fdb2a6a6e13d'});
export const WEST_IDENTITY=Object.freeze({bytes:427909,sha256:'1eed04031d6a0ccb13c5749fbcc7af3c829e2bc959db065a2dd7b78c324ec181'});
export const WEST_PATH=path.join(ROOT,'evidence/san-antonio-sa-tomorrow-derived-repairs/west-northwest/repaired.geojson');
export const WEST_GLOBAL_ID='4c5f3a02-22b0-4af8-8d74-b1bc35a8e03e';
export const ATOMIC_FIELDS=Object.freeze(['GlobalID','Name']);
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity=p=>{const b=fs.readFileSync(p);return {bytes:b.length,sha256:sha(b)};};
const same=(a,b)=>a.bytes===b.bytes&&a.sha256===b.sha256;
export const REGIONS=Object.freeze([
 ['central-san-antonio','Central San Antonio',['Downtown','Eastside','Midtown','Near North','Westside']],
 ['medical-region','Medical Region',['Medical Center','Near Northwest','North Central']],
 ['airport-fort-sam','Airport / Fort Sam',['Fort Sam Houston','Greater Airport Area','Near Northeast']],
 ['stone-oak-far-north','Stone Oak / Far North',['Far North','Stone Oak']],
 ['utsa-northwest','UTSA / Northwest',['Northwest','UTSA','West Northwest']],
 ['far-west-alamo-ranch','Far West / Alamo Ranch',['Far West','Highway 151 and Loop 1604']],
 ['northeast-san-antonio','Northeast San Antonio',['Far East','NE I-35 and Loop 410','Northeast','Rolling Oaks']],
 ['southside-brooks','Southside / Brooks',['Brooks','Far South','South','Southeast','Texas AM - San Antonio']],
 ['southwest-port-san-antonio','Southwest / Port San Antonio',['Port San Antonio','Southwest']]
]);
export const OWNER_COMMAND=`$env:PATH = 'C:\\Program Files\\QGIS 3.44.11\\bin;' + $env:PATH\n$env:GRIDLY_GDAL_BIN = 'C:\\Program Files\\QGIS 3.44.11\\bin'\n$env:GRIDLY_SA_TOMORROW_GEOJSON = 'C:\\GitHub\\Gridly-Source-Data\\SanAntonio\\SATomorrow\\SATomorrowSubAreaPlans-CoSAGIS-Opendata.geojson'\nnpm run build:lp193\nnpm run verify:lp193\nnpm run test:lp193`;
const q=s=>`'${s.replaceAll("'","''")}'`;
const canonical=o=>JSON.stringify(o,null,2)+'\n';

function executable(bin,name){return path.join(bin,process.platform==='win32'?`${name}.exe`:name);}
function command(file,args){const r=spawnSync(file,args,{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});if(r.error)throw Error(`LP193_GDAL_UNAVAILABLE:${file}:${r.error.message}`);if(r.status!==0)throw Error(`LP193_GDAL_FAILED:${path.basename(file)}:${(r.stderr||r.stdout).trim()}`);return r.stdout;}
export function westNorthwestAppendArgs(db,westArtifact=WEST_PATH){
 const sourceFields=['GlobalID','Name'];
 if(sourceFields.length!==ATOMIC_FIELDS.length||sourceFields.some((field,index)=>field!==ATOMIC_FIELDS[index]))throw Error('LP193_WEST_NORTHWEST_APPEND_SCHEMA_MAPPING_UNSAFE');
 const fieldMap=sourceFields.map(field=>ATOMIC_FIELDS.indexOf(field));
 if(fieldMap.some(index=>index<0)||new Set(fieldMap).size!==fieldMap.length)throw Error('LP193_WEST_NORTHWEST_APPEND_SCHEMA_MAPPING_UNSAFE');
 return ['-f','GPKG','-update','-append',db,westArtifact,'-nln','atomics','-t_srs','EPSG:3083','-nlt','PROMOTE_TO_MULTI','-fieldmap',fieldMap.join(',')];
}
export function detectOwnerInputs(env=process.env,run=command){
 const source=env.GRIDLY_SA_TOMORROW_GEOJSON,bin=env.GRIDLY_GDAL_BIN;
 if(!source||!bin||!fs.existsSync(source)||!fs.existsSync(WEST_PATH))return {available:false,reason:'OWNER_INPUT_PATH_MISSING'};
 if(!same(identity(source),SOURCE_IDENTITY))throw Error('LP193_SA_TOMORROW_IDENTITY_MISMATCH');
 if(!same(identity(WEST_PATH),WEST_IDENTITY))throw Error('LP193_WEST_NORTHWEST_IDENTITY_MISMATCH');
 const ogrinfo=executable(bin,'ogrinfo'),ogr2ogr=executable(bin,'ogr2ogr');
 const versions=[run(ogrinfo,['--version']),run(ogr2ogr,['--version'])];
 if(versions.some(v=>!/^GDAL 3\.13\.0(?:\D|$)/.test(v.trim())))throw Error(`LP193_GDAL_VERSION_MISMATCH:${versions.join('|').trim()}`);
 return {available:true,source,bin,ogrinfo,ogr2ogr,gdalVersion:'GDAL 3.13.0',sourceIdentity:SOURCE_IDENTITY,westNorthwestIdentity:WEST_IDENTITY};
}

function zoomForBounds([west,south,east,north]){
 const width=390-96,height=844-96,lat=Math.max(-85,Math.min(85,(south+north)/2));
 const lonSpan=Math.max(east-west,1e-9);const latSpan=Math.max(north-south,1e-9);
 const lonZoom=Math.log2(width*360/(256*lonSpan));
 const latZoom=Math.log2(height*360*Math.cos(lat*Math.PI/180)/(256*latSpan));
 return Number(Math.max(0,Math.min(22,Math.min(lonZoom,latZoom))).toFixed(2));
}
function finalizeFeatures(raw){
 if(raw.length!==9)throw Error(`LP193_REGION_COUNT_GATE_FAILED:${raw.length}`);
 const ids=new Set(raw.map(f=>f.properties.regionId));if(ids.size!==9||REGIONS.some(r=>!ids.has(r[0])))throw Error('LP193_REGION_ID_GATE_FAILED');
 return REGIONS.map(([regionId,consumerLabel,atomicMembership])=>{
  const f=raw.find(x=>x.properties.regionId===regionId),p=f.properties;
  const center={method:'GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84',longitude:Number(p.surfaceLon),latitude:Number(p.surfaceLat),status:'INSIDE_OR_ON_REGION'};
  if(Number(p.centerCovered)!==1)throw Error(`LP193_SEMANTIC_CENTER_GATE_FAILED:${regionId}`);
  return {type:'Feature',properties:{regionId,consumerLabel,labelStatus:consumerLabel==='Airport / Fort Sam'?'OWNER_APPROVED_PROVISIONAL_DESIGN_LABEL':'OWNER_APPROVED_DESIGN_LABEL',atomicMembership,geometryStatus:'CERTIFIED_VALID_NON_EMPTY_UNION',farSouthwestImplication:regionId==='southwest-port-san-antonio'?'PARTIAL_CERTIFIED_REGION_PENDING_FAR_SOUTHWEST_CLARIFICATION':'FAR_SOUTHWEST_EXCLUDED',centroid:{longitude:Number(p.centroidLon),latitude:Number(p.centroidLat)},semanticCenter:center,proposedZoom:zoomForBounds([p.minLon,p.minLat,p.maxLon,p.maxLat]),zoomMethod:'WGS84_BOUNDING_BOX_WEB_MERCATOR_FIT_390x844_48PX_PADDING'},geometry:f.geometry};
 });
}
export function certifyOwnerGeometry(owner,{run=command}={}){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gridly-lp193-'));
 try{
  const db=path.join(tmp,'working.gpkg'),rawFile=path.join(tmp,'regions.geojson'),metricsFile=path.join(tmp,'metrics.geojson');
  run(owner.ogr2ogr,['-f','GPKG',db,owner.source,'-nln','atomics','-t_srs','EPSG:3083','-nlt','PROMOTE_TO_MULTI','-where',`Name NOT IN ('Far Southwest','West Northwest')`,'-select',ATOMIC_FIELDS.join(',')]);
  run(owner.ogr2ogr,westNorthwestAppendArgs(db),'append certified West Northwest geometry');
  const clauses=REGIONS.map(([id,,atoms])=>`WHEN Name IN (${atoms.map(q).join(',')}) THEN ${q(id)}`).join(' ');
  const unionSql=`SELECT CASE ${clauses} END AS regionId, ST_Union(geom) AS geometry FROM atomics GROUP BY regionId`;
  run(owner.ogr2ogr,['-f','GPKG','-update',db,db,'-nln','regions','-dialect','SQLite','-sql',unionSql]);
  const metricSql=`SELECT regionId, ST_IsValid(geom) valid, ST_IsEmpty(geom) empty, ST_X(ST_Transform(ST_Centroid(geom),4326)) centroidLon, ST_Y(ST_Transform(ST_Centroid(geom),4326)) centroidLat, ST_X(ST_Transform(ST_PointOnSurface(geom),4326)) surfaceLon, ST_Y(ST_Transform(ST_PointOnSurface(geom),4326)) surfaceLat, ST_Covers(geom,ST_PointOnSurface(geom)) centerCovered, ST_MinX(ST_Transform(geom,4326)) minLon, ST_MinY(ST_Transform(geom,4326)) minLat, ST_MaxX(ST_Transform(geom,4326)) maxLon, ST_MaxY(ST_Transform(geom,4326)) maxLat FROM regions`;
  run(owner.ogr2ogr,['-f','GeoJSON',metricsFile,db,'-dialect','SQLite','-sql',metricSql]);
  const metrics=JSON.parse(fs.readFileSync(metricsFile)).features.map(f=>f.properties);
  for(const m of metrics)if(Number(m.valid)!==1||Number(m.empty)!==0)throw Error(`LP193_INVALID_REGION_UNION:${m.regionId}`);
  const gateSql=`SELECT (SELECT COUNT(*) FROM atomics) atomicCount, (SELECT COUNT(DISTINCT GlobalID) FROM atomics) uniqueAtomicIdentityCount, (SELECT COUNT(DISTINCT Name) FROM atomics) uniqueAtomicCount, (SELECT COUNT(*) FROM atomics WHERE GlobalID = ${q(WEST_GLOBAL_ID)} AND Name = 'West Northwest') westNorthwestIdentityCount, (SELECT COUNT(*) FROM atomics WHERE Name = 'Far Southwest') farSouthwestCount, (SELECT COUNT(*) FROM atomics WHERE CASE ${clauses} END IS NULL) unassignedCount, (SELECT COUNT(*) FROM regions) regionCount, (SELECT COUNT(*) FROM regions a JOIN regions b ON a.regionId<b.regionId AND ST_Area(ST_Intersection(a.geom,b.geom))>0) overlapCount, ST_Area(ST_SymDifference((SELECT ST_Union(geom) FROM atomics),(SELECT ST_Union(geom) FROM regions))) coverageDelta FROM atomics LIMIT 1`;
  run(owner.ogr2ogr,['-f','GeoJSON',rawFile,db,'-dialect','SQLite','-sql',gateSql]);
  const gate=JSON.parse(fs.readFileSync(rawFile)).features[0]?.properties;
  if(!gate||Number(gate.atomicCount)!==29||Number(gate.uniqueAtomicIdentityCount)!==29||Number(gate.uniqueAtomicCount)!==29||Number(gate.westNorthwestIdentityCount)!==1||Number(gate.farSouthwestCount)!==0||Number(gate.unassignedCount)!==0||Number(gate.regionCount)!==9||Number(gate.overlapCount)!==0||Number(gate.coverageDelta)!==0)throw Error(`LP193_COVERAGE_GATE_FAILED:${JSON.stringify(gate)}`);
  fs.rmSync(rawFile,{force:true});
  run(owner.ogr2ogr,['-f','GeoJSON',rawFile,db,'regions','-t_srs','EPSG:4326','-lco','RFC7946=YES','-lco','COORDINATE_PRECISION=10']);
  const geometryById=new Map(JSON.parse(fs.readFileSync(rawFile)).features.map(f=>[f.properties.regionId,f.geometry]));
  const raw=metrics.map(p=>({type:'Feature',properties:p,geometry:geometryById.get(p.regionId)}));
  return {type:'FeatureCollection',features:finalizeFeatures(raw)};
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}

const labelStatus=label=>label==='Airport / Fort Sam'?'OWNER_APPROVED_PROVISIONAL_DESIGN_LABEL':'OWNER_APPROVED_DESIGN_LABEL';
function placesFor(atoms,overlay){return overlay.aggregates.filter(p=>p.positiveAreaIntersectingAtomicUnits.some(a=>atoms.includes(a.name))).map(p=>({geoid:p.placeGeoid,name:p.placeName,relationshipEvidence:p.materialOverlapCount?'MATERIAL_SPATIAL_CONTEXT':'TRACE_OR_MINOR_SPATIAL_CONTEXT',consumerRegionMember:false,precedence:'INDEPENDENT_GOVERNED_PLACE_WINS'})).sort((a,b)=>a.geoid.localeCompare(b.geoid));}
function buildReport(geometry){
 const lp192=read('reports/lp192/san-antonio-consumer-region-consolidation-design.json'),overlay=read('reports/lp191/bexar-place-cdp-overlay.json'),features=geometry?.features??[];
 const regions=REGIONS.map(([regionId,consumerLabel,atomicMembership],i)=>{const source=lp192.options.A.regions[i];if(source.candidateConsumerLabel!==consumerLabel||JSON.stringify(source.atomicUnits)!==JSON.stringify([...atomicMembership].sort()))throw Error(`LP192_MEMBERSHIP_DRIFT:${regionId}`);const f=features.find(x=>x.properties.regionId===regionId),limited=regionId==='southwest-port-san-antonio';return {regionId,consumerLabel,productionIdStatus:'PROPOSED_PRODUCTION_ID_NOT_ACTIVATED',labelStatus:labelStatus(consumerLabel),atomicMembership,geometryStatus:f?.properties.geometryStatus??'OWNER_GDAL_EXECUTION_REQUIRED',farSouthwestImplication:limited?'CERTIFIED_GEOMETRY_EXCLUDES_HELD_FAR_SOUTHWEST; FUTURE_BOUNDARY_EXTENSION_PENDING_CITY_CLARIFICATION':'NO_CERTIFIED_FAR_SOUTHWEST_MEMBERSHIP',centroid:f?.properties.centroid??null,semanticCenter:f?.properties.semanticCenter??null,startupZoom:f?{proposedZoom:f.properties.proposedZoom,method:f.properties.zoomMethod,status:'PROPOSED_NOT_ACTIVATED'}:null,contextualNearbyOrIntersectingPlaces:placesFor(atomicMembership,overlay),awarenessContract:{mayEventuallyAppearAsSelectableAwarenessGeography:true,independentPlaceCdpExclusionRule:'NO_PLACE_CDP_IS_A_CONSUMER_REGION_MEMBER',canonicalPrecedence:'INDEPENDENT_GOVERNED_PLACE_WINS'},readinessClassification:f?(limited?'IMPLEMENTATION_READY_NOT_ACTIVATED_WITH_FAR_SOUTHWEST_LIMITATION':'IMPLEMENTATION_READY_NOT_ACTIVATED'):'IMPLEMENTATION_READINESS_HOLD'};});
 const ready=features.length===9,bytes=geometry?Buffer.from(canonical(geometry)):null;
 return {schemaVersion:'gridly.lp193.san-antonio-consumer-region-implementation-readiness.v1',milestone:'LP193_SAN_ANTONIO_CONSUMER_REGION_IMPLEMENTATION_READINESS',baseline:{commit:'cead3d4a',subject:'Merge LP192 San Antonio consumer region consolidation design'},runtimeActivationPerformed:false,workingCrs:'EPSG:3083',governance:['GOVERNED_ATOMIC_GEOGRAPHY != CONSUMER_REGION_LABEL','INDEPENDENT_GOVERNED_PLACE_WINS'],geometryArtifact:ready?{path:GEOMETRY_PATH,featureCount:9,bytes:bytes.length,sha256:sha(bytes),crsProvenance:'Union computed in EPSG:3083 and exported to RFC 7946 WGS84',generationMethod:'GDAL_3_13_OGR_SQLITE_ST_UNION_EXACT_MEMBERSHIP'}:{path:GEOMETRY_PATH,status:'OWNER_GDAL_EXECUTION_REQUIRED',expectedFeatureCount:9},coverageContract:{officialAtomicCount:30,usableAtomicCount:29,coveredExactlyOnce:29,heldAtomic:'Far Southwest',westNorthwestAuthority:'CERTIFIED_DERIVED_MAKEVALID',sourceIdentity:SOURCE_IDENTITY,westNorthwestIdentity:WEST_IDENTITY,requiredValidation:['NON_EMPTY','VALID','NO_POSITIVE_AREA_INTERREGION_OVERLAP','UNION_EQUALS_29_ATOMIC_UNION']},searchZipResolverPrecedence:['INDEPENDENT_GOVERNED_PLACE_CDP_IDENTITY','EXACT_GOVERNED_COMMUNITY_IDENTITY','SAN_ANTONIO_CONSUMER_REGION_PROJECTION_FROM_GOVERNED_ATOMIC_GEOGRAPHY','BROADER_FALLBACK_BEHAVIOR'],zipMappingCreated:false,farSouthwestRuntimeRule:{status:'PARTIAL_CERTIFIED_REGION_PENDING_FAR_SOUTHWEST_CLARIFICATION',activatableAsCertifiedGeometry:false,southwestCertifiedAtomics:['Port San Antonio','Southwest'],selectivePlaceHolds:[{geoid:'4868708',name:'Somerset',consumerRegionMember:false},{geoid:'4875764',name:'Von Ormy',consumerRegionMember:false}]},independentPlaceCdpCount:overlay.placeCount,regions,overallStatus:ready?'SAN_ANTONIO_CONSUMER_REGION_IMPLEMENTATION_READY_NOT_ACTIVATED_WITH_SELECTIVE_FAR_SOUTHWEST_LIMITATION':'SAN_ANTONIO_CONSUMER_REGION_IMPLEMENTATION_READINESS_OWNER_GDAL_HOLD',recommendation:ready?'READY_FOR_GUARDED_SAN_ANTONIO_RUNTIME_ACTIVATION':'NOT_READY',ownerCommand:OWNER_COMMAND};
}
function markdown(d){return `# LP193 — San Antonio consumer-region implementation readiness\n\n**Status:** \`${d.overallStatus}\`  \n**Recommendation:** \`${d.recommendation}\`\n\nLP193 defines future contracts only; runtime behavior is untouched. Owner inputs select the fail-closed GDAL 3.13 certification path.\n\n| Production ID | Label | Geometry | Center | Zoom | Readiness |\n|---|---|---|---|---:|---|\n${d.regions.map(r=>`| \`${r.regionId}\` | ${r.consumerLabel} | ${r.geometryStatus} | ${r.semanticCenter?JSON.stringify(r.semanticCenter):'pending owner GDAL'} | ${r.startupZoom?.proposedZoom??'pending'} | ${r.readinessClassification} |`).join('\n')}\n\nFar Southwest is excluded. \`southwest-port-san-antonio\` is \`PARTIAL_CERTIFIED_REGION_PENDING_FAR_SOUTHWEST_CLARIFICATION\`; Somerset 4868708 and Von Ormy 4875764 remain independent.\n\n## Owner execution\n\n\`\`\`powershell\n${d.ownerCommand}\n\`\`\`\n`;}
export function outputs(geometry=null){const d=buildReport(geometry);const out={[JSON_PATH]:canonical(d),[MD_PATH]:markdown(d)};if(geometry)out[GEOMETRY_PATH]=canonical(geometry);return out;}
export function selectExecutionPath(env=process.env,detect=detectOwnerInputs){return detect(env).available?'OWNER_GDAL_CERTIFICATION':'OWNER_GDAL_HOLD';}
export function run(mode,{env=process.env,detect=detectOwnerInputs,certify=certifyOwnerGeometry}={}){
 const owner=detect(env),existing=fs.existsSync(path.join(ROOT,GEOMETRY_PATH));let geometry=null;
 if(owner.available)geometry=certify(owner);else if(mode==='verify'&&existing)throw Error('LP193_OWNER_INPUTS_REQUIRED_TO_VERIFY_CERTIFIED_GEOMETRY');
 const expected=outputs(geometry);for(const [p,s] of Object.entries(expected)){const a=path.join(ROOT,p);if(mode==='build'){fs.mkdirSync(path.dirname(a),{recursive:true});fs.writeFileSync(a,s);}else if(!fs.existsSync(a)||fs.readFileSync(a,'utf8')!==s)throw Error(`LP193_DETERMINISM_MISMATCH:${p}`);}return buildReport(geometry);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const mode=process.argv.includes('--build')?'build':'verify';console.log(JSON.stringify({status:`LP193_${mode.toUpperCase()}_PASSED`,overallStatus:run(mode).overallStatus},null,2));}
