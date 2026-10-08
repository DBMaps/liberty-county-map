// Pinned local-only validator. No output files, source discovery or remote requests.
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import {buildTopology,digest,LIMITS} from '../../dispatch/roadway-topology.mjs';
const root=new URL('../../',import.meta.url);
export async function validateTopology(){
 const manifest=JSON.parse(await readFile(new URL('tools/dispatch-roadway-local/topology-source-manifest.json',root),'utf8'));
 if(manifest.sourcePath!=='dispatch/demo/source/dayton-context-osm.json'||manifest.provenancePath!=='dispatch/demo/dayton-context-provenance.json')throw Error('Only approved local paths are allowed');
 if((await stat(new URL(manifest.sourcePath,root))).size>LIMITS.bytes||(await stat(new URL(manifest.provenancePath,root))).size>65536)throw Error('Pinned input budget exceeded');
 const before=process.memoryUsage(),start=performance.now();
 const topology=await buildTopology(await readFile(new URL(manifest.sourcePath,root)),await readFile(new URL(manifest.provenancePath,root)),manifest);
 // Compatibility audit only: old geometry never enters construction or selection.
 const comparisonInputs=[['data/liberty-county-road-segments.geojson','bbea076ffc97920c6d5cb0050870f22c644c5a78b114ee14b5fceeab0dfd6978'],['dispatch/demo/dayton-roads.geojson','f1a61e3572824a5e8e555382cff6aaec58a628a75efdacf77e3bba856e13680d']];
 const compared=[];for(const [path,hash]of comparisonInputs){const url=new URL(path,root);if((await stat(url)).size>LIMITS.bytes)throw Error('Comparison input budget exceeded');const bytes=await readFile(url);if(await digest(bytes)!==hash)throw Error('Historical comparison input changed');compared.push(JSON.parse(bytes))}
 const byWay=new Map(topology.data.sourceWays.map(w=>[w.sourceWayId.replace('osm:way:','way/'),w]));
 const missingPreviewIdentities=compared[1].features.filter(f=>!byWay.has(f.properties.osmId)).map(f=>f.properties.osmId).sort();
 const mismatchedParentIdentities=[];let exactParentMatches=0;
 for(const f of compared[0].features){const w=byWay.get(f.properties['@id']);if(!w||f.geometry.type!=='LineString')continue;if(await digest(new TextEncoder().encode(JSON.stringify(f.geometry)))===w.geometryHash)exactParentMatches++;else mismatchedParentIdentities.push(f.properties['@id'])}
 const compatibility={status:'REVIEW_REQUIRED_NO_REMAP',previewOverlap:compared[1].features.length-missingPreviewIdentities.length,missingPreviewIdentities,mismatchedParentIdentities:mismatchedParentIdentities.sort(),exactParentMatches};
 const after=process.memoryUsage();
 return {topology,report:{mode:'LOCAL_SOURCE_EVIDENCE_ONLY',...topology.statistics,topologyVersion:topology.data.topologyVersion,elapsedMs:Math.round(performance.now()-start),heapDeltaBytes:after.heapUsed-before.heapUsed,rssBytes:after.rss,authority:'UNVERIFIED',publication:'DISABLED',snapshotMixing:false,compatibility}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 if(process.argv.length!==2){process.stderr.write('Only pinned local inputs are supported.\n');process.exitCode=1}
 else try{console.log(JSON.stringify((await validateTopology()).report,null,2))}catch(e){process.stderr.write('Topology certification refused: '+e.message+'\n');process.exitCode=1}
}
