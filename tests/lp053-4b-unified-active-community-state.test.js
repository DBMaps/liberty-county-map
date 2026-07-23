const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) { assert(app.includes(text), message); }

includes('function gridlyGetCanonicalActiveCommunityState', 'canonical active community state selector exists');
includes('function gridlyBuildCanonicalActiveCommunityRevision', 'canonical revision builder exists');
includes('activeCrossingRecords: Object.freeze(activeCrossingRecords)', 'canonical output separates active crossings');
includes('activeRoadHazardRecords: Object.freeze(activeRoadHazardRecords)', 'canonical output separates active road hazards');
includes('return gridlyGetCanonicalActiveCommunityState().activeRecords.slice();', 'story active records consume canonical state');
includes('canonicalActiveCommunityRevision: renderCanonicalState?.revision', 'render signature includes canonical active revision');
includes('activeCountDecreased', 'marker render reuse detects active count decreases');
includes('unifiedIncidentLayer.clearLayers();', 'unified marker layer remains cleared before rebuild');
includes('gridlyAuthoritativeIncidentSnapshotState.snapshot = null;', 'clear containment invalidates authoritative unified incident snapshot');
includes('const nearestIssue = (typeof gridlyGetCanonicalActiveCommunityState === "function" ? gridlyGetCanonicalActiveCommunityState().activeRecords', 'Location Context uses canonical active state');
includes('const liveHazardIncidentSource = __lp012Stage("liveHazardIncidents", () => gridlyBuildRoadHazardIncidentsFromReports(canonicalRoadHazardRecords));', 'unified road incidents derive from canonical active hazards');
includes('canonicalCrossingRecords.some((report) => String(report?.crossingId', 'unified rail incidents are filtered by canonical active crossings');
includes('gridlyLp0534bClearDiagnostics.crossingClearInFlightKeys', 'crossing clear in-flight guard exists');
includes('gridlyLp0534bClearDiagnostics.roadHazardClearInFlightKeys', 'road hazard clear in-flight guard exists');
includes('window.gridlyLp0534bUnifiedActiveCommunityStateAudit = gridlyLp0534bUnifiedActiveCommunityStateAudit;', 'LP053.4B live audit is exposed');
includes('activeCommunityPopupCount', 'LP053.4B audit inspects popup active content');
includes('locationContextActiveCount', 'LP053.4B audit inspects Location Context active count');
includes('officialRoadwayIndependencePreserved: true', 'official roadway independence remains explicit');
includes('weatherIndependencePreserved: true', 'weather independence remains explicit');
includes('historicalSidecarsRemainPassive: true', 'historical sidecars remain passive');
