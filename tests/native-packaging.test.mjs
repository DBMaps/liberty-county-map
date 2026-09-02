import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
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

const resourceFilesWithExtensions = (root, extensions) => readdirSync(root, { withFileTypes: true })
  .flatMap((entry) => {
    const entryPath = join(root, entry.name);
    return entry.isDirectory()
      ? resourceFilesWithExtensions(entryPath, extensions)
      : extensions.has(extname(entry.name)) ? [entryPath.replaceAll('\\', '/')] : [];
  });

test('Android launcher MainActivity is compiled from the production package', () => {
  const activityPath = 'android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt';
  assert.ok(existsSync(activityPath), `${activityPath} must exist`);

  const activity = text(activityPath);
  assert.match(activity, /^package com\.gridlygo\.gridly$/m);
  assert.match(activity, /^class MainActivity\s*:\s*BridgeActivity\(\)\s*\{/m);
  assert.match(activity, /^import com\.getcapacitor\.BridgeActivity$/m);
  assert.match(activity, /bridge\.webView\.settings\.textZoom\s*=\s*100/);

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

test('Android manifest declares only the approved network and foreground location permissions', () => {
  const manifest = text('android/app/src/main/AndroidManifest.xml');
  const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"\s*\/>/g)]
    .map((match) => match[1]);

  assert.deepEqual(permissions, [
    'android.permission.INTERNET',
    'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.ACCESS_FINE_LOCATION'
  ]);
  assert.equal(permissions.filter((permission) => permission === 'android.permission.INTERNET').length, 1);
  assert.equal(permissions.filter((permission) => permission === 'android.permission.ACCESS_NETWORK_STATE').length, 1);
  assert.equal(permissions.filter((permission) => permission === 'android.permission.ACCESS_COARSE_LOCATION').length, 1);
  assert.equal(permissions.filter((permission) => permission === 'android.permission.ACCESS_FINE_LOCATION').length, 1);
  assert.equal(permissions.some((permission) => permission === 'android.permission.ACCESS_BACKGROUND_LOCATION'), false);
  assert.equal(permissions.some((permission) => /(?:POST_NOTIFICATIONS|READ_|WRITE_|MANAGE_|CAMERA|RECORD_AUDIO|QUERY_ALL_PACKAGES)$/.test(permission)), false);

  const applicationStart = manifest.indexOf('<application');
  assert.ok(applicationStart > 0, 'manifest must contain an application element');
  assert.equal(manifest.slice(applicationStart).includes('<uses-permission'), false);
});

test('tracked text describes launcher, AppIcon, and launch screen resources', () => {
  for (const path of ['android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml', 'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json', 'ios/App/App/Assets.xcassets/Splash.imageset/Contents.json', 'ios/App/App/Base.lproj/LaunchScreen.storyboard']) assert.ok(existsSync(path), `${path} must exist`);
});

test('Android launcher resources separate legacy fallbacks from adaptive foreground artwork', () => {
  const legacyRasters = [
    'android/app/src/main/res/mipmap-anydpi/ic_launcher.png',
    'android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png'
  ];
  const adaptiveForeground = 'android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.xml';
  const adaptiveMark = 'android/app/src/main/res/mipmap-anydpi/ic_launcher_mark.png';
  const obsoleteForeground = 'android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.png';
  const trackedXml = execFileSync('git', ['ls-files', 'android/app/src/main/res/**/*.xml'], { encoding: 'utf8' })
    .trim().split('\n').filter((path) => path && existsSync(path));
  const androidResources = resourceFilesWithExtensions('android/app/src/main/res', new Set(['.png', '.xml']));
  const conflictingBasenames = androidResources.filter((resource, index, resources) => {
    const extension = resource.slice(resource.lastIndexOf('.'));
    const stem = resource.slice(0, resource.lastIndexOf('.'));
    return ['.png', '.xml'].includes(extension)
      && resources.some((candidate, candidateIndex) => candidateIndex !== index && candidate.slice(0, candidate.lastIndexOf('.')) === stem);
  });
  assert.deepEqual(conflictingBasenames, []);

  for (const launcher of ['ic_launcher', 'ic_launcher_round']) {
    assert.equal(trackedXml.filter((path) => path.endsWith(`/mipmap-anydpi-v26/${launcher}.xml`)).length, 1);
    assert.equal(legacyRasters.filter((path) => path.endsWith(`/mipmap-anydpi/${launcher}.png`)).length, 1);
    assert.match(text(`android/app/src/main/res/mipmap-anydpi-v26/${launcher}.xml`), /@mipmap\/ic_launcher_foreground/);
  }
  assert.ok(existsSync(adaptiveForeground), `${adaptiveForeground} must be the adaptive authority`);
  assert.equal(existsSync(obsoleteForeground), false, `${obsoleteForeground} must not coexist with XML authority`);
  assert.match(text(adaptiveForeground), /^<\?xml[\s\S]*<inset[^>]+android:drawable="@mipmap\/ic_launcher_mark"[^>]+android:inset="22%"\s*\/>/);
  assert.notEqual(adaptiveMark, legacyRasters[0], 'adaptive foreground must not reuse the complete legacy tile');
  assert.match(text('android/app/src/main/res/values/colors.xml'), /<color name="ic_launcher_background">#05071A<\/color>/);

  const manifest = text('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
});

test('approved tracked artwork generates every native raster deterministically', () => {
  const first = mkdtempSync(join(tmpdir(), 'gridly-native-assets-a-'));
  const second = mkdtempSync(join(tmpdir(), 'gridly-native-assets-b-'));
  const obsoleteForeground = 'android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.png';
  const adaptiveForeground = 'android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.xml';
  const adaptiveMark = 'android/app/src/main/res/mipmap-anydpi/ic_launcher_mark.png';
  const outputs = ['android/app/src/main/res/drawable/splash.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png', adaptiveMark, adaptiveForeground, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'ios/App/App/Assets.xcassets/Splash.imageset/splash.png'];
  const digest = (root, path) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex');
  try {
    mkdirSync(dirname(join(first, obsoleteForeground)), { recursive: true });
    writeFileSync(join(first, obsoleteForeground), 'stale foreground from former raster architecture');
    for (const root of [first, second]) execFileSync(process.execPath, ['tools/native-assets.mjs', '--output-root', root]);
    assert.equal(existsSync(join(first, obsoleteForeground)), false, 'generation must remove a stale adaptive foreground PNG');
    for (const path of outputs) {
      assert.ok(existsSync(join(first, path)), `${path} must be generated`);
      assert.equal(digest(first, path), digest(second, path), `${path} must be byte-identical`);
    }
    const firstResourceSet = outputs.map((path) => [path, digest(first, path)]);
    execFileSync(process.execPath, ['tools/native-assets.mjs', '--output-root', first]);
    assert.deepEqual(outputs.map((path) => [path, digest(first, path)]), firstResourceSet, 'rerun must preserve the final resource set');
    assert.equal(existsSync(join(first, obsoleteForeground)), false, 'rerun must not recreate the obsolete PNG');
    assert.deepEqual(readFileSync(join(first, outputs[1])), readFileSync('assets/icon-192.png'), 'legacy launcher must be copied byte-for-byte');
    assert.deepEqual(readFileSync(join(first, outputs[2])), readFileSync('assets/icon-192.png'), 'round fallback must use the explicit legacy authority');
    assert.deepEqual(readFileSync(join(first, outputs[3])), readFileSync('assets/icons/incoming/gridly-icon-master-167.png'), 'adaptive mark must be copied byte-for-byte');
    assert.notDeepEqual(readFileSync(join(first, outputs[3])), readFileSync(join(first, outputs[1])), 'adaptive mark must not be the complete legacy launcher tile');
    assert.deepEqual(readFileSync(join(first, outputs[0])), readFileSync('assets/store/branding/Splash/gridly-splash-portrait.png'));
    for (const source of ['assets/icon-192.png', 'assets/icons/incoming/gridly-icon-master-167.png', 'assets/store/icons/gridly-icon-master-1024.png', 'assets/store/branding/Splash/gridly-splash-portrait.png']) {
      assert.equal(execFileSync('git', ['ls-files', '--error-unmatch', source], { encoding: 'utf8' }).trim(), source, `${source} must already be tracked`);
    }
  } finally { rmSync(first, { recursive: true }); rmSync(second, { recursive: true }); }
});

test('generated native raster outputs are not tracked', () => {
  const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');
  const outputs = ['android/app/src/main/res/drawable/splash.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_foreground.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_mark.png', 'android/app/src/main/res/mipmap-anydpi/ic_launcher_round.png', 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'ios/App/App/Assets.xcassets/Splash.imageset/splash.png'];
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
  for (const field of ['capacitorPlatform', 'documentLocationOrigin', 'viewportWidth', 'computedRootFontSize', 'nativeTypographyAuthority', 'nativeTypographyStatus', 'driveTexasConfigFamily', 'supabaseClientInitialized', 'nwsEndpointReachability', 'poiManifestPresence', 'crossingPackagePresence']) assert.match(helper, new RegExp(field));
  assert.doesNotMatch(helper, /authorization|apiKeyValue|supabaseKey/i);
  assert.match(text('index.html'), /gridlyNativeProviderOriginAudit\.js/);
});

test('Android typography normalization is native-only and preserves Gridly density authority', () => {
  const activity = text('android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt');
  const styles = text('css/styles.css');
  assert.match(activity, /bridge\.webView\.settings\.textZoom\s*=\s*100/);
  assert.match(styles, /:root\s*\{[\s\S]*?font-size:\s*calc\(16px \* var\(--gridly-app-font-scale\)\)/);
  assert.match(styles, /body\.gridly-text-compact\s*\{\s*--gridly-app-font-scale:\s*0\.92/);
  assert.doesNotMatch(styles, /data-gridly-native|android_webview_text_zoom/);
  assert.doesNotMatch(text('index.html'), /data-gridly-native|android_webview_text_zoom/);
});

test('Supabase initialization publishes its non-enumerable audit authority after UMD client creation', () => {
  const app = text('js/app.js');
  const creation = app.indexOf('supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);');
  const publication = app.indexOf('gridlyPublishSupabaseClientAuthority();', creation);
  assert.ok(creation >= 0 && publication > creation);
  assert.match(app, /Object\.defineProperty\(globalThis, Symbol\.for\("gridly\.runtime\.supabaseClient"\)/);
  assert.doesNotMatch(app.slice(creation, publication), /service[_-]?role/i);
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

test('native browser dependencies use exact npm authorities', () => {
  const manifest = JSON.parse(text('package.json'));
  const lock = JSON.parse(text('package-lock.json'));
  assert.equal(manifest.dependencies.leaflet, '1.9.4');
  assert.equal(lock.packages[''].dependencies.leaflet, '1.9.4');
  assert.equal(lock.packages['node_modules/leaflet'].version, '1.9.4');
  assert.equal(manifest.dependencies['@supabase/supabase-js'], '2.112.4');
  assert.equal(lock.packages[''].dependencies['@supabase/supabase-js'], '2.112.4');
  assert.equal(lock.packages['node_modules/@supabase/supabase-js'].version, '2.112.4');
});

test('native staging derives browser globals and Leaflet images from node_modules', () => {
  const tool = text('tools/native-web.mjs');
  for (const path of [
    'node_modules/leaflet/dist/leaflet.js',
    'node_modules/leaflet/dist/leaflet.css',
    'node_modules/leaflet/dist/images/marker-icon.png',
    'node_modules/leaflet/dist/images/marker-icon-2x.png',
    'node_modules/leaflet/dist/images/marker-shadow.png',
    'node_modules/@supabase/supabase-js/dist/umd/supabase.js'
  ]) assert.match(tool, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  for (const path of [
    'vendor/leaflet/leaflet.js',
    'vendor/leaflet/leaflet.css',
    'vendor/leaflet/images/marker-icon.png',
    'vendor/leaflet/images/marker-icon-2x.png',
    'vendor/leaflet/images/marker-shadow.png',
    'vendor/supabase/supabase.js'
  ]) assert.match(tool, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(tool, /\.\.\.vendorAssets\.map\(\(\[, target\]\) => target\)/);
});

test('native preparation replaces remote startup authorities without diverging web', () => {
  const source = text('index.html');
  const tool = text('tools/native-web.mjs');
  assert.match(source, /unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.css/);
  assert.match(source, /unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js/);
  assert.match(source, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2/);
  assert.match(tool, /stagedIndex\.replace\(remote, local\)/);
  const leaflet = tool.indexOf("'vendor/leaflet/leaflet.js'");
  const supabase = tool.indexOf("'vendor/supabase/supabase.js'");
  const app = source.indexOf('js/app.js');
  assert.ok(leaflet >= 0 && supabase > leaflet && app >= 0);
  assert.doesNotMatch(source, /audits\/lp2403-condition-label-audit\.js/);
  assert.ok(existsSync('audits/lp2403-condition-label-audit.js'));
});
