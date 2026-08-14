import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeWithGdal,assertGdalVersion,WORKING_CRS} from './san-antonio-sa-tomorrow-gdal-analysis.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export {assertGdalVersion,WORKING_CRS};
export const EXPECTED_BYTES=1864489;
export const EXPECTED_SHA256='bf15d7d257d60970c894e590cacb996a15a8796d789e09335860fdb2a6a6e13d';
export const SOURCE_CLASSIFICATION='SOURCE_CERTIFIED_OWNER_SUPPLIED_CITY_OPEN_DATA';
const EXPECTED_FEATURES=30;
const REGISTRY_PATH=path.join(ROOT,'reports/san-antonio-sa-tomorrow-official-registry.json');
const REPORT_PREFIX=path.join(ROOT,'reports/san-antonio-sa-tomorrow');
const MODES=new Set(['--verify','--analyze','--certify-offline']);
export const NAME_MAPPINGS=Object.freeze({
  'Near Northeast':{priorCertifiedName:'Near North Central',classification:'CURRENT_CITY_NAME_SUPERSEDES_PRIOR_REGISTRY'},
  'Near Northwest':{priorCertifiedName:'Near West',classification:'CURRENT_CITY_NAME_SUPERSEDES_PRIOR_REGISTRY'},
  'NE I-35 and Loop 410':{priorCertifiedName:'Northeast I-35 and Loop 410',classification:'OFFICIAL_ALIAS_FORMAT_VARIANT'},
  'Texas AM - San Antonio':{priorCertifiedName:'Texas A&M-San Antonio',classification:'OFFICIAL_ALIAS_FORMAT_VARIANT'}
});

