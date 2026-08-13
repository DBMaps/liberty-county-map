#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { governedInputs } from './protected-validation-harness.mjs';
import { stage as stageDeployableRuntime } from '../lp1831/prepare-cloudflare-preview-artifact.mjs';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const CLASSIFICATION='OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION';
export const REPORT='reports/lp18811c/protected-environment-provisioning.json';
export const STATUS='PROTECTED_ENVIRONMENT_OWNER_PROVISIONING_ACTION_REQUIRED';
export const PROTECTED_PAGES_ROUTER='tools/lp18811/protected-pages-router.mjs';
export const PROTECTED_NOT_FOUND_CONTROL='404.html';
export const GEOMETRY_CANONICAL_PATH='assets/location-resolution/gridly-authoritative-county-geometry-v1.json';
export const PROTECTED_GEOMETRY_DESCRIPTOR=Object.freeze({mode:'REMOTE_PUBLIC_IMMUTABLE_OBJECT',url:'https://nhwhkbkludzkuyxmkkcj.supabase.co/storage/v1/object/public/gridly-runtime-geometry/geometry/891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316.json',expectedBytes:47911048,expectedSha256:'891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316',expectedCountyCount:254});
const stable=value=>`${JSON.stringify(value,null,2)}\n`;
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const protectedRuntimeConfig=()=>Buffer.from(`(function () {\n  "use strict";\n  window.GRIDLY_RUNTIME_CONFIG = Object.freeze({\n    authoritativeCountyGeometry: Object.freeze(${JSON.stringify(PROTECTED_GEOMETRY_DESCRIPTOR, null, 6).replace(/^/gm,'    ').trimStart()})\n  });\n})();\n`);

export function cohortIdentity(root=ROOT){
  const governed=governedInputs(root);
  const manifest={schemaVersion:'gridly.lp18811c.protected-cohort.v1',waveId:'LP18810-NP-001',packages:governed.packages.map(({countyFips,relativePackagePath,byteLength,sha256,schemaVersion})=>({countyFips,relativePackagePath,byteLength,sha256,schemaVersion}))};
  return {manifest,buildIdentity:`sha256:${sha(Buffer.from(stable(manifest)))}`};
}

