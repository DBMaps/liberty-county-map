import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const releaseId = 'lp24111-d5-standalone-2026-08-28';
const releaseDir = path.join(root, 'poi', releaseId);
const reportDir = path.join(root, 'reports/lp24114');
const stable = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

export const EXPECTED = Object.freeze({
  authorityReleaseId: releaseId,
  runtimeSchemaVersion: 'gridly.poi.runtime.v1',
  reviewedSourceInventoryHash: 'a9d7a77b964af35fcb21ad3cd061ceb1e1a33ae4dc5091a25a119bada92cec13',
  foursquareNoticeSha256: '07cef40d0b0d1f5786b3e29983970aa0729ee6e508d1c4e3e18bbe0eef8878a3',
  foursquareNoticeBytes: 1805,
  foursquareSourceSnapshotSha256: '9ea389b0eb8cd530d1f5c90cee9084b57e5fa837b13798935de88f148c33f39a',
  overtureAttributionSnapshotSha256: 'add8120c71e70efc1d13b93556ba9872c1b377ad5a09e1c31d3dd668c09038ac',
  modificationStatementVersion: 'GRIDLY_POI_MODIFICATION_STATEMENT_V1',
  modificationStatementSha256: '0e8395cba2938ed21fbb0e5deff723674f189a9cc70a84f88c65a755493efc04',
  attributionSurfaceVersion: 'gridly.lp24113.data-sources-surface.v1',
  complianceGovernanceState: 'COMPLIANCE_REVIEW_COMPLETE_OWNER_AUTHORIZED'
});

export class RehearsalBlocked extends Error {
  constructor(code, detail) { super(`${code}: ${detail}`); this.code = code; this.detail = detail; }
}

const readRequired = (base, relative, code) => {
  const file = path.join(base, relative);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new RehearsalBlocked(code, relative);
  return fs.readFileSync(file);
};

export function guardEnvironment(config) {
  if (config.environment !== 'NON_PRODUCTION' || config.rehearsalMode !== 'NON_PRODUCTION')
    throw new RehearsalBlocked('REHEARSAL_BLOCKED_NON_PRODUCTION_GUARD', 'environment and rehearsal mode must both be NON_PRODUCTION');
  if (config.productionProviderGate !== 'OFF')
    throw new RehearsalBlocked('REHEARSAL_BLOCKED_PRODUCTION_BOUNDARY', 'production provider gate must be OFF');
}

export function validateRelease(base = releaseDir, expected = EXPECTED) {
  const manifestBytes = readRequired(base, 'manifest.json', 'REHEARSAL_BLOCKED_RELEASE_BINDING_MISMATCH');
  let manifest;
  try { manifest = JSON.parse(manifestBytes); } catch { throw new RehearsalBlocked('REHEARSAL_BLOCKED_RELEASE_BINDING_MISMATCH', 'manifest is not valid JSON'); }
  for (const [key, value] of Object.entries(expected)) {
    if (manifest[key] !== value) throw new RehearsalBlocked('REHEARSAL_BLOCKED_RELEASE_BINDING_MISMATCH', key);
  }
  const combinations = JSON.stringify(manifest.licenseExposure?.combinations);
  const expectedCombinations = JSON.stringify([
    { licenses: ['CDLA-Permissive-2.0'], count: 355925 },
    { licenses: ['Apache-2.0', 'CDLA-Permissive-2.0'], count: 23248 },
    { licenses: ['CC0-1.0', 'CDLA-Permissive-2.0'], count: 12599 }
  ]);
  if (combinations !== expectedCombinations || manifest.licenseExposure?.total !== 391772 ||
      manifest.externalCounselReviewed !== false || manifest.ownerAuthorizedProceed !== true)
    throw new RehearsalBlocked('REHEARSAL_BLOCKED_RELEASE_BINDING_MISMATCH', 'license or owner governance binding');
  return { manifest, manifestSha256: sha256(manifestBytes) };
}

