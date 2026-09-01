import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const text = (path) => readFileSync(path, 'utf8');
const config = JSON.parse(text('capacitor.config.json'));

test('permanent native identity and bundled web contract are aligned', () => {
  assert.equal(config.appId, 'com.gridlygo.gridly');
  assert.equal(config.appName, 'Gridly');
  assert.equal(config.webDir, 'www');
  assert.equal(config.server, undefined);
  const gradle = text('android/app/build.gradle');
  assert.match(gradle, /namespace ['"]com\.gridlygo\.gridly['"]/);
  assert.match(gradle, /applicationId ['"]com\.gridlygo\.gridly['"]/);
  assert.match(text('ios/App/App.xcodeproj/project.pbxproj'), /PRODUCT_BUNDLE_IDENTIFIER = com\.gridlygo\.gridly;/);
});

test('foreground-only location declarations are present', () => {
  const manifest = text('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /ACCESS_FINE_LOCATION/);
  assert.doesNotMatch(manifest, /ACCESS_BACKGROUND_LOCATION/);
  const plist = text('ios/App/App/Info.plist');
  assert.match(plist, /NSLocationWhenInUseUsageDescription/);
  assert.doesNotMatch(plist, /NSLocationAlways|UIBackgroundModes/);
});

test('tracked text describes launcher, AppIcon, and launch screen resources', () => {
  for (const path of ['android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json', 'ios/App/App/Assets.xcassets/Splash.imageset/Contents.json', 'ios/App/App/Base.lproj/LaunchScreen.storyboard']) assert.ok(existsSync(path), `${path} must exist`);
});

test('approved tracked artwork generates every native raster deterministically', () => {
  const first = mkdtempSync(join(tmpdir(), 'gridly-native-assets-a-'));
  const second = mkdtempSync(join(tmpdir(), 'gridly-native-assets-b-'));
  const outputs = ['android/app/src/main/res/drawable/splash.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_logo.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'ios/App/App/Assets.xcassets/Splash.imageset/splash.png'];
  try {
    for (const root of [first, second]) execFileSync(process.execPath, ['tools/native-assets.mjs', '--output-root', root]);
    for (const path of outputs) {
      assert.ok(existsSync(join(first, path)), `${path} must be generated`);
      const digest = (root) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
      assert.equal(digest(first), digest(second), `${path} must be byte-identical`);
    }
    assert.deepEqual(readFileSync(join(first, outputs[1])), readFileSync('assets/store/icons/gridly-icon-master-1024.png'));
    assert.deepEqual(readFileSync(join(first, outputs[0])), readFileSync('assets/store/branding/Splash/gridly-splash-portrait.png'));
  } finally { rmSync(first, { recursive: true }); rmSync(second, { recursive: true }); }
});

test('generated native raster outputs are not tracked', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  assert.equal(tracked.some((path) => /^(android\/app\/src\/main\/res\/(?:drawable\/splash|mipmap-anydpi\/ic_launcher(?:_logo|_round)?)|ios\/App\/App\/Assets\.xcassets\/(?:AppIcon\.appiconset\/AppIcon-512@2x|Splash\.imageset\/splash))\.png$/.test(path)), false);
});

test('native stage declares every governed runtime family', () => {
  const stage = text('tools/native-web.mjs');
  for (const family of ['css', 'js', 'assets', 'data', 'poi', 'Community-Packages', 'Crossing-Packages']) assert.match(stage, new RegExp(`['"]${family}['"]`));
});

test('native provider origin helper is bounded and never exposes credential values', () => {
  const helper = text('js/gridlyNativeProviderOriginAudit.js');
  assert.match(helper, /gridlyNativeProviderOriginAudit/);
  for (const field of ['capacitorPlatform', 'documentLocationOrigin', 'driveTexasConfigFamily', 'supabaseClientInitialized', 'nwsEndpointReachability', 'poiManifestPresence', 'crossingPackagePresence']) assert.match(helper, new RegExp(field));
  assert.doesNotMatch(helper, /authorization|apiKeyValue|supabaseKey/i);
  assert.match(text('index.html'), /gridlyNativeProviderOriginAudit\.js/);
});

test('configured native staging reuses governed additive production composition and attests final bytes', () => {
  const tool = text('tools/native-web.mjs');
  assert.match(tool, /composeProductionRuntimeConfig/);
  assert.match(tool, /runtimeConfig.*bytes.*sha256/s);
  assert.match(tool, /candidateGitSha/);
  assert.match(tool, /files: attestation\.files/);
  assert.match(tool, /--runtime-config-file/);
  assert.match(tool, /--report-file/);
});
