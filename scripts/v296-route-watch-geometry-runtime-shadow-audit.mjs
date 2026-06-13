#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

await import(path.join(repoRoot, "js/gridlyTxdotGeometryRetentionPrototype.js"));
await import(path.join(repoRoot, "js/gridlyRouteWatchGeometryRuntimeShadowAudit.js"));

if (typeof globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit !== "function") throw new Error("runtime shadow audit helper is unavailable.");
if (typeof globalThis.gridlyRecordRouteWatchGeometryRuntimeShadowCandidate !== "function") throw new Error("runtime shadow candidate recorder is unavailable.");
if (typeof globalThis.gridlyScoreActiveRouteContextGeometryShadow !== "function") throw new Error("V307 active route context scorer is unavailable.");

const routeGeometry = [
  { lat: 30.0500, lng: -94.9000 },
  { lat: 30.0550, lng: -94.8900 },
  { lat: 30.0600, lng: -94.8800 }
];
const activeRouteContext = {
  routeContextAvailable: true,
  routeContextType: "work_destination_route",
  routeSource: "work_destination",
  destinationType: "work",
  destinationLabel: "Work",
  hasGeometry: true,
  geometrySource: "destination_route_preview",
  vertexCount: routeGeometry.length,
  routeGeometry,
  routePreviewAvailable: true,
  monitoringActive: false,
  relevanceObserved: false,
  routeWatchEligible: true
};

globalThis.gridlyGetActiveRouteContext = () => activeRouteContext;

function reset() {
  globalThis.gridlyResetRouteWatchGeometryRuntimeShadowAudit?.();
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Legacy runtime recorder still scores without changing production output.
reset();
globalThis.gridlyRecordRouteWatchGeometryRuntimeShadowCandidate({
  incident: { id: "v296-runtime-overlap", status: "active", type: "blocked", lat: 30.055, lng: -94.890, geometry: { type: "LineString", coordinates: [[-94.9000, 30.0500], [-94.8900, 30.0550], [-94.8800, 30.0600]] } },
  routeLatLngs: routeGeometry,
  midpointRelevant: true,
  activeRouteContext
});
let report = globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit();
assert(report.evaluatedCandidates === 1, "legacy recorder should evaluate one candidate");
assert(report.performance?.scoringCount === 1, "legacy recorder should increment scoring count");
assert(report.safeForProductionWiring === false, "safeForProductionWiring must remain false");

const validations = [];

// Active route context with no active hazards.
reset();
report = globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit({ activeRouteContext, routeGeometry, incidents: [] });
validations.push({ name: "active route context with no active hazards", passed: report.activeRouteContextCandidateRecorded === true && report.evaluatedCandidates === 0 && report.zeroScoringReasons?.no_active_incidents === 1 });

// Active route context with active hazard near route.
reset();
report = globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit({
  activeRouteContext,
  routeGeometry,
  incidents: [{ id: "v307-near", status: "active", type: "blocked", lat: 30.055, lng: -94.890, geometry: { type: "LineString", coordinates: [[-94.9000, 30.0500], [-94.8900, 30.0550], [-94.8800, 30.0600]] } }]
});
validations.push({ name: "active hazard near route", passed: report.evaluatedCandidates === 1 && report.scoredIncidentCandidates === 1 && report.geometryMatches === 1 && report.candidates[0].productionDecisionUsed === false });

// Active route context with active hazard away from route.
reset();
report = globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit({
  activeRouteContext,
  routeGeometry,
  incidents: [{ id: "v307-away", status: "active", type: "blocked", lat: 30.20, lng: -94.70, geometry: { type: "LineString", coordinates: [[-94.7000, 30.2000], [-94.6900, 30.2050]] } }]
});
validations.push({ name: "active hazard away from route", passed: report.evaluatedCandidates === 1 && report.geometryMatches === 0 && report.confidenceBandDistribution.not_relevant === 1 });

// Cleared hazard excluded.
reset();
report = globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit({
  activeRouteContext,
  routeGeometry,
  incidents: [{ id: "v307-cleared", status: "cleared", type: "blocked", lat: 30.055, lng: -94.890 }]
});
validations.push({ name: "cleared hazard excluded", passed: report.evaluatedCandidates === 0 && report.zeroScoringReasons?.inactive_or_cleared_incident_excluded === 1 });

// Invalid geometry excluded.
reset();
report = globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit({
  activeRouteContext,
  routeGeometry,
  incidents: [{ id: "v307-invalid", status: "active", type: "blocked", lat: "not", lng: "valid" }]
});
validations.push({ name: "invalid geometry excluded", passed: report.evaluatedCandidates === 1 && report.candidates.some((candidate) => candidate.scoringSkippedReason === "scoring_skipped_geometry_unavailable") });


// Route Details incident source returns promptly with active candidates present.
reset();
const originalRouteDetailsSource = globalThis.gridlyGetDestinationRouteActiveIncidentCandidates;
const longRouteGeometry = Array.from({ length: 1200 }, (_, index) => ({ lat: 30.0500 + (index * 0.00001), lng: -94.9000 + (index * 0.00001) }));
activeRouteContext.routeGeometry = longRouteGeometry;
activeRouteContext.vertexCount = longRouteGeometry.length;
globalThis.gridlyGetDestinationRouteActiveIncidentCandidates = () => ({
  sourceName: "gridlyDestinationRouteIntelligenceAudit.matchedHazards+matchedAlerts+matchedReports",
  routeDetailsIncidentCount: 4,
  incidents: [
    { id: "route-details-1", status: "active", type: "blocked", lat: 30.052, lng: -94.898 },
    { id: "route-details-2", status: "active", type: "blocked", lat: 30.053, lng: -94.897 },
    { id: "route-details-3", status: "active", type: "blocked", lat: 30.054, lng: -94.896 },
    { id: "route-details-4", status: "active", type: "blocked", lat: 30.055, lng: -94.895 }
  ]
});
const routeDetailsStartedAt = Date.now();
report = globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit({ options: { runtimeBudgetMs: 25, maxRouteVerticesSampled: 200, maxGeometryComparisons: 2000 } });
const routeDetailsElapsedMs = Date.now() - routeDetailsStartedAt;
validations.push({
  name: "Route Details candidates present return promptly",
  passed: report.routeDetailsIncidentCount === 4 && report.activeIncidentCandidates === 4 && routeDetailsElapsedMs < 250 && report.safeForProductionWiring === false && report.productionBehaviorChanged === false && report.shadowModeOnly === true
});
globalThis.gridlyGetDestinationRouteActiveIncidentCandidates = originalRouteDetailsSource;
activeRouteContext.routeGeometry = routeGeometry;
activeRouteContext.vertexCount = routeGeometry.length;

// safeForProductionWiring remains false.
validations.push({ name: "safeForProductionWiring remains false", passed: report.safeForProductionWiring === false });

const output = { audit: "V307 Active Route Context Geometry Relevance Shadow Scoring", validations, finalReport: report };
console.log(JSON.stringify(output, null, 2));
if (!validations.every((validation) => validation.passed)) process.exitCode = 1;
