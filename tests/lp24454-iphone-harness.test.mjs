import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expected, sourceGate, deviceGate, preservation, contained, redact, projectFiles, classifyVisual, stagedIdentity, critical } from '../tools/lp24454/core.mjs';
import { measurePage, analyzeAttachments } from '../tools/lp24454/analyze.mjs';

function fixtures() {
  const device = {
    hardwareProperties: { udid: expected.udid, productType: expected.productType, marketingName: expected.model },
    deviceProperties: { osVersionNumber: expected.os, osBuildUpdate: expected.osBuild, bootState: 'booted', developerModeStatus: 'enabled' },
    connectionProperties: { pairingState: 'paired', tunnelState: 'connected', transportType: 'wired' },
  };
  return { list: { result: { devices: [structuredClone(device)] } }, details: { result: { device } },
    apps: { result: { apps: [{ bundleIdentifier: expected.bundle, version: expected.version, bundleVersion: expected.build }] } },
    destinations: `{ platform:iOS, arch:arm64, id:${expected.udid}, name:Denise’s iPhone }` };
}
const gate = f => deviceGate(f.list, f.details, f.apps, f.destinations);

test('known complete device evidence passes; fixture is not claimed as physical evidence', () => {
  assert.equal(gate(fixtures()).status, 'PASS');
});
for (const [name, mutate] of [
  ['wrong UDID', f => { f.details.result.device.hardwareProperties.udid = 'other'; }],
  ['no device', f => { f.list.result.devices = []; }],
  ['duplicate match', f => { f.list.result.devices.push(f.list.result.devices[0]); }],
  ['wrong model', f => { f.details.result.device.hardwareProperties.marketingName = 'simulator'; }],
  ['unknown schema', f => { delete f.details.result.device.connectionProperties; }],
  ['unpaired', f => { f.details.result.device.connectionProperties.pairingState = 'unpaired'; }],
  ['disconnected', f => { f.details.result.device.connectionProperties.tunnelState = 'disconnected'; }],
  ['not booted', f => { f.details.result.device.deviceProperties.bootState = 'unknown'; }],
  ['developer mode disabled', f => { f.details.result.device.deviceProperties.developerModeStatus = 'disabled'; }],
  ['wireless transport', f => { f.details.result.device.connectionProperties.transportType = 'wireless'; }],
  ['OS drift', f => { f.details.result.device.deviceProperties.osVersionNumber = '27'; }],
  ['Gridly absent', f => { f.apps.result.apps = []; }],
  ['wrong app build', f => { f.apps.result.apps[0].bundleVersion = '2'; }],
  ['ineligible destination', f => { f.destinations += ', error:not eligible'; }],
  ['simulator destination', f => { f.destinations = f.destinations.replace('platform:iOS,', 'platform:iOS Simulator,'); }],
]) test('preflight blocks ' + name, () => {
  const f = fixtures(); mutate(f);
  assert.equal(gate(f).status, 'BLOCKED');
  assert.ok(gate(f).errors.length);
});

test('source gate preserves known staged/unstaged Mac-day files but blocks unrelated production edits', () => {
  const baseline = { head: expected.commit, branch: 'main', changed: ['ios/App/App.xcodeproj/project.pbxproj', 'ios/App/App/Info.plist', 'ios/App/App/Assets.xcassets/Splash.imageset/Contents.json'] };
  assert.deepEqual(sourceGate(baseline), []);
  assert.ok(sourceGate({ ...baseline, changed: [...baseline.changed, 'js/app.js'] }).length);
  assert.ok(sourceGate({ ...baseline, head: 'old' }).length);
  assert.ok(sourceGate({ ...baseline, branch: 'other' }).length);
});

test('preservation detects changed, added or removed native bytes and index modifications', () => {
  const before = { head: expected.commit, indexSha256: 'index', files: { project: 'signing-local', package: null } };
  assert.equal(preservation(before, structuredClone(before)).status, 'PASS');
  for (const after of [
    { ...before, files: { ...before.files, project: 'changed' } },
    { ...before, files: { ...before.files, package: 'new' } },
    { ...before, indexSha256: 'new-index' },
    { ...before, workingDiffSha256: 'changed-unlisted-source' },
  ]) assert.equal(preservation(before, after).status, 'FAIL');
});

test('evidence paths reject sibling-prefix, traversal, and root replacement', () => {
  const root = path.resolve('output/lp24454-test');
  assert.equal(contained(root, path.join(root, 'run/report.json')), path.join(root, 'run/report.json'));
  for (const candidate of [root, root + '-other/report.json', path.join(root, '../outside')]) assert.throws(() => contained(root, candidate));
});

test('provider secrets in common log forms are redacted', () => {
  const output = redact('Bearer secret1 https://example.invalid/?api_key=secret2&x=y apiKey: "secret3"');
  for (const secret of ['secret1', 'secret2', 'secret3']) assert.equal(output.includes(secret), false);
});

