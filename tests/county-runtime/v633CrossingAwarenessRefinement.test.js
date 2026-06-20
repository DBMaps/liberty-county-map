const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}
function notIncludes(fragment, message) {
  assert(!source.includes(fragment), message);
}

// 1. Blocked crossing promotes to top awareness as a crossing condition.
includes('if (sourceKind === "activeReport" && typeof isGridlyCrossingReportRecord === "function" && isGridlyCrossingReportRecord(item))', 'active crossing reports receive explicit rail/crossing classification');
includes('return { resolvedCategory: "rail", categorySource: `${sourceKind}.crossingReportClassifier`, rawCategoryValue: "crossing_report" };', 'crossing report classifier feeds top-awareness category selection');
includes('if (category === "rail") return `Train Blocking Crossing${hasLocation ? ` near ${locationLabel}` : ""}`;', 'rail crossing fallback headline promotes Train Blocking Crossing');

// 2. Blocked crossing remains classified as crossing and not road hazard.
includes('const crossingReportDetail = typeof isGridlyCrossingReportRecord === "function" && isGridlyCrossingReportRecord(item);', 'top-awareness detects crossing report detail separately');
includes('const allowRoadHazardFallback = !activeReportUnknown && !crossingReportDetail && !gridlyIsClearedHazardAwarenessRecord(item);', 'crossing reports remain excluded from road-hazard fallback');

// 3. The former unsafe rejection no longer blocks crossing promotion.
notIncludes('return "unknown_active_report_crossing_uses_crossing_renderer";', 'unknown crossing renderer rejection no longer suppresses promotion');
includes('Crossing reports are first-class awareness conditions and must not be rejected only because they are not road hazards.', 'retired rejection reason is documented in code');

// 4. Bottom awareness exposes crossing report count separately.
includes('const crossingReportCount = explicitCrossingRows.length || activeReportRows.filter((record) => typeof isGridlyCrossingReportRecord === "function" && isGridlyCrossingReportRecord(record)).length', 'bottom panel derives crossing report count independently');
includes('active crossing report${crossingReportCount === 1 ? "" : "s"}', 'bottom panel renders active crossing report wording');
includes('const bottomHazardCountModel = getGridlyBottomAwarenessHazardCountModel(safeSummary);', 'bottom panel reads hazard count from reconciliation model');
includes('const summaryClassificationActiveRoadHazardCount = Number(safeSummary.classificationActiveRoadHazardCount);', 'bottom hazard count model reads cached classification count before fallback');
includes('if (Number.isFinite(summaryClassificationActiveRoadHazardCount)) {', 'bottom hazard count model treats classification zero as available');
includes('bottomHazardCount: safeClassificationCount,', 'bottom hazard count honors cached classification count including zero');
includes('bottomHazardCountSource: "awarenessClassification.activeRoadHazardCount"', 'bottom hazard count source is the awareness classification road-hazard count');
includes('const hazardCount = bottomHazardCountModel.bottomHazardCount;', 'bottom panel renders reconciled active road hazard count');
includes('const activeIssueCount = hazardCount + reportCount + crossingReportCount;', 'active issue count includes crossings separately from road hazards');
includes('bottomHazardCount: bottomHazardCountModel.bottomHazardCount', 'normalized summary exposes bottom hazard count separately');
includes('classificationActiveRoadHazardCount: bottomHazardCountModel.classificationActiveRoadHazardCount', 'normalized summary exposes classification hazard count');
includes('bottomCountMatchesClassification: bottomHazardCountModel.bottomCountMatchesClassification', 'normalized summary exposes bottom/classification match flag');

