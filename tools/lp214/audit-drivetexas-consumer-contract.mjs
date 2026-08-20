#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "data/generated/lp214-drivetexas-consumer-contract-audit.json");

const call = (id, file, fn, surface, accessor, contract, classification, consequence, health = false, retained = false) => ({
  id, file, function: fn, consumerSurface: surface, dataAccessor: accessor, contract,
  retainedFallbackPossible: retained, emptyCanMeanSourceFailure: contract === "records-only",
  sourceHealthConsulted: health, classification, visibleUserConsequence: consequence
});

export function buildAudit() {
  const implementationCallGraph = [
    call("travel-brief", "js/app.js", "gridlyStoryTransportationConnectorRecords", "Travel Brief / Know Before You Go / destination awareness", "gridlySelectConsumerVisibleDriveTexasSituations().consumerVisibleSituations; connector getNormalizedRecords fallback", "records-only", "ARRAY_ONLY_AMBIGUOUS", "The preferred selector computes source health, but this bridge returns only its situation array; a failed cold start is therefore indistinguishable from no official transportation situations and can produce quiet travel copy."),
    call("official-publisher-connector", "js/gridlyAwarenessOfficialRoadwayPublisherRepair.js", "readOfficialSourceRecords", "Awareness Brief official roadway enrichment", "gridlyDriveTexasConnector.getNormalizedRecords", "records-only", "ARRAY_ONLY_AMBIGUOUS", "An empty failed source adds no official roadway hazard; source state is not added to consumer presentation.", false, true),
    call("official-publisher-provider", "js/gridlyAwarenessOfficialRoadwayPublisherRepair.js", "readOfficialSourceRecords", "Awareness Brief provider fallback", "gridlyDriveTexasProvider.getNormalizedRecords", "records-only", "ARRAY_ONLY_AMBIGUOUS", "Provider fallback also collapses failure and healthy-empty to the same array.", false, true),
    call("community-pulse", "js/gridlyAwarenessOfficialRoadwayPublisherRepair.js", "enrichSummary", "Community Pulse and shared awareness summary", "readOfficialSourceRecords -> activeHazardsInArea", "records-only", "ARRAY_ONLY_AMBIGUOUS", "Zero DriveTexas rows lower the shared activity count and permit the visible quiet state.", false, true),
    call("authority-source", "js/gridlyDriveTexasAuthoritySourceIntegration.js", "gridlyGetLoadedDriveTexasAuthoritySourceRecords", "Authority/source-health model", "connector getAllNormalizedRecords/getNormalizedRecords then provider getNormalizedRecords plus runtime state", "records+health", "RETAINED_DATA_WITH_HEALTH", "Audit/authority state discloses availability, fetch failure, last refresh and retained fallback, but this state is not the publisher input.", true, true),
    call("authority-consumer-projection", "js/gridlyDriveTexasAuthoritySourceIntegration.js", "gridlySelectConsumerVisibleDriveTexasSituations", "Authority marker/alert/travel projection (not migrated)", "gridlyGetDriveTexasAuthoritySnapshot", "records+health", "NOT_USER_VISIBLE", "Produces classified marker, alert and travel inputs, but current audit explicitly says consumer migration was not performed.", true, true),
    call("unified-intelligence", "js/gridlyUnifiedIntelligence.js", "collectNormalizedRecords", "Unified Intelligence dormant collector", "gridlyDriveTexasProvider.getNormalizedRecords", "records-only", "LEGACY_OR_UNUSED", "No UI consequence because enabled and activated are hard false and consumer rendering is inactive."),
    call("lp044-inventory", "js/gridlyLp044DriveTexasCommunityAuthorityInventory.js", "sourceRecords", "LP044 passive authority inventory", "connector getAllNormalizedRecords/getNormalizedRecords then provider getNormalizedRecords", "records-only", "NOT_USER_VISIBLE", "Audit-only inventory; an empty array affects evidence availability, not consumer UI.", false, true),
    call("cross-provider-audit", "js/gridlyCrossProviderEvaluationAudit.js", "readConnector", "Cross-provider passive evaluation", "gridlyDriveTexasConnector.getNormalizedRecords", "records-only", "NOT_USER_VISIBLE", "Audit-only evaluation; no rendering ownership."),
    call("activation-readiness", "js/gridlyIntelligenceActivationReadiness.js", "providerSummary", "Provider activation readiness audit", "gridlyDriveTexasProvider.getNormalizedRecords/getRuntimeState", "records+health", "HEALTH_AWARE", "Readiness classification only; it consults runtime state and does not render incidents.", true),
    call("connector-endpoint-audit", "js/gridlyDriveTexasConnectorEndpointAudit.js", "gridlyDriveTexasConnectorEndpointAudit", "Connector endpoint audit", "gridlyDriveTexasProvider.getRuntimeState", "health-only", "HEALTH_AWARE", "Diagnostic source status only; no incident presentation.", true)
  ];
  const surface = (surface, classification, path, evidence) => ({ surface, classification, path, evidence });
  return {
    schemaVersion: "gridly.lp214.drivetexas-consumer-contract-audit.v1",
    milestone: "LP214_PHASE_2_1",
    generatedAtPolicy: "deterministic-no-wall-clock",
    productionSourceModified: false,
    summary: { productionConsumerBoundaryCount: implementationCallGraph.length, healthAwareCount: 2, ambiguousArrayOnlyCount: 4, retainedDataConsumerCount: 4, legacyOrUnusedCount: 1, actualFalseQuietPathExists: true },
    implementationCallGraph,
    consumerSurfaceClassifications: [
      surface("Awareness Brief", "VISIBLE_FALSE_QUIET_POSSIBLE", "publisher readOfficialSourceRecords -> enrichSummary -> activeHazardsInArea", "No health is propagated with the array."),
      surface("Community Pulse / quiet state", "VISIBLE_FALSE_QUIET_POSSIBLE", "enrichSummary -> community activity count -> pulse presentation", "Official roadway count can be zero after failure and permits quiet status."),
      surface("Travel Brief / Know Before You Go / destination awareness", "VISIBLE_FALSE_QUIET_POSSIBLE", "gridlyStoryTransportationConnectorRecords -> gridlyBuildTravelBriefModel", "Direct connector array has no lifecycle state."),
      surface("Alert cards and awareness hazard rows", "VISIBLE_FALSE_QUIET_POSSIBLE", "activeHazardsInArea -> alert consumers", "Missing official rows are not accompanied by failure disclosure."),
      surface("Map markers and hazard popups", "NOT_CONNECTED_TO_DRIVETEXAS", "map presentation", "The authority selector exposes markerInputSituations, but its own audit says consumer migration was not performed and no production renderer reference was discovered."),
      surface("Authority marker/alert/travel projection", "VISIBLE_FAILURE_DISCLOSED", "gridlyGetLoadedDriveTexasAuthoritySourceRecords -> authority snapshot", "Health exists in authority state, but consumer migration is explicitly incomplete."),
      surface("Crossing popups", "NOT_CONNECTED_TO_DRIVETEXAS", "crossing-owned presentation", "No production DriveTexas record reference discovered."),
      surface("Route intelligence", "NOT_CONNECTED_TO_DRIVETEXAS", "route runtime", "Travel brief has destination awareness, but route intelligence itself has no DriveTexas record consumer."),
      surface("County/community status", "OWNER_RUNTIME_CONFIRMATION_REQUIRED", "shared awareness summary", "No independent DriveTexas-specific status owner; effect is indirect through shared hazard counts.")
    ],
    quietStateRisk: {
      classification: "VISIBLE_FALSE_QUIET_POSSIBLE", actualPathExists: true,
      path: ["connector fetch failure sets connected=false and retains/returns its current normalized arrays", "array-only accessor yields [] on cold start or previously healthy empty cache", "publisher/travel consumers count zero official roadway situations", "shared awareness and travel presentation may select quiet/no-issue language", "no DriveTexas failure field reaches that presentation"],
      healthyEmptyIndistinguishableAtAffectedBoundary: true,
      failClosedSurfaces: ["authority/source integration audit state", "activation and endpoint readiness diagnostics"],
      caveat: "Other community reports, weather, or crossings may independently prevent a quiet screen; the DriveTexas contract nevertheless permits false quiet when those inputs are also empty."
    },
    retainedDataRisk: {
      classification: "VISIBLE_STALE_WITHOUT_WARNING_POSSIBLE",
      connector: { preservesPreviousEmptyAfterFailure: true, preservesPreviousNonEmptyAfterFailure: true, sourceRefreshTimestamped: true, currentDisconnectKnownInRuntimeState: true },
      publisher: { separatelyRetainsOnlyNonEmptyRecords: true, lastSuccessfulAtTimestamped: true, retainedFlagRecordedInSourceBreakdown: true, retainedOrDisconnectedWarningRenderedToUser: false },
      consumerKnowledge: { recordsCanRemainVisible: true, knowsRetainedInternally: true, knowsDisconnected: false, communicatesStaleness: false, emptyRetainedCanAppearCurrent: true },
      freshnessBasis: { authority: "incident timestamps for eligibility plus source refresh timestamps in source state", publisherAndTravel: "incident lifecycle fields where present; source refresh freshness is not presented" }
    },
    lp043Classification: {
      classification: "STALE_FIXTURE",
      failingAssertion: "fixture trace reports final eligibility",
      evidence: ["The fixture fixes nowMs at 2026-07-21T12:00:00Z and its crossing endTime at 2026-07-21T18:00:00Z.", "Injected select/audit calls pass because they forward nowMs.", "gridlyLp043TraceSingleAuthorityRecord accepts only sourceId and rebuilds snapshot/consumer projection without nowMs, so current wall-clock freshness expires the fixture.", "Geometry intersection and ownership assertions immediately preceding finalEligibility still pass; the failure is freshness, not identity or geometry."],
      authoritativeBehavior: "Current LP039.2 freshness eligibility correctly rejects an incident whose endTime is in the past.",
      productionDefect: false, testChangePerformed: false
    },
    recommendedRepairBoundary: {
      boundary: "E_AWARENESS_CONSUMER_BRIDGE_WITH_SHARED_SOURCE_STATUS_ENVELOPE",
      rationale: "The affected production paths converge at the official-roadway awareness publisher and story/travel bridge, while existing provider/connector arrays and retained caches are compatibility-sensitive. A shared read-only envelope at this bridge can carry records, connected/fetchFailed, retained, lastSuccessfulAt and healthyEmpty without changing provider normalization or forcing presentation surfaces to infer health.",
      likelyLaterFiles: ["js/gridlyAwarenessOfficialRoadwayPublisherRepair.js", "js/app.js", "focused consumer-contract tests"],
      shouldNotNeedModification: ["js/gridlyDriveTexasProvider.js", "js/gridlyDriveTexasLiveConnector.js", "js/gridlyDriveTexasAuthoritySourceIntegration.js", "weather/NWS", "crossing runtime", "canonical PLACE memberships"],
      compatibilityRisks: ["Changing existing array return types would break callers", "Retained non-empty records must remain usable while visibly marked stale/disconnected", "Healthy zero must remain distinct from failure without manufacturing incidents", "Travel and shared-awareness bridges must use the same status semantics"],
      eventualTests: ["healthy non-empty", "healthy empty", "failed cold start", "failed after healthy empty", "failed after healthy non-empty retained", "status propagation into quiet copy", "legacy array compatibility"]
    },
    laterCertificationPlan: {
      exhaustiveAutomatedChecks: { communityCount: 1859, checks: ["Every canonical community resolves through the same source-status envelope", "Failure never produces healthy-empty presentation classification", "Healthy empty remains truthful quiet", "Retained records carry stale/disconnected disclosure", "All 163 multi-county memberships and transitions retain canonical identity", "No community-specific DriveTexas patches"] },
      representativeBrowserControls: [
        { community: "Dallas", placeGeoid: "4819000", scale: "large-metro", geography: "multi-county", scenarios: ["healthy-with-data", "healthy-zero", "failed-source", "retained-data", "county-transition", "community-transition", "fresh-browser-cold-start"] },
        { community: "Houston", placeGeoid: "4835000", scale: "large-metro", geography: "multi-county", scenarios: ["healthy-with-data", "failed-source"] },
        { community: "Talco", placeGeoid: "4871732", scale: "small-rural", geography: "single-county", scenarios: ["healthy-zero", "failed-source", "fresh-browser-cold-start"] }
      ],
      browserToolingImplemented: false
    }
  };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const serialized = `${JSON.stringify(buildAudit(), null, 2)}\n`;
  const verify = process.argv.includes("--verify");
  if (verify) {
    if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== serialized) throw new Error(`Generated artifact is missing or stale: ${path.relative(root, output)}`);
    process.stdout.write(`Verified ${path.relative(root, output)} (${Buffer.byteLength(serialized)} bytes)\n`);
  } else {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, serialized);
    process.stdout.write(`Wrote ${path.relative(root, output)} (${Buffer.byteLength(serialized)} bytes)\n`);
  }
}