export function validateLegal(base = releaseDir) {
  readRequired(base, 'legal/THIRD-PARTY-NOTICES.txt', 'REHEARSAL_BLOCKED_COMPLIANCE_MATERIAL_MISSING_OR_INVALID');
  const notice = readRequired(base, 'legal/foursquare/NOTICE.txt', 'REHEARSAL_BLOCKED_COMPLIANCE_MATERIAL_MISSING_OR_INVALID');
  const licenses = readRequired(base, 'legal/license-reference-manifest.json', 'REHEARSAL_BLOCKED_COMPLIANCE_MATERIAL_MISSING_OR_INVALID');
  if (notice.length !== EXPECTED.foursquareNoticeBytes || sha256(notice) !== EXPECTED.foursquareNoticeSha256 || notice.includes(13))
    throw new RehearsalBlocked('REHEARSAL_BLOCKED_COMPLIANCE_MATERIAL_MISSING_OR_INVALID', 'Foursquare NOTICE bytes, hash, or LF policy');
  let parsed;
  try { parsed = JSON.parse(licenses); } catch { throw new RehearsalBlocked('REHEARSAL_BLOCKED_COMPLIANCE_MATERIAL_MISSING_OR_INVALID', 'license reference manifest JSON'); }
  if (!parsed.references || !['cdla', 'apache', 'cc0'].every(key => parsed.references[key]?.available === true))
    throw new RehearsalBlocked('REHEARSAL_BLOCKED_COMPLIANCE_MATERIAL_MISSING_OR_INVALID', 'license references');
  return { legalMaterialsVerified: true, noticeVerified: true, noticeSha256: sha256(notice), noticeBytes: notice.length };
}

export function inspectRuntimeShards(base = releaseDir) {
  const candidates = ['shards', 'runtime', 'data'].flatMap(name => {
    const directory = path.join(base, name);
    return fs.existsSync(directory) ? fs.readdirSync(directory).filter(file => /\.json(?:\.gz)?$/.test(file)).map(file => path.join(directory, file)) : [];
  });
  if (candidates.length === 0)
    throw new RehearsalBlocked('REHEARSAL_BLOCKED_RUNTIME_SHARDS_NOT_MATERIALIZED', 'certified release contains no local/static runtime JSON or GZIP shards');
  return candidates.sort();
}

export function initialize(config, base = releaseDir) {
  guardEnvironment(config);
  if (config.authorityReleaseId !== EXPECTED.authorityReleaseId || config.runtimeSchemaVersion !== EXPECTED.runtimeSchemaVersion || config.lp24113ComplianceEligible !== true)
    throw new RehearsalBlocked('REHEARSAL_BLOCKED_RELEASE_BINDING_MISMATCH', 'initialization binding');
  const release = validateRelease(base);
  const legal = validateLegal(base);
  const shards = inspectRuntimeShards(base);
  return { release, legal, shards };
}

export function rollback() {
  return { providerIdentity: 'PRE_REHEARSAL_PROVIDER', providerMode: 'DISABLED', cacheState: 'TEMPORARY_REHEARSAL_STATE_CLEARED', productionProviderGate: 'OFF', runtimeActive: false, rehearsalProviderEnabled: false, productionStateMutation: false, diagnostic: 'ROLLBACK_CONFIRMED_PRE_REHEARSAL_STATE' };
}