export function buildEvidence(root=ROOT){
  const {buildIdentity}=cohortIdentity(root);
  return {
    schemaVersion:'gridly.lp18811c.protected-environment-provisioning.v1',milestone:'LP188.11C',generatedAt:'1970-01-01T00:00:00.000Z',
    environmentClassification:CLASSIFICATION,waveId:'LP18810-NP-001',targetCountyCount:215,
    infrastructureAudit:{provider:'Cloudflare Pages plus Cloudflare Access',pagesProject:'gridly-preview',protectedHostname:'preview.gridlygo.com',existingDeploymentId:'458fa7f4-ba68-44c7-82ea-c5e6475e456e',existingDeploymentArtifactIdentity:'sha256:c292ce65fd06f5f3265be988fa3fa8d152dbb0309aaf306e799646dd34b56a7f',reuseDecision:'REUSE_PROJECT_HOSTNAME_AND_ACCESS_APPLICATION_NEW_IMMUTABLE_DIRECT_UPLOAD_REQUIRED',existingAccessApplication:'preview',existingAccessPolicy:'Gridly Preview Approved Testers',existingPolicyAuthentication:'ONE_TIME_PIN_EMAIL_ALLOWLIST_SERVICE_TOKEN_POLICY_NOT_PROVEN'},
    selectedEnvironment:{rootUrl:'https://preview.gridlygo.com',buildIdentityUrl:'https://preview.gridlygo.com/gridly-protected-build-identity.json',countyPackageUrlPattern:'https://preview.gridlygo.com/counties/{FIPS}.json',buildIdentity},
    protectedUrlConfigured:false,deploymentIdentityConfigured:false,buildIdentityConfigured:true,buildIdentityDocumentRequired:true,
    runtimeStagingContract:{source:'LP183.1 canonical tracked deployable runtime',stager:'tools/lp1831/prepare-cloudflare-preview-artifact.mjs',compositionMode:'DEPLOYABLE_RUNTIME_PLUS_PROTECTED_ARTIFACTS'},
    packageExposureContract:{source:'LP188.3 exact package bytes certified by LP188.5',pathPattern:'counties/{FIPS}.json',targetCount:215,copyMode:'BYTE_FOR_BYTE_NO_TRANSFORMATION',sha256Authority:'reports/lp1885/community-package-identity-inventory.json',sourceBytesPresentInRepository:false},
    accessControlRequired:true,serviceTokenRequired:true,executorIdentityReferenceRequired:true,
    requiredEnvironmentVariables:['GRIDLY_PROTECTED_URL','GRIDLY_PROTECTED_DEPLOYMENT_ID','GRIDLY_PROTECTED_BUILD_IDENTITY','GRIDLY_VALIDATOR_ACCESS_CLIENT_ID','GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET','GRIDLY_EXECUTOR_IDENTITY_REFERENCE'],
    validatorScript:'tools/lp18811/protected-validation-harness.mjs',executionAdapter:'tools/lp18811/invoke-owner-validation.ps1',
    currentOperationalCount:28,restrictedCountyCount:11,newActivatedCount:0,runtimeOperationalCountChanged:false,restrictedCountyStateChanged:false,
    productionMutationAuthorized:false,productionDeploymentAuthorized:false,supabaseProductionMutationAvailable:false,activationAuthorized:false,independentReviewStatus:'SEPARATE_PENDING',validatorExecuted:false,evidenceIngested:false,
    provisioningStatus:STATUS,
    blockingReasons:['LP188_3_EXACT_PACKAGE_BYTES_ARE_OWNER_LOCAL_AND_NOT_PRESENT_IN_GIT','NEW_IMMUTABLE_PROTECTED_UPLOAD_NOT_EXECUTED','PROVIDER_DEPLOYMENT_ID_NOT_CAPTURED','ACCESS_SERVICE_TOKEN_POLICY_NOT_PROVEN','SERVICE_TOKEN_CREDENTIALS_NOT_PROVISIONED','EXECUTOR_IDENTITY_REFERENCE_NOT_SELECTED']
  };
}

export function stage({source,output,deploymentId,root=ROOT}){
  try {
    if(!source||!output||!deploymentId)throw Error('stage requires --source, --output, and immutable --deployment-id');
    if(/^(latest|current|preview)$/i.test(deploymentId))throw Error('ambiguous deployment identity rejected');
    const governed=governedInputs(root), {manifest,buildIdentity}=cohortIdentity(root);
    const packages=governed.packages.map(pkg=>{const bytes=fs.readFileSync(path.join(source,pkg.relativePackagePath));if(bytes.length!==pkg.byteLength||sha(bytes)!==pkg.sha256)throw Error(`LP188.5 package identity mismatch: ${pkg.countyFips}`);return {...pkg,bytes};});
    return composeProtectedBundle({output,deploymentId,buildIdentity,manifest,packages,root});
  } catch (error) {
    if(output)fs.rmSync(output,{recursive:true,force:true});
    throw error;
  }
}

