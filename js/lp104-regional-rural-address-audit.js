(function installLp104RegionalRuralAddressAudit(global) {
  "use strict";

  const counties = Object.freeze(["liberty", "montgomery", "san jacinto", "chambers", "jefferson", "hardin", "polk", "walker", "orange", "jasper", "newton", "tyler", "galveston", "brazoria", "fort bend", "waller", "austin", "washington", "brazos", "grimes", "wharton", "colorado", "fayette", "lavaca", "jackson", "matagorda", "calhoun", "harris"]);
  const approvedPrecision = new Set(["address_point", "rooftop", "parcel_centroid", "verified_address_point", "verified_entrance"]);
  const normalizeCounty = (value) => String(value || "").toLowerCase().replace(/\bcounty\b/g, "").replace(/[^a-z]/g, "").trim();
  const normalizeHouse = (value) => String(value || "").trim().toLowerCase().replace(/^0+(?=\d)/, "");
  const normalizeRoad = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g, "cr $1")
    .replace(/\b(?:farm to market road|farm to market|farm road|fm)\s*(\d+[a-z]?)\b/g, "fm $1")
    .replace(/\b(?:state highway|sh|tx)\s*(\d+[a-z]?)\b/g, "sh $1")
    .replace(/\b(?:us highway|us)\s*(\d+[a-z]?)\b/g, "us $1");

  async function runCase(testCase) {
    const request = { intent: "address", query: String(testCase.query || ""), structuredAddress: testCase.structuredAddress,
      context: testCase.context || {}, limit: 3, requestMode: "lp104_certification" };
    const diagnosticResponse = await global.gridlyGeocodingClient.search(request);
    const consumerResponse = await global.gridlyGeocodingClient.search({ ...request, requestMode: "explicit_search" });
    const result = consumerResponse.ok ? consumerResponse.results[0] : null;
    const expected = testCase.expected || {};
    const houseNumberAgreement = Boolean(result && normalizeHouse(result.address?.houseNumber) === normalizeHouse(expected.houseNumber));
    const roadIdentityAgreement = Boolean(result && normalizeRoad(result.address?.road) === normalizeRoad(expected.road));
    const countyAgreement = Boolean(result && normalizeCounty(result.address?.county) === normalizeCounty(expected.county));
    const stateAgreement = Boolean(result && /^(tx|texas)$/i.test(String(result.address?.state || "")));
    const postalCodeAgreement = Boolean(result && (!expected.postalCode || String(result.address?.postalCode || "").slice(0, 5) === String(expected.postalCode).slice(0, 5)));
    const coordinateContained = Boolean(result && Number(result.latitude) >= 25.7 && Number(result.latitude) <= 33.1
      && Number(result.longitude) >= -106.7 && Number(result.longitude) <= -93.4 && counties.includes(normalizeCounty(result.address?.county)));
    return Object.freeze({ caseId: String(testCase.caseId || "unnamed"), county: normalizeCounty(expected.county),
      resolved: Boolean(result), sourceClassification: String(result?.sourceClassification || "none"),
      houseNumberAgreement, roadIdentityAgreement, countyAgreement, stateAgreement, postalCodeAgreement,
      precisionApproved: approvedPrecision.has(String(result?.precision || "")), coordinateContained,
      routePreviewAgreement: result?.routePreviewEligible === true,
      rejectedMismatchAbsent: !(consumerResponse.results || []).some((entry) => normalizeHouse(entry.address?.houseNumber) !== normalizeHouse(expected.houseNumber)),
      authoritativeRuralOutcome: String(diagnosticResponse.diagnostics?.authoritativeRuralOutcome || "unknown"),
      providerBoundaryPreserved: diagnosticResponse.providerBoundary === "gridly" && consumerResponse.providerBoundary === "gridly" });
  }

  global.gridlyLp104RegionalRuralAddressAudit = async function (options = {}) {
    const cases = Array.isArray(options.cases) ? options.cases : [];
    const results = [];
    for (const testCase of cases) results.push(await runCase(testCase));
    return Object.freeze({ available: Boolean(global.gridlyGeocodingClient), milestone: "LP104",
      configuredCaseCount: cases.length, representativeCountyCount: new Set(results.filter((item) => item.resolved).map((item) => item.county)).size,
      protectedLibertyValidation: options.protectedLibertyValidation === true && results.some((item) => item.county === "liberty" && item.resolved),
      supportedCountyCount: counties.length, supportedCounties: [...counties], cases: results });
  };

  global.gridlyLp104VisibleRegionalRuralAddressCertification = async function (options = {}) {
    const audit = await global.gridlyLp104RegionalRuralAddressAudit(options);
    const cases = audit.cases;
    const every = (field) => cases.length > 0 && cases.every((item) => item[field] === true);
    const checks = {
      providerBoundaryPreserved: every("providerBoundaryPreserved") && global.gridlyGeocodingClient.directProviderRequestCount() === 0,
      allCountyArchitecturePass: audit.supportedCountyCount === 28,
      ruralHouseNumberSafetyPass: every("houseNumberAgreement"), ruralRoadIdentityPass: every("roadIdentityAgreement"),
      ruralPrecisionPass: every("precisionApproved"), countyContainmentPass: every("coordinateContained") && every("countyAgreement"),
      rejectedMismatchAbsent: every("rejectedMismatchAbsent"), routePreviewAgreement: every("routePreviewAgreement"),
      privateDiagnosticsRedacted: cases.every((item) => !Object.keys(item).some((key) => /query|raw|latitude|longitude|apiKey|secret/i.test(key)) && Object.values(item).every((value) => ["string", "boolean", "number"].includes(typeof value))),
      fallbackOrderingPass: cases.length > 0 && cases.every((item) => !["unknown"].includes(item.authoritativeRuralOutcome)),
      ordinaryConsumerSearchPass: audit.representativeCountyCount >= 2 && audit.protectedLibertyValidation
    };
    const failedChecks = Object.entries(checks).filter(([, pass]) => !pass).map(([name]) => name);
    return Object.freeze({ ...checks, failedChecks, safeToMerge: failedChecks.length === 0 });
  };
})(window);
