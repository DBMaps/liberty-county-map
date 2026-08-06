#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReports, serialize, writeAll } from './certify-statewide-notifications.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
export function compareBytes(path,expected,actual){if(expected.equals(actual))return null;let first=0;while(first<expected.length&&first<actual.length&&expected[first]===actual[first])first++;return {path,expectedSha256:hash(expected),actualSha256:hash(actual),firstDifferingByte:first,expectedLength:expected.length,actualLength:actual.length};}
export function verifyDeterminism(){const before=new Map(Object.keys(buildReports()).map(p=>[p,readFileSync(join(ROOT,p))]));const a=mkdtempSync(join(tmpdir(),'gridly-lp165-a-')),b=mkdtempSync(join(tmpdir(),'gridly-lp165-b-'));try{writeAll(a);writeAll(b);const mismatches=[];for(const p of Object.keys(buildReports())){const one=readFileSync(join(a,p)),two=readFileSync(join(b,p)),governed=before.get(p);for(const [actual,comparison] of [[two,'isolated-runs'],[governed,'generated-to-governed']]){const mismatch=compareBytes(p,one,actual);if(mismatch)mismatches.push({...mismatch,comparison});}if(one.includes(13))mismatches.push({path:p,reason:'CR byte violates canonical LF'});}for(const [p,bytes] of before)if(!readFileSync(join(ROOT,p)).equals(bytes))mismatches.push({path:p,reason:'read-only verification rewrote repository report'});if(mismatches.length)throw new Error(`LP165 deterministic mismatch:\n${serialize(mismatches)}`);return {milestone:'LP165',generatedAt:'1970-01-01T00:00:00.000Z',runsCompared:2,governedArtifactsCompared:before.size,canonicalLf:true,protectedArtifactsUnchanged:true,repositoryArtifactsRewritten:false,mutableStateLeakage:false,status:'PASS'};}finally{rmSync(a,{recursive:true,force:true});rmSync(b,{recursive:true,force:true});}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(serialize(verifyDeterminism()));}catch(e){console.error(e.message);process.exitCode=1;}}
