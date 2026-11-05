// Preparation contracts only. No file writes, provider requests or native actions.
import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';

export const PROFILE = 'arcgis-satellite-labels-2026-11';
export const RELEASES = Object.freeze({android:'86bf721ddaf5b85e8786b1d74da240a048c98f96',ios:'71168111a133fa1c187620b9604b08e79fbf4687'});
const GRADLE_SHA = 'e12c6c590596db8038082a628c0e2eb08580004921d92f546d2f57391c5583ff';
const PROJECT_SHA = 'aeb3b7be181bf78b82413e93baced0c28009d9caf91363251903168fead66e74';
const RECOVERY_SHA = '39b30db849d336e9fc327827eb98413f15f16741e1dced470b9f327a6b84a97f';
const fail = code => {throw Error(code);};
const normalized = value => {if(typeof value !== 'string')fail('MAINTENANCE_SOURCE_INVALID');return value.replaceAll('\r\n','\n');};
const sha = text => createHash('sha256').update(text).digest('hex');
const once = (text,from,to) => {if(text.split(from).length!==2)fail('MAINTENANCE_SOURCE_DRIFT');return text.replace(from,to);};

export function deriveAndroidMaintenanceMetadata(released) {
  const text=normalized(released);
  if(sha(text)!==GRADLE_SHA)fail('MAINTENANCE_ANDROID_BASELINE_DRIFT');
  return once(once(text,'versionCode 16','versionCode 17'),"versionName '1.0.1'","versionName '1.0.2'");
}
export function maintenanceAndroidIdentity(metadata,profile) {
  if(profile!==PROFILE)fail('MAINTENANCE_PROFILE_REQUIRED');
  const text=normalized(metadata);
  const released=once(once(text,'versionCode 17','versionCode 16'),"versionName '1.0.2'","versionName '1.0.1'");
  if(sha(released)!==GRADLE_SHA)fail('MAINTENANCE_ANDROID_IDENTITY_INVALID');
  return Object.freeze({applicationId:'com.gridlygo.gridly',versionName:'1.0.2',versionCode:'17',
    maintenanceProfile:PROFILE,releasedVersionCode:'16',reviewerAuthorization:'UNVERIFIED_NOT_GRANTED'});
}
export function deriveIosMaintenanceInputs({project,recovery}) {
  const p=normalized(project),r=normalized(recovery);
  if(sha(p)!==PROJECT_SHA||sha(r)!==RECOVERY_SHA)fail('MAINTENANCE_IOS_BASELINE_DRIFT');
  if((p.match(/CURRENT_PROJECT_VERSION = 17;/g)||[]).length!==2||(p.match(/MARKETING_VERSION = 1\.0\.1;/g)||[]).length!==2)fail('MAINTENANCE_IOS_IDENTITY_INVALID');
  return Object.freeze({project:p.replaceAll('CURRENT_PROJECT_VERSION = 17;','CURRENT_PROJECT_VERSION = 18;').replaceAll('MARKETING_VERSION = 1.0.1;','MARKETING_VERSION = 1.0.2;'),
    recovery:once(r,'return ["14", "16", "17"].contains(buildNumber)','return ["14", "16", "17", "18"].contains(buildNumber)'),
    build:'18',marketingVersion:'1.0.2',availability:'PROVISIONAL_NOT_RESERVED'});
}
export function maintenanceIosIdentity({project,recovery,profile}) {
  if(profile!==PROFILE)fail('MAINTENANCE_PROFILE_REQUIRED');
  const p=normalized(project),r=normalized(recovery);
  if((p.match(/CURRENT_PROJECT_VERSION = 18;/g)||[]).length!==2||(p.match(/MARKETING_VERSION = 1\.0\.2;/g)||[]).length!==2)fail('MAINTENANCE_IOS_IDENTITY_INVALID');
  const releasedProject=p.replaceAll('CURRENT_PROJECT_VERSION = 18;','CURRENT_PROJECT_VERSION = 17;').replaceAll('MARKETING_VERSION = 1.0.2;','MARKETING_VERSION = 1.0.1;');
  const releasedRecovery=once(r,'return ["14", "16", "17", "18"].contains(buildNumber)','return ["14", "16", "17"].contains(buildNumber)');
  if(sha(releasedProject)!==PROJECT_SHA||sha(releasedRecovery)!==RECOVERY_SHA)fail('MAINTENANCE_IOS_BASELINE_DRIFT');
  return Object.freeze({bundleIdentifier:'com.gridlygo.gridly',build:'18',marketingVersion:'1.0.2',maintenanceProfile:PROFILE,availability:'PROVISIONAL_NOT_RESERVED'});
}

