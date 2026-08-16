#!/usr/bin/env node
// Owner-local read-only control. It intentionally emits comparison evidence to
// stdout and never overwrites either governed source.
import fs from 'node:fs';
import crypto from 'node:crypto';
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
const eq=(r,key)=>Boolean(r.raw&&r.processed&&JSON.stringify(r.raw[key])===JSON.stringify(r.processed[key]));
const summary={rawPath,rawBytes:fs.statSync(rawPath).size,rawSha256:crypto.createHash('sha256').update(fs.readFileSync(rawPath)).digest('hex'),processedPath,processedBytes:fs.statSync(processedPath).size,processedSha256:crypto.createHash('sha256').update(fs.readFileSync(processedPath)).digest('hex'),rawRows:raw.features.length,processedRows:processed.features.length,comparisonScope:'Wave 3A.1 exception inventory',exceptionRows:rows.length,rawRecordFound:rows.filter(r=>r.rawRecordPresent).length,crossingIdEqual:rows.filter(r=>eq(r,'id')).length,coordinatesEqual:rows.filter(r=>eq(r,'coordinates')).length,STCYFIPSEqual:rows.filter(r=>r.raw?.county.STCYFIPS===r.processed?.county.STCYFIPS).length,CountyCodeEqual:rows.filter(r=>r.raw?.county.CountyCode===r.processed?.county.CountyCode).length,COUNTYNAMEEqual:rows.filter(r=>r.raw?.county.COUNTYNAME===r.processed?.county.COUNTYNAME).length,stateIdentityEqual:rows.filter(r=>eq(r,'state')).length,allComparedFieldsEqual:rows.filter(r=>r.equal).length};
console.log(JSON.stringify(process.argv.includes('--summary')?summary:{...summary,rows},null,2));
