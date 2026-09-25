import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const expected = Object.freeze({
  commit: 'bbe837cc2a94214510e04b39c06626fd66b36a24', branch: 'main',
  udid: '00008120-000C49A43EC0201E', productType: 'iPhone15,3', model: 'iPhone 14 Pro Max',
  os: '26.7', osBuild: '23H24', bundle: 'com.gridlygo.gridly', version: '1.0.0', build: '1',
  team: '2XSH6R7K37', runnerBundle: 'com.gridlygo.gridly.lp24454tests',
});
export const protectedNative = [
  'ios/App/App.xcodeproj/project.pbxproj', 'ios/App/App/Info.plist',
  'ios/App/App/Assets.xcassets/Splash.imageset/Contents.json',
  'ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved',
];
export const critical = {
  'index.html': 'e5c73adfe3d39266cdf694f22c1df0b48e22c2bdb2ce9fec08e421d43e32c0e3',
  'js/app.js': '7f6780373492043f2655e1f24e678896465ef27acabaaaa88e281c7fec8bffcd',
  'js/gridly-map-visibility.js': 'c1a198de81c3ef4fc74178e05dc37594e0c1c1f3d6d64981ecbdf161c0e048b8',
  'service-worker.js': '2c99bef6e8e4e1fa557f0a548f85355b35fd1e1b9ede1e7eb64796fb035de6d5',
  'community-submission-contract.json': 'f64612279c2ef0dc6d560bb06c18f931b2e273df57e3fec781caa69a7fe6a274',
};
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = value => JSON.stringify(value, null, 2) + '\n';
export function contained(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  if (!rel || rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) throw Error('Evidence path must be strictly inside its owner directory');
  return path.resolve(candidate);
}
export function redact(text) {
  return String(text).replace(/(Bearer\s+)\S+/gi, '$1[REDACTED]')
    .replace(/([?&](?:key|api_?key|token|access_token)=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/((?:api_?key|authorization|access_token|refresh_token)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, '$1[REDACTED]');
}
export function sourceGate({ head, branch, changed }) {
  const errors = [];
  if (head !== expected.commit || branch !== expected.branch) errors.push('Expected main at ' + expected.commit);
  for (const file of changed) if (!protectedNative.slice(0, 3).includes(file)) errors.push('Unexpected tracked change: ' + file);
  return errors;
}
// Explicit CoreDevice JSON paths; missing or new schemas fail closed. Refine only
// against saved output from the installed Xcode, never infer readiness from a name.
function deviceFacts(device) {
  // An existing current dictionary is authoritative, even if incomplete or
  // malformed. Deprecated fields must never mask a failed current observation.
  if (device && Object.hasOwn(device, 'properties')) {
    const p = device.properties;
    const mode = p?.state?.developerModeStatus;
    return {
      hardware: p?.hardware || {},
      properties: {
        osVersionNumber: p?.software?.osVersionNumber?.stringValue,
        osBuildUpdate: p?.software?.osBuildVersions?.buildVersion?.name,
        bootState: p?.state?.bootState,
        developerModeStatus: mode && Object.keys(mode).length === 1 && mode.enabled?.mode === 1 ? 'enabled' : 'UNKNOWN',
      },
      connection: { ...p?.connection, tunnelState: p?.connection?.state },
    };
  }
  return { hardware: device?.hardwareProperties || {}, properties: device?.deviceProperties || {}, connection: device?.connectionProperties || {} };
}
export function deviceGate(list, details, apps, destinations) {
  const errors = [];
  const records = list?.result?.devices;
  const matches = Array.isArray(records) ? records.filter(d => deviceFacts(d).hardware.udid === expected.udid) : [];
  if (matches.length !== 1) errors.push('Expected exactly one matching physical UDID in device list');
  const result = details?.result;
  const d = result && Object.hasOwn(result, 'device') ? result.device : result;
  const { hardware, properties, connection } = deviceFacts(d);
  const requireValue = (label, actual, wanted) => { if (actual !== wanted) errors.push(`${label}: expected ${wanted}; observed ${actual ?? 'UNKNOWN'}`); };
  requireValue('UDID', hardware.udid, expected.udid);
  requireValue('physical product type', hardware.productType, expected.productType);
  requireValue('model', hardware.marketingName, expected.model);
  requireValue('device reality', hardware.reality, 'physical');
  requireValue('iOS', properties.osVersionNumber, expected.os);
  requireValue('OS build', properties.osBuildUpdate, expected.osBuild);
  requireValue('boot state', properties.bootState, 'booted');
  requireValue('Developer Mode', properties.developerModeStatus, 'enabled');
  requireValue('pairing', connection.pairingState, 'paired');
  requireValue('connection tunnel', connection.tunnelState, 'connected');
  requireValue('transport', connection.transportType, 'wired');
  const installed = Array.isArray(apps?.result?.apps) ? apps.result.apps.filter(a => a.bundleIdentifier === expected.bundle) : [];
  if (installed.length !== 1) errors.push('Expected one installed Gridly bundle');
  requireValue('Gridly version', installed[0]?.version, expected.version);
  requireValue('Gridly build', installed[0]?.bundleVersion, expected.build);
  if (!String(destinations).split(/\r?\n/).some(line => line.includes('platform:iOS,') && line.includes(`id:${expected.udid}`) && !line.includes('error:'))) errors.push('Compatible physical App scheme destination not proven');
  return { status: errors.length ? 'BLOCKED' : 'PASS', errors, observed: { hardware, properties, connection, application: installed[0] || null } };
}
export function stagedIdentity(root) {
  const checks = Object.entries(critical).map(([file, digest]) => {
    const native = path.join(root, 'ios/App/App/public', file), web = path.join(root, 'www', file);
    const staged = fs.existsSync(web) ? sha(fs.readFileSync(web)) : null;
    const synced = fs.existsSync(native) ? sha(fs.readFileSync(native)) : null;
    return { file, expected: digest, staged, synced, status: staged === digest && synced === staged ? 'PASS' : 'NOT_PROVEN' };
  });
  const report = path.join(root, '.artifacts/native-web-identity.json');
  const identity = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report, 'utf8')) : null;
  return { checks, recordedIdentity: identity && { bundleDigest: identity.bundleDigest, candidateGitSha: identity.candidateGitSha, fileCount: identity.files?.length },
    status: checks.every(c => c.status === 'PASS') ? 'PASS' : 'BLOCKED',
    installedByteIdentity: 'NOT_OBSERVABLE_FROM_VERSION_BUILD_ALONE', aggregateByteDifferenceReopened: false };
}
export function protectedSnapshot(root, git) {
  const files = [...new Set([...protectedNative, 'js/app.js', 'index.html', 'css/styles.css', 'service-worker.js', 'consumer-script-manifest.json', 'capacitor.config.json', 'package.json'])];
  return { indexSha256: sha(git(['ls-files', '-s'])), workingDiffSha256: sha(git(['diff', '--binary', 'HEAD'])), head: git(['rev-parse', 'HEAD']).trim(),
    status: git(['status', '--short']), files: Object.fromEntries(files.map(p => [p, fs.existsSync(path.join(root, p)) ? sha(fs.readFileSync(path.join(root, p))) : null])) };
}
export function preservation(before, after) {
  const changed = Object.keys(before.files).filter(p => before.files[p] !== after.files[p]);
  if (before.indexSha256 !== after.indexSha256) changed.push('GIT_INDEX');
  if (before.workingDiffSha256 !== after.workingDiffSha256) changed.push('TRACKED_WORKING_DIFF');
  if (before.head !== after.head) changed.push('HEAD');
  return { status: changed.length ? 'FAIL' : 'PASS', changed, action: 'Record differences only; never restore or reset owner state.' };
}
export function classifyVisual(pages) {
  // XCTest exposes AX geometry, not WKWebView DOM card/safe-area bounds. Never
  // substitute screen bounds for either. An external measured geometry record
  // must name its provenance before a layout conclusion is possible.
  if (pages.length !== 7 || new Set(pages.map(p => p.page)).size !== 7 || pages.some(p => !Number.isInteger(p.page) || p.page < 1 || p.page > 7 || !p.cardBounds || !p.contentBounds || !p.safeAreaBounds || !p.geometryProvenance))
    return { classification: 'INCONCLUSIVE — HUMAN VISUAL CONFIRMATION REQUIRED', reason: 'Seven complete page/card/content/safe-area measurements with provenance are required. Screenshots and AX bounds alone are observations.' };
  const measures = pages.map(p => {
    const card = p.cardBounds, content = p.contentBounds;
    if (!(card.height > 0) || !(content.height > 0) || content.y < card.y || content.y + content.height > card.y + card.height) throw Error('Invalid measured card/content geometry');
    const top = content.y - card.y, bottom = card.y + card.height - content.y - content.height;
    return { page: p.page, top, bottom, imbalanceFraction: (bottom - top) / card.height };
  });
  const biased = measures.filter(m => m.imbalanceFraction > 0.15);
  return { classification: biased.length >= 4 ? 'TOP-BIASED SHARED SHELL' : biased.length ? 'PAGE-SPECIFIC MISALIGNMENT' : 'PASS',
    criterion: 'Review threshold: unused lower minus upper space > 15% of measured card height; shared requires at least four pages.', measures,
    productionDefect: 'Requires physical provenance and visual corroboration; measurement is not a design specification.' };
}

