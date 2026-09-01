import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { canonicalBlobs, trackedPaths } from '../lp18321/git-asset-identity.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPORT_DIR = 'reports/lp1831';
export const STAGE_DIR = '.artifacts/lp1831/cloudflare-pages';
export const GENERATED_AT = '1970-01-01T00:00:00.000Z';
export const CANDIDATE_COMMIT = '65be671a899c749426f54be92e8ae000a24ef389';
export const PRODUCTION_ORIGIN = 'https://gridlygo.com';
export const PREVIEW_ORIGIN = 'https://preview.gridlygo.com';
export const RUNTIME_CONFIG_PATH = 'js/gridlyRuntimeEnvironmentConfig.js';
const ENTRY = ['index.html', 'beta-closed.html', 'beta-closure.html', 'manifest.json', 'service-worker.js'];
// Runtime families are staged generically.  `audits/` contains browser-loaded
// audit authorities (not test fixtures), and therefore has the same artifact
// status as js/ rather than being selected one filename at a time.
const FAMILIES = ['js/', 'css/', 'assets/', 'data/', 'audits/', 'Community-Packages/', 'Crossing-Packages/', 'poi/'];
const addressManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/generated/lp104/txgio-addresses/runtime-manifest.json'), 'utf8'));
const roadwayManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roadway-runtime-manifest.json'), 'utf8'));
const runtimeAddressPaths = new Set(['data/generated/lp104/txgio-addresses/runtime-manifest.json', ...addressManifest.packages.flatMap(entry => [entry.path, entry.certificate].filter(Boolean))]);
const supersededCompressedSources = new Set(Object.values(roadwayManifest.counties).filter(entry => entry.compression === 'gzip').map(entry => entry.source?.path).filter(Boolean));
const generatedRuntimeEntries = Object.values(roadwayManifest.counties).filter(entry => entry.compression === 'gzip').map(entry => ({ path: entry.url, bytes: entry.compressedBytes, sha256: entry.sha256 }));
const EXCLUDE = [
  /^js\/gridly\.local\.js$/, /\.backup(?:-|\.)/i, /\/source\//, /\/sources\//,
  /\/generated\/(?!lp104\/txgio-addresses\/)/, /^Crossing-Packages\/Texas\//, /\/evidence\//, /\/fixtures?\//i,
  /(?:^|\/)README(?:\.|$)/i, /(?:^|\/)BUILD-SYSTEM-STATUS\.md$/
];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export const REMOTE_GEOMETRY = Object.freeze({
  canonicalPath: 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json',
  bytes: 47911048,
  sha256: '891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316',
  countyCount: 254
});
export const PRODUCTION_GEOMETRY_DESCRIPTOR = Object.freeze({
  mode: 'REMOTE_PUBLIC_IMMUTABLE_OBJECT',
  url: `https://nhwhkbkludzkuyxmkkcj.supabase.co/storage/v1/object/public/gridly-runtime-geometry/geometry/${REMOTE_GEOMETRY.sha256}.json`,
  expectedBytes: REMOTE_GEOMETRY.bytes,
  expectedSha256: REMOTE_GEOMETRY.sha256,
  expectedCountyCount: REMOTE_GEOMETRY.countyCount
});
export const isIncluded = file => (ENTRY.includes(file) || FAMILIES.some(x => file.startsWith(x))) && !EXCLUDE.some(x => x.test(file)) && (!file.startsWith('data/generated/lp104/txgio-addresses/') || runtimeAddressPaths.has(file)) && !supersededCompressedSources.has(file);

