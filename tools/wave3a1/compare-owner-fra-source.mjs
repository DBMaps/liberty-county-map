#!/usr/bin/env node
// Owner-local read-only control. It intentionally emits comparison evidence to
// stdout and never overwrites either governed source.
import fs from 'node:fs';
const arg=n=>process.argv[process.argv.indexOf(n)+1];
const rawPath=arg('--raw'), processedPath=arg('--processed');
if(!rawPath||!processedPath)throw Error('usage: --raw <raw GeoJSON> --processed <processed GeoJSON>');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const raw=read(rawPath), processed=read(processedPath), id=f=>String(f?.properties?.CROSSING||'');
const rawById=new Map(raw.features.map(f=>[id(f),f]));
const fields=f=>{const p=f?.properties||{},xy=f?.geometry?.coordinates;return{id:id(f),coordinates:xy,county:{STCYFIPS:p.STCYFIPS,CountyCode:p.CountyCode,COUNTYNAME:p.COUNTYNAME},state:{StateCode:p.StateCode,STATENAME:p.STATENAME,STATEAB:p.STATEAB}}};
const exceptions=new Set(['CROSS_COUNTY_MISMATCH','OUTSIDE_TEXAS']);
// Supplying the checked-in exception inventory makes this command independent
// of an owner checkout's working directory.
const inventory=read(new URL('../../evidence/wave3a1-fra-reconciliation/exceptions.json',import.meta.url));
const rows=inventory.exceptions.filter(x=>exceptions.has(x.exceptionType)).map(x=>{const p=processed.features.find(f=>id(f)===x.crossingId),r=rawById.get(x.crossingId);return{crossingId:x.crossingId,raw:r?fields(r):null,processed:p?fields(p):null,rawRecordPresent:Boolean(r),equal:r&&p?JSON.stringify(fields(r))===JSON.stringify(fields(p)):false}});
console.log(JSON.stringify({rawRows:raw.features.length,processedRows:processed.features.length,exceptionRows:rows.length,rows},null,2));
