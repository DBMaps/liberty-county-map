const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) { assert(app.includes(text), message); }

includes('function gridlyGetCanonicalActiveCommunityState', 'canonical active community state selector exists');
includes('function gridlyBuildCanonicalActiveCommunityRevision', 'canonical revision builder exists');
includes('activeCrossingRecords: Object.freeze(activeCrossingRecords)', 'canonical output separates active crossings');
includes('activeRoadHazardRecords: Object.freeze(activeRoadHazardRecords)', 'canonical output separates active road hazards');
// LP219.4 extends the canonical lifecycle set with governed KBYG evidence.
const vm = require('vm');
const start = app.indexOf('function gridlyStoryActiveRecords(');
const end = app.indexOf('\nfunction gridlyStoryWeatherMeaningfulImpact', start);
const canonical = [{id:'active-a',countyId:'harris-tx'}];
const sandbox = {gridlyGetCanonicalActiveCommunityState:()=>({activeRecords:canonical})};
vm.createContext(sandbox);vm.runInContext(app.slice(start,end),sandbox);
const result=sandbox.gridlyStoryActiveRecords({surfaces:{kbygCommunity:[{record:{id:'active-a'}},{record:{id:'active-b',countyId:'fort-bend-tx'}}]}});
assert.deepStrictEqual(Array.from(result,r=>r.id),['active-a','active-b']);
assert.equal(result[0].countyId,'harris-tx');assert.equal(result[1].countyId,'fort-bend-tx');
assert.equal(canonical.length,1,'projection must not mutate the canonical lifecycle set');
includes('canonicalActiveCommunityRevision: renderCanonicalState?.revision', 'render signature includes canonical active revision');
includes('activeCountDecreased', 'marker render reuse detects active count decreases');
includes('unifiedIncidentLayer.clearLayers();', 'unified marker layer remains cleared before rebuild');
includes('gridlyAuthoritativeIncidentSnapshotState.snapshot = null;', 'clear containment invalidates authoritative unified incident snapshot');
includes('const nearestIssue = (typeof gridlyGetCanonicalActiveCommunityState === "function" ? gridlyGetCanonicalActiveCommunityState().activeRecords', 'Location Context uses canonical active state');
includes('const liveHazardIncidentSource = __lp012Stage("liveHazardIncidents", () => gridlyBuildRoadHazardIncidentsFromReports([...canonicalRoadHazardRecords, ...gridlyDiagnosticArray(recentlyClearedRoadHazards)]));', 'canonical hazards retain clearing evidence for lifecycle conflict suppression');
includes('canonicalCrossingRecords.some((report) => String(report?.crossingId', 'unified rail incidents are filtered by canonical active crossings');
includes('gridlyLp0534bClearDiagnostics.crossingClearInFlightKeys', 'crossing clear in-flight guard exists');
includes('gridlyLp0534bClearDiagnostics.roadHazardClearInFlightKeys', 'road hazard clear in-flight guard exists');
includes('window.gridlyLp0534bUnifiedActiveCommunityStateAudit = gridlyLp0534bUnifiedActiveCommunityStateAudit;', 'LP053.4B live audit is exposed');
includes('activeCommunityPopupCount', 'LP053.4B audit inspects popup active content');
includes('locationContextActiveCount', 'LP053.4B audit inspects Location Context active count');
includes('officialRoadwayIndependencePreserved: true', 'official roadway independence remains explicit');
includes('weatherIndependencePreserved: true', 'weather independence remains explicit');
includes('historicalSidecarsRemainPassive: true', 'historical sidecars remain passive');
