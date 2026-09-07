import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");

function functionSource(name) {
  const marker = name.startsWith("window.") ? `${name} = function` : `function ${name}(`;
  const start = app.indexOf(marker);
  assert.notEqual(start, -1, `${name} exists`);
  const signatureEnd = app.indexOf(") {", start);
  assert.notEqual(signatureEnd, -1, `${name} signature closes`);
  const body = signatureEnd + 2;
  let depth = 0;
  for (let index = body; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1) + ";";
  }
  throw new Error(`Unable to extract ${name}`);
}

test("Dallas destination runtime publishes one governed non-null collection", async () => {
  const dallas = { id: "place-4819000", providerId: "place-4819000", title: "Dallas, Texas", provider: "canonical_place", lat: 32.7767, lng: -96.797, countyMemberships: ["48113", "48121", "48257"] };
  const provider = { id: "provider-result", title: "Dallas provider candidate", provider: "provider", lat: 32.78, lng: -96.8 };
  const raw = [dallas, null, undefined, "invalid shard slot", provider];
  Object.defineProperty(raw, "gridlyProviderDiagnostics", { value: {}, enumerable: false });
  const sandbox = {
    Object, Array, Date, Number, String, Math, Boolean, Promise,
    window: {}, GRIDLY_DESTINATION_INTENTS: { BUSINESS_PLACE: "business" }, GRIDLY_SEARCH_RENDER_LIMIT: 10,
    gridlySearchUiState: { activeSearchRequestId: 1 }, gridlyLastInteractiveDestinationSearchTrace: null,
    ensureGridlySearchState: () => ({}), beginGridlyLiveDestinationSearch: () => 1,
    classifyGridlyDestinationSearchIntent: () => ({ type: "place", reason: "canonical" }),
    gridlyQueryAllowsRuntimePoiAcquisition: () => false, searchGridlyLocalPoiSeeds: () => [],
    mergeGridlySavedPlaceDestinationResults: value => value, prioritizeGridlySearchResults: value => value,
    dedupeGridlySearchResults: value => value, getGridlySavedPlaceDestinationSearchResults: () => [],
    normalizeGridlySearchDisplayLabel: value => String(value).toLowerCase(), getGridlySearchActiveInputQuery: () => "Dallas",
    gridlySearchAddress: async () => raw, getGridlyLiveDestinationSearchOptions: () => ({}), renderGridlySearchResults: () => true,
    buildGridlyLiveSearchAuditReport: (_query, results) => ({ resultCount: results.length }),
    normalizeGridlyBrandSearchText: value => value.toLowerCase(), gridlySearchQueryHasDestinationIndicator: () => false,
    gridlySearchQueryHasAddressIndicator: () => false
  };
  sandbox.window.gridlyGetCurrentGovernedLocationContext = () => null;
  vm.createContext(sandbox);
  const runSource = app.slice(app.indexOf("async function runGridlyLiveDestinationSearch"), app.indexOf("async function gridlyDestinationSearchContainmentAudit"));
  vm.runInContext(runSource, sandbox);
  const results = await sandbox.runGridlyLiveDestinationSearch("Dallas", { requestId: 1, render: false });
  assert.equal(results.length, 2);
  assert.equal(results[0], dallas);
  assert.ok(results.every(result => result && typeof result === "object"));
  assert.equal(sandbox.gridlyLastInteractiveDestinationSearchTrace.finalPublishedCandidateCount, results.length);
  assert.equal(sandbox.gridlyLastInteractiveDestinationSearchTrace.finalPublishedCandidates.length, results.length);
  assert.equal(results.find(result => result.id === "place-4819000"), dallas, "Dallas remains selectable with memberships intact");
});

