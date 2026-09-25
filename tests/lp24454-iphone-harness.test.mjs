import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { expected, sourceGate, deviceGate, preservation, contained, redact, projectFiles, classifyVisual, stagedIdentity, critical } from '../tools/lp24454/core.mjs';
import { measurePage, analyzeAttachments, onboardingFailures } from '../tools/lp24454/analyze.mjs';

function fixtures() {
  const device = {
    hardwareProperties: { udid: expected.udid, productType: expected.productType, marketingName: expected.model, reality: 'physical' },
    deviceProperties: { osVersionNumber: expected.os, osBuildUpdate: expected.osBuild, bootState: 'booted', developerModeStatus: 'enabled' },
    connectionProperties: { pairingState: 'paired', tunnelState: 'connected', transportType: 'wired' },
  };
  return { list: { result: { devices: [structuredClone(device)] } }, details: { result: { device } },
    apps: { result: { apps: [{ bundleIdentifier: expected.bundle, version: expected.version, bundleVersion: expected.build }] } },
    destinations: `{ platform:iOS, arch:arm64, id:${expected.udid}, name:Denise’s iPhone }` };
}
const gate = f => deviceGate(f.list, f.details, f.apps, f.destinations);

// Reduced from /tmp/gridly-device-details.json (Xcode 27, jsonVersion 5).
// Preserve the real nesting and enum representation; omit unrelated capabilities.
function xcode27Fixtures() {
  const f = fixtures();
  const device = {
    ...f.details.result.device,
    identifier: '182DB667-3757-563F-8A53-0917D7EE2D4A',
    properties: {
      hardware: { udid: expected.udid, productType: expected.productType, marketingName: expected.model, reality: 'physical' },
      software: {
        osVersionNumber: { components: [26, 7, 0, 0, 0], originalComponentsCount: 2, stringValue: '26.7' },
        osBuildVersions: { buildVersion: { name: '23H24' }, supplementalBuildVersion: { name: '23H24' } },
      },
      state: { bootState: 'booted', developerModeStatus: { enabled: { mode: 1 } } },
      connection: { pairingState: 'paired', state: 'connected', transportType: 'wired' },
    },
  };
  f.details = { info: { jsonVersion: 5, outcome: 'success' }, result: device };
  f.list = { info: { jsonVersion: 5, outcome: 'success' }, result: { devices: [structuredClone(device)] } };
  return f;
}

test('Xcode 27 direct result and current properties pass without deprecated dictionaries', () => {
  const f = xcode27Fixtures();
  for (const d of [f.details.result, ...f.list.result.devices]) {
    for (const key of ['hardwareProperties', 'deviceProperties', 'connectionProperties']) delete d[key];
  }
  const result = gate(f);
  assert.equal(result.status, 'PASS');
  assert.equal(result.observed.hardware.udid, expected.udid);
  assert.equal(result.observed.hardware.reality, 'physical');
  assert.equal(result.observed.properties.osVersionNumber, '26.7');
  assert.equal(result.observed.properties.osBuildUpdate, '23H24');
  assert.equal(result.observed.properties.developerModeStatus, 'enabled');
  assert.equal(result.observed.connection.tunnelState, 'connected');
});

test('deprecated dictionaries remain a fallback for direct results', () => {
  const f = xcode27Fixtures();
  delete f.details.result.properties;
  delete f.list.result.devices[0].properties;
  assert.equal(gate(f).status, 'PASS');
});

