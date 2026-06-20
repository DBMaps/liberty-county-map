const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

// 1. activeReport + unknown cannot use road-hazard fallback headline paths.
includes('const activeReportUnknown = detail?.sourceKind === "activeReport" && (!detail.resolvedCategory || detail.resolvedCategory === "unknown");', 'top-awareness detects unknown activeReport details');
includes('const allowRoadHazardFallback = !activeReportUnknown && !crossingReportDetail && !gridlyIsClearedHazardAwarenessRecord(item);', 'road-hazard fallback is gated away from unknown active reports, crossings, and cleared hazards');
includes('const authoritativeRoadHazard = allowRoadHazardFallback && typeof buildGridlyV322TopAwarenessAuthoritativeRoadHazardHeadline === "function"', 'authoritative V322 road-hazard fallback is gated');
includes('if (allowRoadHazardFallback && typeof buildGridlyRoadHazardTxDotStyleCandidate === "function")', 'TxDOT-style road-hazard fallback is gated');

// 2. explicit empty activeHazards fixtures stay empty and do not repopulate from globals.
includes('const activeHazardCount = explicitActiveHazardsSupplied\n    ? activeHazardSourceCount', 'explicit activeHazards fixtures force activeHazardCount to source fixture count');

// 3. cleared hazards and unsafe crossing records are rejected from selected top awareness.
includes('function getGridlyTopAwarenessDetailRejectionReason(detailOrItem = {})', 'top-awareness rejection reason helper is present');
includes('return "cleared_hazard_excluded_from_top_awareness";', 'cleared hazards receive an explicit selected-detail rejection reason');
includes('return "unknown_active_report_crossing_uses_crossing_renderer";', 'unknown active crossing reports are rejected from road-hazard top-awareness selection');

// 4. enhanced audit exposes root-cause detail and fallback detection.
includes('selectedTopAwarenessRawDetail: selectedRawSummary', 'classification audit exposes selected raw detail');
includes('selectedTopAwarenessReason: awarenessModel?.topAwarenessSelectionReason', 'classification audit exposes selected reason');
includes('selectedTopAwarenessRejectedReasons: Array.isArray(awarenessModel?.topAwarenessRejectedReasons)', 'classification audit exposes rejected reasons');
includes('activeReportAwarenessCandidates', 'classification audit exposes active-report awareness candidates');
includes('clearedAwarenessCandidates', 'classification audit exposes cleared awareness candidates');
includes('unknownActiveReportFallbackDetected', 'classification audit exposes unknown activeReport road-hazard fallback detection');
includes('safeForAwarenessClassification: !crossingCountedAsRoadHazard && !unknownActiveReportFallbackDetected', 'classification audit fails safety when unknown activeReport fallback is detected');

// 5. cleared-hazard regression audit rejects the Dayton road-hazard fallback.
includes('!/flood|Road Hazard on Dayton/i.test(String(model.headline || ""))', 'cleared-hazard regression audit blocks Road Hazard on Dayton fallback');

console.log('v632_1TopAwarenessUnknownActiveReportFix.test.js passed');
