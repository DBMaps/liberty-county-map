// Offline, reproducible extraction of public OSM data; no consumer runtime imports.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const sourcePath='data/liberty-county-road-segments.geojson';
const bytes=await readFile(new URL(sourcePath,root));
const source=JSON.parse(bytes);
const bbox=[-94.95,30.015,-94.85,30.085];
const inside=([x,y])=>x>=bbox[0]&&x<=bbox[2]&&y>=bbox[1]&&y<=bbox[3];
const features=[];
for(const feature of source.features){
  if(feature.geometry.type!=='LineString'||!feature.properties.highway)continue;
  let run=[];
  const flush=()=>{if(run.length>1)features.push({type:'Feature',properties:{osmId:feature.properties['@id'],name:feature.properties.name||'',ref:feature.properties.ref||'',highway:feature.properties.highway},geometry:{type:'LineString',coordinates:run}});run=[];};
  for(const point of feature.geometry.coordinates){if(inside(point))run.push(point);else flush();}flush();
}
await writeFile(new URL('dispatch/demo/dayton-roads.geojson',root),JSON.stringify({type:'FeatureCollection',bbox,attribution:'© OpenStreetMap contributors',license:'https://opendatacommons.org/licenses/odbl/1-0/',sourceTimestamp:source.timestamp,features})+'\n');
await writeFile(new URL('dispatch/demo/dayton-roads-provenance.json',root),JSON.stringify({source:sourcePath,sha256:createHash('sha256').update(bytes).digest('hex'),sourceTimestamp:source.timestamp,bbox,featureCount:features.length,transform:'LineString highway features; contiguous in-bounds vertex runs of at least two points; preserve coordinates and allowlist four public road properties. No jurisdiction or incident data.',license:'ODbL 1.0',copyright:source.copyright},null,2)+'\n');
await mkdir(new URL('dispatch/vendor/leaflet/',root),{recursive:true});
for(const [from,to]of [['dist/leaflet.js','leaflet.js'],['dist/leaflet.css','leaflet.css'],['LICENSE','LICENSE']])await copyFile(new URL('node_modules/leaflet/'+from,root),new URL('dispatch/vendor/leaflet/'+to,root));
console.log(`${features.length} local road lines; Leaflet 1.9.4 copied unchanged with license.`);
