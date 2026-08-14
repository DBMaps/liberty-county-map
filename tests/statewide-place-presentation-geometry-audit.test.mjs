import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os'; import path from 'node:path'; import { test } from 'node:test';
import { buildAudit, GEOMETRY_SQL, loadGovernance, serializeReports, validateGdalVersion, validateSource } from '../tools/audit-statewide-place-presentation-geometry.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/statewide-place-presentation-geometry/places.geojson',import.meta.url)));
const analyzed=(geoid, overrides={})=>({GEOID:geoid,INTPTLAT:1,INTPTLON:1,areaSquareMeters:1_000_000,componentCount:1,minX:0,minY:0,maxX:2,maxY:2,centroidLat:1,centroidLon:1,centroidContained:1,surfaceLat:1,surfaceLon:1,...overrides});
const governance=(ids, excluded=[])=>({eligible:new Map(ids.map(id=>[id,{placeGeoid:id,displayName:`Place ${id}`,governedType:'INCORPORATED_PLACE',countyMemberships:['48001']}])),excluded:new Set(excluded)});

test('GDAL gate accepts only parseable versions on the governed 3.13.x line',()=>{
  assert.equal(validateGdalVersion('GDAL 3.13.0 "Iowa City", released 2026/05/04'),'GDAL 3.13.0 "Iowa City", released 2026/05/04');
  assert.equal(validateGdalVersion('GDAL 3.13.1'),'GDAL 3.13.1');
  for(const version of ['GDAL 3.11.0','GDAL 3.12.0','GDAL 3.14.0','GDAL 4.0.0','GDAL unknown',''])assert.throws(()=>validateGdalVersion(version),/GDAL version must be the governed QGIS 3\.44\.11 GDAL 3\.13\.x line/);
});

test('controlled geometry fixtures cover compact, exterior-centroid concavity, multipart, holes, and stable ordering',()=>{
  assert.deepEqual(fixture.features.map(f=>f.properties.case),['compact polygon','concave polygon with exterior centroid','multipart PLACE','hole']);
  assert.match(GEOMETRY_SQL,/ST_Area\(geom\)/); assert.match(GEOMETRY_SQL,/Centroid\(geom\)/); assert.match(GEOMETRY_SQL,/PointOnSurface\(geom\)/); assert.match(GEOMETRY_SQL,/ST_Intersects\(geom,Centroid\(geom\)\)/);
  assert.ok(GEOMETRY_SQL.indexOf('ST_Area')<GEOMETRY_SQL.indexOf('Centroid')); assert.match(GEOMETRY_SQL,/ORDER BY GEOID/);
});
test('missing GEOID fails closed',()=>assert.throws(()=>buildAudit({rawRows:[analyzed('4800001')],governance:governance(['4800001','4800002']),toolchain:{},focusPath:null}),/missing eligible GEOIDs: 4800002/));
test('duplicate GEOID fails closed',()=>assert.throws(()=>buildAudit({rawRows:[analyzed('4800001'),analyzed('4800001')],governance:governance(['4800001']),toolchain:{},focusPath:null}),/duplicate source GEOID/));
test('excluded record is accepted as source but never leaks into eligible output',()=>assert.throws(()=>buildAudit({rawRows:[analyzed('4800001'),analyzed('4800002')],governance:governance(['4800001'],['4800002']),toolchain:{},focusPath:null}),/matched eligible geometry count must be 1859/));
test('wrong source filename, byte size, and hash fail before geometry',()=>{const dir=mkdtempSync(path.join(os.tmpdir(),'gridly-wrong-source-'));const wrong=path.join(dir,'wrong.zip');writeFileSync(wrong,'x');assert.throws(()=>validateSource(wrong,{filename:'tl_2025_48_place.zip',bytes:1,sha256:'x'}),/source filename/);const named=path.join(dir,'tl_2025_48_place.zip');writeFileSync(named,'x');assert.throws(()=>validateSource(named,{filename:path.basename(named),bytes:2,sha256:'x'}),/byte length/);assert.throws(()=>validateSource(named,{filename:path.basename(named),bytes:1,sha256:'0'.repeat(64)}),/SHA-256/);});
test('real projection reconciles exactly 1,859 eligible and four excluded identities',()=>{const value=loadGovernance();assert.equal(value.eligible.size,1859);assert.equal(value.excluded.size,4);for(const id of value.excluded)assert.ok(!value.eligible.has(id));});
test('deterministic serialization is byte identical and preserves all candidates',()=>{const ids=Array.from({length:1859},(_,i)=>`48${String(i).padStart(5,'0')}`);const rows=ids.slice().reverse().map((id,i)=>analyzed(id,{componentCount:i===0?2:1,centroidContained:i===1?0:1}));const args={rawRows:rows,governance:governance(ids),source:{filename:'fixture',bytes:1,sha256:'fixture'},toolchain:{version:'fixture',qgisDistribution:'fixture'},focusPath:null};const a=serializeReports(buildAudit(args)),b=serializeReports(buildAudit(args));assert.deepEqual(a.json,b.json);assert.deepEqual(a.markdown,b.markdown);const report=JSON.parse(a.json);assert.equal(report.places[0].geoid,'4800000');assert.deepEqual(Object.keys(report.places[0].distancesMeters),['intptToCentroid','intptToBboxMidpoint','intptToPointOnSurface','centroidToPointOnSurface']);assert.equal(report.productionTargetSelected,false);});
