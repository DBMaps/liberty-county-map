#!/usr/bin/env node
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {buildLp197Comparison,reconcile,sha256,stableJson,verifySource,writeAtomic} from './reconcile-named-places.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const EXPECTED={bytes:707715853,sha256:'1d80efe1b19b075d036363d722366870df3efb7fbd4a45dc9f16797868ff4413'};
const arg=n=>{const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1]};
const mode=process.argv.includes('--apply')?'apply':process.argv.includes('--verify')?'verify':'whatif';
const pbf=arg('--pbf')||process.env.GRIDLY_LP2011_OSM_PBF||'C:\\GitHub\\Gridly-Source-Data\\OpenStreetMap\\Regional\\texas-260625.osm.pbf';
const placesPath=arg('--places'); const candidatesPath=arg('--candidates'); const out=path.resolve(ROOT,arg('--output')||'reports/lp2011');
if(!placesPath||!candidatesPath)throw Error('LP2011_INPUT_REQUIRED: run owner PowerShell extraction or pass --places and --candidates');
const source=verifySource(pbf,EXPECTED); source.canonicalSha256=sha256(fs.readFileSync(placesPath)); source.candidatesSha256=sha256(fs.readFileSync(candidatesPath));
const projectionPath=arg('--projection')||path.join(ROOT,'data/generated/gridly-statewide-consumer-community-projection-v1.json');
const projection=JSON.parse(fs.readFileSync(projectionPath)); const identities=new Map(projection.communities.map(x=>[x.placeGeoid,x])); source.projectionSha256=sha256(fs.readFileSync(projectionPath));
const places=JSON.parse(fs.readFileSync(placesPath)).features.map(f=>{const geoid=String(f.properties.GEOID??f.properties.placeGeoid),identity=identities.get(geoid);if(!identity)return null;return {placeGeoid:geoid,name:identity.displayName,governedType:identity.governedType,countyMemberships:identity.countyMemberships,geometry:f.geometry,lp199:f.properties.lp199??null,lp200:f.properties.lp200??null};}).filter(Boolean);
const candidates=JSON.parse(fs.readFileSync(candidatesPath)).features.map(f=>({osmId:f.properties.osm_id??f.properties.osm_way_id??f.id,name:f.properties.name,place:f.properties.place,lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],countyFips:f.properties.countyFips??null}));
const report=reconcile({places,candidates,source}); const review={schemaVersion:'gridly.lp2011.review.v1',records:report.records.filter(r=>!r.selectedOsmId),unmatched:report.unmatched};
const lp197Path=arg('--lp197');
let references;
if(lp197Path) references=JSON.parse(fs.readFileSync(lp197Path));
else {
  const truth=JSON.parse(fs.readFileSync(path.join(ROOT,'reports/lp197/governed-place-consumer-presentation-cameras.json'))).cameras;
  const lp199=JSON.parse(fs.readFileSync(path.join(ROOT,'reports/lp199/statewide-governed-place-presentation-camera-derivation.json')));
  const geometry=new Map(lp199.calibration.find(x=>x.method==='geometryCentroid').controls.map(x=>[x.placeGeoid,x.candidate]));
  references=truth.map(x=>({placeGeoid:x.placeGeoid,label:x.label,reference:{lat:x.lat,lon:x.lng},lp199:geometry.has(x.placeGeoid)?{lat:geometry.get(x.placeGeoid).lat,lon:geometry.get(x.placeGeoid).lng}:null,lp200:null}));
}
const comparison=buildLp197Comparison(report,references);
const preflight={schemaVersion:'gridly.lp2011.preflight.v1',source,checks:{identity:true,pointsLayer:true,requiredFields:['name','place'],gdalValidatedByOwnerWrapper:true}};
const outputs={'preflight.json':stableJson(preflight),'raw-named-place-points.geojson':stableJson(JSON.parse(fs.readFileSync(candidatesPath))),'reconciliation.json':stableJson(report),'review.json':stableJson(review),'lp197-comparison.json':stableJson(comparison),'summary.json':stableJson({schemaVersion:'gridly.lp2011.summary.v1',counts:report.counts,inputHashes:source,runtimeActivation:false})};
if(mode==='apply')for(const [name,value] of Object.entries(outputs))writeAtomic(path.join(out,name),value);
if(mode==='verify')for(const [name,value] of Object.entries(outputs)){const target=path.join(out,name);if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==value)throw Error(`LP2011_ARTIFACT_MISMATCH:${name}`);}
console.log(JSON.stringify({mode,counts:report.counts,outputDirectory:mode==='apply'?out:null},null,2));
