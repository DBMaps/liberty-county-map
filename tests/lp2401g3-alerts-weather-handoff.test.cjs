const assert = require("node:assert/strict");
const test = require("node:test");
const handoff = require("../js/gridlyAlertsWeatherAuthorityHandoff.js");

const DAYTON = "4819432|dayton|30.0466,-94.8852";
const TARKINGTON = "liberty-tx:tarkington|tarkington|30.3205,-94.996";

function authority(identity, identityClass = "CANONICAL_PLACE") {
  const awarenessKey = identityClass === "GOVERNED_NON_PLACE" ? "tarkington" : "dayton";
  const stableIdentity = identityClass === "GOVERNED_NON_PLACE" ? "liberty-tx:tarkington" : "4819432";
  return {
    candidate: { weatherFamilyIdentity: identity },
    weatherSelection: { authorityStatus: "ACTIVE", weatherAuthorityIdentity: identity, weatherFamilyIdentity: identity },
    connectorRuntime: { applicabilityMode: "NWS_POINT_QUERY", requestSucceeded: true, responseValid: true, freshEnough: true, currentAwarenessIdentity: identity, pointRequestIdentity: identity, responseIdentity: identity, selectedPoint: { identityClass, awarenessKey, stableIdentity } }
  };
}

test("A/B: ACTIVE canonical PLACE and governed non-PLACE identities are accepted", () => {
  assert.equal(handoff.evaluate(authority(DAYTON)).accepted, true);
  assert.equal(handoff.evaluate(authority(TARKINGTON, "GOVERNED_NON_PLACE")).accepted, true);
});

test("C/D/I: QUIET and UNAVAILABLE authorities publish no Weather", () => {
  for (const state of ["QUIET", "UNAVAILABLE"]) {
    const input = authority(TARKINGTON, "GOVERNED_NON_PLACE");
    input.weatherSelection.authorityStatus = state;
    assert.equal(handoff.evaluate(input).accepted, false);
  }
});

test("E/F/G/H: mismatched family and cross-area records fail closed", () => {
  for (const [current, candidate, identityClass] of [[TARKINGTON, DAYTON, "GOVERNED_NON_PLACE"], [DAYTON, TARKINGTON, "CANONICAL_PLACE"]]) {
    const input = authority(current, identityClass);
    input.candidate.weatherFamilyIdentity = candidate;
    assert.equal(handoff.evaluate(input).rejectionReason, "WEATHER_GOVERNED_IDENTITY_MISMATCH");
  }
  const missing = authority(DAYTON);
  missing.candidate.weatherFamilyIdentity = null;
  assert.equal(handoff.evaluate(missing).rejectionReason, "WEATHER_FAMILY_IDENTITY_MISSING");
});

test("J: stale authority fails closed", () => {
  const input = authority(TARKINGTON, "GOVERNED_NON_PLACE");
  input.connectorRuntime.freshEnough = false;
  assert.equal(handoff.evaluate(input).rejectionReason, "WEATHER_AUTHORITY_STALE");
});

test("K/L/M/N: fabricated, unsupported, county-wide, and fallback identities fail closed", () => {
  for (const identityClass of ["FABRICATED_NON_PLACE", "UNSUPPORTED"]) {
    const input = authority("fake|fake|0,0", identityClass);
    assert.equal(handoff.evaluate(input).rejectionReason, "UNSUPPORTED_GOVERNED_AWARENESS_IDENTITY");
  }
  for (const mode of ["NWS_COUNTY_QUERY", "STATEWIDE_FALLBACK"]) {
    const input = authority(DAYTON);
    input.connectorRuntime.applicabilityMode = mode;
    assert.equal(handoff.evaluate(input).rejectionReason, "COUNTY_OR_FALLBACK_WEATHER_INELIGIBLE");
  }
});

test("O/P: transitions accept only the completely current lineage", () => {
  assert.equal(handoff.evaluate(authority(TARKINGTON, "GOVERNED_NON_PLACE")).candidateIdentity, TARKINGTON);
  assert.equal(handoff.evaluate(authority(DAYTON)).candidateIdentity, DAYTON);
  const transition = authority(TARKINGTON, "GOVERNED_NON_PLACE");
  transition.connectorRuntime.responseIdentity = DAYTON;
  assert.equal(handoff.evaluate(transition).accepted, false);
});

test("Q/R: evaluator is passive and one candidate yields one deterministic decision", () => {
  const input = authority(TARKINGTON, "GOVERNED_NON_PLACE");
  const before = JSON.stringify(input);
  const result = handoff.evaluate(input);
  assert.equal(result.accepted, true);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(result), true);
});
