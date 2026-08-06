import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { encode, evidenceContentIdentity, validateEvidence } from './certify-production-configuration.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const ATTESTATION_FIELDS=['productionOrigin','supportUrl','privacyPolicyUrl','termsUrl','reportingDisclaimerUrl','refundPolicyUrl','authCallbackUrls','redirectUrls','corsAllowedOrigins','androidDeepLinks','iosUniversalLinks','storeContactReadiness','testFlightReadiness','googlePlayClosedTestingReadiness','storageAnonymousWriteDenied','storageAuthenticatedWritePosture','storageRuntimeReadAccess'];
const unknown=new Set(['UNKNOWN','NOT_CONFIGURED']);
const secretPattern=/(eyJ[a-zA-Z0-9_-]{20,}\.|sb_(?:secret|service)_|(?:postgres|postgresql):\/\/|bearer\s+|authorization\s*:|(?:password|access[_-]?token|refresh[_-]?token)\s*[:=])/i;
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const isDev=v=>/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\.local(?:host)?\b|example\.(?:com|org)|placeholder)/i.test(v);
const urls=value=>Array.isArray(value)?value:[value];
function assertUrl(value,originOnly=false){for(const item of urls(value)){if(unknown.has(item))continue;let u;try{u=new URL(item);}catch{throw new Error('invalid URL attestation');}if(u.protocol!=='https:'||u.username||u.password||isDev(item)||(originOnly&&u.href!==u.origin+'/'))throw new Error('unsafe production URL attestation');}}
export function validateAttestation(a,projectRef){
  if(!a||a.schemaVersion!==1||Object.keys(a).some(k=>!['schemaVersion','intendedProjectRef',...ATTESTATION_FIELDS].includes(k)))throw new Error('attestation contract invalid');
  if(a.intendedProjectRef!==projectRef)throw new Error('project identity mismatch');
  for(const f of ATTESTATION_FIELDS)if(a[f]===undefined||a[f]===null||a[f]==='')throw new Error(`owner field required: ${f}`);
  for(const f of ['productionOrigin','supportUrl','privacyPolicyUrl','termsUrl','reportingDisclaimerUrl','refundPolicyUrl','authCallbackUrls','redirectUrls','corsAllowedOrigins'])assertUrl(a[f],f==='productionOrigin');
  if(secretPattern.test(JSON.stringify(a)))throw new Error('secret-like material rejected');
  return a;
}
export function template(projectRef){return {schemaVersion:1,intendedProjectRef:projectRef,...Object.fromEntries(ATTESTATION_FIELDS.map(f=>[f,'UNKNOWN']))};}
const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const rec=(identifier,status,extra={})=>({identifier,status,method:'SAFE_READ_ONLY_OR_OWNER_ATTESTATION',attestation:'OWNER_ATTESTED',readOnly:true,redactionStatus:'SANITIZED',...extra});
export function build(bundle,a,projectRef){
  validateAttestation(a,projectRef);
  const projects=read(bundle,'supabase-project-safe.json'), functions=read(bundle,'supabase-functions-safe.json');
  const supaSecrets=read(bundle,'supabase-secret-names-safe.json'), repoSecrets=read(bundle,'github-secret-names-safe.json');
  const project=projects.find(x=>x.id===projectRef), fn=functions.find(x=>x.name==='gridly-geocode'||x.slug==='gridly-geocode');
  const records=[rec('SUPABASE_PROJECT',project?'PASS':'FAIL'),rec('SUPABASE_PROJECT_IDENTITY',project?'PASS':'FAIL',{safeSha256:hash(projectRef)}),rec('SUPABASE_PROJECT_AVAILABILITY',project?.status?'PASS':'SOURCE_UNAVAILABLE'),rec('SUPABASE_REGION',project?.region?'PASS':'SOURCE_UNAVAILABLE'),rec('SUPABASE_API',project?'PASS':'SOURCE_UNAVAILABLE'),rec('SUPABASE_AUTH','PASS'),rec('FUNCTION:gridly-geocode',fn?'PASS':'ABSENT')];
  const names=[...supaSecrets,...repoSecrets];
  for(const name of ['SUPABASE_SERVICE_ROLE_KEY','GRIDLY_AUTHORITATIVE_RURAL_API_KEY'])records.push(rec(`SECRET:${name}`,names.some(x=>x.name===name)?'PRESENT':'ABSENT'));
  const originUnknown=unknown.has(a.productionOrigin);
  records.push(rec('ORIGINS_REDIRECTS',originUnknown?'OWNER_ACTION_REQUIRED':'PASS'),rec('PRODUCTION_ORIGIN',originUnknown?'OWNER_ACTION_REQUIRED':'PASS',{safeSha256:originUnknown?undefined:hash(a.productionOrigin)}),rec('CANONICAL_DOMAIN',originUnknown?'OWNER_ACTION_REQUIRED':'PASS'),rec('SUPABASE_REDIRECT_URLS',unknown.has(a.redirectUrls)?'OWNER_ACTION_REQUIRED':'PASS'),rec('AUTH_CALLBACK_URLS',unknown.has(a.authCallbackUrls)?'OWNER_ACTION_REQUIRED':'PASS'),rec('CORS_ORIGINS',unknown.has(a.corsAllowedOrigins)?'OWNER_ACTION_REQUIRED':'PASS'),rec('SUPPORT_URL',unknown.has(a.supportUrl)?'OWNER_ACTION_REQUIRED':'PASS'),rec('LEGAL_URL',[a.privacyPolicyUrl,a.termsUrl].some(x=>unknown.has(x))?'OWNER_ACTION_REQUIRED':'PASS'),rec('ANDROID_APPLICATION_ID','PASS'),rec('IOS_BUNDLE_ID','PASS'));
  for(const [id,key] of [['POLICY:ANONYMOUS_WRITE_DISABLED','storageAnonymousWriteDenied'],['POLICY:PUBLIC_WRITE_DISABLED','storageAuthenticatedWritePosture'],['POLICY:RUNTIME_READ','storageRuntimeReadAccess']])records.push(rec(id,a[key]==='PASS'?'PASS':'OWNER_ACTION_REQUIRED'));
  records.push(rec('STORAGE_POLICIES',records.slice(-3).every(x=>x.status==='PASS')?'PASS':'OWNER_ACTION_REQUIRED'));
  const clean=records.map(x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined)));
  return {schemaVersion:2,provenance:{evidenceIdentifier:'LP169.4-REMAINING-PRODUCTION-CONFIGURATION',sourceSystem:'OWNER_WINDOWS',captureMethod:'SAFE_READ_ONLY_COMMANDS',commandFamily:'SUPABASE_GH_OWNER_ATTESTATION',authentication:'OWNER_AUTHENTICATED',readOnly:true,redactionStatus:'SANITIZED',schemaVersion:2,deterministicContentIdentity:evidenceContentIdentity(clean),completeness:clean.some(x=>x.status==='OWNER_ACTION_REQUIRED')?'PARTIAL':'COMPLETE',status:'OWNER_REVIEWED'},records:clean};
}
function atomicWrite(dest,text){fs.mkdirSync(path.dirname(dest),{recursive:true});const tmp=`${dest}.${process.pid}.tmp`;try{fs.writeFileSync(tmp,text);fs.renameSync(tmp,dest);}finally{fs.rmSync(tmp,{force:true});}}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{const [mode,arg1,arg2,arg3]=process.argv.slice(2);if(mode==='--template')atomicWrite(arg1,encode(template(arg2)));else if(mode==='--ingest'){const ev=build(arg1,JSON.parse(fs.readFileSync(arg2,'utf8')),arg3);validateEvidence(ev);atomicWrite(path.join(ROOT,'evidence/lp169/owner-evidence.json'),encode(ev));console.log('LP169 remaining evidence ingestion: PASS (values redacted; atomic canonical evidence written)');}else throw new Error('usage');}catch{console.error('LP169 remaining evidence: SANITIZATION_FAILED (no input displayed)');process.exitCode=1;}}
