import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalBlobs, trackedPaths } from '../lp18321/git-asset-identity.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPORT_DIR = 'reports/lp1831';
export const STAGE_DIR = '.artifacts/lp1831/cloudflare-pages';
export const GENERATED_AT = '1970-01-01T00:00:00.000Z';
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
export const REMOTE_GEOMETRY = Object.freeze({
  canonicalPath: 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json',
  bytes: 47911048,
  sha256: '891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316',
  countyCount: 254
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
if (process.argv[1] === fileURLToPath(import.meta.url)) { const mode = process.argv[2] || 'build'; const outputFlag = process.argv.indexOf('--output'); const output = outputFlag < 0 ? undefined : path.resolve(process.argv[outputFlag + 1]); if (outputFlag >= 0 && !process.argv[outputFlag + 1]) throw Error('--output requires a directory'); if (mode === 'build') writeReports(output); else if (mode === 'stage') stage(output); else if (mode === 'verify') verify(); else throw Error(`unknown mode: ${mode}`); console.log(`LP183.1 ${mode} PASS; no Cloudflare command executed.`); }