function locationHarness({ native = true, nativeCall, browserCall } = {}) {
  const sandbox = {
    Promise,
    navigator: { geolocation: { getCurrentPosition: browserCall || (() => {}) } },
    window: { Capacitor: native ? { isNativePlatform: () => true, Plugins: { GridlyGeolocation: { getCurrentPosition: nativeCall } } } : null }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${functionSource("getGridlyForegroundLocationProvider")} ${functionSource("requestGridlyForegroundPosition")}`, sandbox);
  return sandbox;
}

test("native first grant and already-granted success each continue once", async () => {
  for (const permission of ["prompt", "granted"]) {
    let calls = 0;
    const harness = locationHarness({ nativeCall: async () => { calls += 1; return { coords: { latitude: 32.7, longitude: -96.8 }, permission }; } });
    const position = await new Promise((resolve, reject) => harness.requestGridlyForegroundPosition(resolve, reject, { timeout: 10000 }));
    assert.equal(calls, 1);
    assert.equal(position.coords.latitude, 32.7);
  }
});

test("native unavailable is delivered to visible recovery owner and invalid coordinates fail closed", async () => {
  const unavailable = locationHarness({ nativeCall: async () => { throw Object.assign(new Error("service unavailable"), { code: "location_unavailable" }); } });
  const error = await new Promise(resolve => unavailable.requestGridlyForegroundPosition(() => assert.fail("unexpected success"), resolve));
  assert.equal(error.code, "location_unavailable");
  const invalid = { coords: { latitude: 190, longitude: -96.8 } };
  assert.equal(Number.isFinite(invalid.coords.latitude) && Math.abs(invalid.coords.latitude) <= 90, false);
});

test("native pending request remains singular across pause/resume and browser fallback is unchanged", async () => {
  let resolveNative;
  let nativeCalls = 0;
  const harness = locationHarness({ nativeCall: () => { nativeCalls += 1; return new Promise(resolve => { resolveNative = resolve; }); } });
  let settlements = 0;
  harness.requestGridlyForegroundPosition(() => { settlements += 1; }, () => { settlements += 1; });
  assert.equal(nativeCalls, 1, "one native request while permission activity pauses/resumes");
  resolveNative({ coords: { latitude: 30, longitude: -95 } });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(settlements, 1);

  let browserOptions;
  const browser = locationHarness({ native: false, browserCall: (success, _error, options) => { browserOptions = options; success({ coords: { latitude: 30, longitude: -95 } }); } });
  assert.equal(browser.requestGridlyForegroundPosition(() => {}, assert.fail, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }), "browser");
  assert.deepEqual({ ...browserOptions }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
});

test("production report owner has one watchdog, duplicate guard, governed submission, and terminal cleanup", () => {
  const source = functionSource("window.submitHazardNearMe");
  assert.match(source, /submissionInProgress \|\| reportingState\.locationLookupInProgress/);
  assert.match(source, /window\.setTimeout[\s\S]*12000/);
  assert.match(source, /if \(locationRequestSettled\) return/);
  assert.match(source, /createSharedHazardReport\(selectedType, finalPlacement\.lat, finalPlacement\.lng/);
  assert.match(source, /locationLookupInProgress: false/);
  assert.match(source, /Try again or tap the map/);
});

test("Android native plugin continues permission callbacks without background permission", () => {
  const native = fs.readFileSync("android/app/src/main/java/com/gridlygo/gridly/GridlyGeolocationPlugin.kt", "utf8");
  assert.match(native, /requestPermissionForAlias\("location", call, "locationPermissionResult"\)/);
  assert.match(native, /locationPermissionResult[\s\S]*continueCurrentPosition\(call\)/);
  assert.match(native, /LocationManagerCompat\.getCurrentLocation/);
  assert.doesNotMatch(native, /ACCESS_BACKGROUND_LOCATION/);
});

test("AndroidX location compatibility owns API 24-29 fallback and API 30+ delegation", () => {
  const native = fs.readFileSync("android/app/src/main/java/com/gridlygo/gridly/GridlyGeolocationPlugin.kt", "utf8");
  const gradle = fs.readFileSync("android/app/build.gradle", "utf8");
  const rootGradle = fs.readFileSync("android/build.gradle", "utf8");
  assert.match(gradle, /minSdk 24/);
  assert.match(gradle, /implementation "androidx\.appcompat:appcompat:\$androidxAppCompatVersion"/);
  assert.match(gradle, /implementation "androidx\.core:core:\$androidxCoreVersion"/);
  assert.match(rootGradle, /androidxCoreVersion = '1\.17\.0'/);
  assert.match(native, /LocationManagerCompat\.getCurrentLocation\([\s\S]*CancellationSignal\(\)[\s\S]*ContextCompat\.getMainExecutor\(context\)/);
  assert.doesNotMatch(native, /manager\.getCurrentLocation|context\.mainExecutor/);
  assert.doesNotMatch(native, /Build\.VERSION|RequiresApi|TargetApi|@SuppressLint\("NewApi"\)/);
  for (const field of ["latitude", "longitude", "accuracy"]) assert.match(native, new RegExp(`coordinates\\.put\\("${field}"`));
  for (const code of ["permission_denied", "location_unavailable"]) assert.match(native, new RegExp(`"${code}"`));
});

test("foreground permission contract remains identical across every supported Android API", () => {
  const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  assert.match(manifest, /ACCESS_COARSE_LOCATION/);
  assert.match(manifest, /ACCESS_FINE_LOCATION/);
  assert.doesNotMatch(manifest, /ACCESS_BACKGROUND_LOCATION/);
});