const currentFields = [
  ['hardware', 'udid', 'other'],
  ['hardware', 'productType', 'iPhone15,2'],
  ['hardware', 'marketingName', 'other'],
  ['hardware', 'reality', 'simulated'],
  ['software', 'osVersionNumber', { stringValue: '27' }],
  ['software', 'osBuildVersions', { buildVersion: { name: 'wrong' } }],
  ['state', 'bootState', 'shutdown'],
  ['state', 'developerModeStatus', { disabled: {} }],
  ['connection', 'pairingState', 'unpaired'],
  ['connection', 'state', 'disconnected'],
  ['connection', 'transportType', 'wireless'],
];
for (const [section, field, wrong] of currentFields) {
  for (const missing of [false, true]) test(`Xcode 27 blocks ${missing ? 'missing' : 'wrong'} ${field} despite valid deprecated fields`, () => {
    const f = xcode27Fixtures();
    if (missing) delete f.details.result.properties[section][field];
    else f.details.result.properties[section][field] = wrong;
    assert.equal(gate(f).status, 'BLOCKED');
  });
}
for (const mode of [{ enabled: { mode: 0 } }, { enabled: { mode: '1' } }, { enabled: { mode: 1 }, disabled: {} }, 'enabled', null]) {
  test('Xcode 27 rejects unproven Developer Mode ' + JSON.stringify(mode), () => {
    const f = xcode27Fixtures();
    f.details.result.properties.state.developerModeStatus = mode;
    assert.equal(gate(f).status, 'BLOCKED');
  });
}
for (const properties of [null, {}, 'unknown']) test('malformed current properties fail closed ' + JSON.stringify(properties), () => {
  const f = xcode27Fixtures();
  f.details.result.properties = properties;
  assert.equal(gate(f).status, 'BLOCKED');
});
test('current device-list identity cannot fall back to a valid deprecated UDID', () => {
  const f = xcode27Fixtures();
  f.list.result.devices[0].properties.hardware.udid = 'other';
  assert.equal(gate(f).status, 'BLOCKED');
});
test('current device-list duplicate identity blocks', () => {
  const f = xcode27Fixtures();
  f.list.result.devices.push(structuredClone(f.list.result.devices[0]));
  assert.equal(gate(f).status, 'BLOCKED');
});

