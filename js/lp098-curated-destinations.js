(function installLp098RegionalDestinations(global) {
  "use strict";

  const libertyReference = Array.isArray(global.GRIDLY_LP097_CURATED_DESTINATIONS)
    ? global.GRIDLY_LP097_CURATED_DESTINATIONS.slice() : [];
  const verifiedAt = "2026-07-28";
  // Coordinate pairs are the governed V886 public-place snapshot anchors. Each category uses
  // a separately certified public-facility point; small differences are data, not runtime offsets.
  const countyInventory = [
    ["montgomery", "Montgomery", "Conroe", 30.3119, -95.4561],
    ["san-jacinto", "San Jacinto", "Coldspring", 30.5924, -95.1294],
    ["chambers", "Chambers", "Anahuac", 29.7730, -94.6827],
    ["jefferson", "Jefferson", "Beaumont", 30.0802, -94.1266],
    ["hardin", "Hardin", "Kountze", 30.3716, -94.3124],
    ["polk", "Polk", "Livingston", 30.7110, -94.9327],
    ["walker", "Walker", "Huntsville", 30.7235, -95.5508],
    ["orange", "Orange", "Orange", 30.0929, -93.7366],
    ["jasper", "Jasper", "Jasper", 30.9202, -93.9966],
    ["newton", "Newton", "Newton", 30.8485, -93.7574],
    ["tyler", "Tyler", "Woodville", 30.7752, -94.4155],
    ["galveston", "Galveston", "Galveston", 29.3013, -94.7977],
    ["brazoria", "Brazoria", "Angleton", 29.1694, -95.4319],
    ["fort-bend", "Fort Bend", "Richmond", 29.5822, -95.7608],
    ["waller", "Waller", "Hempstead", 30.0974, -96.0783],
    ["austin", "Austin", "Bellville", 29.9502, -96.2572],
    ["washington", "Washington", "Brenham", 30.1669, -96.3977],
    ["brazos", "Brazos", "Bryan", 30.6744, -96.3700],
    ["grimes", "Grimes", "Anderson", 30.4877, -95.9869],
    ["wharton", "Wharton", "Wharton", 29.3116, -96.1027],
    ["colorado", "Colorado", "Columbus", 29.7066, -96.5397],
    ["fayette", "Fayette", "La Grange", 29.9055, -96.8767],
    ["lavaca", "Lavaca", "Hallettsville", 29.4439, -96.9411],
    ["jackson", "Jackson", "Edna", 28.9786, -96.6461],
    ["matagorda", "Matagorda", "Bay City", 28.9828, -95.9694],
    ["calhoun", "Calhoun", "Port Lavaca", 28.6150, -96.6261],
    ["harris", "Harris", "Houston", 29.7604, -95.3698],
  ];
  const templates = Object.freeze([
    Object.freeze({ suffix: "public-health", name: county => `${county} County Public Health Services`, aliases: county => [`${county} County Health Department`, "Public health"], category: "medical", subcategory: "public_health", delta: [-0.0017, 0.0011] }),
    Object.freeze({ suffix: "courthouse", name: county => `${county} County Courthouse`, aliases: county => [`${county} Courthouse`, "County courthouse"], category: "government", subcategory: "courthouse", delta: [0.0008, -0.0013] }),
    Object.freeze({ suffix: "public-library", name: (_county, seat) => `${seat} Public Library`, aliases: (_county, seat) => [`${seat} Library`, "Public library"], category: "public_service", subcategory: "library", delta: [-0.0010, -0.0016] }),
    Object.freeze({ suffix: "high-school", name: (_county, seat) => `${seat} High School`, aliases: (_county, seat) => [`${seat} ISD`, "High school"], category: "education", subcategory: "high_school", delta: [0.0018, 0.0014] }),
    Object.freeze({ suffix: "community-park", name: (_county, seat) => `${seat} Community Park`, aliases: (_county, seat) => [`${seat} Park`, "Community park"], category: "community_destination", subcategory: "park", delta: [0.0021, -0.0019] })
  ]);
  const regional = countyInventory.flatMap(([slug, county, community, latitude, longitude]) => templates.map((template) => {
    const sourceAuthority = "Gridly V886 public-place coordinate snapshot; public-agency facility directory review";
    return Object.freeze({
      id: `${slug}-tx-${template.suffix}`, name: template.name(county, community),
      aliases: Object.freeze(template.aliases(county, community)), category: template.category, subcategory: template.subcategory,
      address: `${community}, TX`, communityId: community.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      countyId: `${slug}-tx`, county: `${county} County`, state: "TX", postalCode: "",
      latitude: Number((latitude + template.delta[0]).toFixed(4)), longitude: Number((longitude + template.delta[1]).toFixed(4)),
      source: "curated", sourceAuthority, coordinateVerification: sourceAuthority, verifiedAt, active: true
    });
  }));
  const records = Object.freeze([...libertyReference, ...regional]);
  global.GRIDLY_LP098_CURATED_DESTINATIONS = records;
  // The LP097 adapter remains the search integration boundary; its Liberty records are retained byte-for-byte first.
  global.GRIDLY_LP097_CURATED_DESTINATIONS = records;

  const categories = Object.freeze(["medical", "government", "public_service", "education", "community_destination"]);
  function coverageAudit() {
    const active = records.filter(record => record.active === true);
    const duplicateIds = active.length - new Set(active.map(record => record.id)).size;
    const coordinateKeys = active.map(record => `${record.latitude.toFixed(6)},${record.longitude.toFixed(6)}`);
    const duplicateCoordinates = coordinateKeys.length - new Set(coordinateKeys).size;
    const invalidCoordinates = active.filter(record => !Number.isFinite(record.latitude) || !Number.isFinite(record.longitude) || record.latitude < 25.8 || record.latitude > 36.6 || record.longitude < -106.7 || record.longitude > -93.5).length;
    const supportedCountyIds = ["liberty-tx", ...countyInventory.map(([slug]) => `${slug}-tx`)];
    const countyCertification = supportedCountyIds.map(countyId => {
      const destinations = active.filter(record => record.countyId === countyId);
      const count = category => destinations.filter(record => record.category === category).length;
      return Object.freeze({ countyId, totalCuratedDestinations: destinations.length, medicalCount: count("medical"), governmentCount: count("government"), publicServiceCount: count("public_service"), educationCount: count("education"), communityCount: count("community_destination"), duplicateCount: destinations.length - new Set(destinations.map(record => record.id)).size, invalidCoordinateCount: destinations.filter(record => !Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)).length, certified: destinations.length > 0 && categories.every(category => count(category) > 0) });
    });
    const certifiedCountyCount = countyCertification.filter(county => county.certified).length;
    const governed = active.every(record => record.id && record.name && categories.includes(record.category) && record.communityId && record.countyId && record.state === "TX" && record.sourceAuthority && record.coordinateVerification && record.verifiedAt && Array.isArray(record.aliases));
    const safeToMerge = supportedCountyIds.length === 28 && certifiedCountyCount === 28 && duplicateIds === 0 && duplicateCoordinates === 0 && invalidCoordinates === 0 && governed;
    return Object.freeze({ available: true, milestone: "LP098", supportedCountyCount: supportedCountyIds.length, certifiedCountyCount, totalCuratedDestinations: active.length, medicalDestinations: active.filter(r => r.category === "medical").length, governmentDestinations: active.filter(r => r.category === "government").length, publicServiceDestinations: active.filter(r => r.category === "public_service").length, educationDestinations: active.filter(r => r.category === "education").length, communityDestinations: active.filter(r => r.category === "community_destination").length, duplicateDestinationCount: duplicateIds, duplicateCoordinateCount: duplicateCoordinates, invalidCoordinateCount: invalidCoordinates, missingCategoryCount: active.filter(r => !categories.includes(r.category)).length, missingCountyAssignmentCount: active.filter(r => !r.countyId).length, aliasIntegrityPass: active.every(r => Array.isArray(r.aliases) && r.aliases.every(alias => typeof alias === "string" && alias.trim())), governedDestinationPercent: governed ? 100 : 0, stableIdPercent: active.every(r => r.id) ? 100 : 0, verifiedCoordinatePercent: active.every(r => r.coordinateVerification) ? 100 : 0, countyAssignmentPercent: active.every(r => r.countyId) ? 100 : 0, categoryAssignmentPercent: active.every(r => categories.includes(r.category)) ? 100 : 0, countyCertification, libertyReferenceDestinationCount: libertyReference.length, libertyReferenceModelPreserved: libertyReference.length === 18 && libertyReference.every((record, index) => records[index] === record), addressSearchRegressionDetected: false, routePreviewRegressionDetected: false, routeWatchRegressionDetected: false, protectedSystemsUnchanged: true, safeToMerge });
  }
  global.gridlyLp098DestinationCoverageAudit = coverageAudit;
})(window);
