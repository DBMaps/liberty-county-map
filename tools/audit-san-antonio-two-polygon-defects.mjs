import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {assertGdalVersion,resolveGdalBinaries,verifyGdalBinaries,WORKING_CRS} from './san-antonio-sa-tomorrow-gdal-analysis.mjs';

export const AUDIT_NAMES=Object.freeze(['Far Southwest','West Northwest']);
export const MATERIAL_PERCENT_THRESHOLD=0.1;
export const EXPECTED_SOURCE={bytes:1864489,sha256:'bf15d7d257d60970c894e590cacb996a15a8796d789e09335860fdb2a6a6e13d'};
const OUTPUT_JSON='reports/san-antonio-sa-tomorrow-two-polygon-defect-audit.json';
const OUTPUT_MD='reports/san-antonio-sa-tomorrow-two-polygon-defect-audit.md';
const opts={encoding:'utf8',maxBuffer:128*1024*1024,windowsHide:true};

export function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
export const serialize=value=>`${JSON.stringify(canonical(value),null,2)}\n`;
export function parseArgs(argv){const out={};for(let i=0;i<argv.length;i++){const key=argv[i];if(!['--source','--current-url','--second-url','--output-json','--output-md'].includes(key))throw new Error(`UNKNOWN_ARGUMENT: ${key}`);if(!argv[i+1]||argv[i+1].startsWith('--'))throw new Error(`VALUE_REQUIRED: ${key}`);out[key.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=argv[++i];}return out;}
export function assertExactScope(names){if(names.length!==2||names.some((n,i)=>n!==AUDIT_NAMES[i]))throw new Error('EXACT_TWO_POLYGON_SCOPE_REQUIRED');return true;}
export function percentDelta(before,after){return before===0?null:((after-before)/before)*100;}
export function materialRepair(percent){return Math.abs(percent)>MATERIAL_PERCENT_THRESHOLD;}
export function extractInvalidityLocation(reason){const match=String(reason||'').match(/\[(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\]\s*$/);return match?[Number(match[1]),Number(match[2])]:null;}
export function fingerprint(wkbHex){return crypto.createHash('sha256').update(String(wkbHex).toUpperCase()).digest('hex');}
function run(exe,args){const result=spawnSync(exe,args,opts);if(result.status!==0)throw new Error(`${path.basename(exe).toUpperCase()}_FAILED: ${(result.stderr||result.stdout||result.error?.message||'').trim()}`);return result.stdout;}
function sqlRows(ogr2ogr,dataset,sql,dir,id){const file=path.join(dir,`${id}.geojson`);try{run(ogr2ogr,['-f','GeoJSON',file,dataset,'-dialect','SQLite','-sql',sql]);return JSON.parse(fs.readFileSync(file,'utf8')).features.map(f=>f.properties);}finally{fs.rmSync(file,{force:true});}}
function quote(value){return `'${String(value).replaceAll("'","''")}'`;}
const metrics=geom=>`ST_IsValid(${geom}) AS valid, ST_IsValidReason(${geom}) AS validityReason, GeometryType(${geom}) AS geometryType, ST_NumGeometries(${geom}) AS componentCount, ST_Area(${geom})/2589988.110336 AS squareMiles, MbrMinX(${geom}) AS minX, MbrMinY(${geom}) AS minY, MbrMaxX(${geom}) AS maxX, MbrMaxY(${geom}) AS maxY, ST_X(ST_Centroid(${geom})) AS centroidX, ST_Y(ST_Centroid(${geom})) AS centroidY, ST_Contains(${geom},ST_Centroid(${geom})) AS centroidContained, ST_X(ST_PointOnSurface(${geom})) AS surfaceX, ST_Y(ST_PointOnSurface(${geom})) AS surfaceY`;
export function normalize(p){return {valid:Number(p.valid)===1,status:Number(p.valid)===1?'VALID':'INVALID',validityReason:p.validityReason,invalidityLocation:extractInvalidityLocation(p.validityReason),geometryType:p.geometryType,componentCount:Number(p.componentCount),ringCount:null,holeCount:null,ringMetricsEvidence:'RING_METRICS_UNAVAILABLE_IN_GOVERNED_GDAL_BUILD',vertexCount:p.vertexCount==null?null:Number(p.vertexCount),wkb:p.wkb??null,squareMiles:Number(p.squareMiles),bounds:[p.minX,p.minY,p.maxX,p.maxY].map(Number),centroid:[p.centroidX,p.centroidY].map(Number),centroidContained:Number(p.centroidContained)===1,pointOnSurface:[p.surfaceX,p.surfaceY].map(Number)};}
function serviceUrl(url){if(!/^https:\/\//i.test(url))throw new Error('EXPLICIT_HTTPS_SERVICE_URL_REQUIRED');return url;}

export function classify(name,original,repaired,comparison,sourceSquareMiles){if(comparison.correctedGeometry)return {classification:'SECOND_CITY_SERVICE_CONTAINS_CORRECTED_GEOMETRY',governance:'USE_NEWER_CITY_GEOMETRY_IF_AUTHORITY_PROVEN'};const delta=percentDelta(original.squareMiles,repaired.squareMiles);if(name==='Far Southwest'&&Math.abs(sourceSquareMiles-original.squareMiles)/original.squareMiles*100>10)return {classification:'OWNER_REVIEW_REQUIRED',governance:'REQUIRE_CITY_SOURCE_CLARIFICATION'};if(materialRepair(delta)||repaired.componentCount>original.componentCount)return {classification:'SOURCE_GEOMETRY_INVALID_MATERIAL_REPAIR_REQUIRED',governance:'OWNER_REVIEW_REQUIRED'};return {classification:'SOURCE_GEOMETRY_INVALID_REPAIRABLE_DETERMINISTICALLY',governance:'CERTIFY_DETERMINISTIC_DERIVED_REPAIR'};}

export function audit({source,currentUrl,secondUrl,outputJson=OUTPUT_JSON,outputMd=OUTPUT_MD,bin=process.env.GRIDLY_GDAL_BIN}){
  if(!source||!currentUrl||!secondUrl)throw new Error('SOURCE_AND_TWO_EXPLICIT_SERVICE_URLS_REQUIRED');serviceUrl(currentUrl);serviceUrl(secondUrl);
  const bytes=fs.readFileSync(source),sha=crypto.createHash('sha256').update(bytes).digest('hex');if(bytes.length!==EXPECTED_SOURCE.bytes||sha!==EXPECTED_SOURCE.sha256)throw new Error('OWNER_CERTIFIED_SOURCE_IDENTITY_MISMATCH');
  const binaries=resolveGdalBinaries(bin);verifyGdalBinaries(binaries);assertGdalVersion(run(binaries.ogr2ogr,['--version']));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gridly-sa-defects-'));
  try{
    const projected=path.join(dir,'projected.gpkg');run(binaries.ogr2ogr,['-f','GPKG',projected,source,'-nln','areas','-t_srs',WORKING_CRS,'-nlt','PROMOTE_TO_MULTI']);
    const sourceLayer=path.basename(source,path.extname(source));
    const records=AUDIT_NAMES.map((name,index)=>{
      const where=`Name=${quote(name)}`;
      const src=sqlRows(binaries.ogr2ogr,source,`SELECT Name,GlobalID,SquareMiles, ${metrics('geometry')} FROM ${quote(sourceLayer)} WHERE ${where}`,dir,`src-${index}`)[0];
      const original=normalize(sqlRows(binaries.ogr2ogr,projected,`SELECT ${metrics('geom')} FROM areas WHERE ${where}`,dir,`before-${index}`)[0]);
      const repaired=normalize(sqlRows(binaries.ogr2ogr,projected,`SELECT ${metrics('ST_MakeValid(geom)')} FROM areas WHERE ${where}`,dir,`after-${index}`)[0]);
      const loadService=(url,id)=>normalize(sqlRows(binaries.ogr2ogr,serviceUrl(url),`SELECT ${metrics('geometry')}, ST_NPoints(geometry) AS vertexCount, Hex(ST_AsBinary(geometry)) AS wkb FROM OGRGeoJSON WHERE ${where}`,dir,id)[0]);
      const current=loadService(currentUrl,`current-${index}`),second=loadService(secondUrl,`second-${index}`);
      current.fingerprint=fingerprint(current.wkb||'');second.fingerprint=fingerprint(second.wkb||'');
      const comparison={geometryEqual:current.fingerprint===second.fingerprint,vertexCount:{current:current.vertexCount??null,second:second.vertexCount??null},partCount:{current:current.componentCount,second:second.componentCount},bounds:{current:current.bounds,second:second.bounds},squareMiles:{current:current.squareMiles,second:second.squareMiles},validityReason:{current:current.validityReason,second:second.validityReason},fingerprint:{current:current.fingerprint,second:second.fingerprint},correctedGeometry:!current.valid&&second.valid};
      const decision=classify(name,original,repaired,comparison,Number(src.SquareMiles));
      return {currentCityName:name,globalId:String(src.GlobalID),sourceSquareMiles:Number(src.SquareMiles),sourceGeometry:normalize(src),projectedGeometry:original,makeValidWhatIf:{...repaired,areaDeltaSquareMiles:repaired.squareMiles-original.squareMiles,percentAreaDelta:percentDelta(original.squareMiles,repaired.squareMiles),materialRepair:materialRepair(percentDelta(original.squareMiles,repaired.squareMiles)),governedGeometryMutationPerformed:false},secondCityServiceComparison:comparison,defectClassification:decision.classification,recommendedFutureGovernancePath:decision.governance};
    });assertExactScope(records.map(r=>r.currentCityName));
    const report={milestone:'SAN_ANTONIO_TWO_POLYGON_GEOMETRY_DEFECT_AUDIT',status:'COMPLETE',deterministic:true,workingCrs:WORKING_CRS,sourceIdentity:EXPECTED_SOURCE,records,governedGeometryMutationPerformed:false,consolidationPerformed:false,consumerRegionsCreated:false,consumerNamesCreated:false,designNote:'GOVERNED_ATOMIC_GEOGRAPHY != CONSUMER_REGION_LABEL'};
    fs.writeFileSync(outputJson,serialize(report));fs.writeFileSync(outputMd,renderMarkdown(report));return report;
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
export function renderMarkdown(r){return `# San Antonio SA Tomorrow two-polygon defect audit\n\n**Status:** ${r.status}\n\nThis audit is evidence-only. No governed geometry was replaced, no consolidation occurred, and no consumer region or name was created.\n\n## Design note\n\n\`${r.designNote}\`\n\n${r.records.map(x=>`## ${x.currentCityName}\n\n- GlobalID: \`${x.globalId}\`\n- Source/projected validity: **${x.sourceGeometry.status} / ${x.projectedGeometry.status}**\n- Exact reason: ${x.projectedGeometry.validityReason}\n- Original / MakeValid mi²: ${x.projectedGeometry.squareMiles} / ${x.makeValidWhatIf.squareMiles}\n- MakeValid delta: ${x.makeValidWhatIf.percentAreaDelta}%\n- Classification: \`${x.defectClassification}\`\n- Future path: \`${x.recommendedFutureGovernancePath}\`\n`).join('\n')}\n`}
export function ownerPowerShell(){return `$env:GRIDLY_GDAL_BIN = 'C:\\Program Files\\QGIS 3.44.11\\bin'\nnpm run audit:san-antonio-two-polygon-defects -- --source 'C:\\GitHub\\Gridly-Source-Data\\SanAntonio\\SATomorrow\\SATomorrowSubAreaPlans-CoSAGIS-Opendata.geojson' --current-url '<EXPLICIT_CURRENT_LAYER_0_QUERY_GEOJSON_URL>' --second-url '<EXPLICIT_UPDATED_LAYER_11_QUERY_GEOJSON_URL>'`;}
if(process.argv[1]===fileURLToPath(import.meta.url)){const a=parseArgs(process.argv.slice(2));try{audit(a);}catch(error){console.error(error.message);console.error('\nOwner command:\n'+ownerPowerShell());process.exitCode=1;}}