function remoteGeometryException(root, descriptor, files) {
  if (!descriptor) return false;
  const geometry = files.find(file => file.path === REMOTE_GEOMETRY.canonicalPath);
  const manifestPath = `${REMOTE_GEOMETRY.canonicalPath.replace(/\.json$/, '')}.manifest.json`;
  const manifestBytes = canonicalBlobs(root, [manifestPath]).get(manifestPath);
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch { throw Error('REMOTE_GEOMETRY_MANIFEST_INVALID'); }
  const certification = manifest.certification || {};
  const immutableUrl = typeof descriptor.url === 'string' && descriptor.url === `https://nhwhkbkludzkuyxmkkcj.supabase.co/storage/v1/object/public/gridly-runtime-geometry/geometry/${REMOTE_GEOMETRY.sha256}.json`;
  const valid = geometry && geometry.bytes === REMOTE_GEOMETRY.bytes && geometry.sha256 === REMOTE_GEOMETRY.sha256 &&
    manifest.packagePath === REMOTE_GEOMETRY.canonicalPath && manifest.packageByteLength === REMOTE_GEOMETRY.bytes && manifest.packageSha256 === REMOTE_GEOMETRY.sha256 &&
    manifest.expectedOperationalCountyCount === 254 && manifest.operationalCountyCount === 254 && manifest.packagedCountyCount === 254 && manifest.restrictedCountyCount === 0 &&
    certification.passed === true && certification.polygonContainmentRequired === true && certification.polygonSupported === true && certification.boundsRole === 'candidate-prefilter-only' &&
    descriptor.mode === 'REMOTE_PUBLIC_IMMUTABLE_OBJECT' && descriptor.expectedBytes === REMOTE_GEOMETRY.bytes && descriptor.expectedSha256 === REMOTE_GEOMETRY.sha256 && descriptor.expectedCountyCount === REMOTE_GEOMETRY.countyCount && immutableUrl;
  if (!valid) throw Error('REMOTE_GEOMETRY_EXCEPTION_IDENTITY_MISMATCH');
  return true;
}

