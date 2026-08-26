import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { countyRegistryRange } from "../scripts/lp189-statewide-runtime-activation-guarded.mjs";

const source = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const range = countyRegistryRange(source);
const registryContext = {};
vm.createContext(registryContext);
vm.runInContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, registryContext);
const registry = registryContext.registry;
const sanAntonioRegistry = JSON.parse(fs.readFileSync(new URL("../data/runtime/san-antonio-consumer-regions.json", import.meta.url), "utf8"));

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const bodyStart = source.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to extract ${name}`);
}

const representatives = [
  ["El Paso", "el-paso-tx", "48141", "4824000"],
  ["Laredo", "webb-tx", "48479", "4841464"],
  ["Fort Worth", "tarrant-tx", "48439", "4827000"],
  ["Houston", "harris-tx", "48201", "4835000"],
  ["Corpus Christi", "nueces-tx", "48355", "4817000"],
  ["Lubbock", "lubbock-tx", "48303", "4845000"],
  ["Waco", "mclennan-tx", "48309", "4876000"],
  ["Tyler", "smith-tx", "48423", "4874144"],
  ["College Station", "brazos-tx", "48041", "4815976"],
  ["Dallas", "dallas-tx", "48113", "4819000"],
  ["San Antonio", "bexar-tx", "48029", "4865000"],
  ["Austin", "travis-tx", "48453", "4805000"],
  ["Palestine", "anderson-tx", "48001", "4854708"],
  ["Liberty", "liberty-tx", "48291", "4842568"]
];

function makeHarness() {
  const areas = {};
  for (const [name, countyId, , placeGeoid] of representatives) {
    areas[`${countyId}-${placeGeoid}`] = { key: `${countyId}-${placeGeoid}`, label: name, countyId, communityId: placeGeoid };
  }
  areas["el-paso-countywide"] = { key: "el-paso-countywide", label: "El Paso County", countyId: "el-paso-tx", countyWide: true };
  const sanAntonioRegions = sanAntonioRegistry.regions.map((region) => ({
    id: region.regionId, label: region.consumerLabel, countyId: region.countyId,
    lat: region.semanticCenter.latitude, lng: region.semanticCenter.longitude,
    startupZoom: region.startupZoom, geometryFeatureId: region.geometryFeatureId
  }));
  for (const region of sanAntonioRegions) areas[region.id] = {
    key: region.id, label: region.label, awarenessRegionLabel: region.label,
    awarenessRegionId: region.id, countyId: region.countyId, sanAntonioRegion: true,
    lat: region.lat, lng: region.lng, startupZoom: region.startupZoom,
    geometryFeatureId: region.geometryFeatureId
  };
  const storage = new Map([["gridlyHomePersonalizationV1", JSON.stringify({ countyId: "anderson-tx", communityKey: "4854708" })]]);
  const context = {
    GRIDLY_COUNTY_REGISTRY: registry,
    GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID: Object.fromEntries(representatives.map(([, countyId, countyFips]) => [countyId, countyFips])),
    GRIDLY_AWARENESS_AREA_BY_KEY: areas,
    GRIDLY_LP194_SAN_ANTONIO_REGION_LOOKUP: Object.fromEntries(sanAntonioRegions.map((region) => [region.id, region])),
    GRIDLY_LP0517_HOME_PERSONALIZATION_SCHEMA_VERSION: "LP051.7.home-personalization.v1",
    GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY: "gridlyHomePersonalizationV1",
    GRIDLY_SETTINGS_STORAGE_KEY: "gridlySettingsV2",
    GRIDLY_PROFILE_STORAGE_KEY: "gridlyUserProfileV1",
    gridlyLp0517ApplyInFlight: false,
    gridlyLp0517IntegrationMetrics: { duplicateApplyBlocked: 0, canonicalHomeWrites: 0, productionSetupWrites: 0, compatibilitySetupWrites: 0, activeCountyUpdates: 0, activeCommunityUpdates: 0, activeAwarenessUpdates: 0, mapFocusRequests: 0, mapFocusCompleted: 0, providerRefreshRequests: 0, settingsRenderUpdates: 0, onboardingCompletionWrites: 0, rollbackCount: 0 },
    gridlyNormalizeCountyId: (value) => String(value || ""),
    gridlyLp0516NormalizeZipInput: (value) => String(value || ""),
    gridlyLp0516CountyName: (id, fallback) => registry[id]?.name || fallback || "",
    resolveGridlyAwarenessAreaForCounty: () => null,
    gridlySafeLocalStorageGet: (key) => storage.get(key) ?? null,
    localStorage: { setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) },
    gridlyGetActiveCountyId: () => "anderson-tx",
    gridlySetActiveCountyContext: () => true,
    saveGridlyHomeTownPreference: () => true,
    gridlyLp0517RecordMetric: () => {},
    gridlyFocusConfirmedHomeSelection: () => true,
    syncGridlyAwarenessAreaSurfacesImmediately: () => {},
    renderGridlySettingsPanel: () => {},
    markGridlyWelcomeSeen: () => {},
    saveGridlyUserProfile: () => {},
    window: {},
    Object, Boolean, String, Date, JSON, Error
  };
  vm.createContext(context);
  vm.runInContext([
    extractFunction("gridlyLp194ResolveGovernedSelectedRegionIdentity"),
    extractFunction("gridlyLp0517ResolveGovernedSelectedIdentity"),
    extractFunction("gridlyLp240ResolveGovernedHomeIdentity"),
    extractFunction("gridlyLp0517ValidateHomeRecord"),
    extractFunction("gridlyBuildHomePersonalizationRecord"),
    extractFunction("gridlyLp0517NormalizeSelectedOption"),
    extractFunction("gridlyApplyConfirmedHomePersonalization")
  ].join("\n"), context);
  return { context, storage, areas };
}

test("all nine governed San Antonio consumer regions save and restore without PLACE identity", () => {
  for (const region of sanAntonioRegistry.regions) {
    const { context, storage } = makeHarness();
    const result = context.gridlyApplyConfirmedHomePersonalization({
      countyId: "bexar-tx", awarenessAreaKey: region.regionId,
      consumerLabel: region.consumerLabel, communityLabel: region.consumerLabel,
      resolutionStatus: "manual_confirmed"
    }, { resolutionMethod: "manual_governed_area" });
    assert.equal(result.success, true, `${region.regionId}: ${JSON.stringify(result)}`);
    const saved = JSON.parse(storage.get("gridlyHomePersonalizationV1"));
    assert.equal(saved.identityType, "SAN_ANTONIO_CONSUMER_REGION");
    assert.equal(saved.canonicalRegionId, region.regionId);
    assert.equal(saved.awarenessAreaKey, region.regionId);
    assert.equal(saved.consumerLabel, region.consumerLabel);
    assert.equal(saved.communityKey, null);
    assert.equal(Object.hasOwn(saved, "placeGeoid"), false);
    assert.equal(context.gridlyLp0517ValidateHomeRecord(saved).area.key, region.regionId);
  }
});

test("San Antonio region governance fails closed and legacy blanket identity requires reselection", () => {
  const invalid = [
    { countyId: "bexar-tx", awarenessAreaKey: "arbitrary-tenth-region", consumerLabel: "Arbitrary San Antonio", resolutionStatus: "manual_confirmed" },
    { countyId: "dallas-tx", awarenessAreaKey: "central-san-antonio", consumerLabel: "Central San Antonio", resolutionStatus: "manual_confirmed" },
    { countyId: "bexar-tx", awarenessAreaKey: "bexar-tx-san-antonio", consumerLabel: "San Antonio", resolutionStatus: "manual_confirmed" }
  ];
  for (const selection of invalid) {
    const { context } = makeHarness();
    assert.equal(context.gridlyApplyConfirmedHomePersonalization(selection, { resolutionMethod: "manual_governed_area" }).error, "invalid_selected_identity");
  }
  const { context, areas } = makeHarness();
  delete areas["medical-region"];
  const missingRegistration = context.gridlyApplyConfirmedHomePersonalization({ countyId: "bexar-tx", awarenessAreaKey: "medical-region", consumerLabel: "Medical Region", resolutionStatus: "manual_confirmed" });
  assert.equal(missingRegistration.error, "invalid_selected_identity");
});

test("explicit apply accepts every representative governed statewide PLACE identity", () => {
  for (const [name, countyId, countyFips, placeGeoid] of representatives) {
    const { context, storage } = makeHarness();
    const result = context.gridlyApplyConfirmedHomePersonalization({
      countyId, communityKey: placeGeoid, communityLabel: name,
      awarenessAreaKey: `${countyId}-${placeGeoid}`, consumerLabel: name,
      resolutionStatus: "manual_confirmed"
    }, { resolutionMethod: "manual_governed_area" });
    assert.equal(result.success, true, `${name}: ${JSON.stringify(result)}`);
    assert.equal(result.persisted, true, `${name} persisted`);
    assert.equal(result.countyId, countyId, `${name} active operational county`);
    assert.equal(registry[result.countyId].countyFips || context.GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID[result.countyId], countyFips, `${name} active canonical county FIPS`);
    assert.equal(result.communityKey, placeGeoid, `${name} active PLACE GEOID`);
    assert.equal(result.mapFocused, true, `${name} map focus`);
    assert.equal(JSON.parse(storage.get("gridlyHomePersonalizationV1")).communityKey, placeGeoid, `${name} replaced prior state`);
  }
});

test("governed manual identity validation remains fail closed and transactional", () => {
  const invalidCases = [
    { countyId: "dallas-tx", communityKey: "4824000", awarenessAreaKey: "el-paso-tx-4824000", resolutionStatus: "manual_confirmed" },
    { countyId: "el-paso-tx", communityKey: "4899999", awarenessAreaKey: "el-paso-tx-4824000", resolutionStatus: "manual_confirmed" },
    { countyId: "el-paso-tx", communityKey: "el-paso", awarenessAreaKey: "el-paso-tx-4824000", resolutionStatus: "manual_confirmed" },
  ];
  for (const selection of invalidCases) {
    const { context, storage } = makeHarness();
    const prior = storage.get("gridlyHomePersonalizationV1");
    const result = context.gridlyApplyConfirmedHomePersonalization(selection, { resolutionMethod: "manual_governed_area" });
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { success: false, error: "invalid_selected_identity", persisted: false, onboardingCompleted: false, routeIntelligenceTouched: false });
    assert.equal(storage.get("gridlyHomePersonalizationV1"), prior, "prior Palestine state is preserved");
  }

  const { context } = makeHarness();
  const originalFips = registry["el-paso-tx"].countyFips;
  const countyWithoutFips = { ...registry["el-paso-tx"], countyFips: "" };
  context.GRIDLY_COUNTY_REGISTRY = { ...registry, "el-paso-tx": countyWithoutFips };
  context.GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID = { ...context.GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID, "el-paso-tx": "" };
  assert.equal(context.gridlyLp0517ResolveGovernedSelectedIdentity({ countyId: "el-paso-tx", communityKey: "4824000" }), null, "missing county FIPS rejects");
  assert.equal(originalFips, "48141");
});

test("countywide manual apply retains FIPS-backed county identity without a fabricated PLACE", () => {
  const { context, storage } = makeHarness();
  const result = context.gridlyApplyConfirmedHomePersonalization({
    countyId: "el-paso-tx", communityKey: null, awarenessAreaKey: "el-paso-countywide",
    consumerLabel: "El Paso County", resolutionStatus: "manual_countywide_confirmed"
  }, { resolutionMethod: "manual_countywide" });
  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.communityKey, null);
  assert.equal(registry[result.countyId].countyFips, "48141");
  assert.equal(JSON.parse(storage.get("gridlyHomePersonalizationV1")).communityKey, null);
});

test("manual apply completion copy retains the committed governed label independently of picker state", () => {
  const render = extractFunction("gridlyLp0516Render");
  assert.match(render, /state\.prototypeResult\?\.consumerLabel \|\| state\.selectedCandidate\?\.consumerLabel/);
  assert.match(render, /Your home area is set/);
});