export function artifacts() {
  const config = { environment: 'NON_PRODUCTION', rehearsalMode: 'NON_PRODUCTION', productionProviderGate: 'OFF', authorityReleaseId: EXPECTED.authorityReleaseId, runtimeSchemaVersion: EXPECTED.runtimeSchemaVersion, lp24113ComplianceEligible: true };
  const environment = { schemaVersion: 'gridly.lp24114.environment.v1', rehearsalId: 'LP241.14', ...config, productionProviderEligible: false, runtimeActive: false, deployed: false, productionSupabaseMutation: false };
  let releaseValidation;
  try { const release = validateRelease(); const legal = validateLegal(); releaseValidation = { schemaVersion: 'gridly.lp24114.release-validation.v1', manifestVerified: true, legalMaterialsVerified: true, noticeVerified: true, ...release, ...legal }; }
  catch (error) { releaseValidation = { schemaVersion: 'gridly.lp24114.release-validation.v1', manifestVerified: false, blockedState: error.code, detail: error.detail }; }
  let blocked;
  try { initialize(config); } catch (error) { blocked = { code: error.code, detail: error.detail }; }
  const runtime = { schemaVersion: 'gridly.lp24114.runtime-availability.v1', releaseId, runtimeShardsMaterialized: false, compactAuthorityOwnerLocalOnly: true, fixtureAdapterCreated: false, shardManufacturingPerformed: false, searchExecuted: false, requestedShardIds: [], loadedShardIds: [], fanoutCount: 0, blockedState: blocked?.code, blockedDetail: blocked?.detail };
  const rollbackResult = { schemaVersion: 'gridly.lp24114.rollback.v1', ...rollback() };
  const certification = { schemaVersion: 'gridly.lp24114.certification.v1', phaseState: blocked?.code ?? 'REHEARSAL_BLOCKED_UNKNOWN', automatedState: 'AUTOMATED_BLOCKED', nonProductionProviderRehearsalPassed: false, providerInitialized: false, searchExecuted: false, ownerBrowserAcceptance: 'NOT_APPLICABLE_REHEARSAL_DID_NOT_INITIALIZE', productionProviderEligible: false, providerGate: 'OFF', runtimeActive: false, runtimeActivated: false, productionPoiSearch: 'NOT_LAUNCHED_NOT_CERTIFIED', deployed: false, productionSupabaseMutation: false, productionBehaviorChanged: false, remoteOvertureFetch: false, osmMerged: false, shardManufacturing: false, phoneTesting: false, rollback: rollbackResult.diagnostic, nextOwnerAction: 'Materialize and certify the frozen release runtime shards in a separately authorized milestone, then rerun LP241.14; do not activate production POI search.' };
  return { 'lp24114-rehearsal-environment.json': environment, 'lp24114-release-validation.json': releaseValidation, 'lp24114-runtime-shard-availability.json': runtime, 'lp24114-rollback-result.json': rollbackResult, 'lp24114-certification.json': certification };
}

export function verifyReports() {
  const expected = artifacts();
  for (const [name, value] of Object.entries(expected)) {
    const file = path.join(reportDir, name);
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== stable(value)) throw Error(`STALE_OR_MISSING: reports/lp24114/${name}`);
  }
  return expected;
}

if (path.resolve(process.argv[1] ?? '') === path.resolve(import.meta.filename)) {
  const args = new Set(process.argv.slice(2));
  if (args.has('--write')) { fs.mkdirSync(reportDir, { recursive: true }); for (const [name, value] of Object.entries(artifacts())) fs.writeFileSync(path.join(reportDir, name), stable(value)); console.log('wrote LP241.14 fail-closed rehearsal evidence'); }
  else if (args.has('--verify')) { verifyReports(); console.log('verified LP241.14 fail-closed rehearsal evidence'); }
  else if (args.has('--rehearse')) { try { initialize({ environment: process.env.POI_REHEARSAL_ENVIRONMENT, rehearsalMode: process.env.POI_REHEARSAL_MODE, productionProviderGate: 'OFF', authorityReleaseId: EXPECTED.authorityReleaseId, runtimeSchemaVersion: EXPECTED.runtimeSchemaVersion, lp24113ComplianceEligible: true }); } catch (error) { console.error(`${error.code}: ${error.detail}`); process.exitCode = 2; } }
  else console.log('use --write, --verify, or --rehearse');
}
