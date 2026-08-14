import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reconstructWrapper,recoverWrapperFile,WEST} from '../tools/lp191/recover-west-northwest-artifact.mjs';
import {verifyWrittenGeoJson,writeBytes,writeCanonicalJson} from '../tools/certify-san-antonio-working-geometry-governance.mjs';

const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixture=()=>Buffer.from(JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{Name:WEST.name,GlobalID:WEST.globalId},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[0,0]]]}}]}));
const wrapper=b=>Object.fromEntries([...b].map((value,index)=>[String(index),value]));
const options=b=>({bytes:b.length,sha256:sha(b),validateGeoJson:true});

test('correct numeric-key wrapper reconstructs expected bytes',()=>{const b=fixture();assert.deepEqual(reconstructWrapper(wrapper(b),options(b)),b)});
test('missing index fails',()=>{const b=fixture(),w=wrapper(b);delete w['1'];assert.throws(()=>reconstructWrapper(w,options(b)),/PROPERTY_COUNT|MISSING_INDEX/)});
test('extra key fails',()=>{const b=fixture(),w=wrapper(b);w[String(b.length)]=0;assert.throws(()=>reconstructWrapper(w,options(b)),/PROPERTY_COUNT/)});
test('nonnumeric key fails',()=>{const b=fixture(),w=wrapper(b);delete w['1'];w.nope=1;assert.throws(()=>reconstructWrapper(w,options(b)),/NONNUMERIC/)});
test('negative or out-of-range index fails',()=>{const b=fixture(),w=wrapper(b);delete w['1'];w['-1']=1;assert.throws(()=>reconstructWrapper(w,options(b)),/NONNUMERIC|OUT_OF_RANGE/)});
test('byte value outside 0..255 fails',()=>{const b=fixture(),w=wrapper(b);w['1']=256;assert.throws(()=>reconstructWrapper(w,options(b)),/INVALID_BYTE/)});
test('wrong reconstructed length fails',()=>{const b=fixture();assert.throws(()=>reconstructWrapper(wrapper(b),{...options(b),bytes:b.length+1}),/PROPERTY_COUNT|LENGTH/)});
test('wrong final hash fails',()=>{const b=fixture();assert.throws(()=>reconstructWrapper(wrapper(b),{...options(b),sha256:'0'.repeat(64)}),/SHA256/)});
test('Buffer raw-write helper remains byte-identical',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'lp191-')),p=path.join(d,'b');try{const b=Buffer.from([0,255,10]);writeBytes(p,b);assert.deepEqual(fs.readFileSync(p),b)}finally{fs.rmSync(d,{recursive:true,force:true})}});
test('Uint8Array raw-write helper remains byte-identical',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'lp191-')),p=path.join(d,'u');try{const b=new Uint8Array([1,2,254]);writeBytes(p,b);assert.deepEqual(fs.readFileSync(p),Buffer.from(b))}finally{fs.rmSync(d,{recursive:true,force:true})}});
test('structured report JSON remains deterministic',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'lp191-')),a=path.join(d,'a'),b=path.join(d,'b');try{writeCanonicalJson(a,{z:1,a:{d:2,c:3}});writeCanonicalJson(b,{a:{c:3,d:2},z:1});assert.deepEqual(fs.readFileSync(a),fs.readFileSync(b));assert.throws(()=>writeCanonicalJson(a,Buffer.from('x')),/REJECTS_BYTES/)}finally{fs.rmSync(d,{recursive:true,force:true})}});
test('post-write drift is detected and guarded recovery writes exact fixture bytes',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'lp191-')),p=path.join(d,'artifact');try{const b=fixture(),raw=Buffer.from(JSON.stringify(wrapper(b)));fs.writeFileSync(p,raw);const result=recoverWrapperFile(p,{wrapperIdentity:{bytes:raw.length,sha256:sha(raw)},recoveredIdentity:options(b)});assert.equal(result.mode,'RECOVER');assert.deepEqual(fs.readFileSync(p),b);verifyWrittenGeoJson(p,b);fs.appendFileSync(p,' ');assert.throws(()=>verifyWrittenGeoJson(p,b),/POST_WRITE_IDENTITY_MISMATCH/)}finally{fs.rmSync(d,{recursive:true,force:true})}});
