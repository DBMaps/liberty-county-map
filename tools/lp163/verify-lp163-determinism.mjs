#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { buildReports, serialize, writeAll } from './certify-statewide-destination-routing.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
export function compareBytes(path,expected,actual){if(expected.equals(actual))return null;let first=0;while(first<expected.length&&first<actual.length&&expected[first]===actual[first])first++;return {path,expectedSha256:hash(expected),actualSha256:hash(actual),firstDifferingByte:first,expectedLength:expected.length,actualLength:actual.length};}
export function verifyDeterminism(){const a=mkdtempSync(join(tmpdir(),'gridly-lp163-a-')),b=mkdtempSync(join(tmpdir(),'gridly-lp163-b-'));try{writeAll(a);writeAll(b);const mismatches=[];for(const p of Object.keys(buildReports())){const one=readFileSync(join(a,p)),two=readFileSync(join(b,p));const mismatch=compareBytes(p,one,two);if(mismatch)mismatches.push(mismatch);const governed=readFileSync(join(ROOT,p));const repositoryMismatch=compareBytes(p,one,governed);if(repositoryMismatch)mismatches.push({...repositoryMismatch,comparison:'generated-to-governed'});if(one.includes(13))mismatches.push({path:p,reason:'CR byte violates canonical LF'});}if(mismatches.length)throw new Error(`LP163 deterministic mismatch:\n${serialize(mismatches)}`);return {milestone:'LP163',generatedAt:'1970-01-01T00:00:00.000Z',runsCompared:2,governedArtifactsCompared:Object.keys(buildReports()).length,canonicalLf:true,protectedArtifactsUnchanged:true,repositoryArtifactsRewritten:false,status:'PASS'};}finally{rmSync(a,{recursive:true,force:true});rmSync(b,{recursive:true,force:true});}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(serialize(verifyDeterminism()));}catch(e){console.error(e.message);process.exitCode=1;}}
