import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE_COMMIT = 'a090933138973b68aecb64ff09c732ce04b6db20';
export const REPORT_DIR = 'reports/lp177';
export const REPORT_NAMES = ['prerequisite-matrix.json', 'authorization-reassessment.json', 'protected-artifact-identities.json', 'lp177-summary.json'];
const PROTECTED = [
  'js/app.js',
  ...['activation-authorization-decision.json', 'app-distribution-authorization-decision.json', 'blocker-register.json', 'deployment-authorization-decision.json', 'launch-readiness-assessment.json', 'lp167-summary.json', 'prerequisite-reconciliation.json', 'production-readiness-checklist.json', 'protected-artifact-hashes.json', 'public-launch-authorization-decision.json'].map(name => `reports/lp167/${name}`),
  ...['launch-authorization-readiness-report.json', 'lp173-summary.json', 'operational-evidence-completion-report.json'].map(name => `reports/lp173/${name}`),
  ...['authorization-reassessment-report.json', 'deterministic-validation-report.json', 'operational-evidence-summary.json'].map(name => `reports/lp174/${name}`),
  'evidence/lp173/owner-evidence.autodiscovered.json'
];
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readText = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function engineeringValidation(root) {
  const manifest = JSON.parse(readText(root, 'manifest.json'));
  const index = readText(root, 'index.html');
  const worker = readText(root, 'service-worker.js');
  const requiredIcons = ['192x192', '512x512'];
  const pwaChecks = {
    manifestLinked: /rel=["']manifest["'][^>]+href=["']manifest\.json["']/.test(index),
    serviceWorkerRegistered: /navigator\.serviceWorker\.register\(["']\.\/service-worker\.js["']/.test(readText(root, 'js/app.js')),
    standaloneDisplay: manifest.display === 'standalone',
    startAndScopePresent: Boolean(manifest.start_url && manifest.scope),
    requiredIcons: requiredIcons.every(size => manifest.icons.some(icon => icon.sizes === size && fs.existsSync(path.join(root, icon.src)))),
    offlineShell: worker.includes('caches.open(') && worker.includes('caches.match("./index.html")')
  };
  const capacitor = JSON.parse(readText(root, 'capacitor.config.json'));
  const android = readText(root, 'android/app/build.gradle');
  const ios = readText(root, 'ios/App/App/Info.plist');
  const nativeChecks = {
    canonicalApplicationId: capacitor.appId === 'com.gridly.app' && android.includes("applicationId 'com.gridly.app'") && ios.includes('<string>com.gridly.app</string>'),
    androidProjectPresent: fs.existsSync(path.join(root, 'android/gradlew')) && fs.existsSync(path.join(root, 'android/app/src/main/AndroidManifest.xml')),
    iosProjectPresent: fs.existsSync(path.join(root, 'ios/App/App.xcodeproj/project.pbxproj')) && fs.existsSync(path.join(root, 'ios/App/App/AppDelegate.swift')),
    governedVersionFieldsPresent: /versionCode\s+\d+/.test(android) && /versionName\s+'[^']+'/.test(android) && ios.includes('CFBundleShortVersionString') && ios.includes('CFBundleVersion')
  };
  if (!Object.values(pwaChecks).every(Boolean)) throw Error('LP177 fails closed: PWA engineering validation failed');
  if (!Object.values(nativeChecks).every(Boolean)) throw Error('LP177 fails closed: native project validation failed');
  return { pwaChecks, nativeChecks };
}

function row(id, prerequisite, category, status, evidence, remaining = null) {
  return { id, prerequisite, category, status, evidence, remainingBlocker: remaining };
}

export function protectedIdentities(root = ROOT) {
  const artifacts = PROTECTED.map(relative => {
    const expected = execFileSync('git', ['show', `${BASELINE_COMMIT}:${relative}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    const actual = execFileSync('git', ['show', `HEAD:${relative}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    return { path: relative, identity: 'CANONICAL_GIT_BLOB', expectedSha256: sha(expected), actualSha256: sha(actual), classification: expected.equals(actual) ? 'PASS' : 'FAIL' };
  });
  return { schemaVersion: 'gridly.lp177.protectedIdentities.v1', baselineCommit: BASELINE_COMMIT, comparisonCommit: 'HEAD', workingTreeIgnored: true, classification: artifacts.every(item => item.classification === 'PASS') ? 'PASS' : 'FAIL', artifacts };
}

export function build(root = ROOT) {
  const validation = engineeringValidation(root);
  const prerequisites = [
    row('LP167-B001', 'Eleven-county address certification', 'PLATFORM_DEPENDENT', 'BLOCKED_PLATFORM_INPUT', 'evidence/lp135/statewide-certification.json', 'The eleven byte-identical LP130 packages are absent; restore/mount and certify them through LP134 without weakening exact-match rules.'),
    row('LP167-B002', 'Live Talco routing validation', 'PLATFORM_DEPENDENT', 'BLOCKED_LIVE_VALIDATION', 'reports/lp163/lp163-summary.json', 'A launch-window Talco route attestation and smoke test must be performed against the live route.'),
    row('LP167-B003-Q', 'Quiet awareness live validation', 'PLATFORM_DEPENDENT', 'BLOCKED_LIVE_VALIDATION', 'reports/lp164/lp164-summary.json', 'Observe and attest the quiet state against configured production sources.'),
    row('LP167-B003-A', 'Active awareness live validation', 'PLATFORM_DEPENDENT', 'BLOCKED_LIVE_VALIDATION', 'reports/lp164/lp164-summary.json', 'Observe and attest an active state against configured production sources.'),
    row('LP167-B003-C', 'Cleared awareness live validation', 'PLATFORM_DEPENDENT', 'BLOCKED_LIVE_VALIDATION', 'reports/lp164/lp164-summary.json', 'Observe and attest a cleared transition against configured production sources.'),
    row('LP167-B005', 'Physical-device validation', 'PLATFORM_DEPENDENT', 'BLOCKED_PHYSICAL_DEVICE', 'reports/lp166/lp166-summary.json', 'Record real Android and iPhone browser evidence; packaged apps additionally require closed-platform testing.'),
    row('LP167-B009', 'PWA readiness', 'ENGINEERING_COMPLETABLE', 'COMPLETED', 'LP177 deterministic manifest, service-worker, icon, shell, and install-contract validation'),
    row('LP167-B010-A', 'Governed Android build readiness', 'PLATFORM_DEPENDENT', 'ENGINEERING_PROJECT_VALIDATED_PLATFORM_BLOCKED', 'LP177 native project validation', 'Produce a governed signed build under release credentials and platform governance.'),
    row('LP167-B010-I', 'Governed iOS build readiness', 'PLATFORM_DEPENDENT', 'ENGINEERING_PROJECT_VALIDATED_PLATFORM_BLOCKED', 'LP177 native project validation', 'Produce a governed signed build with Xcode, Apple credentials, and platform governance.'),
    row('LP167-B010-C', 'Closed testing readiness', 'PLATFORM_DEPENDENT', 'BLOCKED_PLATFORM_APPROVAL', 'reports/lp167/blocker-register.json', 'Complete Google Play closed testing and TestFlight with governed accounts and physical testers.'),
    row('LP167-B011', 'Store asset readiness', 'PLATFORM_DEPENDENT', 'BLOCKED_PLATFORM_OWNER_INPUT', 'assets/store repository inventory', 'Complete store metadata, screenshots, support assets, and confirm store-account ownership.'),
    row('LP167-B012', 'Legal approval', 'EXTERNAL_OWNER_APPROVAL', 'BLOCKED_EXTERNAL_APPROVAL', 'reports/lp167/blocker-register.json', 'Legal must approve the privacy, terms, disclaimer, data-use, refund/subscription, and support materials.'),
    row('LP167-B013', 'Final owner launch approval', 'EXTERNAL_OWNER_APPROVAL', 'BLOCKED_OWNER_APPROVAL', 'reports/lp167/blocker-register.json', 'Owner must approve the launch window, incident/support plan, release notes, limitations, and launch-day script.')
  ];
  const protectedIdentity = protectedIdentities(root);
  if (protectedIdentity.classification !== 'PASS') throw Error('LP177 fails closed: protected artifact identity changed');
  const blockers = Object.fromEntries(prerequisites.filter(item => item.remainingBlocker).map(item => [item.id, item.remainingBlocker]));
  const decisions = {
    deployment: ['LP167-B002', 'LP167-B003-Q', 'LP167-B003-A', 'LP167-B003-C', 'LP167-B005', 'LP167-B012', 'LP167-B013'],
    activation: ['LP167-B001', 'LP167-B002', 'LP167-B003-Q', 'LP167-B003-A', 'LP167-B003-C', 'LP167-B005', 'LP167-B012', 'LP167-B013'],
    distribution: ['LP167-B005', 'LP167-B010-A', 'LP167-B010-I', 'LP167-B010-C', 'LP167-B011', 'LP167-B012', 'LP167-B013'],
    publicLaunch: ['LP167-B002', 'LP167-B003-Q', 'LP167-B003-A', 'LP167-B003-C', 'LP167-B005', 'LP167-B012', 'LP167-B013']
  };
  const authorization = Object.fromEntries(Object.entries(decisions).map(([operation, ids]) => [operation, { status: 'NOT_AUTHORIZED', authorizationGranted: false, remainingPrerequisites: ids.map(id => ({ id, reason: blockers[id] })) }]));
  const matrix = { schemaVersion: 'gridly.lp177.prerequisiteMatrix.v1', milestone: 'LP177', policySource: 'LP167', prerequisites, counts: { evaluated: prerequisites.length, completed: prerequisites.filter(item => item.status === 'COMPLETED').length, externalOwnerApproval: prerequisites.filter(item => item.category === 'EXTERNAL_OWNER_APPROVAL').length, platformDependent: prerequisites.filter(item => item.category === 'PLATFORM_DEPENDENT').length }, engineeringValidation: validation };
  const reassessment = { schemaVersion: 'gridly.lp177.authorizationReassessment.v1', boundary: 'AUTHORIZATION_ONLY_NO_EXECUTION', authorization, operationsPerformed: { deployments: 0, activations: 0, distributions: 0, publicLaunches: 0, runtimeModifications: 0 }, failClosed: true };
  const summary = { schemaVersion: 'gridly.lp177.summary.v1', milestone: 'LP177', rootCause: 'LP167 combined repository-verifiable engineering readiness with prerequisites requiring unavailable immutable county packages, live production observations, physical devices, governed store platforms, legal approval, and owner approval. LP176 evidence completion could not truthfully satisfy those distinct gates.', engineeringPrerequisitesCompleted: ['LP167-B009 PWA readiness'], engineeringProjectValidationCompleted: ['LP167-B010-A Android project readiness', 'LP167-B010-I iOS project readiness'], remainingBlockerCount: prerequisites.filter(item => item.remainingBlocker).length, authorization: Object.fromEntries(Object.entries(authorization).map(([key, value]) => [key, value.status])), protectedIdentityResult: 'PASS', deterministicGeneration: 'PASS', launchExecutionStatement: 'NO_PRODUCTION_OPERATION_PERFORMED' };
  return { 'prerequisite-matrix.json': matrix, 'authorization-reassessment.json': reassessment, 'protected-artifact-identities.json': protectedIdentity, 'lp177-summary.json': summary };
}

export function write(output = path.join(ROOT, REPORT_DIR), root = ROOT) { const reports = build(root); fs.mkdirSync(output, { recursive: true }); for (const name of REPORT_NAMES) fs.writeFileSync(path.join(output, name), encode(reports[name]), 'utf8'); return reports; }
export function verify(root = ROOT) { const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp177-')); try { const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(a, root); write(b, root); for (const name of REPORT_NAMES) { const one = fs.readFileSync(path.join(a, name)); const two = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, REPORT_DIR, name)); if (!one.equals(two) || !one.equals(committed)) throw Error(`LP177 deterministic drift: ${name}`); if (one.includes(13) || (one[0] === 0xef && one[1] === 0xbb && one[2] === 0xbf)) throw Error(`LP177 canonical encoding failure: ${name}`); } return true; } finally { fs.rmSync(temp, { recursive: true, force: true }); } }

if (process.argv[1] === fileURLToPath(import.meta.url)) { const command = process.argv[2] ?? 'build'; if (command === 'build') { write(); console.log('LP177 prerequisite closure reports written; no operation performed.'); } else if (command === 'verify') { verify(); console.log('LP177 verification PASS'); } else throw Error(`Unknown command: ${command}`); }
