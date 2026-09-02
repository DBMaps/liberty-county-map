import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { composeNativeProviderConfig, validateNativeProviderConfig } from "../tools/native-provider-config.mjs";
import { stage } from "../tools/native-web.mjs";

const read = (path) => readFileSync(path, "utf8");
const app = read("js/app.js");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const launcher = read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml");
const roundLauncher = read("android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml");
const foreground = read("android/app/src/main/res/drawable/ic_launcher_foreground.xml");
const splashIcon = read("android/app/src/main/res/drawable/splash_icon.xml");
const api31Theme = read("android/app/src/main/res/values-v31/styles.xml");
const pkg = JSON.parse(read("package.json"));

function section(start, end) {
  const from = app.indexOf(start);
  assert.notEqual(from, -1, `${start} exists`);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `${end} exists after ${start}`);
  return app.slice(from, to);
}

test("API 36 resolves both launcher roles through one drawable foreground and generated mark", () => {
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  for (const adaptive of [launcher, roundLauncher]) {
    assert.match(adaptive, /@color\/ic_launcher_background/);
    assert.match(adaptive, /@drawable\/ic_launcher_foreground/);
  }
  assert.match(foreground, /@drawable\/ic_launcher_mark/);
  assert.match(read("tools/native-assets.mjs"), /drawable-nodpi\/ic_launcher_mark\.png/);
});

