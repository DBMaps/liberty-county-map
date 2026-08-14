import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const WORKING_CRS='EPSG:3083';
export const EVIDENCE='evidence/san-antonio-sa-tomorrow-geometry-source';
const REGISTRY='reports/san-antonio-sa-tomorrow-official-registry.json';
const ALLOWED_PORTAL='cosagis.maps.arcgis.com';
const ALLOWED_OWNERS=new Set(['cosagis','cityofsanantonio']);
const MODES=new Set(['--discover','--acquire','--verify','--analyze']);
export const FAILURES=Object.freeze(['OFFICIAL_CITY_AUTHORITY_NOT_ESTABLISHED','SOURCE_LAYER_IDENTITY_AMBIGUOUS','SOURCE_BYTES_NOT_PRESERVED','SOURCE_HASH_MISMATCH','FRAMEWORK_RECONCILIATION_FAILED','MISSING_ATOMIC_UNIT','DUPLICATE_ATOMIC_UNIT','UNEXPECTED_ATOMIC_UNIT','REQUIRED_GEOMETRY_MISSING','INVALID_GEOMETRY_UNRESOLVED','SOURCE_CRS_UNKNOWN','TOPOLOGY_ANALYSIS_INCOMPLETE','CITY_LIMIT_AUTHORITY_AMBIGUOUS','PLACE_CDP_GEOMETRY_UNAVAILABLE','NON_AUTHORITATIVE_SOURCE_REQUIRED']);

export const sha256=b=>crypto.createHash('sha256').update(b).digest('hex');
export function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
export const serialize=v=>JSON.stringify(canonical(v),null,2)+'\n';
export function assertAuthority({portalHost,itemOwner,serviceUrl,serviceItemId,itemId}){
  let host;try{host=new URL(serviceUrl).hostname.toLowerCase();}catch{throw new Error('OFFICIAL_CITY_AUTHORITY_NOT_ESTABLISHED');}
  const serviceHost=host==='gis.sanantonio.gov'||/^(services\d*|utility)\.arcgis\.com$/.test(host);
  if(portalHost!==ALLOWED_PORTAL||!ALLOWED_OWNERS.has(String(itemOwner).toLowerCase())||!serviceHost||serviceItemId!==itemId)throw new Error('OFFICIAL_CITY_AUTHORITY_NOT_ESTABLISHED');
  return true;
}
export function geometryKind(g){if(!g)throw new Error('REQUIRED_GEOMETRY_MISSING');if(!['Polygon','MultiPolygon'].includes(g.type))throw new Error('INVALID_GEOMETRY_UNRESOLVED');if(!Array.isArray(g.coordinates)||!g.coordinates.length)throw new Error('REQUIRED_GEOMETRY_MISSING');return {type:g.type,components:g.type==='Polygon'?1:g.coordinates.length};}
export function reconcile(registry,features,nameField='officialName',typeField='type'){
  const expected=registry.records.map(r=>`${r.type}\0${r.officialName}`), actual=features.map(f=>`${f.properties[typeField]}\0${f.properties[nameField]}`);
  const duplicates=[...new Set(actual.filter((x,i)=>actual.indexOf(x)!==i))].sort();
  const missing=expected.filter(x=>!actual.includes(x)).sort(), unexpected=actual.filter(x=>!expected.includes(x)).sort();
  for(const f of features)geometryKind(f.geometry);
  const split=features.reduce((a,f)=>(a[f.properties[typeField]]=(a[f.properties[typeField]]||0)+1,a),{});
  const result={expectedCount:30,actualCount:features.length,regionalCenterCount:split.REGIONAL_CENTER||0,communityAreaCount:split.COMMUNITY_AREA||0,missing,duplicates,unexpected,unresolvedNameMappings:missing.length+unexpected.length,status:'RECONCILIATION_FAILED'};
  if(features.length!==30||result.regionalCenterCount!==13||result.communityAreaCount!==17||missing.length||duplicates.length||unexpected.length)throw Object.assign(new Error('FRAMEWORK_RECONCILIATION_FAILED'),{result});
  result.status='RECONCILED';return result;
}
const bbox=g=>{const p=[];(function walk(x){if(typeof x?.[0]==='number')p.push(x);else for(const y of x||[])walk(y);})(g.coordinates);return [Math.min(...p.map(x=>x[0])),Math.min(...p.map(x=>x[1])),Math.max(...p.map(x=>x[0])),Math.max(...p.map(x=>x[1]))];};
export function bboxRelationship(a,b){const A=bbox(a),B=bbox(b),w=Math.min(A[2],B[2])-Math.max(A[0],B[0]),h=Math.min(A[3],B[3])-Math.max(A[1],B[1]);return {intersects:w>=0&&h>=0,overlapDetected:w>0&&h>0,overlapArea:w>0&&h>0?w*h:0,adjacent:(w===0&&h>=0)||(h===0&&w>=0)};}
export function assertAnalysisContract({sourceCrs,workingCrs,valid=true}){if(!sourceCrs)throw new Error('SOURCE_CRS_UNKNOWN');if(workingCrs!==WORKING_CRS)throw new Error('EPSG_3083_WORKING_PROJECTION_REQUIRED');if(!valid)throw new Error('INVALID_GEOMETRY_UNRESOLVED');return true;}

