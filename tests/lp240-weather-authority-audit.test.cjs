const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyWeatherAuthority } = require("../js/gridlyLP240WeatherAuthorityAudit.js");

const healthy = { sourceConfigured: true, sourceRequestAttempted: true, sourceRequestSucceeded: true, sourceHealthy: true, canonicalGeographyResolved: true, geographyAgreementPass: true };

test("CASE A - healthy current applicable evidence is ACTIVE", () => {
  const result = classifyWeatherAuthority({ ...healthy, currentApplicableCount: 2, presentationCount: 2 });
  assert.equal(result.weatherAuthorityState, "ACTIVE");
  assert.equal(result.quietProven, false);
});

test("CASE B - healthy governed zero is QUIET", () => {
  const result = classifyWeatherAuthority({ ...healthy, currentApplicableCount: 0, presentationCount: 0, presentationEmptyState: "No active weather alerts" });
  assert.equal(result.weatherAuthorityState, "QUIET");
  assert.equal(result.quietProven, true);
  assert.equal(result.presentationAgreementPass, true);
});

test("CASE C - source failure is UNAVAILABLE", () => {
  const result = classifyWeatherAuthority({ ...healthy, sourceRequestSucceeded: false, sourceHealthy: false, sourceError: "network failed", currentApplicableCount: 0 });
  assert.equal(result.weatherAuthorityState, "UNAVAILABLE");
  assert.equal(result.quietProven, false);
  assert.equal(result.firstLosingStage, "SOURCE_HEALTH");
});

test("CASE D - unresolved geography is UNAVAILABLE", () => {
  const result = classifyWeatherAuthority({ ...healthy, geographyAgreementPass: false, currentApplicableCount: 0 });
  assert.equal(result.weatherAuthorityState, "UNAVAILABLE");
  assert.equal(result.quietProven, false);
  assert.equal(result.firstLosingStage, "GOVERNED_GEOGRAPHY");
});

test("CASE E - expired evidence only is QUIET after a healthy governed evaluation", () => {
  const result = classifyWeatherAuthority({ ...healthy, rawWeatherRecordCount: 1, currentApplicableCount: 0, presentationCount: 0, presentationEmptyState: "No active weather alerts" });
  assert.equal(result.weatherAuthorityState, "QUIET");
  assert.equal(result.quietProven, true);
});

test("CASE F - false quiet presentation fails for ACTIVE and UNAVAILABLE", () => {
  const presentation = { presentationCount: 0, presentationEmptyState: "No active weather alerts" };
  assert.equal(classifyWeatherAuthority({ ...healthy, currentApplicableCount: 1, ...presentation }).presentationAgreementPass, false);
  assert.equal(classifyWeatherAuthority({ ...healthy, sourceRequestSucceeded: false, sourceHealthy: false, currentApplicableCount: 0, ...presentation }).presentationAgreementPass, false);
});
