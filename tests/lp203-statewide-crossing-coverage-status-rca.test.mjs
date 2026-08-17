import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildLp203Rca } from "../tools/lp203/build-statewide-crossing-coverage-status-rca.mjs";

const rca = buildLp203Rca();

test("LP203 proves the exact legacy banner input and first incorrect condition", () => {
  assert.equal(rca.exactBannerOwner.decisionFunction, "getGridlyAwarenessCoverageState (js/app.js)");
  assert.equal(rca.exactBannerOwner.firstIncorrectCondition, "countyConfig.runtimeSourceAvailability.crossings === 'available'");
  assert.equal(rca.exactBannerOwner.reads.authoritativeRuntimePackageRegistry, false);
  assert.equal(rca.exactBannerOwner.reads.hydrationState, false);
});

test("Sherman, Dallas, regional controls, and Liberty reproduce the contradiction", () => {
  assert.deepEqual([rca.controls.shermanGrayson.governedCount, rca.controls.shermanGrayson.legacyAvailabilityValue, rca.controls.shermanGrayson.currentLegacyBannerAvailabilityClassification], [240, "not-claimed", "UNAVAILABLE"]);
  assert.deepEqual([rca.controls.dallas.governedCount, rca.controls.dallas.currentLegacyBannerAvailabilityClassification], [789, "UNAVAILABLE"]);
  assert.deepEqual([rca.controls.elPaso.governedCount, rca.controls.wacoMcLennan.governedCount, rca.controls.tylerSmith.governedCount], [198, 169, 123]);
  assert.ok([rca.controls.elPaso, rca.controls.wacoMcLennan, rca.controls.tylerSmith].every((c) => c.currentLegacyBannerAvailabilityClassification === "UNAVAILABLE"));
  assert.deepEqual([rca.controls.liberty.governedCount, rca.controls.liberty.currentLegacyBannerAvailabilityClassification], [115, "AVAILABLE"]);
});

test("ACTIVE_EMPTY is governed availability and three controls are falsely unavailable", () => {
  for (const county of [rca.controls.activeEmptyAndrews, rca.controls.activeEmptyArcher, rca.controls.activeEmptyBandera]) {
    assert.equal(county.governedCrossingState, "ACTIVE_EMPTY");
    assert.equal(county.expectedModernAvailabilityClassification, "AVAILABLE_NO_CROSSINGS");
    assert.equal(county.currentLegacyBannerAvailabilityClassification, "UNAVAILABLE");
  }
});

test("all 254 counties are evaluated and statewide mismatch totals are exact", () => {
  assert.deepEqual(rca.authoritativeState, { governedCounties: 254, activePositive: 202, activeEmpty: 52, governedIdentities: 16099, runtimeCrossingRegistryEntries: 254 });
  assert.deepEqual(rca.statewideResults, { evaluated: 254, correctBannerClassifications: 28, falseUnavailableClassifications: 226, activePositiveFalselyUnavailable: 175, activeEmptyFalselyUnavailable: 51, otherMismatches: 0, legacyInlineAvailable: 28, legacyInlineNotAvailable: 226 });
  assert.equal(rca.counties.length, 254);
  assert.ok(rca.counties.every((county) => county.runtimeRegistryAvailability));
});

test("RCA artifacts do not patch production behavior", () => {
  const changed = fs.readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(changed, /countyConfig\?\.runtimeSourceAvailability\?\.crossings === "available"/);
  assert.match(changed, /primary: crossingAvailable \? "" : "Limited local coverage"/);
  assert.match(changed, /secondary: crossingAvailable \? "" : "Crossing data isn't available for this area yet\."/);
});
