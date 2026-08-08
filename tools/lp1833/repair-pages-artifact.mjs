import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'fflate';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory, stage } from '../lp1831/prepare-cloudflare-preview-artifact.mjs';
import { canonicalBlob } from '../lp18321/git-asset-identity.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPORT_DIR = 'reports/lp1833';
export const SOURCE = 'assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson';
export const PACKAGE = 'assets/county-implementation/montgomery/runtime-assets/montgomery-roads-lp1833-v1.geojson.gz';
export const LIMIT_BYTES = 25 * 1024 * 1024;
export const EXPECTED_PACKAGE_BYTES = 6444342;
export const EXPECTED_PACKAGE_SHA256 = '2d7a52fdfbab8549a92b6724d557e9e26c4b089d523961d41b7ddc7b94c5e6b1';
const FRA = 'Crossing-Packages/Texas/fra-crossings-tx.geojson';
const HARRIS = 'data/generated/lp104/txgio-addresses/harris-48201.addresses.jsonl.gz';
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
export function deterministicGzip(source) { return Buffer.from(gzipSync(source, { level: 9, mtime: 0 })); }
export function packageAsset(root = ROOT, write = true) { const source = canonicalBlob(root, SOURCE); const bytes = deterministicGzip(source); if (bytes.length !== EXPECTED_PACKAGE_BYTES || sha(bytes) !== EXPECTED_PACKAGE_SHA256) throw Error('Montgomery package governed identity mismatch'); if (write) fs.writeFileSync(path.join(root, PACKAGE), bytes); return bytes; }
export function build(root = ROOT) {
  const source = canonicalBlob(root, SOURCE), compressed = fs.readFileSync(path.join(root, PACKAGE)), regenerated = deterministicGzip(source);
  if (!compressed.equals(regenerated)) throw Error('Montgomery package deterministic regeneration mismatch');
  const inv = inventory(root), paths = new Set(inv.files.map(x => x.path));
  const max = [...inv.files].sort((a,b) => b.bytes-a.bytes || a.path.localeCompare(b.path))[0];
  const common = { milestone:'LP183.3', generatedAt:GENERATED_AT, performsCloudExecution:false, candidateCommit:git('rev-parse','HEAD') };
  const packageManifest = { schemaVersion:'gridly.lp1833.montgomeryPackage.v1', ...common, path:PACKAGE, compression:'gzip', compressedBytes:compressed.length, uncompressedBytes:source.length, sha256:sha(compressed), source:{ path:SOURCE, gitBlob:git('rev-parse',`HEAD:${SOURCE}`), sha256:sha(source) }, schema:'GeoJSON FeatureCollection with LineString/MultiLineString features', deterministicRegeneration:{ algorithm:'gzip', implementation:'fflate@0.8.3', level:9, mtime:0, byteIdentical:true, command:'npm run build:lp1833' } };
  const compatibility = { schemaVersion:'gridly.lp1833.compatibilityVerification.v1', ...common, limitBytes:LIMIT_BYTES, artifactIdentity:inv.artifactIdentity, fileCount:inv.files.length, totalBytes:inv.files.reduce((n,x)=>n+x.bytes,0), maximumFile:max, oversizedFileCount:inv.files.filter(x=>x.bytes>=LIMIT_BYTES).length, proofs:{ fraStatewideSourceAbsent:!paths.has(FRA), harrisUnusedAddressAbsent:!paths.has(HARRIS), montgomeryRawAbsent:!paths.has(SOURCE), montgomeryCompressedPresent:paths.has(PACKAGE), allFilesBelowLimit:inv.files.every(x=>x.bytes<LIMIT_BYTES), requiredEntriesPresent:inv.missingRequired.length===0 } };
  if (compatibility.oversizedFileCount || Object.values(compatibility.proofs).includes(false)) throw Error('Pages compatibility proof failed');
  const implementation = { schemaVersion:'gridly.lp1833.implementationSummary.v1', ...common, classification:'PAGES_ARTIFACT_COMPATIBILITY_REPAIRED_DEPLOYMENT_REASSESSMENT_REQUIRED', inclusionPolicy:'Runtime-manifest address packages/certificates only; statewide crossing manufacturing sources and compressed-road superseded sources excluded', runtimeFilesModified:['js/app.js','data/roadway-runtime-manifest.json','assets/county-implementation/montgomery/manifests/montgomery-package-manifest.json'], serviceWorkerModified:false, browserMethod:{ implementation:"DecompressionStream('gzip') plus Web Crypto SHA-256 and fatal UTF-8 decoding", chromiumEdge:'SUPPORTED', androidWebViewCapacitor:'SUPPORTED_BY_CURRENT_CAPACITOR_8_MODERN_WEBVIEW_TARGET', safariIosWebView:'SUPPORTED_FROM_SAFARI_IOS_16.4; FAILS_CLOSED_WHEN_UNAVAILABLE', fallbackDependencyAdded:false }, failurePolicy:'HTTP, API support, compressed size, digest, decompression, uncompressed size, UTF-8, JSON, FeatureCollection and line-geometry failures leave roadway state empty; raw source is never fetched.' };
  const transition = { schemaVersion:'gridly.lp1833.runtimeTransition.v1', ...common, transition:'AUTHORIZED_REPOSITORY_COMPATIBILITY_TRANSITION_REASSESSMENT_REQUIRED', priorCandidateChanged:true, priorLp1831ArtifactIdentity:'sha256:9e4fb579077e5d1c192d85cbf79a7d38044c214484ad24fdaa8b413d16969bda', candidateArtifactIdentity:inv.artifactIdentity, protectedRuntimeFilesChanged:['js/app.js'], exactRuntimeMetadataFilesChanged:implementation.runtimeFilesModified.slice(1), externalDeploymentAuthorizationGranted:false };
  const rollback = { schemaVersion:'gridly.lp1833.rollback.v1', ...common, scope:'REPOSITORY_ONLY', authorization:'NOT_AUTHORIZED', procedure:['Revert the LP183.3 compatibility commits','Restore the previous js/app.js Montgomery raw roadway URL and response.json loader','Restore the previous data/roadway-runtime-manifest.json Montgomery entry','Restore the previous LP183.1 artifact inclusion logic','Remove the compressed package reference and generated gzip file','Rebuild and re-run governed verification before any separately authorized action'], cloudRollbackExists:false };
  const readiness = { schemaVersion:'gridly.lp1833.readiness.v1', ...common, classification:implementation.classification, artifactCompatibility:'PASS', deploymentReassessmentRequired:true, cloudExecution:'NONE', authorizationState:{ deployment:'NOT_AUTHORIZED',distribution:'NOT_AUTHORIZED',activation:'NOT_AUTHORIZED',publicLaunch:'NOT_AUTHORIZED',restore:'NOT_AUTHORIZED',rollback:'NOT_AUTHORIZED',automaticDeployment:'NOT_AUTHORIZED' } };
  return { implementation, packageManifest, compatibility, transition, rollback, readiness };
}
const REPORTS={ 'compatibility-implementation-summary.json':'implementation','montgomery-package-manifest.json':'packageManifest','artifact-compatibility-verification.json':'compatibility','runtime-transition-identity.json':'transition','rollback-procedure.json':'rollback','readiness-reassessment.json':'readiness' };
export function writeReports(output=path.join(ROOT,REPORT_DIR),root=ROOT){const made=build(root);fs.mkdirSync(output,{recursive:true});for(const [f,k] of Object.entries(REPORTS))fs.writeFileSync(path.join(output,f),encode(made[k]));return made;}
export function verify(root=ROOT){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lp1833-'));try{const a=path.join(tmp,'a'),b=path.join(tmp,'b');writeReports(a,root);writeReports(b,root);for(const f of Object.keys(REPORTS)){const x=fs.readFileSync(path.join(a,f));if(!x.equals(fs.readFileSync(path.join(b,f)))||!x.equals(fs.readFileSync(path.join(root,REPORT_DIR,f))))throw Error(`LP183.3 report drift: ${f}`);}const staged=path.join(tmp,'stage');const inv=stage(staged,root);if(inv.oversized.length)throw Error('oversized staged file');return true;}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
if(process.argv[1]===fileURLToPath(import.meta.url)){const mode=process.argv[2]||'build';if(mode==='package')packageAsset();else if(mode==='build'){packageAsset();writeReports();}else if(mode==='verify')verify();else throw Error(`unknown mode: ${mode}`);console.log(`LP183.3 ${mode} PASS; no cloud command executed.`);}