// 5-6. Placeholder labels like St 0000 are rejected while better reviewed/name/parsed labels can win.
includes('function isGridlyZeroCodedPlaceholderRoadName(value = "")', 'zero-coded placeholder detector exists');
includes('if (isGridlyZeroCodedPlaceholderRoadName(label)) return true;', 'zero-coded placeholder labels are low quality');
includes('if (/^(?:private|unknown|unnamed road|unnamed|local crossing impact)$/i.test(label)) return true;', 'Private, Unknown, unnamed road, and Local crossing impact labels are low quality crossing tokens');
includes('const safeIncidentCrossingName = isGridlyConsumerCrossingLocationTokenUseful(incident.crossingName) ? gridlyCleanConsumerCrossingLocationToken(incident.crossingName) : "";', 'Montgomery Private source labels are suppressed before unified crossing title rendering');
includes('? (headlineLocation ? `Train blocking crossing on ${headlineLocation}` : "Train Blocking Crossing")', 'generic crossing fallback copy is allowed when only low-quality labels exist');
includes('if (activeConditionPresent && gridlyV238IsBlockedCrossingCondition(selectedCondition) && typeof isGridlyConsumerCrossingLocationTokenUseful === "function" && !isGridlyConsumerCrossingLocationTokenUseful(selectedRoad)) selectedRoad = "";', 'crossing narrative road-name resolver guesses cannot promote low-quality road labels');
includes('const reviewedPrimaryRoad = gridlyCleanConsumerCrossingLocationToken(localContext?.primaryLabel);', 'reviewed crossing context remains ahead of fallback source fields');
includes('|| parsedCrossingParts.find((value) => isGridlyConsumerCrossingLocationTokenUseful(value))', 'parsed crossing label can win over placeholder source values');

// 7-8. Road-name lookup cache key is county and label-signature scoped to avoid stale crossing labels while preserving cache.
includes('const countyKey = normalizeRoadNameLookupKeyPart(incident?.countyId || incident?.county_id || incident?.county || incident?.countyName || (typeof gridlyGetActiveCountyId === "function" ? gridlyGetActiveCountyId() : "")) || "county-unknown";', 'cache key includes county scope');
includes('const labelSignature = normalizeRoadNameLookupKeyPart([', 'cache key includes label signature');
includes('if (stableId) return `${lookupType}::${countyKey}::id::${stableId}::${labelSignature}`;', 'stable-id cache entries vary by county and label signature');
includes('gridlyRoadNameLookupCache.formatterValues.set(key, value)', 'road-name formatter cache remains functional');

// Required diagnostic.
includes('function gridlyCrossingAwarenessPromotionAudit(options = {})', 'crossing awareness promotion audit exists');
includes('bottomHazardCountSource: summary?.bottomHazardCountSource || ""', 'promotion audit exposes bottom hazard count source');
includes('bottomHazardCount: Number(summary?.bottomHazardCount || 0)', 'promotion audit exposes bottom hazard count');
includes('classificationActiveRoadHazardCount: Number(classification.activeRoadHazardCount || 0)', 'promotion audit exposes classification active road hazard count');
includes('bottomCountMatchesClassification: Number(summary?.bottomHazardCount || 0) === Number(classification.activeRoadHazardCount || 0)', 'promotion audit verifies bottom hazard count matches classification');
includes('safeForCrossingAwarenessPromotion', 'audit exposes safety boolean');
includes('roadNameLookupCachedValueSamples', 'audit includes cached value samples');
includes('visibleCrossingCopyForQualityAudit', 'promotion audit checks only visible crossing copy for low-quality labels');
includes('(?:Private|Unknown|unnamed road|Local crossing impact|St\\s+0{3,}|Street\\s+0{3,})', 'promotion audit flags Private and Local crossing impact when visible');
includes('function isGridlyLowQualityCrossingAwarenessLocationLabel(value = "", category = "", source = "")', 'crossing awareness location labels have a shared low-quality suppression gate');
includes('gridlyReusableCrossingAlertSummaryHasLowQualityLocation(text, detail?.resolvedCategory)', 'DOM parsed alert text Local Crossing Impact is rejected before reusable crossing alert summaries can win');
includes('rejectionReason: "low_quality_crossing_location_label"', 'top awareness candidates reject low-quality crossing location labels');
includes('const crossingNamingSample = crossingCandidates.map((candidate) => suppressGridlyLowQualityCrossingLocationInCopy(candidate.headline || candidate.title || candidate.summary || candidate.crossingId || "")).filter(Boolean).slice(0, 5);', 'crossing naming samples suppress low-quality visible location labels');
includes('return Boolean(parsedLocation && isGridlyLowQualityCrossingAwarenessLocationLabel(parsedLocation, category, "reusedAlertText:parsed_location"));', 'reused alert text cannot promote Local Crossing Impact as a crossing fallback');

console.log('v633CrossingAwarenessRefinement.test.js passed');
