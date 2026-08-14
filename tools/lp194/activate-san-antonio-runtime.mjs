import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SOURCE='evidence/lp193/san-antonio-consumer-region-design-geometry.geojson';
const REPORT='reports/lp193/san-antonio-consumer-region-implementation-readiness.json';
const ASSET='data/runtime/san-antonio-consumer-regions.geojson';
const REGISTRY='data/runtime/san-antonio-consumer-regions.json';
const APP='js/app.js';
export const WRITE_ALLOWLIST=Object.freeze([ASSET,REGISTRY,APP]);
const EXPECTED={bytes:3577612,sha256:'c8aa67df96e0ac21a9c339eb3eebf67d528522786ab662d8f330eb883dcedfae',features:9};
const IDS=['central-san-antonio','medical-region','airport-fort-sam','stone-oak-far-north','utsa-northwest','far-west-alamo-ranch','northeast-san-antonio','southside-brooks','southwest-port-san-antonio'];
const START='// LP194_SAN_ANTONIO_RUNTIME_START';
const END='// LP194_SAN_ANTONIO_RUNTIME_END';

const read=p=>fs.readFileSync(path.join(ROOT,p));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function governed(){
 const bytes=read(SOURCE); if(bytes.length!==EXPECTED.bytes||hash(bytes)!==EXPECTED.sha256)throw Error('LP193_GEOMETRY_IDENTITY_MISMATCH');
 const geo=JSON.parse(bytes); if(geo.features?.length!==9)throw Error('LP193_FEATURE_COUNT_MISMATCH');
 const ids=geo.features.map(f=>f.properties?.regionId); if(JSON.stringify(ids)!==JSON.stringify(IDS))throw Error('LP193_REGION_IDS_MISMATCH');
 if(geo.features.some(f=>!f.geometry||!Array.isArray(f.geometry.coordinates)||f.geometry.coordinates.length===0))throw Error('LP193_EMPTY_GEOMETRY');
 const report=JSON.parse(read(REPORT));
 if(report.recommendation!=='READY_FOR_GUARDED_SAN_ANTONIO_RUNTIME_ACTIVATION')throw Error('LP193_NOT_CERTIFIED_FOR_ACTIVATION');
 const regions=report.regions.map(r=>({regionId:r.regionId,consumerLabel:r.consumerLabel,parentCity:'San Antonio',countyId:'bexar-tx',semanticCenter:{latitude:r.semanticCenter.latitude,longitude:r.semanticCenter.longitude},startupZoom:r.startupZoom.proposedZoom,atomicMembership:r.atomicMembership,geometryFeatureId:r.regionId,limitation:r.regionId==='southwest-port-san-antonio'?'PARTIAL_CERTIFIED_REGION_PENDING_FAR_SOUTHWEST_CLARIFICATION':null}));
 return {bytes,regions};
}
function registry(regions){return Buffer.from(JSON.stringify({schemaVersion:'gridly.san-antonio-consumer-regions.runtime.v1',status:'SAN_ANTONIO_CONSUMER_REGIONS_RUNTIME_ACTIVE_WITH_SELECTIVE_FAR_SOUTHWEST_LIMITATION',precedence:'INDEPENDENT_GOVERNED_PLACE_WINS',geometrySource:{path:SOURCE,...EXPECTED},independentPlaceCdpCount:33,farSouthwestActivated:false,regions},null,2)+'\n');}
function block(regions){
 const rows=regions.map(r=>`  Object.freeze(${JSON.stringify({id:r.regionId,label:r.consumerLabel,parentCity:r.parentCity,countyId:r.countyId,lat:r.semanticCenter.latitude,lng:r.semanticCenter.longitude,startupZoom:r.startupZoom,includedAreas:r.atomicMembership,geometryFeatureId:r.geometryFeatureId,limitation:r.limitation})})`).join(',\n');
 return `${START}\n+const GRIDLY_LP194_SAN_ANTONIO_REGION_MODEL = Object.freeze([\n${rows}\n+]);\n+const GRIDLY_LP194_SAN_ANTONIO_REGION_LOOKUP = Object.freeze(Object.fromEntries(GRIDLY_LP194_SAN_ANTONIO_REGION_MODEL.map((region) => [region.id, region])));\n+function gridlyLp194SanAntonioRegionAwarenessArea(region) { return Object.freeze({ key: region.id, label: region.label, storageValue: \`San Antonio — \${region.label}\`, countyId: region.countyId, parentCommunity: 'San Antonio', awarenessRegionId: region.id, awarenessRegionLabel: region.label, lat: region.lat, lng: region.lng, radiusMiles: null, startupZoom: region.startupZoom, sanAntonioRegion: true, geometryAsset: '${ASSET}', geometryFeatureId: region.geometryFeatureId, source: 'LP194 certified LP193 geometry activation' }); }\n+function gridlyLp194FindSanAntonioRegion(value = '') { const normalized=normalizeGridlyAwarenessAreaLookupText(value); return GRIDLY_LP194_SAN_ANTONIO_REGION_MODEL.find(region => [region.id,region.label,\`San Antonio \${region.label}\`,\`San Antonio — \${region.label}\`].some(label => normalizeGridlyAwarenessAreaLookupText(label)===normalized)) || null; }\n+GRIDLY_LP194_SAN_ANTONIO_REGION_MODEL.forEach(region => { if (!GRIDLY_AWARENESS_AREA_DEFINITIONS.some(area => area.key===region.id)) GRIDLY_AWARENESS_AREA_DEFINITIONS.push(gridlyLp194SanAntonioRegionAwarenessArea(region)); });\n+${END}`.replace(/^\+/gm,'');
}
function mutations(){const {bytes,regions}=governed();let app=read(APP).toString();const re=new RegExp(`${START}[\\s\\S]*?${END}`,'m');if(re.test(app))app=app.replace(re,block(regions));else {const anchor='GRIDLY_LP035_HOUSTON_REGION_MODEL.forEach((region) => {';const at=app.indexOf(anchor);if(at<0)throw Error('RUNTIME_AWARENESS_ANCHOR_MISSING');const close=app.indexOf('\n});',at)+4;app=app.slice(0,close)+'\n\n'+block(regions)+app.slice(close);}return new Map([[ASSET,bytes],[REGISTRY,registry(regions)],[APP,Buffer.from(app)]]);}
function changed(m){return [...m].filter(([p,b])=>!fs.existsSync(path.join(ROOT,p))||!read(p).equals(b)).map(([p])=>p);}
export function run(mode){const m=mutations(),changes=changed(m);if(changes.some(p=>!WRITE_ALLOWLIST.includes(p)))throw Error('WRITE_OUTSIDE_ALLOWLIST');if(mode==='whatif'){console.log(JSON.stringify({result:'PASS_NO_WRITES',writeAllowlist:WRITE_ALLOWLIST,wouldChange:changes},null,2));return;}if(mode==='apply'){for(const [p,b] of m){fs.mkdirSync(path.dirname(path.join(ROOT,p)),{recursive:true});fs.writeFileSync(path.join(ROOT,p),b);}console.log(JSON.stringify({result:'APPLIED',changed:changes,writeAllowlist:WRITE_ALLOWLIST},null,2));return;}if(mode==='verify'){if(changes.length)throw Error(`RUNTIME_DRIFT:${changes.join(',')}`);console.log(JSON.stringify({result:'PASS',activeRegions:9,geometry:EXPECTED,status:'SAN_ANTONIO_CONSUMER_REGIONS_RUNTIME_ACTIVE_WITH_SELECTIVE_FAR_SOUTHWEST_LIMITATION'},null,2));return;}throw Error('Use --whatif, --apply, or --verify');}
if(process.argv[1]===fileURLToPath(import.meta.url))run((process.argv.find(x=>/^--/.test(x))||'').slice(2));
