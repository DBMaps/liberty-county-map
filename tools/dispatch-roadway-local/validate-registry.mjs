// Read-only, local-only certification of the approved existing inputs. No outputs are written.
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {CONTRACT,LIMITS,digest,loadRegistry} from '../../dispatch/roadway-registry.mjs';
export const PROVENANCE='dispatch/demo/dayton-roads-provenance.json';
export const PROVENANCE_HASH='69f91682f19113ad5a15a9af88df107b19ff6bbd89cdf18b2de37026fae595ae';
export const RUNTIME_HASH='e4c9ac7168ec84dc462695a93ea4561dbd62486131f3f78b70ed05ab5ba39a0c';
export const COUNTY_HASH='808467c27171743bf217e1b31d9fffb506064c8dba304010387c7b9719b9358c';
const sourceHash='bbea076ffc97920c6d5cb0050870f22c644c5a78b114ee14b5fceeab0dfd6978';
const common={contract:CONTRACT,namespace:'osm',sourceDataset:'data/liberty-county-road-segments.geojson',sourceHash,snapshot:'2026-05-09T22:50:58Z',provenanceHash:PROVENANCE_HASH,countyFips:Object.freeze(['48291']),crs:'OGC:CRS84',license:'ODbL 1.0',attribution:'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.'};
export const INPUTS=Object.freeze([
 Object.freeze({...common,dataset:'dispatch/demo/dayton-roads.geojson',inputHash:'f1a61e3572824a5e8e555382cff6aaec58a628a75efdacf77e3bba856e13680d',version:'dispatch-preview-331-v1',packageId:'liberty-tx.dispatch-preview-331',featureIdKey:'osmId',inputFeatureCount:331,sourceTransform:'Existing extraction: contiguous in-bounds vertex runs, four public properties; exact retained coordinates. No new extraction.'}),
 Object.freeze({...common,dataset:'data/liberty-county-road-segments.geojson',inputHash:sourceHash,version:'osm-2026-05-09-liberty',packageId:'liberty-tx.osm-source',featureIdKey:'@id',inputFeatureCount:8407,excludedGeometryTypes:Object.freeze(['Polygon']),sourceTransform:'Original OSM input; registry excludes two Polygon features from roadway rows. No coordinate transformation.'})
]);
const root=new URL('../../',import.meta.url);
async function bounded(path,limit){const url=new URL(path,root);if((await stat(url)).size>limit)throw new Error('Pinned local input exceeds limit.');const b=await readFile(url);if(b.length>limit)throw new Error('Pinned local input exceeds limit.');return b;}
export async function validateLocal(){
 const counties=await bounded('data/lp104/texas-counties.json',1024*1024);if(await digest(counties)!==COUNTY_HASH)throw new Error('County provenance changed.');
 const runtimeBytes=await bounded('data/roadway-runtime-manifest.json',1024*1024);if(await digest(runtimeBytes)!==RUNTIME_HASH)throw new Error('Statewide packaging reference changed.');
 const runtime=JSON.parse(runtimeBytes);if(Object.keys(runtime.counties||{}).length!==254||runtime.counties['liberty-tx']?.url!==INPUTS[1].dataset||runtime.counties['liberty-tx']?.status!=='local_runtime')throw new Error('Approved source is outside governed runtime packaging.');
 const inventory=JSON.parse(counties);if(inventory.count!==254||inventory.counties.length!==254)throw new Error('Invalid Texas inventory.');
 const fips=inventory.counties.map(c=>c.fips),provenance=await bounded(PROVENANCE,65536),results=[];
 // Sequential by design: never loads statewide road packages or remote URLs.
 for(const manifest of INPUTS){const start=performance.now(),bytes=await bounded(manifest.dataset,LIMITS.bytes),registry=await loadRegistry(bytes,provenance,manifest,fips);
  results.push({dataset:manifest.dataset,packagingReference:'data/roadway-runtime-manifest.json',packagingHash:RUNTIME_HASH,packageId:registry.packageId,...registry.statistics,elapsedMs:Math.round(performance.now()-start),sourceGeometry:'VALID',sourceIdentity:'GOVERNED_LOCAL',topology:'UNVERIFIED',boundaryRelationship:'UNVERIFIED',roadwayAuthority:'UNVERIFIED',publication:'DISABLED'});
 }
 return results;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv.length!==2){process.stderr.write('Only pinned local inputs are supported.\n');process.exitCode=1;}
 else try{console.log(JSON.stringify({contract:CONTRACT,mode:'LOCAL_READ_ONLY',results:await validateLocal()},null,2));}catch{process.stderr.write('Registry certification refused: local input or provenance contract failed.\n');process.exitCode=1;}
}