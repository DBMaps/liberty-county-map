// Synthetic-only writer. The real owner candidate cannot be written by this tool.
import {lstat,readFile,mkdir,writeFile,rename,rm,realpath} from 'node:fs/promises';
import {isAbsolute,dirname,join,resolve,parse} from 'node:path';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {composeProductionRuntimeConfig} from '../lp1831/prepare-cloudflare-preview-artifact.mjs';
import {PROFILE,requireSyntheticProviders,validateProviderPair} from './contracts.mjs';
const fail=code=>{throw Error(code);};

export async function assertPlainPath(path,{mustExist=true}={}) {
  if(typeof path!=='string'||!isAbsolute(path)||/[\u0000-\u001f]/.test(path)||/(^|[\\/])(OneDrive[^\\/]*|Dropbox|Google Drive|GoogleDrive|iCloudDrive|Box)([\\/]|$)/i.test(path))fail('MAINTENANCE_PATH_UNSAFE');
  const target=resolve(path);let current=target;
  while(true){
    try {const entry=await lstat(current);if(entry.isSymbolicLink())fail('MAINTENANCE_PATH_UNSAFE');}
    catch(error){if(error.code!=='ENOENT')fail('MAINTENANCE_PATH_UNSAFE');if(current===target&&mustExist)fail('MAINTENANCE_INPUT_MISSING');}
    const parent=dirname(current);if(parent===current)break;current=parent;
  }
  if(mustExist){const actual=await realpath(target);if(actual.toLowerCase()!==target.toLowerCase())fail('MAINTENANCE_PATH_UNSAFE');}
  return target;
}
export async function assertOutsideRepository(path) {
  let current=resolve(path);
  while(true){try {await lstat(join(current,'.git'));fail('MAINTENANCE_OUTPUT_REPOSITORY_FORBIDDEN');}catch(e){if(e.message==='MAINTENANCE_OUTPUT_REPOSITORY_FORBIDDEN')throw e;if(e.code!=='ENOENT')fail('MAINTENANCE_PATH_UNSAFE');}
    const parent=dirname(current);if(parent===current)break;current=parent;}
}
export async function assertMaintenanceOutput({repositoryRoot,outputDirectory,requireNew=true}) {
  const root=resolve(repositoryRoot),output=await assertPlainPath(outputDirectory,{mustExist:false});
  if(output!==join(root,'www'))fail('MAINTENANCE_OUTPUT_NOT_NATIVE_WEB_DIR');
  try {
    if(execFileSync('git',['ls-files','--','www'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim())fail('FAIL');
    execFileSync('git',['check-ignore','--quiet','--','www/js/gridlyRuntimeEnvironmentConfig.js'],{cwd:root,stdio:'ignore'});
  }catch{fail('MAINTENANCE_OUTPUT_NOT_PRIVATE_IGNORED');}
  if(requireNew){try{await lstat(output);fail('MAINTENANCE_OUTPUT_EXISTS');}catch(e){if(e.message==='MAINTENANCE_OUTPUT_EXISTS')throw e;if(e.code!=='ENOENT')fail('MAINTENANCE_PATH_UNSAFE');}}
  return output;
}
export async function readMaintenanceProviderInputs({candidateFile,originalFile,verifyPrivateFile}) {
  if(!candidateFile||!originalFile||typeof verifyPrivateFile!=='function')fail('MAINTENANCE_EXPLICIT_PRIVATE_INPUTS_REQUIRED');
  const candidate=await assertPlainPath(candidateFile),original=await assertPlainPath(originalFile);
  await assertOutsideRepository(candidate);
  if(candidate.toLowerCase()===original.toLowerCase())fail('MAINTENANCE_CANDIDATE_EQUALS_ORIGINAL');
  // A filesystem/ACL attestation is required, never inferred from a callback's absence.
  if(await verifyPrivateFile(candidate)!==true)fail('MAINTENANCE_PRIVATE_INPUT_NOT_VERIFIED');
  let candidateBytes,originalBytes;
  try {candidateBytes=await readFile(candidate);originalBytes=await readFile(original);validateProviderPair({originalBytes,candidateBytes});}
  catch{fail('MAINTENANCE_PRIVATE_INPUT_INVALID');}
  return {candidateBytes,originalBytes}; // Private process memory only; callers must not log.
}
export function composeMaintenanceRuntime({canonicalBytes,originalBytes,candidateBytes,profile}) {
  if(profile!==PROFILE)fail('MAINTENANCE_PROFILE_REQUIRED');
  validateProviderPair({originalBytes,candidateBytes});
  try {return composeProductionRuntimeConfig(canonicalBytes,candidateBytes);}catch{fail('MAINTENANCE_RUNTIME_COMPOSITION_FAILED');}
}
export function verifyMaintenanceRuntime({runtimeBytes,canonicalBytes,originalBytes,candidateBytes}) {
  validateProviderPair({originalBytes,candidateBytes});
  try {
    const expected=composeProductionRuntimeConfig(canonicalBytes,candidateBytes);
    if(!Buffer.from(runtimeBytes).equals(expected))fail('FAIL');
    const sandbox={window:{}};vm.runInNewContext(expected.toString('utf8'),sandbox,{timeout:500});
    const candidate=JSON.parse(candidateBytes),original=JSON.parse(originalBytes);
    if(sandbox.window.GRIDLY_RUNTIME_CONFIG.arcgisStaticBasemapApiKey!==candidate.arcgisStaticBasemapApiKey||sandbox.window.GRIDLY_CONFIG.driveTexas.apiKey!==original.driveTexas.apiKey)fail('FAIL');
    return Object.freeze({status:'PASS',arcgisCandidateMatch:true,driveTexasParity:true,canonicalUnrelatedSettingsPreserved:true});
  }catch{fail('MAINTENANCE_RUNTIME_VERIFICATION_FAILED');}
}
export async function stageSyntheticMaintenanceRuntime(options) {
  if(options?.mode!=='SYNTHETIC_PREPARATION_ONLY'||options.profile!==PROFILE)fail('MAINTENANCE_SYNTHETIC_MODE_REQUIRED');
  const {candidateBytes,originalBytes}=await readMaintenanceProviderInputs(options);
  requireSyntheticProviders({candidateBytes,originalBytes});
  const output=await assertPlainPath(options.outputDirectory,{mustExist:false});await assertOutsideRepository(output);
  if(parse(output).root===output)fail('MAINTENANCE_PATH_UNSAFE');
  // Refuse pre-existing output instead of deleting, replacing or merging it.
  try {await lstat(output);fail('MAINTENANCE_OUTPUT_EXISTS');}catch(e){if(e.message==='MAINTENANCE_OUTPUT_EXISTS')throw e;if(e.code!=='ENOENT')fail('MAINTENANCE_PATH_UNSAFE');}
  const runtime=composeMaintenanceRuntime({...options,candidateBytes,originalBytes});
  const result=verifyMaintenanceRuntime({...options,runtimeBytes:runtime,candidateBytes,originalBytes});
  await mkdir(output,{recursive:false});
  const pending=join(output,'.runtime-'+randomUUID()+'.tmp'),destination=join(output,'gridlyRuntimeEnvironmentConfig.js');
  try {await writeFile(pending,runtime,{flag:'wx',mode:0o600});await rename(pending,destination);}
  catch{fail('MAINTENANCE_SYNTHETIC_WRITE_FAILED');}
  finally {await rm(pending,{force:true}).catch(()=>{});}
  return Object.freeze({...result,mode:'SYNTHETIC_PREPARATION_ONLY',nativeAssetsWritten:false,realCredentialAllowed:false});
}