test("API 31+ splash resolves Android framework resources through AndroidX into AppTheme", () => {
  assert.match(manifest, /android:theme="@style\/AppTheme\.NoActionBarLaunch"/);
  assert.match(api31Theme, /parent="Theme\.SplashScreen"/);
  assert.match(api31Theme, /android:windowSplashScreenBackground/);
  assert.match(api31Theme, /android:windowSplashScreenAnimatedIcon">@drawable\/splash_icon/);
  assert.match(api31Theme, /<item name="postSplashScreenTheme">@style\/AppTheme<\/item>/);
  assert.doesNotMatch(api31Theme, /android:postSplashScreenTheme/);
  assert.match(read("android/app/build.gradle"), /androidx\.core:core-splashscreen:\$androidxCoreSplashScreenVersion/);
  assert.match(read("android/build.gradle"), /androidxCoreSplashScreenVersion\s*=\s*'1\.0\.1'/);
  assert.match(read("android/app/src/main/res/values/styles.xml"), /<style name="AppTheme"/);
  assert.match(read("android/app/src/main/res/values/colors.xml"), /<color name="ic_launcher_background">/);
  assert.match(splashIcon, /@drawable\/ic_launcher_mark/);
  assert.doesNotMatch(api31Theme, /@drawable\/splash</);
});

test("fresh Android installs cannot restore completion and blank profiles never mark onboarding complete", () => {
  assert.match(manifest, /android:allowBackup="false"/);
  const legacyWelcome = section("function maybeShowWelcomeModal()", "window.closeGridlyWelcome");
  assert.doesNotMatch(legacyWelcome, /markGridlyWelcomeSeen/);
  const firstRun = section("function maybeOpenFirstRunSetup()", "function syncModalScrollLock");
  assert.match(firstRun, /isGridlyFirstRunWalkthroughComplete\(\)/);
  assert.match(firstRun, /openGridlyWelcomeOnboarding\(\{ source: "first_run" \}\)/);
});

test("Dallas/native search diagnostics discard null shard slots without weakening PLACE authority", () => {
  const search = section("async function gridlySearchAddress", "window.gridlyAggregateAddressVariantOutcomes");
  assert.ok(search.indexOf("resolveGridlyAwarenessAreaQuery(rawQuery)") < search.indexOf("searchGridlyRuntimePoiCandidates"));
  assert.match(search, /RESOLVED_CANONICAL_MULTI_COUNTY_PLACE/);
  assert.match(search, /runtimePoiResults\.filter\(Boolean\)\.map/);
  assert.match(search, /candidate\.providerId \|\| candidate\.id \|\| null/);
});

test("native preparation requires externally composed provider configuration", () => {
  assert.equal(pkg.scripts["prepare:native"], "npm run build:native-web:configured && npm run verify:native-web:configured");
  assert.match(pkg.scripts["build:native-web:configured"], /--runtime-config-file owner-local\/native-provider-config\.json/);
  assert.doesNotMatch(read("tools/native-web.mjs"), /gridly\.local\.js['"]\s*\]/);
  assert.match(read(".gitignore"), /^\/owner-local\/$/m);
  assert.match(read(".gitignore"), /^\/\.artifacts\/native-web-identity\.json$/m);
  assert.match(read(".gitattributes"), /^android\/app\/src\/main\/res\/drawable\/ic_launcher_foreground\.xml text eol=lf$/m);
  assert.match(read("tools/Prepare-GridlyNative.ps1"), /node tools\/native-provider-config\.mjs compose[\s\S]*npm run prepare:native[\s\S]*verify-staged/);
  assert.doesNotMatch(read("docs/LP2444-NATIVE-PROVIDER-CONFIGURATION.md"), /npm run verify:native-web(?:\r?\n|`)/);
});

test("native provider configuration fails clearly when the owner-local JSON is missing", async () => {
  const output = mkdtempSync(join(tmpdir(), "gridly-native-missing-"));
  await assert.rejects(stage(output, { runtimeConfigFile: join(output, "absent.json") }), /NATIVE_PROVIDER_CONFIG_MISSING:[\s\S]*Prepare-GridlyNative\.ps1/);
  rmSync(output, { recursive: true, force: true });
});

test("native provider configuration rejects invalid and extra fields without exposing values", () => {
  assert.throws(() => validateNativeProviderConfig({}), /FIELDS_INVALID/);
  assert.throws(() => validateNativeProviderConfig({ arcgisStaticBasemapApiKey: "fixture", driveTexas: { apiKey: "fixture" }, extra: true }), /FIELDS_INVALID/);
  assert.throws(() => validateNativeProviderConfig({ arcgisStaticBasemapApiKey: "fixture", driveTexas: { apiKey: "" } }), /DRIVETEXAS_KEY_REQUIRED/);
});

test("existing local authority composes the exact valid JSON schema without printing credentials", () => {
  const composed = composeNativeProviderConfig(Buffer.from(`
    window.GRIDLY_TXDOT_API_KEY = "test-drivetexas-value";
    window.GRIDLY_CONFIG = { txdot: { apiKey: window.GRIDLY_TXDOT_API_KEY } };
    window.GRIDLY_RUNTIME_CONFIG = { arcgisStaticBasemapApiKey: "test-arcgis-value" };
  `));
  assert.deepEqual(Object.keys(composed).sort(), ["arcgisStaticBasemapApiKey", "driveTexas"]);
  assert.deepEqual(Object.keys(composed.driveTexas), ["apiKey"]);
  assert.equal(validateNativeProviderConfig(composed).officialRoadways, "GRIDLY_CONFIG.driveTexas.apiKey_CONFIGURED_NONBLANK");
});

test("armed report placement owns a crossing tap before early popup capture", () => {
  const capture = section("function recordGridlyCrossingRootCauseDomEvent", "function installGridlyCrossingPopupRootCauseDomTrace");
  const owner = capture.indexOf('"report_placement_owned"');
  const early = capture.indexOf('rememberGridlyCrossingEarlyTapCandidate');
  assert.ok(owner >= 0 && owner < early);
  assert.match(capture, /handleHazardPlacementMapClick\(\{ latlng, originalEvent: event \}\)/);
  assert.match(capture, /if \(rawCrossingId && reportingState\?\.placementModeActive/);
  assert.match(capture.slice(owner, early), /return;/);
  assert.match(capture.slice(early), /openCrossingPopupFromCapturedMarkerDomClick/);
});

test("use-location has bounded success, denial, unavailable, timeout and cancel cleanup", () => {
  const useLocation = section("window.submitHazardNearMe = function", "function beginRoadHazardMapPlacement");
  for (const state of ["permission_denied", "unavailable", "timeout", "canceled", "success"]) assert.match(useLocation, new RegExp(state));
  assert.match(useLocation, /window\.setTimeout[\s\S]*12000/);
  assert.match(useLocation, /window\.cancelHazardLocationLookup/);
  assert.match(useLocation, /locationLookupInProgress: false/);
  assert.match(useLocation, /document\.body\.classList\.remove\("report-pulse"\)/);
  assert.match(useLocation, /timeout: 10000/);
});

test("touch repair remains Android-safe and does not alter portrait/iPhone layout authority", () => {
  const capture = section("function recordGridlyCrossingRootCauseDomEvent", "function installGridlyCrossingPopupRootCauseDomTrace");
  assert.doesNotMatch(capture.slice(0, capture.indexOf('rememberGridlyCrossingEarlyTapCandidate')), /preventDefault|stopPropagation/);
  assert.doesNotMatch(app, /Event\.prototype\.preventDefault/);
  assert.doesNotMatch(read("css/styles.css").slice(-2000), /iphone|ios/i);
});