export function inventory(root = ROOT, options = {}) {
  const paths = trackedPaths(root).filter(isIncluded);
  const blobs = canonicalBlobs(root, paths);
  const files = paths.map(file => {
    const bytes = blobs.get(file);
    return { path: file, bytes: bytes.length, sha256: sha(bytes) };
  });
  for (const generated of generatedRuntimeEntries) {
    if (!isIncluded(generated.path) || paths.includes(generated.path)) continue;
    const generatedPath = path.join(root, generated.path);
    if (!fs.existsSync(generatedPath)) throw Error(`governed generated runtime asset missing; run npm run build:lp1833: ${generated.path}`);
    const bytes = fs.readFileSync(generatedPath);
    if (bytes.length !== generated.bytes || sha(bytes) !== generated.sha256) throw Error(`governed generated runtime asset identity mismatch: ${generated.path}`);
    files.push({ path: generated.path, bytes: bytes.length, sha256: sha(bytes) });
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const omitGeometry = remoteGeometryException(root, options.geometryDescriptor, files);
  if (omitGeometry) files.splice(files.findIndex(file => file.path === REMOTE_GEOMETRY.canonicalPath), 1);
  const missingRequired = ENTRY.filter(x => !files.some(f => f.path === x));
  const oversized = files.filter(x => x.bytes > 25 * 1024 * 1024).map(x => ({ path: x.path, bytes: x.bytes, limitBytes: 25 * 1024 * 1024 }));
  const identityInput = files.map(({ path: p, bytes, sha256 }) => `${p}\0${bytes}\0${sha256}\n`).join('');
  return { files, missingRequired, oversized, artifactIdentity: `sha256:${sha(Buffer.from(identityInput, 'utf8'))}` };
}

function runtimeObject(bytes) {
  const sandbox = { window: {} };
  try { vm.runInNewContext(bytes.toString('utf8'), sandbox, { timeout: 1000 }); } catch { throw Error('CANONICAL_RUNTIME_CONFIG_INVALID'); }
  const value = sandbox.window.GRIDLY_RUNTIME_CONFIG;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('CANONICAL_RUNTIME_CONFIG_INVALID');
  return JSON.parse(JSON.stringify(value));
}

function nonblank(value) { return typeof value === 'string' && value.trim().length > 0 && !/^<.*>$/.test(value.trim()) && !/PLACEHOLDER/i.test(value); }
function validateGeometry(value) {
  const transportValid = (value?.mode === 'LOCAL_CANONICAL' && value.url === REMOTE_GEOMETRY.canonicalPath) || (value?.mode === PRODUCTION_GEOMETRY_DESCRIPTOR.mode && value.url === PRODUCTION_GEOMETRY_DESCRIPTOR.url);
  return value && transportValid && value.expectedBytes === REMOTE_GEOMETRY.bytes && value.expectedSha256 === REMOTE_GEOMETRY.sha256 && value.expectedCountyCount === REMOTE_GEOMETRY.countyCount;
}

export function composeProductionRuntimeConfig(canonicalBytes, overlayBytes, geometryDescriptor) {
  let overlay;
  try { overlay = JSON.parse(overlayBytes.toString('utf8')); } catch { throw Error('RUNTIME_CONFIG_OVERLAY_MALFORMED'); }
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) throw Error('RUNTIME_CONFIG_OVERLAY_MALFORMED');
  const keys = Object.keys(overlay).sort();
  if (keys.join(',') !== 'arcgisStaticBasemapApiKey,driveTexas') throw Error('RUNTIME_CONFIG_OVERLAY_PROPERTIES_DISALLOWED');
  if (!nonblank(overlay.arcgisStaticBasemapApiKey)) throw Error('ARCGIS_STATIC_BASEMAP_API_KEY_REQUIRED');
  if (!overlay.driveTexas || typeof overlay.driveTexas !== 'object' || Array.isArray(overlay.driveTexas) || Object.keys(overlay.driveTexas).join(',') !== 'apiKey' || !nonblank(overlay.driveTexas.apiKey)) throw Error('DRIVETEXAS_API_KEY_REQUIRED');
  const canonical = runtimeObject(canonicalBytes);
  if (canonical.poiBrowserProvider?.enabled !== 'ENABLED') throw Error('POI_BROWSER_PROVIDER_CONTRACT_INVALID');
  if (!validateGeometry(canonical.authoritativeCountyGeometry)) throw Error('COUNTY_GEOMETRY_CONTRACT_INVALID');
  canonical.arcgisStaticBasemapApiKey = overlay.arcgisStaticBasemapApiKey;
  if (geometryDescriptor) canonical.authoritativeCountyGeometry = { ...geometryDescriptor };
  const composed = `(function () {\n  "use strict";\n  window.GRIDLY_CONFIG = window.GRIDLY_CONFIG || {};\n  window.GRIDLY_CONFIG.driveTexas = Object.freeze({ apiKey: ${JSON.stringify(overlay.driveTexas.apiKey)} });\n  window.GRIDLY_RUNTIME_CONFIG = Object.freeze(${JSON.stringify(canonical, null, 2)});\n})();\n`;
  return Buffer.from(composed, 'utf8');
}

export function inventoryDirectory(directory) {
  const files = [];
  const visit = (current, relative = '') => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute, rel);
      else if (entry.isFile()) { const bytes = fs.readFileSync(absolute); files.push({ path: rel, bytes: bytes.length, sha256: sha(bytes) }); }
      else throw Error(`UNSUPPORTED_STAGED_ENTRY:${rel}`);
    }
  };
  visit(directory);
  files.sort((a, b) => a.path.localeCompare(b.path));
  const identityInput = files.map(({ path: p, bytes, sha256 }) => `${p}\0${bytes}\0${sha256}\n`).join('');
  return { files, missingRequired: ENTRY.filter(x => !files.some(f => f.path === x)), oversized: files.filter(x => x.bytes > 25 * 1024 * 1024), artifactIdentity: `sha256:${sha(Buffer.from(identityInput))}` };
}