export function composeProtectedBundle({output,deploymentId,buildIdentity,manifest,packages,root=ROOT}){
  const temporary=`${output}.protected-tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
  try {
    const runtime=stageDeployableRuntime(temporary,root,{geometryDescriptor:PROTECTED_GEOMETRY_DESCRIPTOR,runtimeConfigBytes:protectedRuntimeConfig()});
    // Pages' implicit SPA fallback is not an asset-first routing contract. Use
    // advanced mode only in this protected composition so ASSETS decides every
    // real file before an HTML-navigation fallback is considered.
    fs.copyFileSync(path.join(root,PROTECTED_PAGES_ROUTER),path.join(temporary,'_worker.js'));
    // A top-level 404.html disables Pages' implicit index.html SPA fallback.
    // The protected Worker, rather than the ASSETS binding, owns SPA fallback.
    fs.writeFileSync(path.join(temporary,PROTECTED_NOT_FOUND_CONTROL),'Gridly protected preview: asset not found.\n');
    fs.mkdirSync(path.join(temporary,'counties'),{recursive:true});
    for(const pkg of packages)fs.writeFileSync(path.join(temporary,pkg.relativePackagePath),pkg.bytes);
    const registry=JSON.parse(fs.readFileSync(path.join(root,'assets/package-registry/runtime-package-registry.json'),'utf8'));
    const communityRuntimePackageCount=registry.packageTypes.find(entry=>entry.packageType==='Community')?.packageCount;
    const crossingRuntimePackageCount=registry.packageTypes.find(entry=>entry.packageType==='Crossing')?.packageCount;
    const dallas48113Present=registry.packages.some(entry=>entry.packageType==='Community'&&entry.countyFips==='48113');
    if(communityRuntimePackageCount!==254||crossingRuntimePackageCount!==28||registry.totalPackages!==282||!dallas48113Present)throw Error('PROTECTED_BUILD_RUNTIME_REGISTRY_IDENTITY_MISMATCH');
    const sourceGitCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
    const identity={deploymentId,buildIdentity,sourceGitCommit,runtimeArtifactIdentity:runtime.artifactIdentity,environmentClassification:CLASSIFICATION,geometryTransportMode:PROTECTED_GEOMETRY_DESCRIPTOR.mode,geometryCanonicalPath:GEOMETRY_CANONICAL_PATH,geometryRemoteUrl:PROTECTED_GEOMETRY_DESCRIPTOR.url,geometryExpectedBytes:PROTECTED_GEOMETRY_DESCRIPTOR.expectedBytes,geometryExpectedSha256:PROTECTED_GEOMETRY_DESCRIPTOR.expectedSha256,geometryExpectedCountyCount:PROTECTED_GEOMETRY_DESCRIPTOR.expectedCountyCount,communityRuntimePackageCount,crossingRuntimePackageCount,totalRuntimePackages:registry.totalPackages,dallas48113Present};
    fs.writeFileSync(path.join(temporary,'gridly-protected-build-identity.json'),stable(identity));
    fs.writeFileSync(path.join(temporary,'gridly-protected-cohort-manifest.json'),stable(manifest));
    fs.rmSync(output,{recursive:true,force:true});
    fs.renameSync(temporary,output);
    return {deploymentId,buildIdentity,countyCount:packages.length,output,runtimeArtifactIdentity:runtime.artifactIdentity,runtimeFileCount:runtime.files.length,protectedRouting:'ASSET_FIRST_THEN_HTML_NAVIGATION_FALLBACK'};
  } catch(error) {
    fs.rmSync(temporary,{recursive:true,force:true});
    fs.rmSync(output,{recursive:true,force:true});
    throw error;
  }
}

export function verify(root=ROOT){const a=stable(buildEvidence(root)),b=stable(buildEvidence(root));if(a!==b)throw Error('non-deterministic provisioning evidence');const expected=fs.readFileSync(path.join(root,REPORT),'utf8');if(expected!==a)throw Error('LP188.11C provisioning evidence drift');return true;}
function args(argv){const out={};for(let i=0;i<argv.length;i+=2){if(!argv[i].startsWith('--')||!argv[i+1])throw Error('invalid arguments');out[argv[i].slice(2)]=argv[i+1];}return out;}
if(process.argv[1]===fileURLToPath(import.meta.url)){const mode=process.argv[2]||'build';if(mode==='build'){fs.mkdirSync(path.dirname(path.join(ROOT,REPORT)),{recursive:true});fs.writeFileSync(path.join(ROOT,REPORT),stable(buildEvidence()));}else if(mode==='verify')verify();else if(mode==='stage'){const a=args(process.argv.slice(3));process.stdout.write(stable(stage({source:path.resolve(a.source),output:path.resolve(a.output),deploymentId:a['deployment-id']})));}else throw Error('unknown mode');process.stdout.write(`LP188.11C ${mode} PASS; no external deployment or production mutation executed.\n`);}
