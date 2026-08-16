import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { certify, genericHazardPolicy, reconcileCrossingCapabilities, deployedReportsInsertKeys, deployedReportsSelectKeys } from "../tools/certify-statewide-reporting.mjs";

test("statewide reporting protects all governed identities and crossing cohorts", () => {
  const { counts } = certify();
  assert.deepEqual([counts.countiesPassed, counts.uniqueFips, counts.placesPassed, counts.multiCountyPlaces], [254, 254, 1859, 163]);
  assert.deepEqual([counts.zeroFraCounties, counts.sourceOnlyCounties, counts.activeRuntimeCounties], [54, 173, 28]);
  assert.equal(certify().passed, true);
  assert.deepEqual([counts.ACTIVE_POSITIVE, counts.ACTIVE_EMPTY, counts.SOURCE_ONLY_POSITIVE, counts.SOURCE_ZERO_NOT_ACTIVATED], [27, 1, 173, 53]);
  assert.equal(counts.governedCrossingPartitionCount, 254);
  assert.deepEqual([counts.mapVisible, counts.alertsVisible, counts.awarenessActive, counts.crossingDependencyFailures], [254, 254, 254, 0]);
  assert.deepEqual([counts.persistenceShapeCompatible, counts.structuredCountyMetadataPresent, counts.historicalCohortExclusions], [254, 254, 0]);
  for (const row of certify().evidence["statewide-reporting-certification.json"].results) {
    assert.deepEqual(row.deployedInsertKeys, deployedReportsInsertKeys);
    assert.deepEqual(row.deployedSelectKeys, deployedReportsSelectKeys);
    assert.equal(row.retrievalShapeCompatible && row.structuredMetadataNormalized, true);
    assert.equal(row.persistenceShapeCompatible && row.structuredCountyMetadataPresent && row.crossingRuntimeRequired === false, true);
  }
});

test("crossing source sets reconcile and runtime precedence partitions all counties", () => {
  const capability = JSON.parse(fs.readFileSync("reports/statewide-capability-audit/county-capability-matrix.json")).counties;
  const result = reconcileCrossingCapabilities(capability);
  assert.deepEqual(result.counts, { A: 254, Z: 54, P: 200, R: 28, S: 173 });
  assert.equal(result.sourceContractReconciled, true);
  assert.equal(result.partitionValid, true);
  assert.deepEqual(result.intersections["Z ∩ P"], []);
  assert.deepEqual(result.intersections["Z ∩ R"], ["tyler-tx"]);
  assert.deepEqual(result.intersections["S ∩ R"], []);
  assert.deepEqual(result.intersections["R - P"], ["tyler-tx"]);
  const partition = Object.values(result.classes).flat();
  assert.equal(partition.length, 254);
  assert.equal(new Set(partition).size, 254, "no county may occur twice or be silently dropped");
  assert.ok(result.classes.ACTIVE_EMPTY.includes("tyler-tx"));
  assert.ok(!result.classes.SOURCE_ZERO_NOT_ACTIVATED.includes("tyler-tx"), "active runtime takes precedence");
});

