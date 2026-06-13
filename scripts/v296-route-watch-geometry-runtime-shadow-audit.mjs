#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

await import(path.join(repoRoot, "js/gridlyTxdotGeometryRetentionPrototype.js"));
await import(path.join(repoRoot, "js/gridlyRouteWatchGeometryRuntimeShadowAudit.js"));

if (typeof globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit !== "function") {
  throw new Error("V296 runtime shadow audit helper is unavailable.");
}
if (typeof globalThis.gridlyRecordRouteWatchGeometryRuntimeShadowCandidate !== "function") {
  throw new Error("V296 runtime shadow candidate recorder is unavailable.");
}

globalThis.gridlyResetRouteWatchGeometryRuntimeShadowAudit?.();

const routeLatLngs = [
  { lat: 30.0500, lng: -94.9000 },
  { lat: 30.0550, lng: -94.8900 },
  { lat: 30.0600, lng: -94.8800 }
];

const candidates = [
  {
    incident: {
      id: "v296-runtime-overlap",
      routeName: "US 90",
      lat: 30.0550,
      lng: -94.8900,
      geometry: { type: "LineString", coordinates: [[-94.9000, 30.0500], [-94.8900, 30.0550], [-94.8800, 30.0600]] }
    },
    midpointRelevant: true
  },
  {
    incident: {
      id: "v296-runtime-midpoint-only",
      routeName: "parallel frontage",
      lat: 30.0551,
      lng: -94.8901,
      geometry: { type: "LineString", coordinates: [[-94.9000, 30.0700], [-94.8900, 30.0750], [-94.8800, 30.0800]] }
    },
    midpointRelevant: true
  },
  {
    incident: {
      id: "v296-runtime-no-geometry",
      roadName: "unknown local road",
      lat: 30.0800,
      lng: -94.8500
    },
    midpointRelevant: false
  }
];

for (const candidate of candidates) {
  globalThis.gridlyRecordRouteWatchGeometryRuntimeShadowCandidate({
    ...candidate,
    routeLatLngs,
    routeId: "v296-runtime-route",
    routeOriginLabel: "Home",
    routeDestinationLabel: "Work"
  });
}

const report = globalThis.gridlyRouteWatchGeometryRuntimeShadowAudit();
console.log(JSON.stringify(report, null, 2));

const requiredBooleans = [
  report.available === true,
  report.auditOnly === true,
  report.shadowModeOnly === true,
  report.productionBehaviorChanged === false,
  report.safeForProductionWiring === false,
  report.safetyVerification?.noUiChanges === true,
  report.safetyVerification?.noRouteWatchOutputChanges === true,
  report.safetyVerification?.noAlertChanges === true,
  report.safetyVerification?.noPopupChanges === true,
  report.safetyVerification?.noMarkerChanges === true,
  report.safetyVerification?.noAwarenessChanges === true,
  report.safetyVerification?.noSupabaseWrites === true,
  report.safetyVerification?.noNotificationBehavior === true
];
const requiredCounts = report.evaluatedCandidates === candidates.length
  && report.midpointMatches === 2
  && report.geometryMatches >= 1
  && report.midpointOnlyMatches >= 1
  && report.disagreementCount >= 1
  && report.performance?.scoringCount === candidates.length;

if (!requiredBooleans.every(Boolean) || !requiredCounts) {
  process.exitCode = 1;
}