function provider(bytes) {
  let value, text;
  try {text=Buffer.isBuffer(bytes)?bytes.toString('utf8'):String(bytes);value=JSON.parse(text);}catch{fail('MAINTENANCE_PROVIDER_SCHEMA_INVALID');}
  if(!value||Array.isArray(value)||Object.keys(value).sort().join(',')!=='arcgisStaticBasemapApiKey,driveTexas'||
    !value.driveTexas||Array.isArray(value.driveTexas)||Object.keys(value.driveTexas).join(',')!=='apiKey')fail('MAINTENANCE_PROVIDER_SCHEMA_INVALID');
  const properties=[...text.matchAll(/("(?:[^"\\]|\\.)*")\s*:/g)].map(match=>match[1]);
  if(properties.length!==3||properties.some(name=>!['"arcgisStaticBasemapApiKey"','"driveTexas"','"apiKey"'].includes(name)))fail('MAINTENANCE_PROVIDER_SCHEMA_INVALID');
  for(const name of ['arcgisStaticBasemapApiKey','driveTexas','apiKey'])if((text.match(new RegExp('"'+name+'"\\s*:','g'))||[]).length!==1)fail('MAINTENANCE_PROVIDER_SCHEMA_INVALID');
  for(const token of [value.arcgisStaticBasemapApiKey,value.driveTexas.apiKey])if(typeof token!=='string'||!token||token!==token.trim()||/[\r\n\u0000-\u001f]/.test(token))fail('MAINTENANCE_PROVIDER_VALUE_INVALID');
  return value;
}
// Digests are keyed with a fresh in-memory key and never returned or recorded.
export function validateProviderPair({originalBytes,candidateBytes}) {
  if(originalBytes===undefined||candidateBytes===undefined)fail('MAINTENANCE_EXPLICIT_INPUTS_REQUIRED');
  const original=provider(originalBytes),candidate=provider(candidateBytes),key=randomBytes(32);
  const digest=value=>createHmac('sha256',key).update(value).digest();
  try {
    if(timingSafeEqual(digest(original.arcgisStaticBasemapApiKey),digest(candidate.arcgisStaticBasemapApiKey)))fail('MAINTENANCE_CANDIDATE_EQUALS_ORIGINAL');
    if(!timingSafeEqual(digest(original.driveTexas.apiKey),digest(candidate.driveTexas.apiKey)))fail('MAINTENANCE_UNRELATED_PROVIDER_CHANGED');
    return Object.freeze({status:'PASS',candidateDiffers:true,driveTexasParity:true,unrelatedProviderParity:true,fingerprintComparison:'PASS_PRIVATE_EPHEMERAL_HMAC'});
  }finally{key.fill(0);}
}
export function requireSyntheticProviders({originalBytes,candidateBytes}) {
  const a=provider(originalBytes),b=provider(candidateBytes);
  for(const token of [a.arcgisStaticBasemapApiKey,b.arcgisStaticBasemapApiKey,a.driveTexas.apiKey,b.driveTexas.apiKey])if(!/^SYNTHETIC_[A-Z0-9_]+$/.test(token))fail('MAINTENANCE_SYNTHETIC_ONLY');
  return validateProviderPair({originalBytes,candidateBytes});
}
