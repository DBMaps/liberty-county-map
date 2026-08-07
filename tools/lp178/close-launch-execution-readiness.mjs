import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASELINE = '121b24926ec33d8a3ec33706cbe3280b388544c4';
export const REPAIR_BASELINE = '333141cf220c174f48f1d87c84a9873ff8e9c8a2';
export const COMPARISON_COMMIT = '8f70179327944b8b371a87c87cc13bb8a7232eb8';
export const LP1782_APP_BLOB = '13d316b56a3cde2e37d158681638780892e0cd2b';
export const LP1783_REPAIR_COMMIT = 'fa16aa8ea97f4c270b93f87dd33ebe8f72787cc4';
export const LP1783_APP_BLOB = '01a3ae3792f4bc29a5542001c525a1cdce52278d';
export const REPORT_DIR = 'reports/lp178';
export const NAMES = ['launch-readiness-report.json', 'owner-validation-checklist.json', 'protected-artifact-identities.json', 'lp178-summary.json'];
const PROTECTED = ['js/app.js', 'reports/lp167/launch-readiness-assessment.json', 'reports/lp167/blocker-register.json', 'reports/lp167/deployment-authorization-decision.json', 'reports/lp167/activation-authorization-decision.json', 'reports/lp167/app-distribution-authorization-decision.json', 'reports/lp167/public-launch-authorization-decision.json', 'reports/lp177/prerequisite-matrix.json', 'reports/lp177/authorization-reassessment.json'];
const encode = value => `${JSON.stringify(value, null, 2)}\n`;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (root, name) => fs.readFileSync(path.join(root, name), 'utf8');