test('known complete device evidence passes; fixture is not claimed as physical evidence', () => {
  assert.equal(gate(fixtures()).status, 'PASS');
});
for (const [name, mutate] of [
  ['wrong UDID', f => { f.details.result.device.hardwareProperties.udid = 'other'; }],
  ['no device', f => { f.list.result.devices = []; }],
  ['duplicate match', f => { f.list.result.devices.push(f.list.result.devices[0]); }],
  ['missing reality', f => { delete f.details.result.device.hardwareProperties.reality; }],
  ['not physical', f => { f.details.result.device.hardwareProperties.reality = 'simulated'; }],
  ['wrong product', f => { f.details.result.device.hardwareProperties.productType = 'other'; }],
  ['wrong build', f => { f.details.result.device.deviceProperties.osBuildUpdate = 'other'; }],
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


function acceptedOnboarding() {
  const pages = Array.from({length: 7}, (_, i) => ({page: i + 1, accessibility: {label: 'page'}}));
  const events = [{action: 'page-1-start', evidence: 'verified-page-1-start'}];
  for (let from = 1; from < 7; from++) events.push({action: 'transition', control: 'Next', from, to: from + 1, evidence: 'next-' + from});
  events.push({action: 'transition', control: 'Back', from: 2, to: 1, evidence: 'back-verified-page-1'},
    {action: 'transition', control: 'Next', from: 1, to: 2, evidence: 'forward-restored-page-2'});
  for (const [label, identifier, state] of [['Finish', 'gridlyV894C2FirstRunFinishBtn', 'after-Finish'], ['Skip walkthrough', 'gridlyV894CFirstRunSkipBtn', 'after-Skip']]) {
    events.push({action: 'required-tap', label, identifier}, {action: 'post-onboarding', control: state, evidence: state});
  }
  events.push({action: 'onboarding-complete', journeyStarted: false});
  const screens = [...pages.map(p => 'onboarding-' + p.page), ...events.map(e => e.evidence).filter(Boolean)]
    .map(name => ({name, accessibility: {label: 'observed'}, screenPixels: {width: 1290, height: 2796}}));
  return {pages, events, screens, screenshotCount: screens.length};
}
const acceptanceErrors = f => onboardingFailures(f.pages, f.events, f.screens, f.screenshotCount);
test('complete physical onboarding evidence permits extraction without certifying layout', () => {
  assert.deepEqual(acceptanceErrors(acceptedOnboarding()), []);
});
for (const action of ['page-1-start', 'transition', 'required-tap', 'post-onboarding', 'onboarding-complete']) {
  test('acceptance fails closed without ' + action, () => {
    const f = acceptedOnboarding(); f.events = f.events.filter(e => e.action !== action);
    assert.ok(acceptanceErrors(f).length);
  });
}
for (const control of ['Next', 'Back', 'Skip walkthrough', 'Finish']) {
  test('missing required control/result blocks: ' + control, () => {
    const f = acceptedOnboarding(); f.events = f.events.filter(e => e.control !== control && e.label !== control);
    assert.ok(acceptanceErrors(f).length);
  });
}
test('wrong Next page identity and missing forward restoration block', () => {
  for (const change of [f => { f.events.find(e => e.from === 4).to = 6; }, f => { f.events = f.events.filter(e => e.evidence !== 'forward-restored-page-2'); }]) {
    const f = acceptedOnboarding(); change(f); assert.ok(acceptanceErrors(f).length);
  }
});
test('missing page, screenshot, AX, or state evidence cannot pass', () => {
  for (const change of [f => f.pages.pop(), f => f.pages.reverse(), f => f.screenshotCount--, f => delete f.screens[0].accessibility, f => f.screens.pop()]) {
    const f = acceptedOnboarding(); change(f); assert.ok(acceptanceErrors(f).length);
  }
});
test('blocked safe replay or automatic journey cannot pass', () => {
  for (const event of [{status: 'BLOCKED'}, {gate: 'R1-real-geolocation'}, {label: 'Around Me — use my location'}]) {
    const f = acceptedOnboarding(); f.events.push(event); assert.ok(acceptanceErrors(f).length);
  }
});
test('malformed unrelated AX elements are inspected without activation queries', () => {
  const unrelated = {label: 'Know Before You Go', frame: {x: NaN, y: 0, width: 0, height: 0}, get isHittable() { throw new Error('Activation point invalid'); }};
  assert.doesNotThrow(() => measurePage({page: 1, appFramePoints: {x: 0, y: 0, width: 430, height: 932}, accessibility: {children: [unrelated]}}));
  const swift = fs.readFileSync(new URL('../tools/lp24454/GridlyAcceptance.swift', import.meta.url), 'utf8');
  assert.doesNotMatch(swift, /app\.buttons\.allElementsBoundByIndex/);
  const observation = swift.slice(swift.indexOf('private func tourNodes'), swift.indexOf('private func blocked'));
  assert.doesNotMatch(observation, /isHittable/);
  const required = swift.slice(swift.indexOf('private func requiredTap'), swift.indexOf('private func expectPage'));
  assert.match(required, /buttons\.matching\(predicate\)/);
  assert.ok(required.indexOf('try capture') < required.indexOf('button.isHittable'));
  assert.match(required, /matches.count == 1/);
  assert.match(required, /guard button.isEnabled/);
});
test('Swift safety contract uses bounded Back, exact safe replay ID, real Finish and separate journey', () => {
  const swift = fs.readFileSync(new URL('../tools/lp24454/GridlyAcceptance.swift', import.meta.url), 'utf8');
  assert.match(swift, /stride\(from: initial, to: 0, by: -1\)/);
  assert.match(swift, /identifier: "settingsReplaySetupBtn", tour: false, idOnly: true/);
  assert.match(swift, /requiredTap\("Finish", identifier: "gridlyV894C2FirstRunFinishBtn"\)/);
  assert.match(swift, /requiredTap\("Skip walkthrough", identifier: "gridlyV894CFirstRunSkipBtn"\)/);
  assert.doesNotMatch(swift, /resetGridly|forceSetupReset|removeItem|evaluateJavaScript/);
  const onboarding = swift.slice(swift.indexOf('private func onboarding()'), swift.indexOf('func testPhysicalJourney'));
  assert.doesNotMatch(onboarding, /Around Me|testPhysicalJourney\(/);
  assert.match(onboarding, /expectShell\("after-Finish"\)/);
  assert.match(onboarding, /expectShell\("after-Skip"\)/);
});
