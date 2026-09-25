import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { opaqueIOSIcon, iconPath, masterPath, background } from '../tools/ios-appicon.mjs';
import { alignIOSDeploymentFloor } from '../tools/ios-deployment-floor.mjs';
import { readConsumerScriptManifest } from '../tools/native-web.mjs';
const require = createRequire(import.meta.url);
const { PNG } = require(resolve(require.resolve('playwright-core/package.json'), '..', 'lib/utilsBundle.js'));
const baseline = 'aee1341696edabf99ce8f902f3c22ea0ef1e540c';
const read = path => readFileSync(path, 'utf8');
const original = path => execFileSync('git', ['show', `${baseline}:${path}`], { maxBuffer: 32 * 1024 * 1024 });
const normalize = text => text.replace(/\r\n/g, '\n');
function isolated(t) {
  const root = mkdtempSync(join(tmpdir(), 'gridly-lp24451a-'));
  assert.equal(resolve(root).startsWith(resolve(tmpdir()) + '\\') || resolve(root).startsWith(resolve(tmpdir()) + '/'), true);
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('D1: only four Xcode deployment floors and the SPM floor change', () => {
  const project = 'ios/App/App.xcodeproj/project.pbxproj';
  assert.deepEqual([...read(project).matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)].map(m => m[1]), Array(4).fill('16.4'));
  assert.equal(normalize(read(project)), normalize(original(project).toString()).replaceAll('IPHONEOS_DEPLOYMENT_TARGET = 15.0;', 'IPHONEOS_DEPLOYMENT_TARGET = 16.4;'));
  const spm = 'ios/App/CapApp-SPM/Package.swift';
  assert.equal(normalize(read(spm)), normalize(original(spm).toString()).replace('.iOS(.v15)', '.iOS("16.4")'));
});

test('D1: post-sync correction survives Capacitor major-only regeneration and is idempotent', async t => {
  const root = isolated(t);
  const project = 'ios/App/App.xcodeproj/project.pbxproj';
  const spm = 'ios/App/CapApp-SPM/Package.swift';
  for (const directory of ['ios/App/App.xcodeproj', 'ios/App/CapApp-SPM']) mkdirSync(join(root, directory), { recursive: true });
  writeFileSync(join(root, project), read(project));
  writeFileSync(join(root, spm), read(spm).replace('.iOS("16.4")', '.iOS(.v16)'));
  await alignIOSDeploymentFloor(root);
  assert.equal(read(join(root, spm)), read(spm));
  await alignIOSDeploymentFloor(root);
  assert.equal(read(join(root, spm)), read(spm));
  writeFileSync(join(root, project), read(project).replace('16.4', '15.0'));
  await assert.rejects(alignIOSDeploymentFloor(root), /all four/);
  writeFileSync(join(root, project), read(project));
  writeFileSync(join(root, spm), read(spm).replace('.iOS("16.4")', '.iOS(.v17)'));
  await assert.rejects(alignIOSDeploymentFloor(root), /Unexpected SPM/);
  assert.equal(JSON.parse(read('package.json')).scripts['capacitor:sync:after'], 'node tools/ios-deployment-floor.mjs');
});

test('protected identity, permissions, runtime consumers, Android and splash sources remain unchanged', () => {
  for (const path of ['capacitor.config.json', 'ios/App/App/Info.plist', 'js/app.js', 'js/gridlyPoiBrowserProvider.js', 'js/lp1045-txgio-address-runtime.js', 'assets/icon-192.png', 'assets/icons/incoming/gridly-icon-master-167.png', masterPath, 'assets/store/branding/Splash/gridly-splash-portrait.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json']) {
    const actual = readFileSync(path), expected = original(path);
    if (path.endsWith('.png')) assert.deepEqual(actual, expected, path);
    else assert.equal(normalize(actual.toString()), normalize(expected.toString()), path);
  }
  const plist = read('ios/App/App/Info.plist');
  assert.match(plist, /NSLocationWhenInUseUsageDescription/);
  assert.doesNotMatch(plist, /NSLocationAlways|UIBackgroundModes|NSAllowsArbitraryLoads/);
  assert.equal(JSON.parse(read('capacitor.config.json')).appId, 'com.gridlygo.gridly');
});

test('D2: RGB 1024 icon matches full-resolution source compositing at every pixel', () => {
  const bytes = readFileSync(iconPath);
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137,80,78,71,13,10,26,10]));
  assert.equal(bytes[25], 2, 'RGB PNG without alpha channel');
  const actual = PNG.sync.read(bytes), master = PNG.sync.read(readFileSync(masterPath));
  assert.equal(actual.width, 1024); assert.equal(actual.height, 1024);
  for (let i = 0; i < actual.data.length; i += 4) {
    assert.equal(actual.data[i + 3], 255);
    for (let c = 0; c < 3; c++) assert.equal(actual.data[i+c], Math.round((master.data[i+c]*master.data[i+3]+background[c]*(255-master.data[i+3]))/255));
  }
  assert.deepEqual(opaqueIOSIcon(process.cwd()), bytes, 'repeat generation is byte-identical');
});

test('D2: native copy uses derivative; Android and splash mappings/output stay byte-identical in isolation', t => {
  const source = read('tools/native-assets.mjs');
  assert.equal(normalize(source), normalize(original('tools/native-assets.mjs').toString()).replace("iosIcon: 'assets/store/icons/gridly-icon-master-1024.png'", "iosIcon: 'assets/store/icons/gridly-ios-appicon-1024.png'"));
  const root = isolated(t);
  execFileSync(process.execPath, ['tools/native-assets.mjs', '--output-root', root]);
  const catalog = JSON.parse(read('ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json'));
  const native = 'ios/App/App/Assets.xcassets/AppIcon.appiconset/' + catalog.images[0].filename;
  assert.deepEqual(readFileSync(join(root, native)), readFileSync(iconPath));
  for (const [output, input] of [
    ['android/app/src/main/res/mipmap-anydpi/ic_launcher.png', 'assets/icon-192.png'],
    ['android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png', 'assets/icon-192.png'],
    ['android/app/src/main/res/drawable-nodpi/ic_launcher_mark.png', 'assets/icons/incoming/gridly-icon-master-167.png'],
    ['android/app/src/main/res/drawable/splash.png', 'assets/store/branding/Splash/gridly-splash-portrait.png'],
    ['ios/App/App/Assets.xcassets/Splash.imageset/splash.png', 'assets/store/branding/Splash/gridly-splash-portrait.png']
  ]) assert.deepEqual(readFileSync(join(root, output)), original(input), output);
});

test('consumer manifest consistency remains valid without staging', async () => {
  const manifest = await readConsumerScriptManifest(process.cwd());
  assert(manifest.startupScripts.includes('js/gridly-map-visibility.js?v=lp24448f2'));
});