function settings(){const urls=(process.env.GRIDLY_SA_TOMORROW_LAYER_URLS||'').split(',').filter(Boolean);if(!urls.length)throw new Error('SOURCE_LAYER_IDENTITY_AMBIGUOUS: set GRIDLY_SA_TOMORROW_LAYER_URLS to exact City service layer URL(s)');return urls;}
async function json(url){const r=await fetch(`${url}${url.includes('?')?'&':'?'}f=json`);if(!r.ok)throw new Error(`NETWORK_FETCH_FAILURE HTTP_${r.status}`);return r.json();}
async function discover(){const sources=[];for(const layerUrl of settings()){const u=new URL(layerUrl);if(!/\/FeatureServer\/\d+$/.test(u.pathname))throw new Error('SOURCE_LAYER_IDENTITY_AMBIGUOUS');const serviceUrl=layerUrl.replace(/\/\d+$/,''), layerId=Number(u.pathname.split('/').at(-1));const [layer,service]=await Promise.all([json(layerUrl),json(serviceUrl)]);const itemId=service.serviceItemId;if(!itemId)throw new Error('OFFICIAL_CITY_AUTHORITY_NOT_ESTABLISHED');const item=await json(`https://${ALLOWED_PORTAL}/sharing/rest/content/items/${itemId}`);assertAuthority({portalHost:ALLOWED_PORTAL,itemOwner:item.owner,serviceUrl,serviceItemId:service.serviceItemId,itemId:item.id});sources.push({itemId:item.id,itemOwner:item.owner,title:item.title,serviceUrl,serviceItemId:service.serviceItemId,layerId,layerName:layer.name,department:item.orgId,authoritativeHost:u.hostname,sourceCrs:layer.extent?.spatialReference||null,geometryType:layer.geometryType,featureCount:null,fields:layer.fields||[],capabilities:layer.capabilities||null,supportedQueryFormats:layer.supportedQueryFormats||null,licenseInfo:item.licenseInfo||null,created:item.created||null,modified:item.modified||null});}return {status:'CITY_AUTHORITY_ESTABLISHED_METADATA_ONLY',sources};}
async function acquire(){const d=await discover();fs.mkdirSync(path.join(ROOT,EVIDENCE),{recursive:true});for(const s of d.sources){const params=new URLSearchParams({f:'geojson',where:'1=1',outFields:'*',returnGeometry:'true',orderByFields:'OBJECTID ASC'}),url=`${s.serviceUrl}/${s.layerId}/query?${params}`,r=await fetch(url);if(!r.ok)throw new Error(`NETWORK_FETCH_FAILURE HTTP_${r.status}`);const bytes=Buffer.from(await r.arrayBuffer()),file=`${s.itemId}.layer-${s.layerId}.source.geojson`;fs.writeFileSync(path.join(ROOT,EVIDENCE,file),bytes);Object.assign(s,{acquisitionUrl:url,queryParameters:Object.fromEntries(params),filename:file,byteLength:bytes.length,sha256:sha256(bytes),featureCount:JSON.parse(bytes).features?.length});}const m={schemaVersion:'gridly.san-antonio-sa-tomorrow-geometry-source.v1',status:'SOURCE_BYTES_ACQUIRED_ANALYSIS_PENDING',workingCrs:WORKING_CRS,sources:d.sources,failClosedConditions:FAILURES};fs.writeFileSync(path.join(ROOT,EVIDENCE,'manifest.json'),serialize(m));return m;}
function verify(){const p=path.join(ROOT,EVIDENCE,'manifest.json');if(!fs.existsSync(p))throw new Error('SOURCE_BYTES_NOT_PRESERVED');const m=JSON.parse(fs.readFileSync(p));for(const s of m.sources){const b=fs.readFileSync(path.join(ROOT,EVIDENCE,s.filename));if(b.length!==s.byteLength||sha256(b)!==s.sha256)throw new Error('SOURCE_HASH_MISMATCH');}return {status:'SOURCE_BYTES_VERIFIED',sourceCount:m.sources.length};}
function analyze(){verify();const m=JSON.parse(fs.readFileSync(path.join(ROOT,EVIDENCE,'manifest.json'))),registry=JSON.parse(fs.readFileSync(path.join(ROOT,REGISTRY)));const features=m.sources.flatMap(s=>JSON.parse(fs.readFileSync(path.join(ROOT,EVIDENCE,s.filename))).features||[]);const name=process.env.GRIDLY_SA_NAME_FIELD||'officialName',type=process.env.GRIDLY_SA_TYPE_FIELD||'type';const reconciliation=reconcile(registry,features,name,type);for(const s of m.sources)assertAnalysisContract({sourceCrs:s.sourceCrs,workingCrs:WORKING_CRS});throw Object.assign(new Error('TOPOLOGY_ANALYSIS_INCOMPLETE: owner GDAL EPSG:3083 execution and governed PLACE/CDP geometry are required'),{reconciliation});}
async function main(){const modes=process.argv.filter(x=>MODES.has(x));if(modes.length!==1)throw new Error('Exactly one mode is required');const out=modes[0]==='--discover'?await discover():modes[0]==='--acquire'?await acquire():modes[0]==='--verify'?verify():analyze();console.log(process.argv.includes('--json')?serialize(out):JSON.stringify(out,null,2));}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error(`FAIL_CLOSED: ${e.message}`);if(e.result)console.error(serialize(e.result));process.exitCode=1;});
