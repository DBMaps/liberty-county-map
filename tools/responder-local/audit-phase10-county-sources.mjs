#!/usr/bin/env node
// Local, read-only comparison. Never connects to a database or writes artifacts.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const files={
  lp137:'assets/boundaries/texas-counties-boundaries.geojson',
  responderFrozen:'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json',
  sharedRuntime:'assets/location-resolution/gridly-authoritative-county-geometry-v1.json',
  cartographic:'assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson',
  legacyLiberty:'data/liberty-county-boundary.geojson'
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=p=>readFileSync(join(root,p));
const parsed=p=>JSON.parse(read(p));
const gitBlob=p=>execFileSync('git',['cat-file','blob',`HEAD:${p}`],
  {cwd:root,maxBuffer:20*1024*1024});

function rows(kind,data){
  if(kind==='lp137') return data.features.map(x=>({fips:x.properties.GEOID,name:x.properties.NAMELSAD,geometry:x.geometry}));
  if(kind==='responderFrozen') return data.counties.map(x=>({fips:x.fips,name:x.displayName,geometry:x.geometry}));
  if(kind==='sharedRuntime') return data.counties.map(x=>({fips:x.countyFips,name:x.name,geometry:x.geometry}));
  if(kind==='legacyLiberty') return data.features.map(x=>({fips:x.properties.FIPS,name:x.properties.NAME,geometry:x.geometry}));
  return data.features.map(x=>({fips:x.properties.geoid,name:x.properties.name,geometry:x.geometry}));
}

function geometryStats(items){
  const typeCounts={},bounds=[Infinity,Infinity,-Infinity,-Infinity];
  let polygons=0,rings=0,points=0,closedRings=0,invalidCoordinates=0;
  let minimumDimension=Infinity,maximumDimension=0;
  for(const item of items){
    const geometry=item.geometry;
    typeCounts[geometry.type]=(typeCounts[geometry.type]||0)+1;
    const polygonParts=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
    polygons+=polygonParts.length;
    for(const polygon of polygonParts) for(const ring of polygon){
      rings++;
      if(JSON.stringify(ring[0])===JSON.stringify(ring.at(-1))) closedRings++;
      for(const coordinate of ring){
        points++;
        minimumDimension=Math.min(minimumDimension,coordinate.length);
        maximumDimension=Math.max(maximumDimension,coordinate.length);
        const [x,y]=coordinate;
        if(!Number.isFinite(x)||!Number.isFinite(y)||x< -180||x>180||y< -90||y>90)
          invalidCoordinates++;
        bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);
        bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);
      }
    }
  }
  return {typeCounts,polygons,rings,points,closedRings,invalidCoordinates,
    coordinateDimensions:[minimumDimension,maximumDimension],bbox:bounds};
}

function inventory(kind){
  const file=files[kind],bytes=read(file),data=JSON.parse(bytes),items=rows(kind,data);
  const byFips=new Map(items.map(x=>[x.fips,x]));
  const invalidFips=items.filter(x=>!/^48\d{3}$/.test(x.fips)).map(x=>x.fips);
  return {path:file,bytes:bytes.length,sha256:sha(bytes),count:items.length,
    uniqueFips:byFips.size,duplicateFips:items.length-byFips.size,invalidFips,
    geometry:geometryStats(items),packageVersion:data.packageVersion||null,
    source:data.source||data.sourceSummary||null,items,byFips};
}

function compare(basis,candidate){
  const missingFips=[...basis.byFips.keys()].filter(f=>!candidate.byFips.has(f)).sort();
  const extraFips=[...candidate.byFips.keys()].filter(f=>!basis.byFips.has(f)).sort();
  const geometryDifferentFips=[],nameDifferentFips=[];
  for(const [fips,a] of basis.byFips){
    const b=candidate.byFips.get(fips);
    if(!b) continue;
    if(a.geometry.type!==b.geometry.type ||
      JSON.stringify(a.geometry.coordinates)!==JSON.stringify(b.geometry.coordinates))
      geometryDifferentFips.push(fips);
    if(a.name!==b.name) nameDifferentFips.push(fips);
  }
  return {missingFips,extraFips,exactGeometryMatches:basis.byFips.size-missingFips.length-geometryDifferentFips.length,
    geometryDifferentCount:geometryDifferentFips.length,geometryDifferentFips,
    nameDifferentCount:nameDifferentFips.length,nameDifferentFips};
}

function perCountyFiles(basis){
  const base=join(root,'assets/county-implementation');
  const paths=[];
  for(const slug of readdirSync(base)){
    const dir=join(base,slug,'boundary');
    let names=[];
    try{names=readdirSync(dir).filter(n=>n.endsWith('-county-boundary.geojson'));}catch{continue;}
    for(const name of names) paths.push(`assets/county-implementation/${slug}/boundary/${name}`);
  }
  const same=[],different=[],missing=[],entries=[];
  for(const path of paths.sort()){
    const feature=parsed(path).features?.[0];
    const fips=feature?.properties?.GEOID||feature?.properties?.FIPS;
    const expected=basis.byFips.get(fips);
    entries.push({path,sha256:sha(gitBlob(path)),fips:fips||null,
      geometryType:feature?.geometry?.type||null,
      sourceLibraryPath:feature?.properties?.sourceLibraryPath||null});
    if(!expected) missing.push({path,fips:fips||null});
    else if(feature.geometry.type===expected.geometry.type &&
      JSON.stringify(feature.geometry.coordinates)===JSON.stringify(expected.geometry.coordinates)) same.push(fips);
    else different.push(fips);
  }
  return {count:paths.length,entries,exactFrozenGeometryMatches:same.length,
    differentFips:different.sort(),missing};
}

export function audit(){
  const data=Object.fromEntries(Object.keys(files).map(k=>[k,inventory(k)]));
  const frozen=data.responderFrozen;
  const canonical=gitBlob(files.responderFrozen);
  const candidates=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{
    path:v.path,bytes:v.bytes,sha256:v.sha256,count:v.count,
    uniqueFips:v.uniqueFips,duplicateFips:v.duplicateFips,invalidFips:v.invalidFips,
    geometry:v.geometry,packageVersion:v.packageVersion,source:v.source,
    versusFrozen:k==='responderFrozen'?null:compare(frozen,v)
  }]));
  return {schemaVersion:'responder.phase10.countySourceComparison.v1',
    frozenCanonicalGitBlob:{path:files.responderFrozen,bytes:canonical.length,sha256:sha(canonical)},
    candidates,perCountyBoundaryFiles:perCountyFiles(frozen)};
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
  process.stdout.write(JSON.stringify(audit(),null,2)+'\n');
