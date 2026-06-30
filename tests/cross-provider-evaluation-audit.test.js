const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext(overrides = {}) {
  const context = Object.assign({ console, module: { exports: {} } }, overrides);
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyCrossProviderEvaluationAudit.js", "utf8"), context, { filename: "js/gridlyCrossProviderEvaluationAudit.js" });
  return context;
}

const records = {
  community: [
    { id: "c-flood", providerId: "community", category: "Flooding", title: "Water over US 90", description: "Flooding reported on US 90", routeName: "US 90", latitude: 30.06, longitude: -94.79, effectiveTime: "2026-06-30T12:00:00Z", expirationTime: "2026-06-30T14:00:00Z", rawPayloadExposed: false },
    { id: "c-clear", providerId: "community", category: "Road Clear", title: "FM 1960 reopened", description: "Road clear and open", routeName: "FM 1960", latitude: 30.05, longitude: -94.78, effectiveTime: "2026-06-30T12:15:00Z", rawPayloadExposed: false },
    { id: "c-hazard-alone", providerId: "community", category: "Hazard", title: "Debris on CR 100", description: "Hazard in lane", routeName: "CR 100", latitude: 31.0, longitude: -95.5, rawPayloadExposed: false }
  ],
  drivetexas: [
    { id: "d-closure", providerId: "drivetexas", category: "Road Closure", title: "US 90 closed due to flooding", description: "Flood closure on US 90", routeName: "US 90", latitude: 30.061, longitude: -94.791, effectiveTime: "2026-06-30T12:30:00Z", expirationTime: "2026-06-30T15:00:00Z", rawPayloadExposed: false },
    { id: "d-fm1960", providerId: "drivetexas", category: "Road Closure", title: "FM 1960 closed", description: "Closure on FM 1960", routeName: "FM 1960", latitude: 30.051, longitude: -94.781, effectiveTime: "2026-06-30T12:00:00Z", rawPayloadExposed: false },
    { id: "d-construction", providerId: "drivetexas", category: "Construction", title: "Construction on SH 146", routeName: "SH 146", latitude: 30.4, longitude: -94.9, rawPayloadExposed: false }
  ],
  weather: [
    { id: "w-flood", providerId: "weather", category: "Flash Flood Warning", title: "Flash Flood Warning", description: "Flash flooding near US 90", latitude: 30.062, longitude: -94.792, effectiveTime: "2026-06-30T12:00:00Z", expirationTime: "2026-06-30T16:00:00Z", rawPayloadExposed: false },
    { id: "w-alone", providerId: "weather", category: "Tornado Warning", title: "Tornado Warning", description: "Weather warning", latitude: 29.7, longitude: -94.2, rawPayloadExposed: false }
  ]
};

const empty = loadContext({});
assert.strictEqual(typeof empty.gridlyCrossProviderEvaluationAudit, "function", "helper is available");
const emptyAudit = empty.gridlyCrossProviderEvaluationAudit();
assert.strictEqual(emptyAudit.auditOnly, true);
assert.strictEqual(emptyAudit.providers.community.recordCount, 0, "missing community fails gracefully");
assert.strictEqual(emptyAudit.providers.drivetexas.recordCount, 0, "missing DriveTexas fails gracefully");
assert.strictEqual(emptyAudit.providers.weather.recordCount, 0, "missing Weather fails gracefully");
assert.strictEqual(emptyAudit.overlapCandidates.length, 0);

let driveCalls = 0;
let weatherCalls = 0;
const context = loadContext({
  communityReports: records.community,
  gridlyDriveTexasConnector: { getNormalizedRecords() { driveCalls += 1; return records.drivetexas; } },
  gridlyWeatherConnector: { getNormalizedRecords() { weatherCalls += 1; return records.weather; } },
  gridlyDriveTexasConnectorRuntimeAudit() { return { automaticPolling: false, providerActivated: false, renderingPerformed: false }; },
  gridlyWeatherConnectorRuntimeAudit() { return { automaticPolling: false, providerActivated: false, renderingPerformed: false }; },
  gridlyUnifiedIntelligenceAudit() { return { enabled: false, activated: false, consumerRenderingActive: false }; }
});

const audit = context.gridlyCrossProviderEvaluationAudit();
assert.strictEqual(driveCalls, 1, "audit reads existing DriveTexas normalized records only");
assert.strictEqual(weatherCalls, 1, "audit reads existing Weather normalized records only");
assert.strictEqual(audit.providers.community.available, true);
assert.strictEqual(audit.providers.community.recordCount, 3);
assert.strictEqual(audit.providers.community.geographicCoverage.pointCount, 3, "community geographic coverage is summarized");
assert.strictEqual(audit.providers.drivetexas.timeCoverage.recordsWithStart, 2, "DriveTexas time coverage is summarized");
assert.strictEqual(audit.providers.weather.timeCoverage.recordsWithEnd, 1, "Weather expiration coverage is summarized");
assert(audit.providers.drivetexas.categories.includes("Road Closure"));
assert(audit.providers.weather.categories.includes("Flash Flood Warning"));
assert.strictEqual(audit.providers.weather.normalizedModelReady, true);
assert.strictEqual(audit.providers.drivetexas.rawPayloadExposed, false);
assert(audit.overlapCandidates.length > 0, "overlap candidates are returned");
assert(audit.duplicateCandidates.length > 0, "duplicate candidates are returned");
assert(audit.complementCandidates.length > 0, "complement candidates are returned");
assert(audit.conflictCandidates.length > 0, "conflict candidates are returned");
assert(audit.relationshipAnalysis.overlap.communityDrivetexas > 0, "Community ↔ DriveTexas overlap reporting is summarized");
assert(audit.relationshipAnalysis.overlap.drivetexasWeather > 0, "DriveTexas ↔ Weather overlap reporting is summarized");
assert(audit.relationshipAnalysis.overlap.communityWeather > 0, "Community ↔ Weather overlap reporting is summarized");
assert(audit.relationshipAnalysis.duplicate.communityDrivetexas > 0, "duplicate reporting is summarized");
assert(audit.relationshipAnalysis.complement.representativeExamples.length > 0, "complement examples are preserved");
assert(audit.relationshipAnalysis.conflict.representativeExamples.length > 0, "conflict examples are preserved");
assert(audit.relationshipAnalysis.threeProvider.length > 0, "three-provider relationship candidates are returned");
assert.strictEqual(audit.runtimeContainment.driveTexasDormant, true);
assert.strictEqual(audit.runtimeContainment.weatherDormant, true);
assert.strictEqual(audit.runtimeContainment.unifiedIntelligenceInactive, true);
assert.strictEqual(audit.runtimeContainment.noRenderingOccurred, true);
assert.strictEqual(audit.runtimeContainment.noProviderActivationOccurred, true);
assert.strictEqual(audit.runtimeContainment.noAutomaticPollingOccurred, true);
assert.strictEqual(typeof context.gridlyDriveTexasConnector.fetchNow, "undefined", "audit does not require activation/fetch APIs");
assert(fs.readFileSync("index.html", "utf8").includes("js/gridlyCrossProviderEvaluationAudit.js?v=845"));

console.log(JSON.stringify({ ok: true, overlap: audit.overlapCandidates.length, duplicates: audit.duplicateCandidates.length, complements: audit.complementCandidates.length, conflicts: audit.conflictCandidates.length }, null, 2));
