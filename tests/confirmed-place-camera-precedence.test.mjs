import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const projection = JSON.parse(fs.readFileSync(new URL("../data/generated/gridly-statewide-consumer-community-projection-v1.json", import.meta.url), "utf8"));
const presentation = JSON.parse(fs.readFileSync(new URL("../data/generated/gridly-statewide-place-presentation-v1.json", import.meta.url), "utf8"));

function body(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const brace = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

test("confirmed PLACE persistence hydrates county support without taking camera ownership", () => {
  const apply = body("gridlyApplyConfirmedHomePersonalization");
  assert.match(apply, /preserveSemanticCamera: validation\.area\.countyWide !== true/);
  assert.ok(apply.indexOf("saveGridlyHomeTownPreference") < apply.indexOf("gridlyFocusConfirmedHomeSelection"), "support hydration precedes the final PLACE camera");

  const save = body("saveGridlyHomeTownPreference");
  assert.match(save, /gridlySetActiveCountyContext\(resolvedCountyId, \{ preserveSemanticCamera: options\.preserveSemanticCamera === true \}\)/);
  assert.match(save, /fitMap: options\.preserveSemanticCamera !== true/);

  const countyContext = body("gridlySetActiveCountyContext");
  assert.match(countyContext, /if \(options\.preserveSemanticCamera !== true\) gridlyFitMapToActiveCountyContext/);
  const awareness = body("applyGridlyHomeTownAwarenessContext");
  assert.ok(awareness.indexOf("renderGridlyAwarenessMapIdentity") < awareness.indexOf("if (!fitMap) return true"), "identity support initializes without moving the map");
  assert.ok(awareness.indexOf("if (!fitMap) return true") < awareness.indexOf("gridlyDispatchSemanticCamera"), "camera dispatch is suppressed during PLACE support hydration");
});

test("explicit countywide confirmation retains COUNTY_GEOMETRY_FIT ownership", () => {
  const apply = body("gridlyApplyConfirmedHomePersonalization");
  assert.match(apply, /preserveSemanticCamera: validation\.area\.countyWide !== true/);
  const dispatch = body("gridlyDispatchSemanticCamera");
  assert.match(dispatch, /if \(area\.countyWide !== true\) return false/);
  assert.match(dispatch, /map\.fitBounds\(bounds/);
  assert.match(dispatch, /semanticLevel: "COUNTYWIDE"/);
});

test("statewide control PLACE targets remain unchanged and governed at zoom 13", () => {
  const expected = {
    Dayton: [30.0131768, -94.9360035],
    Liberty: [30.0388343, -94.7888034],
    Palestine: [31.7545115, -95.6469527],
    Tyler: [32.3173339, -95.3063994],
    Waco: [31.5579941, -97.1897498]
  };
  for (const [name, coordinates] of Object.entries(expected)) {
    const community = projection.communities.find((entry) => entry.displayName === name);
    assert.ok(community, `${name} identity exists`);
    const target = presentation.places[community.placeGeoid];
    assert.deepEqual([target.lat, target.lon], coordinates, `${name} governed camera source is unchanged`);
  }
  assert.match(source, /\{ key: "dayton", label: "Dayton", storageValue: "Dayton", countyId: "liberty-tx", lat: 30\.0466, lng: -94\.8852, radiusMiles: 8, startupZoom: 14, source: "existing local app anchor" \}/);
  assert.match(source, /const GRIDLY_TOWN_STARTUP_ZOOM = 13;/);
});

test("LP197 and canonical multi-county PLACE dispatch remain ahead of county geometry", () => {
  for (const name of ["Dallas", "Fort Worth", "Austin", "El Paso"]) {
    const community = projection.communities.find((entry) => entry.displayName === name);
    assert.ok(community && presentation.places[community.placeGeoid], `${name} governed PLACE camera remains available`);
  }
  const dispatch = body("gridlyDispatchSemanticCamera");
  assert.ok(dispatch.indexOf("if (placeGeoid)") < dispatch.indexOf("if (area.countyWide !== true) return false"));
  assert.doesNotMatch(dispatch.slice(dispatch.indexOf("if (placeGeoid)"), dispatch.indexOf("if (area.countyWide !== true) return false")), /fitBounds/);
});

test("complete manual Dayton confirmation path ends with one observable PLACE camera matching reload", () => {
  const transitions = [];
  const dayton = { key: "dayton", label: "Dayton", storageValue: "Dayton", countyId: "liberty-tx", lat: 30.0466, lng: -94.8852, startupZoom: 14, source: "existing local app anchor" };
  const county = { countyWide: true, countyId: "liberty-tx" };
  const context = {
    map: {
      setView(center, zoom, options) { transitions.push({ method: "setView", center: [...center], zoom, options }); },
      fitBounds(bounds, options) { transitions.push({ method: "fitBounds", bounds, options }); }
    },
    L: { latLngBounds: () => ({ isValid: () => true }) },
    GRIDLY_TOWN_STARTUP_ZOOM: 13, GRIDLY_COUNTY_STARTUP_ZOOM: 9,
    GRIDLY_LP194_SAN_ANTONIO_REGION_LOOKUP: {}, GRIDLY_AWARENESS_AREA_BY_KEY: {},
    gridlyPlacePresentationTargets: null, gridlySemanticCameraSequence: 0, gridlyCommittedSemanticCamera: null,
    GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY: "home", GRIDLY_LP0517_HOME_PERSONALIZATION_SCHEMA_VERSION: "1", GRIDLY_SETTINGS_STORAGE_KEY: "settings", GRIDLY_PROFILE_STORAGE_KEY: "profile",
    gridlyLp0517ApplyInFlight: false,
    gridlyLp0517IntegrationMetrics: { duplicateApplyBlocked: 0, canonicalHomeWrites: 0, productionSetupWrites: 0, compatibilitySetupWrites: 0, activeCountyUpdates: 0, activeCommunityUpdates: 0, activeAwarenessUpdates: 0, mapFocusRequests: 0, mapFocusCompleted: 0, providerRefreshRequests: 0, settingsRenderUpdates: 0, onboardingCompletionWrites: 0, rollbackCount: 0 },
    gridlyLp0517RecordMetric() {}, gridlySafeLocalStorageGet() { return null; },
    localStorage: { setItem() {}, removeItem() {} }, window: {},
    gridlyLp0517NormalizeSelectedOption: input => input,
    gridlyBuildHomePersonalizationRecord: input => ({ ...input, schemaVersion: "1" }),
    gridlyLp0517ValidateHomeRecord: () => ({ valid: true, area: dayton }),
    gridlyGetActiveCountyId: () => "liberty-tx",
    gridlyNormalizeCountyId: value => value,
    gridlyResolveCanonicalPlaceGeoid: () => null,
    gridlyGetGovernedPlaceConsumerPresentationCamera: () => null,
    getGridlyAwarenessFitPadding: () => ({}),
    gridlyGetAuthoritativeCountyGeometryFocusBounds: () => ({ libertyCountyBounds: true }),
    setGridlyAwarenessView(center, zoom, options) { context.map.setView([center.lat, center.lng], zoom, { animate: options.animate === true }); return true; },
    saveGridlyHomeTownPreference() { transitions.push({ method: "persistence" }); context.gridlyDispatchSemanticCamera(county, "liberty-tx", { source: "county_support" }); return "Dayton"; },
    syncGridlyAwarenessAreaSurfacesImmediately() { transitions.push({ method: "current-view-refresh" }); context.gridlyDispatchSemanticCamera(county, "liberty-tx", { source: "settings_refresh" }); },
    renderGridlySettingsPanel() { transitions.push({ method: "settings-render" }); },
    markGridlyWelcomeSeen() {}, saveGridlyUserProfile() {},
    gridlyFocusConfirmedHomeSelection(area, countyId) { return context.gridlyDispatchSemanticCamera(area, countyId, { source: "confirmed_home", transactionPhase: "final_place_dispatch" }); }
  };
  const runtime = `
    let gridlyConfirmedCameraTransaction = null;
    const gridlySemanticCameraOwnerTrace = [];
    ${body("gridlyRecordSemanticCameraOperation")}
    ${body("gridlyBeginConfirmedCameraTransaction")}
    ${body("gridlyCompleteConfirmedCameraTransaction")}
    ${body("gridlyDispatchSemanticCamera")}
    ${body("gridlyApplyConfirmedHomePersonalization")}
    this.gridlyDispatchSemanticCamera = gridlyDispatchSemanticCamera;
    this.apply = gridlyApplyConfirmedHomePersonalization;
    this.ownerTrace = gridlySemanticCameraOwnerTrace;
    this.committed = () => gridlyCommittedSemanticCamera;
  `;
  vm.runInNewContext(runtime, context);
  const result = context.apply({ zip: "77535", countyId: "liberty-tx", countyName: "Liberty County", communityKey: "dayton", communityLabel: "Dayton", awarenessAreaKey: "dayton", consumerLabel: "Dayton", resolutionStatus: "manual_confirmed" });
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.mapFocused, true);
  assert.equal(transitions.filter(entry => entry.method === "fitBounds").length, 0, "county fitting cannot execute during the confirmed PLACE transaction");
  const setViews = transitions.filter(entry => entry.method === "setView");
  assert.equal(setViews.length, 1, "exactly one final camera is issued after support and settings refresh");
  assert.deepEqual(setViews[0], { method: "setView", center: [30.0466, -94.8852], zoom: 13, options: { animate: false } });
  assert.equal(context.committed().semanticLevel, "PLACE");
  assert.equal(context.committed().zoom, 13);
  assert.ok(Math.abs(context.committed().target.lat - 30.046658937805077) < 0.0001);
  assert.ok(Math.abs(context.committed().target.lng - -94.88513946533205) < 0.0001);
  assert.deepEqual(JSON.parse(JSON.stringify(context.ownerTrace.map(entry => [entry.method, entry.semanticOwner, entry.transactionPhase]))), [
    ["fitBounds", "COUNTYWIDE_BLOCKED", "support_hydration"],
    ["fitBounds", "COUNTYWIDE_BLOCKED", "support_hydration"],
    ["setView", "PLACE", "final_place_dispatch"]
  ]);
  assert.ok(transitions.findIndex(entry => entry.method === "current-view-refresh") < transitions.findIndex(entry => entry.method === "setView"));
  assert.notEqual(setViews[0].zoom, 9);
});