export const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
export function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
export const serialize=v=>JSON.stringify(canonical(v),null,2)+'\n';
export function certifyBytes(sourceFile,{expectedBytes=EXPECTED_BYTES,expectedSha256=EXPECTED_SHA256}={}){
  if(!sourceFile||!fs.existsSync(sourceFile))throw new Error('OWNER_SOURCE_FILE_NOT_FOUND');
  const bytes=fs.readFileSync(sourceFile), digest=sha256(bytes);
  if(bytes.length!==expectedBytes)throw new Error(`OWNER_SOURCE_BYTE_LENGTH_MISMATCH: expected ${expectedBytes}, received ${bytes.length}`);
  if(digest!==expectedSha256)throw new Error(`OWNER_SOURCE_SHA256_MISMATCH: expected ${expectedSha256}, received ${digest}`);
  return {sourcePath:path.resolve(sourceFile),filename:path.basename(sourceFile),byteLength:bytes.length,sha256:digest,bytes};
}
export function geometryKind(g){if(!g)throw new Error('REQUIRED_GEOMETRY_MISSING');if(!['Polygon','MultiPolygon'].includes(g.type))throw new Error('POLYGON_COMPATIBLE_GEOMETRY_REQUIRED');if(!Array.isArray(g.coordinates)||!g.coordinates.length)throw new Error('EMPTY_GEOMETRY_REJECTED');return {type:g.type,components:g.type==='Polygon'?1:g.coordinates.length};}
function sourceBounds(geometry){const points=[];(function visit(value){if(Array.isArray(value)&&typeof value[0]==='number')points.push(value);else if(Array.isArray(value))value.forEach(visit);})(geometry.coordinates);return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];}
export function normalizePlanType(value){if(value==='Regional Center'||value==='Regional Center Plan')return 'REGIONAL_CENTER';if(value==='Community')return 'COMMUNITY_AREA';throw new Error(`UNRECOGNIZED_PLAN_TYPE: ${value}`);}
export function normalizeStatus(value){if(/^Adopted by City Council \(\d{4}\)$/.test(value))return 'ADOPTED';if(value==='In Progress')return 'IN_PROGRESS';if(/^Beginning \d{4}-\d{4}$/.test(value))return 'PLANNED_FUTURE';return 'OFFICIAL_AREA_STATUS_UNRESOLVED';}
export function validateGeoJson(document){
  if(document?.type!=='FeatureCollection')throw new Error('FEATURE_COLLECTION_REQUIRED');
  if(document.features?.length!==EXPECTED_FEATURES)throw new Error(`UNEXPECTED_FEATURE_COUNT: ${document.features?.length??0}`);
  const names=new Set(),ids=new Set();
  return document.features.map(feature=>{const p=feature?.properties||{};for(const key of ['Name','PlanType','Phase','PlanStatus'])if(p[key]===undefined||p[key]===null||p[key]==='')throw new Error(`REQUIRED_PROPERTY_MISSING: ${key}`);geometryKind(feature.geometry);if(names.has(p.Name))throw new Error(`DUPLICATE_CURRENT_CITY_NAME: ${p.Name}`);names.add(p.Name);const id=String(p.GlobalID??p.SubPlanID??p.OBJECTID??'');if(!id||ids.has(id))throw new Error(`DUPLICATE_OR_MISSING_STABLE_IDENTITY: ${id}`);ids.add(id);return feature;});
}
export function reconcile(registry,features){
  const prior=new Map(registry.records.map(r=>[r.officialName,r]));const rows=[];
  for(const feature of features){const p=feature.properties,mapping=NAME_MAPPINGS[p.Name],priorName=mapping?.priorCertifiedName||p.Name,record=prior.get(priorName);if(!record)throw new Error(`UNRESOLVED_CURRENT_CITY_IDENTITY: ${p.Name}`);const type=normalizePlanType(p.PlanType);if(type!==record.type)throw new Error(`TYPE_RECONCILIATION_FAILED: ${p.Name}`);rows.push({currentCityName:p.Name,priorCertifiedName:mapping?.priorCertifiedName||null,type,phase:p.Phase,planStatus:p.PlanStatus,normalizedStatus:normalizeStatus(p.PlanStatus),sourceSquareMiles:Number(p.SquareMiles),sourceFeatureIdentity:{OBJECTID:p.OBJECTID??null,SubPlanID:p.SubPlanID??null,GlobalID:p.GlobalID??null},aliasOrRenameStatus:mapping?.classification||'CURRENT_CITY_NAME_UNCHANGED'});}
  rows.sort((a,b)=>a.currentCityName.localeCompare(b.currentCityName,'en'));const used=new Set(rows.map(r=>r.priorCertifiedName||r.currentCityName));const missing=[...prior.keys()].filter(x=>!used.has(x));const split={regionalCenterCount:rows.filter(x=>x.type==='REGIONAL_CENTER').length,communityAreaCount:rows.filter(x=>x.type==='COMMUNITY_AREA').length};if(rows.length!==30||missing.length||split.regionalCenterCount!==13||split.communityAreaCount!==17)throw new Error('FRAMEWORK_RECONCILIATION_FAILED');return {status:'RECONCILED',expectedCount:30,actualCount:30,missingCurrentIdentities:[],duplicateIdentities:[],unresolvedMappings:[],...split,rows};
}
function writeJson(suffix,value){fs.writeFileSync(`${REPORT_PREFIX}-${suffix}.json`,serialize(value));}
function mdTable(rows){const h='| Current City Name | Prior Certified Name | Type | Phase | PlanStatus | Normalized Status | Source mi² | Calculated mi² | Geometry | Alias/rename |\n|---|---|---|---|---|---|---:|---:|---|---|';return `${h}\n${rows.map(r=>`| ${r.currentCityName} | ${r.priorCertifiedName||''} | ${r.type} | ${r.phase} | ${r.planStatus} | ${r.normalizedStatus} | ${r.sourceSquareMiles} | ${r.calculatedSquareMiles} | ${r.geometryStatus} | ${r.aliasOrRenameStatus} |`).join('\n')}\n`;}
function normalizedGuid(value){return value==null||value===''?null:String(value).trim().replace(/^\{(.+)\}$/,'$1').toLowerCase();}
function identityDiagnostic(expected,results,sourceCount){return JSON.stringify({expectedName:expected.currentCityName,expectedGlobalID:expected.sourceFeatureIdentity.GlobalID??null,availableGdalResults:results.map(x=>({Name:x.sourceName??null,GlobalID:x.sourceGlobalID??null,PlanType:x.sourcePlanType??null})),sourceRowCount:sourceCount,resultRowCount:results.length});}
export function reconcileGdalResults(reconciliation,sourceFeatures,resultFeatures){
  const resultsByName=new Map();
  for(const result of resultFeatures){const name=String(result.sourceName??'');const matches=resultsByName.get(name)||[];matches.push(result);resultsByName.set(name,matches);}
  const expectedNames=new Set(reconciliation.rows.map(row=>row.currentCityName));
  const unexpected=[...resultsByName.keys()].filter(name=>!expectedNames.has(name));
  if(unexpected.length)throw new Error(`GDAL_RESULT_UNEXPECTED_NAME: ${unexpected.join(', ')}; ${identityDiagnostic(reconciliation.rows[0],resultFeatures,sourceFeatures.length)}`);
  const sourceByName=new Map(sourceFeatures.map(feature=>[feature.properties.Name,feature]));
  const rows=reconciliation.rows.map(row=>{
    const matches=resultsByName.get(row.currentCityName)||[];
    if(matches.length!==1){const reason=matches.length?'GDAL_RESULT_DUPLICATE_NAME':'GDAL_RESULT_IDENTITY_MISSING';throw new Error(`${reason}: ${identityDiagnostic(row,resultFeatures,sourceFeatures.length)}`);}
    const result=matches[0],sourceFeature=sourceByName.get(row.currentCityName);
    if(!sourceFeature)throw new Error(`SOURCE_NAME_RECONCILIATION_MISSING: ${row.currentCityName}`);
    const expectedGuid=normalizedGuid(row.sourceFeatureIdentity.GlobalID),actualGuid=normalizedGuid(result.sourceGlobalID);
    if(expectedGuid&&actualGuid&&expectedGuid!==actualGuid)throw new Error(`GDAL_GLOBALID_MISMATCH: ${identityDiagnostic(row,resultFeatures,sourceFeatures.length)}`);
    if(result.sourcePlanType!==sourceFeature.properties.PlanType)throw new Error(`GDAL_PLAN_TYPE_MISMATCH: ${identityDiagnostic(row,resultFeatures,sourceFeatures.length)}`);
    const kind=geometryKind(sourceFeature.geometry);
    return {...row,...result,sourceGlobalID:result.sourceGlobalID??row.sourceFeatureIdentity.GlobalID??null,globalIdPreservation:expectedGuid&&actualGuid?'PRESERVED_NORMALIZED':'SECONDARY_IDENTITY_UNAVAILABLE',geometryType:kind.type,componentCount:kind.components,sourceBounds:sourceBounds(sourceFeature.geometry),absoluteAreaDeltaSquareMiles:Math.abs(result.calculatedSquareMiles-row.sourceSquareMiles),percentAreaDelta:row.sourceSquareMiles?Math.abs(result.calculatedSquareMiles-row.sourceSquareMiles)/row.sourceSquareMiles*100:null};
  });
  if(sourceFeatures.length!==30||resultFeatures.length!==30||rows.length!==30)throw new Error(`GDAL_RESULT_COUNT_MISMATCH: source=${sourceFeatures.length}, result=${resultFeatures.length}, reconciled=${rows.length}`);
  return rows;
}
function writeReports(identity,doc,reconciliation,analysis){
  const rows=reconcileGdalResults(reconciliation,doc.features,analysis.features);
  const common={schemaVersion:'gridly.san-antonio-sa-tomorrow-geometry.v2',deterministic:true,runtimeMutationPerformed:false,consolidationPerformed:false,gridlyChildRegionsCreated:false,workingCrs:WORKING_CRS};const source={...common,status:SOURCE_CLASSIFICATION,source:{sourcePath:identity.sourcePath,filename:identity.filename,byteLength:identity.byteLength,sha256:identity.sha256,geoJsonType:doc.type,featureCount:doc.features.length,itemId:'4e67cbcf249a464cb8cef0738ddbb1b1',layer:0,layerName:'SATomorrowSubAreaPlans'},reconciliation:{...reconciliation,rows},currentNameTypeStatusTable:rows};const topology={...common,status:'TOPOLOGY_ANALYSIS_CERTIFIED',...analysis.topology,geometryValidity:{valid:rows.filter(x=>x.geometryStatus==='VALID').length,invalid:rows.filter(x=>x.geometryStatus!=='VALID').length},features:rows};const overlay={...common,status:'PLACE_CDP_OVERLAY_PENDING_GOVERNED_GEOMETRY',sourceCertificationUnaffected:true,identityCount:33,reason:'Exact governed PLACE/CDP geometry was not supplied to this offline milestone; no relationship was fabricated.'};writeJson('geometry-source-certification',source);writeJson('topology-analysis',topology);writeJson('bexar-place-overlay',overlay);fs.writeFileSync(`${REPORT_PREFIX}-geometry-source-certification.md`,`# San Antonio SA Tomorrow geometry source certification\n\n**${source.status}**\n\n* Bytes: ${identity.byteLength}\n* SHA-256: \`${identity.sha256}\`\n* Features: 30 (13 Regional Centers; 17 Community Areas)\n* Working CRS: ${WORKING_CRS}\n\n## Owner-review table\n\n${mdTable(rows)}`);fs.writeFileSync(`${REPORT_PREFIX}-topology-analysis.md`,`# San Antonio SA Tomorrow topology analysis\n\n**${topology.status}**\n\n* Valid: ${topology.geometryValidity.valid}; invalid: ${topology.geometryValidity.invalid}\n* Pairwise overlaps: ${topology.pairwiseOverlaps.length}\n* Duplicate geometries: ${topology.duplicateGeometries.length}\n* Union area (m²): ${topology.totalUnionAreaSquareMeters}\n* Relationship: ${topology.regionalCenterCommunityAreaRelationship}\n* Gap finding: ${topology.gaps.status}\n`);fs.writeFileSync(`${REPORT_PREFIX}-bexar-place-overlay.md`,`# San Antonio SA Tomorrow / Bexar PLACE-CDP overlay\n\n**${overlay.status}**\n\nThe 33 governed identities remain unchanged. Exact governed PLACE/CDP geometry was not locally supplied, so no overlay relationship is fabricated and source certification remains valid.\n`);return {source,topology,overlay};
}
export function offlineVerify(sourceFile=process.env.GRIDLY_SA_TOMORROW_GEOJSON){const identity=certifyBytes(sourceFile),doc=JSON.parse(identity.bytes.toString('utf8'));validateGeoJson(doc);const registry=JSON.parse(fs.readFileSync(REGISTRY_PATH));return {identity,doc,reconciliation:reconcile(registry,doc.features)};}
function main(){const modes=process.argv.filter(x=>MODES.has(x));if(modes.length!==1)throw new Error('Exactly one offline mode is required');const verified=offlineVerify();if(modes[0]==='--verify'){console.log(serialize({status:'OWNER_SOURCE_BYTES_AND_STRUCTURE_VERIFIED',...verified.identity,bytes:undefined,reconciliation:{...verified.reconciliation,rows:undefined}}));return;}const analysis=analyzeWithGdal(verified.identity.sourcePath);const reports=writeReports(verified.identity,verified.doc,verified.reconciliation,analysis);console.log(serialize({status:SOURCE_CLASSIFICATION,source:reports.source.source,reconciliation:reports.source.reconciliation,geometryValidity:reports.topology.geometryValidity,topologyStatus:reports.topology.status,overlayStatus:reports.overlay.status}));}
if(process.argv[1]===fileURLToPath(import.meta.url))try{main();}catch(error){console.error(`FAIL_CLOSED: ${error.message}`);process.exitCode=1;}
