const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/app.js', 'utf8');
const lp033Start = source.indexOf('function gridlyLp033RegionalRoadwayConsumerCertificationAudit');
const lp033End = source.indexOf('if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp033RegionalRoadwayConsumerCertificationAudit"', lp033Start);
const lp034Start = source.indexOf('function gridlyLp034ConsumerRoadContextAudit');
const lp034End = source.indexOf('if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp034ConsumerRoadContextAudit"', lp034Start);
assert(lp033Start > 0 && lp033End > lp033Start, 'LP033 audit body exists');
assert(lp034Start > 0 && lp034End > lp034Start, 'LP034 audit body exists');
const lp033 = source.slice(lp033Start, lp033End);
const lp034 = source.slice(lp034Start, lp034End);

assert(source.includes('function gridlyLp033AuthoritativeCountyBoundaryContract'), 'authoritative county-boundary contract helper exists');
assert(source.includes('gridlyLp033PointInCountyBoundary'), 'Polygon/MultiPolygon point-in-boundary helper exists');
assert(!lp033.includes('GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID') && !lp033.includes('visibleBounds'), 'awareness-area and viewport bounds are not used for county containment');
assert(lp033.includes('boundaryContract.usableGeometry'), 'authoritative county boundary geometry is preferred for containment');
assert(lp033.includes('dataset_ownership_verified_geometry_unverified'), 'verified roadway dataset ownership can report geometry-unverified instead of false failure');
assert(lp033.includes('countyContainmentPass = countyContainmentStatus === "sample_proven_no_violations" ? true : (countyContainmentStatus === "positively_disproven" ? false'), 'false containment remains limited to positively disproven authoritative geometry');
assert(lp033.includes('authoritative_county_boundary_geometry_not_loaded'), 'uncertain containment returns an unverifiable reason');
assert(lp033.includes('feature_center_outside_authoritative_county_boundary'), 'violations identify authoritative county boundary evidence, not awareness bounds');
assert(lp033.includes('countyContainmentBoundarySource') && lp033.includes('countyContainmentBoundaryOwner') && lp033.includes('countyContainmentDatasetOwner'), 'boundary and dataset ownership fields are reported');

assert(lp034.includes('selectedStageExpected') && lp034.includes('selectedStageSamples'), 'selected-chain correlation is scoped to expected selected stages');
assert(lp034.includes('correlated_through_structured_metadata'), 'Report Tap Map can certify through structured metadata');
assert(lp034.includes('selected_report_tap_map_conflicting_stage_correlation'), 'conflicting selected-chain stages remain detectable');
assert(lp034.includes('unrelatedRenderedObservationIgnoredCount'), 'historical rendered observations remain counted as ignored');
assert(lp034.includes('selectedObservationIsNewestOverall') && lp034.includes('selectedObservationIsNewestRelevant'), 'overall and relevant freshness are distinct');
assert(lp034.includes('Observed workflow ended at structured metadata before report submission.'), 'missing post-submission stages are not classified as detail loss');
assert(source.includes('canonicalRoadContext: structuredRoadContext'), 'original LP034 structured road-context preservation remains unchanged');
assert(source.includes('window.gridlyResetLp034RoadContextAuditObservations = gridlyResetLp034RoadContextAuditObservations'), 'LP034 reset helper exposure remains intact');
assert(source.includes('cleared: "lp034_road_context_audit_observations_only"'), 'reset helper still clears only LP034 audit buffers');

console.log('LP034R3 selected-chain and county containment contract checks passed.');