export function projectFiles() {
  // Standalone UI-test runner, no App target/reference/dependency. Only this
  // runner is built and installed. Gridly is opened by its existing bundle ID.
  const id = n => n.toString(16).padStart(24, '0').toUpperCase();
  const objects = {
    [id(1)]: `isa = PBXProject; attributes = {LastUpgradeCheck = 2700;}; buildConfigurationList = ${id(9)}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; knownRegions = (en, Base); mainGroup = ${id(2)}; productRefGroup = ${id(3)}; projectDirPath = ""; targets = (${id(4)});`,
    [id(2)]: `isa = PBXGroup; children = (${id(5)}, ${id(3)}); sourceTree = "<group>";`,
    [id(3)]: `isa = PBXGroup; name = Products; children = (${id(6)}); sourceTree = "<group>";`,
    [id(4)]: `isa = PBXNativeTarget; name = GridlyAcceptance; productName = GridlyAcceptance; productType = "com.apple.product-type.bundle.ui-testing"; productReference = ${id(6)}; buildConfigurationList = ${id(10)}; buildPhases = (${id(7)}); buildRules = (); dependencies = ();`,
    [id(5)]: 'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = GridlyAcceptance.swift; sourceTree = "<group>";',
    [id(6)]: 'isa = PBXFileReference; explicitFileType = wrapper.cfbundle; path = GridlyAcceptance.xctest; sourceTree = BUILT_PRODUCTS_DIR;',
    [id(7)]: `isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (${id(8)}); runOnlyForDeploymentPostprocessing = 0;`,
    [id(8)]: `isa = PBXBuildFile; fileRef = ${id(5)};`,
    [id(9)]: `isa = XCConfigurationList; buildConfigurations = (${id(11)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug;`,
    [id(10)]: `isa = XCConfigurationList; buildConfigurations = (${id(12)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Debug;`,
    [id(11)]: 'isa = XCBuildConfiguration; name = Debug; buildSettings = {SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 16.4; CLANG_ENABLE_MODULES = YES; SWIFT_VERSION = 5.0;};',
    [id(12)]: `isa = XCBuildConfiguration; name = Debug; buildSettings = {PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = ${expected.runnerBundle}; DEVELOPMENT_TEAM = ${expected.team}; CODE_SIGN_STYLE = Automatic; GENERATE_INFOPLIST_FILE = YES; TARGETED_DEVICE_FAMILY = 1; SWIFT_OPTIMIZATION_LEVEL = "-Onone"; ENABLE_TESTABILITY = YES; LD_RUNPATH_SEARCH_PATHS = "$(inherited) @executable_path/Frameworks @loader_path/Frameworks";};`,
  };
  const project = '// !$*UTF8*$!\n{archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n' + Object.entries(objects).map(([k,v]) => `${k} = {${v}};`).join('\n') + `\n}; rootObject = ${id(1)}; }\n`;
  const ref = `<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${id(4)}" BuildableName="GridlyAcceptance.xctest" BlueprintName="GridlyAcceptance" ReferencedContainer="container:GridlyAcceptance.xcodeproj"/>`;
  const scheme = `<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2700" version="1.3">
 <BuildAction parallelizeBuildables="NO" buildImplicitDependencies="NO"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="NO">${ref}</BuildActionEntry></BuildActionEntries></BuildAction>
 <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="NO"><Testables><TestableReference skipped="NO" parallelizable="NO">${ref}</TestableReference></Testables></TestAction>
</Scheme>\n`;
  return { project, scheme };
}