test('standalone project builds only a test runner, not the protected app', () => {
  const { project, scheme } = projectFiles();
  assert.match(project, /com.apple.product-type.bundle.ui-testing/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com.gridlygo.gridly.lp24454tests/);
  assert.match(project, /DEVELOPMENT_TEAM = 2XSH6R7K37/);
  assert.doesNotMatch(project, /com.apple.product-type.application|TEST_TARGET_NAME|App.xcodeproj|CapApp-SPM/);
  assert.match(scheme, /parallelizable="NO"/);
});

test('missing staged payload blocks without restaging or altering files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gridly-lp24454-'));
  try {
    const result = stagedIdentity(directory);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.checks.length, Object.keys(critical).length);
    assert.equal(result.aggregateByteDifferenceReopened, false);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally { fs.rmdirSync(directory); }
});

test('visual evidence cannot pass with missing pages, card bounds or safe-area provenance', () => {
  assert.match(classifyVisual([]).classification, /INCONCLUSIVE/);
  assert.match(classifyVisual(Array.from({ length: 7 }, (_, i) => ({ page: i + 1, screenshot: 'image.png' }))).classification, /INCONCLUSIVE/);
  const pages = Array.from({ length: 7 }, (_, i) => ({ page: i + 1, geometryProvenance: 'synthetic-test-only', safeAreaBounds: { y: 0, height: 800 }, cardBounds: { y: 40, height: 600 }, contentBounds: { y: 80, height: 300 } }));
  assert.equal(classifyVisual(pages).classification, 'TOP-BIASED SHARED SHELL');
  assert.match(classifyVisual(pages.map(p => ({ ...p, page: 1 }))).classification, /INCONCLUSIVE/);
  assert.equal(classifyVisual(pages.map((p, i) => i === 0 ? p : { ...p, contentBounds: { y: 190, height: 300 } })).classification, 'PAGE-SPECIFIC MISALIGNMENT');
});

test('AX measurements do not rename the pager region as safe-area or card geometry', () => {
  const result = measurePage({ page: 1, visibleTitle: 'Welcome to Gridly', appFramePoints: { x: 0, y: 0, width: 430, height: 932 }, accessibility: {
    label: '', frame: { x: 0, y: 0, width: 430, height: 932 }, children: [
      { label: 'Quick Tour cards and setup', frame: { x: 20, y: 60, width: 390, height: 800 } },
      { label: 'Welcome to Gridly', frame: { x: 60, y: 200, width: 300, height: 40 } },
      { label: 'Gridly logo', frame: { x: 60, y: 90, width: 300, height: 80 } },
      { label: 'Next', frame: { x: 280, y: 800, width: 100, height: 40 }, enabled: true },
    ]
  } });
  assert.equal(result.contentBoundsFromAccessibleCopy.y, 90);
  assert.ok(result.pagerRelativeMeasurements.centerOffsetFraction < 0);
  assert.equal(result.safeAreaBounds, null);
  assert.equal(result.cardBounds, null);
  assert.match(result.classification, /INCONCLUSIVE/);
});

test('empty export cannot masquerade as a completed onboarding capture', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gridly-lp24454-analysis-'));
  try {
    const result = analyzeAttachments(directory);
    assert.equal(result.status, 'INCOMPLETE_EVIDENCE');
    assert.equal(result.R1, 'INCONCLUSIVE');
    assert.deepEqual(result.productionDefects, []);
  } finally { fs.rmdirSync(directory); }
});

test('UI harness targets semantic controls and leaves permission and production internals unclaimed', () => {
  const swift = fs.readFileSync(new URL('../tools/lp24454/GridlyAcceptance.swift', import.meta.url), 'utf8');
  assert.match(swift, /XCUIApplication\(bundleIdentifier: "com.gridlygo.gridly"\)/);
  assert.match(swift, /buttons.count == 1/);
  assert.match(swift, /HUMAN ACTION REQUIRED/);
  assert.match(swift, /XCUIScreen.main.screenshot/);
  assert.match(swift, /lifetime = .keepAlways/);
  assert.match(swift, /"gate": "R1-real-geolocation", "status": "INCONCLUSIVE"/);
  assert.match(swift, /"gate": "R3-native-provider-networking", "status": "INCONCLUSIVE"/);
  assert.doesNotMatch(swift, /coordinate\(withNormalizedOffset|resetAuthorizationStatus|simulatedLocation|setLocation|launchArguments|launchEnvironment|\.buttons\["Allow/);
});

test('orchestrator never builds Gridly, syncs, edits Keychain, or invokes reporting', () => {
  const source = fs.readFileSync(new URL('../tools/lp24454/run.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /command\('(?:security|npm|npx|curl|adb)'/);
  assert.doesNotMatch(source, /'install'|'uninstall'|'simctl'|reset --hard|git clean/);
  assert.match(source, /deviceGate\(await deviceJSON/);
  assert.match(source, /physicalAcceptance: 'NOT_CERTIFIED'/);
});

test('non-Mac execution stops before creating evidence or invoking a device tool', { skip: process.platform === 'darwin' }, () => {
  const result = spawnSync(process.execPath, ['tools/lp24454/run.mjs', 'preflight'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /requires the connected Mac/);
  assert.equal(result.stdout, '');
});