function assertCandidate(root) {
  try { git(root, 'cat-file', '-e', `${CANDIDATE_COMMIT}^{commit}`); git(root, 'merge-base', '--is-ancestor', CANDIDATE_COMMIT, 'HEAD'); } catch { throw Error(`FROZEN_CANDIDATE_NOT_AVAILABLE:${CANDIDATE_COMMIT}`); }
  const changedRuntime = git(root, 'diff', '--name-only', CANDIDATE_COMMIT, '--', ...ENTRY, ...FAMILIES).split(/\r?\n/).filter(Boolean);
  if (changedRuntime.length) throw Error(`FROZEN_CANDIDATE_RUNTIME_DRIFT:${changedRuntime.join(',')}`);
}

function assertExternalIgnoredInput(root, input, output) {
  const absolute = path.resolve(input);
  if (!fs.statSync(absolute).isFile()) throw Error('RUNTIME_CONFIG_FILE_NOT_REGULAR');
  if (absolute === path.resolve(root, RUNTIME_CONFIG_PATH) || absolute.startsWith(`${path.resolve(output)}${path.sep}`)) throw Error('RUNTIME_CONFIG_FILE_NOT_EXTERNAL');
  if (absolute.startsWith(`${path.resolve(root)}${path.sep}`)) {
    try { execFileSync('git', ['check-ignore', '-q', '--', absolute], { cwd: root }); } catch { throw Error('RUNTIME_CONFIG_FILE_MUST_BE_UNTRACKED_AND_IGNORED'); }
  }
  return absolute;
}

function verifyProductionContracts(directory) {
  const runtimeBytes = fs.readFileSync(path.join(directory, RUNTIME_CONFIG_PATH));
  const sandbox = { window: {} };
  try { vm.runInNewContext(runtimeBytes.toString('utf8'), sandbox, { timeout: 1000 }); } catch { throw Error('COMPOSED_RUNTIME_CONFIG_INVALID'); }
  const runtime = sandbox.window.GRIDLY_RUNTIME_CONFIG;
  if (!nonblank(runtime?.arcgisStaticBasemapApiKey)) throw Error('ARCGIS_STATIC_BASEMAP_API_KEY_REQUIRED');
  if (runtime?.poiBrowserProvider?.enabled !== 'ENABLED') throw Error('POI_BROWSER_PROVIDER_CONTRACT_INVALID');
  if (!validateGeometry(runtime?.authoritativeCountyGeometry)) throw Error('COUNTY_GEOMETRY_CONTRACT_INVALID');
  if (!nonblank(sandbox.window.GRIDLY_CONFIG?.driveTexas?.apiKey)) throw Error('DRIVETEXAS_API_KEY_REQUIRED');
  const app = fs.readFileSync(path.join(directory, 'js/app.js'), 'utf8');
  if (!/SUPABASE_PUBLIC_KEY\s*=\s*["'][^"']+["']/.test(app) || /service[_-]?role/i.test(app)) throw Error('SUPABASE_PUBLIC_CLIENT_CONTRACT_INVALID');
  const drive = fs.readFileSync(path.join(directory, 'js/gridlyDriveTexasProvider.js'), 'utf8');
  for (const contract of ['GRIDLY_CONFIG.driveTexas', 'GRIDLY_CONFIG.txdot', 'GRIDLY_TXDOT_API_KEY']) if (!drive.includes(contract)) throw Error('DRIVETEXAS_FALLBACK_CONTRACT_INVALID');
  return { arcgisStaticBasemapApiKey: 'CONFIGURED_NONBLANK', poiBrowserProvider: 'ENABLED', authoritativeCountyGeometry: 'CANONICAL_COMPLETE', driveTexas: 'GRIDLY_CONFIG.driveTexas.apiKey_CONFIGURED_FALLBACK_CONTRACT_PRESERVED', supabase: 'PUBLIC_CLIENT_CONFIG_PRESENT_NO_SERVICE_ROLE' };
}