test("last persisted helper uses deployed columns and strongest retained identity", async () => {
  const source = fs.readFileSync("reports/statewide-capability-recovery/live-waco-report-select-helper.js", "utf8");
  assert.doesNotMatch(source, /\.(?:insert|update|delete)\s*\(/i);
  const calls = [];
  const builder = new Proxy({}, { get(_target, name) {
    if (name === "then") return (resolve) => resolve({ data: [{ id: "waco-fixture", crossing_id: "hazard-device-1" }], error: null });
    return (...args) => { calls.push([name, ...args]); return builder; };
  }});
  globalThis[Symbol.for("gridly.runtime.supabaseClient")] = { from(table) { calls.push(["from", table]); return builder; } };
  globalThis.gridlyGetLastHazardPersistenceDiagnostic = () => ({ finalStatus: "PERSISTED", crossingId: "hazard-device-1", deviceId: "device-1", reportType: "flooding" });
  const { selectLastPersistedHazardReport } = await import("../reports/statewide-capability-recovery/live-waco-report-select-helper.js");
  const result = await selectLastPersistedHazardReport();
  assert.equal(result.status, "FOUND");
  assert.equal(result.queryMode, "DEPLOYED_BASE_COLUMNS:EXACT_CROSSING_ID");
  assert.ok(calls.some((call) => call[0] === "eq" && call[1] === "crossing_id" && call[2] === "hazard-device-1"));
  assert.ok(!calls.some((call) => call.includes("county_id") || call.includes("state")));
  delete globalThis[Symbol.for("gridly.runtime.supabaseClient")];
  delete globalThis.gridlyGetLastHazardPersistenceDiagnostic;
});

test("production exposes a sanitized loaded-row trace and retains a statewide retrieval window", () => {
  const source = fs.readFileSync("js/app.js", "utf8");
  assert.match(source, /function gridlyGetLoadedReportSnapshot\(\)/);
  assert.match(source, /\.order\("created_at", \{ ascending: false \}\)\s*\.limit\(300\)/);
  for (const field of ["lifecycleState", "mapEligible", "alertsEligible", "awarenessEligible", "countyScopeMatch", "activeCollection"]) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(source, /gridlyGetLoadedReportSnapshot[\\s\\S]{0,250}supabaseClient\\s*\.from/);
});

test("generic hazard policy never depends on crossing runtime", () => {
  for (const crossingRuntime of [undefined, false, true]) assert.deepEqual(genericHazardPolicy({ reportKind: "hazard", expired: false, countyFips: "48001", crossingRuntime }), { persistenceEligible: true, retrievalEligible: true, mapVisible: true, alertsVisible: true, awarenessState: "active", crossingRuntimeRequired: false });
});

test("runtime uses governed FIPS and statewide PLACE presentation candidates", () => {
  const source = fs.readFileSync("js/app.js", "utf8");
  assert.match(source, /function gridlyGetCountyReportingIdentity/);
  assert.match(source, /Object\.entries\(gridlyPlacePresentationTargets\)/);
  assert.match(source, /countyFips: gridlyGetCountyReportingIdentity/);
});

test("report insert errors remain consumer-visible failures", () => {
  const source = fs.readFileSync("js/app.js", "utf8");
  assert.match(source, /if \(error\) throw error/);
  assert.doesNotMatch(source, /gridlyInsertWithCountyMetadataFallback[\s\S]{0,500}catch\s*\([^)]*\)\s*\{\s*return\s*\{\s*error:\s*null/);
  assert.match(source, /function gridlyGetLastHazardPersistenceDiagnostic\(\)/);
  assert.match(source, /firstAttemptMode: "DEPLOYED_BASE_COLUMNS"/);
  assert.match(source, /finalStatus: retry\?\.error \? "NOT_PERSISTED" : "PERSISTED"/);
});

test("actual production-boundary render harness certifies every county and Waco control", async () => {
  const { normalizeGenericHazard, exerciseActualRenderPath, createRenderHarness } = await import("../tools/statewide-report-render-runtime.mjs");
  const result = certify();
  assert.deepEqual([result.counts.mapRendered, result.counts.alertsRendered, result.counts.awarenessPresented], [254, 254, 254]);
  for (const row of result.evidence["statewide-reporting-certification.json"].results) {
    assert.equal(row.actualRender.markerCreated && row.actualRender.markerAddedToLayer && row.actualRender.markerCurrentlyOnMap, true);
    assert.equal(row.actualRender.alertItemCreated && row.actualRender.alertRendered && row.actualRender.awarenessPresented, true);
    assert.equal(row.actualRender.crossingDependencies, 0);
  }
  const waco = normalizeGenericHazard({ id: "48c70dd1-6b56-45ee-ac2c-d4a1314d7386", crossing_id: "hazard-device-fb254e5c-da39-4ff0-92d1-15c9cc62b57d-1786898439054", report_type: "flooding", lat: 31.5561805244549, lng: -97.1312159299851 }, { countyId: "mclennan-tx", countyFips: "48309", name: "McLennan County" }, { placeGeoid: "4876000", displayName: "Waco", countyMemberships: ["48309"] });
  const actual = exerciseActualRenderPath(waco, createRenderHarness());
  assert.equal(actual.markerCurrentlyOnMap && actual.alertRendered && actual.awarenessPresented, true);
  assert.equal(actual.crossingDependencies, 0, "legacy hazard crossing_id is data, never a rendering dependency");
});

test("owner render diagnostics are read-only and production refresh invalidates stale models", () => {
  const source = fs.readFileSync("js/app.js", "utf8");
  assert.match(source, /function gridlyGetHazardRenderSnapshot\(\)/);
  assert.match(source, /function gridlyGetAlertsRenderSnapshot\(\)/);
  assert.match(source, /function gridlyGetAwarenessFinalStateSnapshot\(\)/);
  assert.match(source, /gridlyAuthoritativeIncidentSnapshotState\.snapshot = null/);
  assert.match(source, /unifiedIncidents\+activeHazards/);
});

test("final presentation owners do not gate generic hazards on crossing, desktop, or popup enrichment", () => {
  const source = fs.readFileSync("js/app.js", "utf8");
  const addAt = source.indexOf("marker.addTo(unifiedIncidentLayer);", source.indexOf("function renderUnifiedIncidents"));
  const popupAt = source.indexOf("const popupContent = buildUnifiedIncidentPopup", source.indexOf("function renderUnifiedIncidents"));
  assert.ok(addAt > 0 && addAt < popupAt, "Leaflet insertion precedes optional popup enrichment");
  const refresh = source.slice(source.indexOf("function refreshReportHazardViews"), source.indexOf("function getCrossingReviewOverrides"));
  assert.ok(refresh.indexOf("refreshGridlyCommunityPulseSharedModel") < refresh.indexOf("refreshPortraitV2LocalizedIntelligence"));
  assert.ok(refresh.indexOf('timeRefreshChild("renderAlerts"') < refresh.indexOf("if (refreshLayoutModeIsDesktop)"));
  assert.match(source, /const lifecycleActiveHazards = getGridlyAwarenessLifecycleActiveHazards\(hazardItems\)/);
  assert.match(source, /data-gridly-alert-report-id=.*data-gridly-alert-state="active"/);
});
