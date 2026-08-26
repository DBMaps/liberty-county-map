(function installGridlyAlertsWeatherAuthorityHandoff(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GridlyAlertsWeatherAuthorityHandoff = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildAlertsWeatherAuthorityHandoff() {
  "use strict";

  const text = (value) => String(value ?? "").trim();
  const SUPPORTED_CLASSES = new Set(["CANONICAL_PLACE", "GOVERNED_NON_PLACE"]);

  function evaluate(input = {}) {
    const runtime = input.connectorRuntime || {};
    const selection = input.weatherSelection || {};
    const candidateIdentity = text(input.candidate?.weatherFamilyIdentity);
    const authorityIdentity = text(selection.weatherAuthorityIdentity);
    const familyIdentity = text(selection.weatherFamilyIdentity);
    const selectedIdentity = text(runtime.currentAwarenessIdentity);
    const requestIdentity = text(runtime.pointRequestIdentity);
    const responseIdentity = text(runtime.responseIdentity);
    const identityClass = text(runtime.selectedPoint?.identityClass);
    let rejectionReason = null;

    if (selection.authorityStatus !== "ACTIVE") rejectionReason = "WEATHER_AUTHORITY_NOT_ACTIVE";
    else if (runtime.applicabilityMode !== "NWS_POINT_QUERY") rejectionReason = "COUNTY_OR_FALLBACK_WEATHER_INELIGIBLE";
    else if (runtime.requestSucceeded !== true || runtime.responseValid !== true) rejectionReason = "WEATHER_RESPONSE_NOT_AUTHORITATIVE";
    else if (runtime.freshEnough !== true) rejectionReason = "WEATHER_AUTHORITY_STALE";
    else if (!SUPPORTED_CLASSES.has(identityClass) || !text(runtime.selectedPoint?.awarenessKey) || !text(runtime.selectedPoint?.stableIdentity)) rejectionReason = "UNSUPPORTED_GOVERNED_AWARENESS_IDENTITY";
    else if (!candidateIdentity) rejectionReason = "WEATHER_FAMILY_IDENTITY_MISSING";
    else if (!authorityIdentity || !familyIdentity) rejectionReason = "WEATHER_AUTHORITY_IDENTITY_MISSING";
    else if (!(selectedIdentity === requestIdentity && requestIdentity === responseIdentity && responseIdentity === authorityIdentity && authorityIdentity === familyIdentity && familyIdentity === candidateIdentity)) rejectionReason = "WEATHER_GOVERNED_IDENTITY_MISMATCH";

    return Object.freeze({
      accepted: rejectionReason === null,
      candidateIdentity: candidateIdentity || null,
      authorityIdentity: authorityIdentity || null,
      firstLosingStage: rejectionReason ? "ALERTS_WEATHER_AUTHORITY_HANDOFF" : null,
      rejectionReason
    });
  }

  return Object.freeze({ evaluate });
});