function assertExclusions(directory, ownerInput) {
  const inv = inventoryDirectory(directory);
  const forbidden = /(^|\/)(?:node_modules|tests|tools|reports|evidence|android|ios)(\/|$)|(?:^|\/).*\.local\.js$|(?:^|\/)(?:\.env(?:\..*)?|wrangler\.toml|.*(?:private[-_]?key|service[-_]?role|cloudflare.*(?:token|auth)).*)$/i;
  const bad = inv.files.filter(file => forbidden.test(file.path));
  if (bad.length) throw Error(`FORBIDDEN_STAGED_PATH:${bad[0].path}`);
  if (inv.files.some(file => path.resolve(directory, file.path) === path.resolve(ownerInput))) throw Error('OWNER_RUNTIME_CONFIG_INPUT_WAS_STAGED');
  return inv;
}

export function stageProduction({ output = path.join(ROOT, STAGE_DIR), root = ROOT, runtimeConfigFile, reportFile } = {}) {
  if (!runtimeConfigFile) throw Error('PRODUCTION_RUNTIME_CONFIG_FILE_REQUIRED');
  assertCandidate(root);
  const ownerInput = assertExternalIgnoredInput(root, runtimeConfigFile, output);
  const canonical = canonicalBlobs(root, [RUNTIME_CONFIG_PATH]).get(RUNTIME_CONFIG_PATH);
  const runtimeConfigBytes = composeProductionRuntimeConfig(canonical, fs.readFileSync(ownerInput), PRODUCTION_GEOMETRY_DESCRIPTOR);
  stage(output, root, { runtimeConfigBytes, geometryDescriptor: PRODUCTION_GEOMETRY_DESCRIPTOR });
  const configStatus = verifyProductionContracts(output);
  const inv = assertExclusions(output, ownerInput);
  if (inv.missingRequired.length || inv.oversized.length) throw Error('FINAL_ARTIFACT_CONTRACT_FAILED');
  const runtimeRecord = inv.files.find(file => file.path === RUNTIME_CONFIG_PATH);
  const roadwayBytes = canonicalBlobs(root, ['data/roadway-runtime-manifest.json']).get('data/roadway-runtime-manifest.json');
  const report = { schemaVersion: 'gridly.lp1831.productionRelease.v1', generatedAt: GENERATED_AT, candidateGitSha: CANDIDATE_COMMIT, productionOrigin: PRODUCTION_ORIGIN, previewOrigin: PREVIEW_ORIGIN, artifactDigest: inv.artifactIdentity, fileCount: inv.files.length, totalBytes: inv.files.reduce((n, x) => n + x.bytes, 0), identityMethod: 'SHA-256 over UTF-8 records sorted by path: path NUL byte-length NUL file-SHA-256 LF', runtimeConfig: { path: RUNTIME_CONFIG_PATH, bytes: runtimeRecord.bytes, sha256: runtimeRecord.sha256, classification: 'OWNER_OVERLAY_COMPOSED_BROWSER_PUBLIC_CONFIG', properties: configStatus }, packageAuthorities: { roadwayRuntimeManifestSha256: sha(roadwayBytes), authoritativeCountyGeometry: REMOTE_GEOMETRY }, files: inv.files };
  const destination = reportFile ? path.resolve(reportFile) : path.join(path.dirname(output), 'production-release-report.json');
  if (destination.startsWith(`${path.resolve(output)}${path.sep}`)) throw Error('RELEASE_REPORT_MUST_BE_OUTSIDE_UPLOAD_DIRECTORY');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, json(report));
  return { ...inv, report, reportFile: destination };
}

export function verifyProduction({ output = path.join(ROOT, STAGE_DIR), reportFile } = {}) {
  const destination = reportFile ? path.resolve(reportFile) : path.join(path.dirname(output), 'production-release-report.json');
  const report = JSON.parse(fs.readFileSync(destination, 'utf8'));
  const inv = inventoryDirectory(output);
  if (report.candidateGitSha !== CANDIDATE_COMMIT || report.artifactDigest !== inv.artifactIdentity || report.fileCount !== inv.files.length || report.totalBytes !== inv.files.reduce((n, x) => n + x.bytes, 0) || JSON.stringify(report.files) !== JSON.stringify(inv.files)) throw Error('FINAL_ARTIFACT_MANIFEST_MISMATCH');
  const status = verifyProductionContracts(output);
  if (JSON.stringify(status) !== JSON.stringify(report.runtimeConfig.properties)) throw Error('REDACTED_CONFIG_STATUS_MISMATCH');
  return report;
}

