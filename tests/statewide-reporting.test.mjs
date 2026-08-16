import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { certify, genericHazardPolicy } from "../tools/certify-statewide-reporting.mjs";

test("statewide reporting protects all governed identities and crossing cohorts", () => {
  const { counts } = certify();
  assert.deepEqual([counts.countiesPassed, counts.uniqueFips, counts.placesPassed, counts.multiCountyPlaces], [254, 254, 1859, 163]);
  assert.deepEqual([counts.zeroFraCounties, counts.sourceOnlyCounties, counts.activeRuntimeCounties], [54, 173, 28]);
  assert.equal(certify().passed, false, "the permanent gate must fail rather than conceal the 173/172 governed-cohort anomaly");
  assert.deepEqual([counts.mapVisible, counts.alertsVisible, counts.awarenessActive, counts.crossingDependencyFailures], [254, 254, 254, 0]);
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
});