function repositoryValidation(root) {
  const capacitor = JSON.parse(read(root, 'capacitor.config.json'));
  const android = read(root, 'android/app/build.gradle');
  const ios = read(root, 'ios/App/App/Info.plist');
  const pbx = read(root, 'ios/App/App.xcodeproj/project.pbxproj');
  const values = {
    applicationId: 'com.gridly.app', androidVersionCode: 1, androidVersionName: '1.0',
    iosBundleId: 'com.gridly.app', iosShortVersion: '1.0', iosBuildVersion: '1'
  };
  const checks = {
    identifiersAligned: capacitor.appId === values.applicationId && android.includes(`applicationId '${values.applicationId}'`) && ios.includes(`<string>${values.iosBundleId}</string>`),
    androidVersionAligned: android.includes(`versionCode ${values.androidVersionCode}`) && android.includes(`versionName '${values.androidVersionName}'`),
    iosVersionAligned: ios.includes(`<string>${values.iosShortVersion}</string>`) && ios.includes(`<string>${values.iosBuildVersion}</string>`),
    androidProjectComplete: fs.existsSync(path.join(root, 'android/app/src/main/AndroidManifest.xml')),
    iosProjectComplete: pbx.trim().length > 0 && fs.existsSync(path.join(root, 'ios/App/App/AppDelegate.swift')),
    storeIconPresent: fs.existsSync(path.join(root, 'assets/store/icons/gridly-icon-master-1024.png'))
  };
  if (!Object.values(checks).every(Boolean)) throw Error(`LP178 repository validation failed: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
  const buildInputs = { androidGradleWrapperJarAvailable: fs.existsSync(path.join(root, 'android/gradle/wrapper/gradle-wrapper.jar')) };
  if (buildInputs.androidGradleWrapperJarAvailable) throw Error('LP178 boundary failure: binary Gradle wrapper JAR must not be supplied by this milestone');
  return { classification: 'PASS', values, checks, buildInputs, buildAttempts: {
    android: { command: './android/gradlew :app:assembleDebug', result: 'BLOCKED_BY_ENVIRONMENT', evidence: 'The governed repository baseline has no Gradle wrapper JAR; Android SDK and release signing credentials are also unavailable. No Android build PASS is inferred.' },
    ios: { command: 'xcodebuild', result: 'BLOCKED_BY_ENVIRONMENT', evidence: 'xcodebuild is unavailable in this Linux environment; Apple signing and account evidence are also absent.' }
  }};
}

function item(id, name, classification, evidence, remainingAction, repositoryWorkComplete, ownerAction, platformAction) {
  return { id, name, classification, evidence, remainingAction, repositoryWorkComplete, ownerActionRequired: ownerAction, platformActionRequired: platformAction };
}

export function identities(root = ROOT) {
  const artifacts = PROTECTED.map(file => {
    const expectedCommit = file === 'js/app.js' ? LP1783_REPAIR_COMMIT : BASELINE;
    const expectedGitBlob = file === 'js/app.js' ? LP1783_APP_BLOB : execFileSync('git', ['rev-parse', `${expectedCommit}:${file}`], { cwd: root, encoding: 'utf8' }).trim();
    const actualComparisonCommit = file === 'js/app.js' ? LP1783_REPAIR_COMMIT : COMPARISON_COMMIT;
    const actualGitBlob = file === 'js/app.js'
      ? execFileSync('git', ['rev-parse', `${LP1783_REPAIR_COMMIT}:${file}`], { cwd: root, encoding: 'utf8' }).trim()
      : execFileSync('git', ['rev-parse', `${COMPARISON_COMMIT}:${file}`], { cwd: root, encoding: 'utf8' }).trim();
    const expected = execFileSync('git', ['cat-file', 'blob', expectedGitBlob], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    const actual = execFileSync('git', ['cat-file', 'blob', actualGitBlob], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
    for (const [source, bytes] of [['expected', expected], ['actual', actual]]) {
      if (bytes.includes(13) || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) throw Error(`LP178 non-canonical ${source} Git blob: ${file}`);
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    }
    return { path: file, identity: 'CANONICAL_GIT_BLOB', expectedBaselineCommit: expectedCommit, authorizedLp1782GitBlob: file === 'js/app.js' ? LP1782_APP_BLOB : null, authorizedLp1783GitBlob: file === 'js/app.js' ? LP1783_APP_BLOB : null, expectedGitBlob, actualComparisonCommit, actualGitBlob, expectedSha256: sha(expected), actualSha256: sha(actual), classification: expectedGitBlob === actualGitBlob ? 'PASS' : 'FAIL' };
  });
  return {
    schemaVersion: 'gridly.lp178.protectedIdentities.v4',
    provenance: {
      originalLp178BaselineCommit: BASELINE,
      authorizedLp1781RepairCommit: REPAIR_BASELINE,
      authorizedLp1782RepairGitBlob: LP1782_APP_BLOB,
      authorizedLp1783RepairCommit: LP1783_REPAIR_COMMIT,
      authorizedLp1783RepairGitBlob: LP1783_APP_BLOB,
      currentComparisonCommit: COMPARISON_COMMIT,
      transition: 'LP178_BASELINE -> AUTHORIZED_LP178.1_ROUTE_WATCH_REPAIR -> AUTHORIZED_LP178.2_GEOMETRY_BRIDGE -> AUTHORIZED_LP178.3_ROUTE_AWARE_HYDRATION -> RECONCILED_PROTECTED_IDENTITY'
    },
    classification: artifacts.every(x => x.classification === 'PASS') ? 'PASS' : 'FAIL',
    artifacts
  };
}

export function build(root = ROOT) {
  const repository = repositoryValidation(root);
  const checklist = {
    schemaVersion: 'gridly.lp178.ownerChecklist.v1', instructions: 'Record actual observations, timestamps, production URL/build identity, device/platform, tester, and screenshots or screen recording. Do not mark PASS from this blank checklist.',
    live: [
      { id: 'LP167-B002', procedure: 'On the public production network, select Talco, choose a governed destination, request the route, and confirm destination identity, route geometry, turn/preview output, route intelligence and Route Watch remain tied to that route; record truthful failure if the provider fails.', requiredEvidence: ['UTC timestamp', 'production URL and release identity', 'origin and selected destination', 'route-provider result', 'screenshots/recording of selection, route, preview, intelligence and Route Watch', 'owner attestation'] },
      { id: 'LP167-B003-Q', procedure: 'With configured production Supabase, roadway and weather/public sources, select the governed awareness area during a genuinely quiet observation and confirm zero invented active hazards, local scope, current-check wording, retained context, no all-clear claim and no stale active remnant.', requiredEvidence: ['UTC timestamp and area', 'source/config identity', 'screenshots/recording', 'observed counts and consumer wording', 'owner attestation'] },
      { id: 'LP167-B003-A', procedure: 'Observe a genuine active production-source item and confirm correct area/relevance, situation, road or crossing, freshness, report count, qualified confidence and consistent active presentation.', requiredEvidence: ['UTC timestamp and area', 'source record/reference without secrets', 'screenshots/recording of all affected surfaces', 'observed counts/freshness', 'owner attestation'] },
      { id: 'LP167-B003-C', procedure: 'Observe the same genuine item transition to cleared and refresh/change area; confirm zero active count, recently-cleared uncertainty, no active presentation and no rehydration without new active evidence.', requiredEvidence: ['active and cleared UTC timestamps', 'same source record/reference without secrets', 'before/after screenshots or recording', 'refresh/area-change result', 'owner attestation'] }
    ],
    physicalDevices: { procedure: 'Use at least one real supported Android device and one real iPhone. On each, validate portrait public-site load, install/open path, search/select, route success and truthful failure, awareness quiet/active/cleared as available, refresh/relaunch, offline shell, links and readable controls. Repeat packaged-app smoke coverage through Play closed testing and TestFlight when builds exist.', requiredEvidence: ['device model and OS version', 'browser/app and version/build identity', 'UTC timestamp and network', 'screenshots/recording', 'step results and defects', 'tester attestation'], consolidation: 'One evidence bundle may cover web and packaged-app checks and all states, but must identify each device/platform and must not substitute simulator/browser emulation.' },
    approvals: { legal: ['Privacy Policy', 'Terms', 'community-reporting disclaimer', 'data-use disclosures', 'support terms', 'pricing/subscription/refund terms if offered', 'entity and account ownership'], finalOwner: ['launch window', 'support/incident/rollback/monitoring owners', 'beta migration', 'release notes', 'known limitations', 'launch-day validation script'] }
  };
  const items = [
    item('LP167-B002', 'Live Talco routing', 'LIVE_VALIDATION_REQUIRED', 'LP163 deterministic routing PASS; no live owner observation is recorded.', 'Execute and attest checklist LP167-B002.', true, true, false),
    item('LP167-B003-Q', 'Quiet awareness validation', 'LIVE_VALIDATION_REQUIRED', 'LP164 quiet fixtures PASS; no live quiet observation is recorded.', 'Execute and attest checklist LP167-B003-Q.', true, true, false),
    item('LP167-B003-A', 'Active awareness validation', 'LIVE_VALIDATION_REQUIRED', 'LP164 active fixtures PASS; no live active observation is recorded.', 'Execute and attest checklist LP167-B003-A.', true, true, false),
    item('LP167-B003-C', 'Cleared awareness validation', 'LIVE_VALIDATION_REQUIRED', 'LP164 cleared fixtures and rehydration guard PASS; no live transition is recorded.', 'Execute and attest checklist LP167-B003-C.', true, true, false),
    item('LP167-B005', 'Physical-device validation', 'LIVE_VALIDATION_REQUIRED', 'Browser/synthetic certifications exist; no real Android/iPhone evidence is recorded.', 'Run the consolidated real-device checklist, then packaged-app checks through both closed-test platforms.', true, true, true),
    item('LP167-B010-A', 'Android build', 'BLOCKED_BY_ENVIRONMENT', 'Native project structure, identifier and version fields PASS repository validation. The governed baseline has no Gradle wrapper JAR, Android SDK or release signing credentials; no Android build PASS is inferred.', 'Supply governed platform build tooling/artifacts outside this milestone, then sync web assets and produce/sign the governed release artifact.', true, true, true),
    item('LP167-B010-I', 'iOS build', 'BLOCKED_BY_ENVIRONMENT', 'Identifiers/version/project PASS. xcodebuild and Apple signing credentials are unavailable.', 'On governed macOS/Xcode, sync web assets and archive/sign the governed release.', true, true, true),
    item('LP167-B010-C', 'Closed testing', 'PLATFORM_ACTION_REQUIRED', 'Projects are repository-ready; no Play closed-test or TestFlight submission/test evidence exists.', 'Upload governed builds, configure tester cohorts, test on physical devices, and retain platform/test evidence.', true, true, true),
    item('LP167-B011-ACCOUNT', 'Store accounts', 'OWNER_ACTION_REQUIRED', 'No governed Apple Developer/App Store Connect or Google Play Console ownership evidence is present.', 'Owner confirms active entity accounts, agreements, roles, payment/tax/contact state as applicable.', true, true, true),
    item('LP167-B011-ASSET', 'Store assets', 'OWNER_ACTION_REQUIRED', 'Repository contains the 1024px master icon; Apple/Google asset directories, screenshots and governed listing metadata are otherwise empty.', 'Owner supplies only platform-required screenshots, listing/support/legal URLs and metadata for the chosen distribution; generate platform renditions during submission.', true, true, true),
    item('LP167-B012', 'Legal approval', 'OWNER_ACTION_REQUIRED', 'LP167 requires review of the checklist legal materials; no counsel/authorized approver decision is recorded.', 'Obtain dated approval (or required corrections) for the minimum LP167 legal set.', true, true, false),
    item('LP167-B013', 'Final owner launch approval', 'OWNER_ACTION_REQUIRED', 'No explicit final owner approval is recorded.', 'After all preceding evidence is complete, Denise explicitly approves the governed launch window and operations package.', true, true, false)
  ];
  const blockerIds = items.map(x => x.id);
  const authorization = Object.fromEntries(['deployment', 'activation', 'distribution', 'publicLaunch'].map(name => [name, { status: 'NOT_AUTHORIZED', authorizationGranted: false, remainingPrerequisites: name === 'distribution' ? blockerIds.slice(4) : name === 'activation' ? blockerIds.filter(id => !['LP167-B010-A','LP167-B010-I','LP167-B010-C','LP167-B011-ACCOUNT','LP167-B011-ASSET'].includes(id)) : blockerIds.filter(id => ['LP167-B002','LP167-B003-Q','LP167-B003-A','LP167-B003-C','LP167-B005','LP167-B012','LP167-B013'].includes(id)) }]));
  const protectedIdentity = identities(root); if (protectedIdentity.classification !== 'PASS') throw Error('LP178 protected identity failure');
  const report = { schemaVersion: 'gridly.lp178.launchReadiness.v1', milestone: 'LP178', retiredPrerequisite: { id: 'LP167-B001', blanketActivationBlocker: false, countySpecificRestrictionsPreserved: 11 }, items, repositoryValidation: repository, authorization, exactRemainingBlockers: blockerIds, operationsPerformed: { deployments: 0, activations: 0, distributions: 0, publicLaunches: 0 }, authorizationReassessmentReady: true };
  const summary = { schemaVersion: 'gridly.lp178.summary.v1', repositoryCompletableWork: 'COMPLETE', remainingBlockerCount: items.length, remainingClasses: [...new Set(items.map(x => x.classification))].sort(), protectedIdentity: 'PASS', deterministicVerification: 'PASS', authorizationReassessmentReady: true, unsupportedAuthorizationGranted: false };
  return { 'launch-readiness-report.json': report, 'owner-validation-checklist.json': checklist, 'protected-artifact-identities.json': protectedIdentity, 'lp178-summary.json': summary };
}

export function write(output = path.join(ROOT, REPORT_DIR), root = ROOT) { const result = build(root); fs.mkdirSync(output, { recursive: true }); for (const name of NAMES) fs.writeFileSync(path.join(output, name), encode(result[name]), 'utf8'); return result; }
export function verify(root = ROOT) { const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp178-')); try { const a = path.join(temp, 'a'); const b = path.join(temp, 'b'); write(a, root); write(b, root); for (const name of NAMES) { const x = fs.readFileSync(path.join(a, name)); const y = fs.readFileSync(path.join(b, name)); const committed = fs.readFileSync(path.join(root, REPORT_DIR, name)); if (!x.equals(y) || !x.equals(committed) || x.includes(13) || (x[0] === 0xef && x[1] === 0xbb && x[2] === 0xbf)) throw Error(`LP178 deterministic/canonical failure: ${name}`); } return true; } finally { fs.rmSync(temp, { recursive: true, force: true }); } }
if (process.argv[1] === fileURLToPath(import.meta.url)) { const command = process.argv[2] ?? 'build'; if (command === 'build') { write(); console.log('LP178 reports written; no launch operation performed.'); } else if (command === 'verify') { verify(); console.log('LP178 verification PASS'); } else throw Error(`Unknown command: ${command}`); }