export function build(root = ROOT) {
  const inv = inventory(root);
  const excluded = {
    always: ['.git/', 'node_modules/', 'android/', 'ios/', 'tests/', 'tools/', 'reports/', 'evidence/', 'legal/', 'docs/', 'supabase/', 'scripts/', 'Gridly-Source-Data/', 'repository-root governance/report files', 'secrets and untracked files'],
    withinIncludedFamilies: ['js/gridly.local.js', 'backup files', 'source/source archives', 'generated staging except packages and certificates exposed by the current address runtime manifest', 'statewide crossing manufacturing sources', 'raw roadway sources superseded by compressed runtime manifest entries', 'evidence and fixture directories', 'README and build-status documents']
  };
  const common = { milestone: 'LP183.1', generatedAt: GENERATED_AT, performsCloudExecution: false };
  const manifest = { schemaVersion: 'gridly.lp1831.deployableArtifactManifest.v1', ...common, source: 'CANONICAL_TRACKED_GIT_BLOBS_AT_HEAD', materializationPolicy: 'Write canonical Git blob bytes at HEAD without working-tree EOL conversion', stagingDirectory: STAGE_DIR, repositoryRootSafeForUpload: false, requiredStaging: true, identityMethod: 'SHA-256 over UTF-8 records sorted by path: path NUL byte-length NUL file-SHA-256 LF', artifactIdentity: inv.artifactIdentity, fileCount: inv.files.length, totalBytes: inv.files.reduce((n, x) => n + x.bytes, 0), missingRequired: inv.missingRequired, cloudflarePagesOversizedFiles: inv.oversized, files: inv.files };
  const commands = { schemaVersion: 'gridly.lp1831.cloudflareCommandPlan.v1', ...common, shellBoundary: 'PowerShell 5.1 compatible; run from repository root', placeholders: { project: '<OWNER_SELECTED_PAGES_PROJECT_NAME>', accountId: '<VERIFIED_ACCOUNT_ID>', artifactDirectory: STAGE_DIR }, environment: ['No repository secret is required', 'Owner completes interactive OAuth when npx wrangler prompts, or supplies a temporary CLOUDFLARE_API_TOKEN in the process environment only'], sequence: [
    { purpose: 'authenticated account verification', command: 'npx --yes wrangler whoami', executeNow: false },
    { purpose: 'create empty Direct Upload project', command: 'npx --yes wrangler pages project create <OWNER_SELECTED_PAGES_PROJECT_NAME> --production-branch preview', executeNow: false },
    { purpose: 'future explicit upload only after authorization', command: `npx --yes wrangler pages deploy ${STAGE_DIR} --project-name <OWNER_SELECTED_PAGES_PROJECT_NAME> --branch preview --commit-dirty=true`, executeNow: false },
    { purpose: 'list and capture deployment ID, URL, environment and timestamp', command: 'npx --yes wrangler pages deployment list --project-name <OWNER_SELECTED_PAGES_PROJECT_NAME>', executeNow: false }
  ], identityCapture: 'Capture the deploy command output and deployment-list output; reconcile the returned deployment URL/ID with this manifest identity. Wrangler does not prove file identity by itself.', customDomainNote: 'Custom-domain binding/removal is deliberately omitted: it requires a separately authorized owner Dashboard/API action and confirmed platform controls.' };
  const rollback = { schemaVersion: 'gridly.lp1831.rollbackPlan.v1', ...common, rollbackAuthorization: 'NOT_AUTHORIZED', firstDeployment: { executableNow: false, objective: 'Return to no-preview state', procedure: ['Owner disables/removes the preview.gridlygo.com Pages custom-domain binding or other publication route using the platform control proven at execution time', 'Owner removes/disables only the corresponding preview DNS route if one was later authorized and created', 'Verify preview.gridlygo.com no longer serves the candidate anonymously or as an approved tester', 'Verify gridlygo.com and the closed beta surfaces are unchanged', 'Capture control, DNS, HTTP, Access and timestamp evidence'], caveat: 'Do not claim executable until Cloudflare proves the exact route-removal controls exist.' }, knownGood: { executableNow: false, procedure: ['Retain the known-good staging artifact and manifest identified by SHA-256', `Recreate/verify it with node tools/lp1831/prepare-cloudflare-preview-artifact.mjs stage --output <KNOWN_GOOD_DIRECTORY>`, 'After separate authorization, explicitly run wrangler pages deploy against that immutable directory', 'Capture the new deployment ID/URL and reconcile every file hash'], caveat: 'No known-good preview deployment currently exists; Pages redeployment creates a new deployment identity.' } };
  const readiness = { schemaVersion: 'gridly.lp1831.platformReadiness.v1', ...common, classification: inv.oversized.length || inv.missingRequired.length ? 'PLATFORM_PREPARATION_BLOCKED_OWNER_ACTION_REQUIRED' : 'PLATFORM_PREPARATION_COMPLETE_OWNER_EXECUTION_REQUIRED', governedFacts: { zone: 'gridlygo.com', zoneState: 'ACTIVE', registrar: 'GoDaddy', cloudflareRegistrarRole: 'NONE', accessApplication: 'preview', protectedDestination: 'preview.gridlygo.com', authentication: 'ONE_TIME_PIN', policy: 'Gridly Preview Approved Testers / Allow / exact approved email allowlist', anonymousAccess: 'NOT_AUTHORIZED', cloudflareOneClient: 'OFF', browserRemoteProtocols: 'OFF', pagesProjects: 0, pagesDeployments: 0, previewDnsOrCustomDomainRoute: false, artifactUploaded: false, evidenceSource: 'OWNER_PROVIDED_UNAUTHENTICATED_FACTS' }, authorizations: { deployment: 'NOT_AUTHORIZED', distribution: 'NOT_AUTHORIZED', activation: 'NOT_AUTHORIZED', publicLaunch: 'NOT_AUTHORIZED', restore: 'NOT_AUTHORIZED', rollback: 'NOT_AUTHORIZED', automaticDeployment: 'NOT_AUTHORIZED' }, ownerActionsRequired: ['Resolve every Pages file-size incompatibility without runtime behavior drift or obtain proven platform support', 'Select project name and Cloudflare account', 'Authenticate interactively or provide a least-privilege temporary token outside the repository', 'Verify the account before project creation', 'Obtain separate scoped authorization before every project, DNS, domain, upload, or rollback action', 'Capture authenticated platform evidence'], reassessmentPrerequisites: ['Authenticated whoami/account evidence', 'Empty Direct Upload project identity and configuration evidence', 'Exact artifact manifest and SHA-256 identity', 'Evidence every uploaded file satisfies Pages limits', 'Access application/policy export or screenshots showing exact allowlist and anonymous denial', 'Proven custom-domain and first-deployment route-removal controls', 'DNS and certificate plan without execution', 'Approved-tester and anonymous access test plan', 'Owner authorization record bounded to the exact artifact and window', 'Post-upload deployment ID/URL/hash reconciliation plan'], unresolvedUnknowns: ['Authenticated Cloudflare account identity and permissions', 'Selected Pages project name', 'Current platform facts have not been independently authenticated', 'Exact Pages custom-domain removal/disable controls before a project exists', 'Future deployment ID and URL', 'Approved tester identities', 'Whether oversized runtime files can be served by Pages Direct Upload', 'No immutable known-good preview exists'] };
  const summary = { schemaVersion: 'gridly.lp1831.summary.v1', ...common, classification: readiness.classification, artifactIdentity: inv.artifactIdentity, repositoryRootSafeForUpload: false, stagingRequired: true, runtimeModified: false, cloudExecution: 'NONE', ownerActionRequired: true, authorizationState: readiness.authorizations, blockers: [...inv.missingRequired.map(x => `MISSING:${x}`), ...inv.oversized.map(x => `PAGES_25_MIB_LIMIT:${x.path}`)] };
  return { manifest, commands, rollback, readiness, summary };
}

