#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_DIRECTORY, certificateFor, selectGovernedCounties, validateRuntimeCertificate } from '../lp107/generate-runtime-certificates.mjs';
import { atomicJson, BUCKET, credentialHeaders, objectPaths, redact, stableDigest } from './lp108-core.mjs';
export { credentialHeaders } from './lp108-core.mjs';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT = join(ROOT, 'reports/lp108');
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 120000;

export function parseArguments(argv) { const o = {};
  for (let i=0;i<argv.length;i++) { const a=argv[i]; if (a==='--plan') o.plan=true; else if(a==='--verify-remote') o.verifyRemote=true; else if(a==='--upload') o.upload=true; else if(a==='--replace-mismatched') o.replaceMismatched=true; else if(a==='--county-fips') o.countyFips=argv[++i]; else throw new Error(`unknown option: ${a}`); }
  if(o.replaceMismatched&&!o.upload) throw new Error('--replace-mismatched requires --upload'); if (!o.plan && !o.verifyRemote && !o.upload) throw new Error('select --plan, --verify-remote, or --upload'); if(o.plan&&(o.upload||o.verifyRemote)) throw new Error('--plan cannot perform remote actions'); return o; }
export const credentials = env => { const url=env.SUPABASE_URL || env.GRIDLY_SUPABASE_URL; const key=env.SUPABASE_SERVICE_ROLE_KEY; if(!url||!key) throw new Error('REMOTE EXECUTION NOT COMPLETED: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'); return {url:url.replace(/\/$/,''),key}; };
export const storageObjectPath = (bucket, objectPath) =>
  `object/authenticated/${encodeURIComponent(bucket)}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;

export async function storageRequest(auth, path, init={}, hooks={}) {
  const fetchImpl=hooks.fetchImpl||fetch;
  const attempts=hooks.attempts??3;
  for(let n=0;n<attempts;n++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),hooks.timeoutMs??DEFAULT_REQUEST_TIMEOUT_MS);
    try {
      const r=await fetchImpl(`${auth.url}/storage/v1/${path}`,{...init,headers:{...credentialHeaders(auth.key),...init.headers},signal:controller.signal});
      if(r.status<500||n===attempts-1)return r;
    } catch(error) {
      if(n===attempts-1){
        error.lp108Attempts=attempts;
        error.lp108Failure=error?.name==='AbortError'?'timeout':'network';
        throw error;
      }
    } finally { clearTimeout(timer); }
    await new Promise(x=>setTimeout(x,200*(n+1)));
  }
}

function errorEvidence(text) {
  let parsed;
  try { parsed=JSON.parse(text); } catch {}
  const values=[];
  const visit=value=>{if(typeof value==='string'||typeof value==='number')values.push(String(value));else if(value&&typeof value==='object')for(const key of ['error','message','statusCode','status','code'])if(key in value)visit(value[key]);};
  visit(parsed); if(!parsed&&text)values.push(text);
  return values.join(' | ').slice(0,512);
}
export function isDefinitiveStorageNotFound(status, body='') {
  if(status!==400&&status!==404)return false;
  const evidence=errorEvidence(body).toLowerCase();
  return /(?:object|resource|key|file)\s*(?:is\s*)?not[ _-]?found|not[ _-]?found\s*(?:object|resource|key|file)|nosuchkey|no such (?:object|key)|\b404\b/.test(evidence);
}
const safeDiagnostic=(status,body,operation='download')=>redact(`Storage ${operation} failed (${status})${errorEvidence(body)?`: ${errorEvidence(body)}`:''}`).slice(0,320);

export async function verifyRemoteObject(auth, objectPath, expected, hooks={}) {
  let response;
  try { response=await storageRequest(auth,storageObjectPath(hooks.bucket||BUCKET,objectPath),{method:'GET'},hooks); }
  catch(error){return {status:'inaccessible',diagnostic:redact(error?.name==='AbortError'?'Storage download timed out':`Storage download network failure: ${error?.message||'unknown error'}`).slice(0,320)};}
  if(!response||typeof response.ok!=='boolean'||typeof response.status!=='number')return {status:'inaccessible',diagnostic:'Storage download returned a malformed response'};
  if(!response.ok){let body='';try{body=await response.text();}catch{return {status:'inaccessible',diagnostic:`Storage download error body was unreadable (${response.status})`};}return isDefinitiveStorageNotFound(response.status,body)?{status:'missing'}:{status:'inaccessible',diagnostic:safeDiagnostic(response.status,body)};}
  let bytes;
  try { bytes=Buffer.from(await response.arrayBuffer()); }
  catch { return {status:'unverifiable',diagnostic:'Storage object responded successfully but usable bytes were unavailable'}; }
  const actualSizeBytes=bytes.byteLength, actualSha256=createHash('sha256').update(bytes).digest('hex');
  const status=actualSizeBytes===expected.sizeBytes&&actualSha256===expected.sha256?'matching':'mismatched';
  return {status,actualSizeBytes,actualSha256};
}
export async function syncRemoteObject(auth, objectPath, expected, bytes, contentType, options={}, hooks={}) {
  const current=await verifyRemoteObject(auth,objectPath,expected,hooks);
  const eligible=current.status==='missing'||(current.status==='mismatched'&&options.replaceMismatched);
  if(!eligible)return {...current,uploaded:false};
  let response;
  const uploadHooks={...hooks,timeoutMs:hooks.uploadTimeoutMs??DEFAULT_UPLOAD_TIMEOUT_MS};
  try { response=await storageRequest(auth,`object/${hooks.bucket||BUCKET}/${objectPath}`,{method:current.status==='missing'?'POST':'PUT',headers:{'content-type':contentType,'x-upsert':current.status==='missing'?'false':'true','x-metadata':JSON.stringify({sha256:expected.sha256})},body:bytes},uploadHooks); }
  catch(error){const reason=error?.lp108Failure==='timeout'?'timed out':'network failure';return {status:'upload_failed',uploaded:false,diagnostic:redact(`Storage upload ${reason} after ${error?.lp108Attempts??1} attempt(s): ${error?.message||'unknown error'}`).slice(0,320)};}
  if(!response||typeof response.ok!=='boolean'||!response.ok){let body='';try{body=await response?.text?.()||'';}catch{}return {status:'upload_failed',uploaded:false,diagnostic:safeDiagnostic(response?.status??'unknown',body,'upload')};}
  const verified=await verifyRemoteObject(auth,objectPath,expected,hooks);
  return {...verified,uploaded:true};
}
export async function run(options, hooks={}) {
  const packageDirectory=options.packageDirectory || PACKAGE_DIRECTORY;
  const manifest=JSON.parse(await readFile(join(ROOT,'data/lp104/texas-counties.json'),'utf8')); let counties=selectGovernedCounties(manifest); if(options.countyFips){counties=counties.filter(x=>x.fips===options.countyFips);if(counties.length!==1)throw new Error('county FIPS is not governed');}
  const local=[]; for(const county of counties){ const stem=`${county.slug}-${county.fips}`, pkg=join(packageDirectory,`${stem}.addresses.jsonl.gz`), cert=join(packageDirectory,`${stem}.runtime-certificate.json`); const digest=await stableDigest(pkg).catch(e=>{throw new Error(`required local package missing or unstable: ${county.fips}: ${e.message}`)}); const certificate=JSON.parse(await readFile(cert,'utf8').catch(()=>{throw new Error(`required local certificate missing: ${county.fips}`)})); const expected=certificateFor(county,`${stem}.addresses.jsonl.gz`,digest.sizeBytes,digest.sha256); const failures=validateRuntimeCertificate(certificate,expected); if(failures.length)throw new Error(`${county.fips}: ${failures.join('; ')}`); local.push({countySlug:county.slug,countyFips:county.fips,...objectPaths(county),packageSizeBytes:digest.sizeBytes,packageSha256:digest.sha256,certificateSha256:(await import('node:crypto')).createHash('sha256').update(await readFile(cert)).digest('hex'),paths:{pkg,cert}}); }
  const report={schemaVersion:'gridly-lp108-storage-v1',mode:options.plan?'plan':options.upload?'upload':'verify-remote',evidence:options.plan?'local-only':'remote Storage verification attempted',bucket:BUCKET,totals:{counties:local.length,localPackagesValid:local.length,localCertificatesValid:local.length,expectedObjects:local.length*2,present:0,matching:0,missing:0,mismatched:0,inaccessible:0,unverifiable:0,uploaded:0},objects:[]};
  if(options.plan){report.objects=local.flatMap(x=>[{countyFips:x.countyFips,path:x.package,status:'planned'},{countyFips:x.countyFips,path:x.certificate,status:'planned'}]); await atomicJson(join(REPORT,'storage-plan.json'),report); return report;}
  const auth=credentials(hooks.env||process.env); const requestHooks={fetchImpl:hooks.fetchImpl,timeoutMs:hooks.timeoutMs,uploadTimeoutMs:hooks.uploadTimeoutMs,attempts:hooks.attempts}; const bucket=await storageRequest(auth,'bucket/'+BUCKET,{},requestHooks); if(!bucket.ok)throw new Error(`Storage target ambiguous or inaccessible (${bucket.status})`);
  for(const item of local) for(const kind of ['package','certificate']) { const path=item[kind], localPath=item.paths[kind==='package'?'pkg':'cert']; const expectedSize=kind==='package'?item.packageSizeBytes:(await readFile(localPath)).byteLength; let status,metadata={};
    if(!options.upload){const result=await verifyRemoteObject(auth,path,{sizeBytes:expectedSize,sha256:kind==='package'?item.packageSha256:item.certificateSha256},requestHooks);status=result.status;metadata=result;}
    else {const bytes=await readFile(localPath);metadata=await syncRemoteObject(auth,path,{sizeBytes:expectedSize,sha256:kind==='package'?item.packageSha256:item.certificateSha256},bytes,kind==='package'?'application/gzip':'application/json',options,requestHooks);status=metadata.status;if(metadata.uploaded)report.totals.uploaded++;}
    report.objects.push({countyFips:item.countyFips,path,kind,status,...(metadata.uploaded===undefined?{}:{uploaded:metadata.uploaded}),...(metadata.actualSizeBytes===undefined?{}:{actualSizeBytes:metadata.actualSizeBytes,actualSha256:metadata.actualSha256}),...(metadata.diagnostic?{diagnostic:metadata.diagnostic}:{})}); if(status==='matching'){report.totals.present++;report.totals.matching++;} else if(status==='missing')report.totals.missing++; else if(status==='mismatched')report.totals.mismatched++; else if(status==='unverifiable')report.totals.unverifiable++; else report.totals.inaccessible++;
  }
  await atomicJson(join(REPORT,'storage-verification.json'),report);
  if(options.upload)await atomicJson(join(REPORT,'storage-upload.json'),report);
  if(report.objects.some(x=>x.status!=='matching'))throw Object.assign(new Error('remote objects are missing, mismatched, inaccessible, or unverifiable'),{report}); return report;
}
export async function main(argv=process.argv.slice(2)){try{const r=await run(parseArguments(argv));console.log(`LP108 Storage: ${r.totals.matching}/${r.totals.expectedObjects} matching; ${r.totals.missing} missing.`)}catch(e){console.error(redact(e.message));process.exitCode=1;}}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
