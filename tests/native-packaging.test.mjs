import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const text = (path) => readFileSync(path, 'utf8');
const config = JSON.parse(text('capacitor.config.json'));

const sourceFilesNamed = (root, names) => readdirSync(root, { withFileTypes: true })
  .flatMap((entry) => {
    const entryPath = join(root, entry.name);
    return entry.isDirectory()
      ? sourceFilesNamed(entryPath, names)
      : names.has(entry.name) ? [entryPath.replaceAll('\\', '/')] : [];
  });

test('Android launcher MainActivity is compiled from the production package', () => {
  const activityPath = 'android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt';
  assert.ok(existsSync(activityPath), `${activityPath} must exist`);

  const activity = text(activityPath);
  assert.match(activity, /^package com\.gridlygo\.gridly$/m);
  assert.match(activity, /^class MainActivity\s*:\s*BridgeActivity\(\)$/m);
  assert.match(activity, /^import com\.getcapacitor\.BridgeActivity$/m);

  const activitySources = sourceFilesNamed(
    'android/app/src',
    new Set(['MainActivity.kt', 'MainActivity.java'])
  );
  assert.deepEqual(activitySources, [activityPath]);
  assert.equal(activitySources.some((path) => path.includes('/com/gridly/app/')), false);

  const manifest = text('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /<activity\s+[\s\S]*?android:name="\.MainActivity"[\s\S]*?<action android:name="android\.intent\.action\.MAIN" \/>[\s\S]*?<category android:name="android\.intent\.category\.LAUNCHER" \/>[\s\S]*?<\/activity>/);

  const appGradle = text('android/app/build.gradle');
  const rootGradle = text('android/build.gradle');
  assert.match(appGradle, /^\s*id ['"]org\.jetbrains\.kotlin\.android['"]$/m);
  assert.match(rootGradle, /^\s*id ['"]org\.jetbrains\.kotlin\.android['"] version ['"]2\.2\.0['"] apply false$/m);
  assert.match(appGradle, /^\s*namespace ['"]com\.gridlygo\.gridly['"]$/m);
  assert.match(appGradle, /^\s*applicationId ['"]com\.gridlygo\.gridly['"]$/m);
});

test('Android Java and Kotlin compilation deterministically target JVM 1.8', () => {
  const gradle = text('android/app/build.gradle');
  assert.match(gradle, /^import org\.jetbrains\.kotlin\.gradle\.dsl\.JvmTarget$/m);
  assert.match(gradle, /^\s*sourceCompatibility JavaVersion\.VERSION_1_8$/m);
  assert.match(gradle, /^\s*targetCompatibility JavaVersion\.VERSION_1_8$/m);
  assert.match(gradle, /^\s*jvmTarget = JvmTarget\.JVM_1_8$/m);
  assert.doesNotMatch(gradle, /JvmTarget\.JVM_(?:24|25)|JavaVersion\.VERSION_(?:24|25)/);
});

test('Android app compile classpath directly exposes Capacitor AppCompat authority', () => {
  const appGradle = text('android/app/build.gradle');
  const rootGradle = text('android/build.gradle');
  const capacitorGradle = text('node_modules/@capacitor/android/capacitor/build.gradle');
  const supportLibraryPattern = /com\.android\.support\s*:/;

  const authority = rootGradle.match(/^\s*androidxAppCompatVersion\s*=\s*['"]([^'"]+)['"]$/m);
  assert.ok(authority, 'root project must declare the shared AppCompat version authority');
  assert.equal(authority[1], '1.7.1');
  assert.match(appGradle, /^\s*implementation\s+['"]androidx\.appcompat:appcompat:\$androidxAppCompatVersion['"]$/m);
  assert.match(capacitorGradle, /androidxAppCompatVersion[^\n]+rootProject\.ext\.androidxAppCompatVersion\s*:\s*['"]1\.7\.1['"]/);
  assert.match(capacitorGradle, /implementation\s+['"]androidx\.appcompat:appcompat:\$androidxAppCompatVersion['"]/);

  for (const path of [
    'android/build.gradle',
    'android/app/build.gradle',
    'android/app/capacitor.build.gradle',
    'android/capacitor-cordova-android-plugins/build.gradle',
    'node_modules/@capacitor/android/capacitor/build.gradle'
  ]) assert.doesNotMatch(text(path), supportLibraryPattern);
});

test('Android project explicitly enables AndroidX without unnecessary Jetifier', () => {
  const properties = text('android/gradle.properties');
  assert.match(properties, /^android\.useAndroidX=true$/m);
  assert.doesNotMatch(properties, /^android\.enableJetifier\s*=/m);
});

test('Android SDK levels retain the Capacitor 8 packaging contract', () => {
  const gradle = text('android/app/build.gradle');
  assert.match(gradle, /^\s*minSdk 24$/m);
  assert.doesNotMatch(gradle, /^\s*minSdk(?:Version)? 23$/m);
  assert.deepEqual(
    [...gradle.matchAll(/^\s*minSdk(?:Version)?\s+(\d+)$/gm)].map((match) => Number(match[1])),
    [24]
  );
  assert.match(gradle, /^\s*compileSdk 36$/m);
  assert.match(gradle, /^\s*targetSdk 36$/m);
  assert.match(gradle, /^\s*applicationId ['"]com\.gridlygo\.gridly['"]$/m);

  const capacitorPackage = JSON.parse(text('node_modules/@capacitor/android/package.json'));
  assert.equal(capacitorPackage.version, '8.3.4');
  const capacitorGradle = text('node_modules/@capacitor/android/capacitor/build.gradle');
  assert.match(capacitorGradle, /minSdkVersion project\.hasProperty\('minSdkVersion'\) \? rootProject\.ext\.minSdkVersion : 24/);

  for (const path of [
    'android/app/build.gradle',
    'android/app/src/main/AndroidManifest.xml',
    'android/capacitor-cordova-android-plugins/build.gradle'
  ]) assert.doesNotMatch(text(path), /tools:overrideLibrary/);
});

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

test('Android launcher resources separate legacy fallbacks from adaptive foreground artwork', () => {
  const generated = [
    'android/app/src/main/res/mipmap-anydpi/ic_launcher.png',
    'android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.png',
    'android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png'
  ];
  const trackedXml = execFileSync('git', ['ls-files', 'android/app/src/main/res/**/*.xml'], { encoding: 'utf8' })
    .trim().split('\n').filter((path) => path && existsSync(path));
  const conflictingBasenames = generated.filter((png) => trackedXml.some((xml) => {
    const pngName = png.slice(png.lastIndexOf('/') + 1, -4);
    const xmlName = xml.slice(xml.lastIndexOf('/') + 1, -4);
    const pngDirectory = png.slice(0, png.lastIndexOf('/'));
    const xmlDirectory = xml.slice(0, xml.lastIndexOf('/'));
    return pngName === xmlName && pngDirectory === xmlDirectory;
  }));
  assert.deepEqual(conflictingBasenames, []);

  for (const launcher of ['ic_launcher', 'ic_launcher_round']) {
    assert.equal(trackedXml.filter((path) => path.endsWith(`/mipmap-anydpi-v26/${launcher}.xml`)).length, 1);
    assert.equal(generated.filter((path) => path.endsWith(`/mipmap-anydpi/${launcher}.png`)).length, 1);
    assert.match(text(`android/app/src/main/res/mipmap-anydpi-v26/${launcher}.xml`), /@mipmap\/ic_launcher_foreground/);
  }
  assert.ok(generated.some((path) => path.endsWith('/mipmap-anydpi/ic_launcher_foreground.png')));

  const manifest = text('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
});

test('approved tracked artwork generates every native raster deterministically', () => {
  const first = mkdtempSync(join(tmpdir(), 'gridly-native-assets-a-'));
  const second = mkdtempSync(join(tmpdir(), 'gridly-native-assets-b-'));
  const outputs = ['android/app/src/main/res/drawable/splash.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'ios/App/App/Assets.xcassets/Splash.imageset/splash.png'];
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
  const outputs = ['android/app/src/main/res/drawable/splash.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'ios/App/App/Assets.xcassets/Splash.imageset/splash.png'];
  assert.equal(outputs.some((path) => tracked.includes(path)), false);
  for (const path of outputs) execFileSync('git', ['check-ignore', '--quiet', path]);
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