const REPORTS = { 'deployable-artifact-manifest.json': 'manifest', 'cloudflare-pages-command-plan.json': 'commands', 'rollback-plan.json': 'rollback', 'platform-readiness.json': 'readiness', 'lp1831-summary.json': 'summary' };
export function writeReports(output = path.join(ROOT, REPORT_DIR), root = ROOT) { const made = build(root); fs.mkdirSync(output, { recursive: true }); for (const [name, key] of Object.entries(REPORTS)) fs.writeFileSync(path.join(output, name), json(made[key])); return made; }
export function stage(output = path.join(ROOT, STAGE_DIR), root = ROOT, options = {}) {
  const temporary = `${output}.tmp-${process.pid}-${crypto.randomBytes(8).toString('hex')}`;
  try {
    const inv = inventory(root, options);
    if (options.geometryDescriptor && inv.oversized.length) throw Error(`PAGES_25_MIB_LIMIT:${inv.oversized[0].path}`);
    const tracked = new Set(trackedPaths(root));
    const trackedIncluded = inv.files.filter(file => tracked.has(file.path)).map(file => file.path);
    const blobs = canonicalBlobs(root, trackedIncluded);
    for (const file of inv.files) {
      const target = path.join(temporary, file.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, blobs.get(file.path) || fs.readFileSync(path.join(root, file.path)));
    }
    if (options.runtimeConfigBytes) fs.writeFileSync(path.join(temporary, 'js/gridlyRuntimeEnvironmentConfig.js'), options.runtimeConfigBytes);
    fs.rmSync(output, { recursive: true, force: true });
    fs.renameSync(temporary, output);
    return inv;
  } catch (error) {
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.rmSync(output, { recursive: true, force: true });
    throw error;
  }
}
export function verify(root = ROOT) { const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1831-')); try { const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); writeReports(a, root); writeReports(b, root); for (const name of Object.keys(REPORTS)) { const x = fs.readFileSync(path.join(a, name)); if (!x.equals(fs.readFileSync(path.join(b, name))) || !x.equals(fs.readFileSync(path.join(root, REPORT_DIR, name)))) throw Error(`deterministic report drift: ${name}`); if (x.includes(13) || (x[0] === 0xef && x[1] === 0xbb && x[2] === 0xbf)) throw Error(`non-canonical encoding: ${name}`); } return true; } finally { fs.rmSync(temp, { recursive: true, force: true }); } }
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || 'build';
  const flag = name => { const at = process.argv.indexOf(name); if (at < 0) return undefined; if (!process.argv[at + 1] || process.argv[at + 1].startsWith('--')) throw Error(`${name} requires a value`); return path.resolve(process.argv[at + 1]); };
  const output = flag('--output'), runtimeConfigFile = flag('--runtime-config-file'), reportFile = flag('--report-file');
  let result;
  if (mode === 'build') result = writeReports(output);
  else if (mode === 'stage') result = stage(output);
  else if (mode === 'stage-production') result = stageProduction({ output, runtimeConfigFile, reportFile });
  else if (mode === 'verify-production') result = verifyProduction({ output, reportFile });
  else if (mode === 'verify') result = verify();
  else throw Error(`unknown mode: ${mode}`);
  const safe = mode.includes('production') ? ` candidate=${result.candidateGitSha || result.report.candidateGitSha} files=${result.fileCount || result.report.fileCount} bytes=${result.totalBytes || result.report.totalBytes} digest=${result.artifactDigest || result.report.artifactDigest}` : '';
  console.log(`LP183.1 ${mode} PASS; no Cloudflare command executed.${safe}`);
}
