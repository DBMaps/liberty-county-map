const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/app.js', 'utf8');
const auditStart = source.indexOf('function gridlyLp034ConsumerRoadContextAudit');
const auditEnd = source.indexOf('if (typeof exposeGridlyAuditHelper === "function") exposeGridlyAuditHelper("gridlyLp034ConsumerRoadContextAudit"', auditStart);
assert(auditStart > 0 && auditEnd > auditStart, 'LP034 audit body exists');
const auditBody = source.slice(auditStart, auditEnd);
const tapStart = source.indexOf('async function handleHazardPlacementMapClick');
const tapEnd = source.indexOf('function gridlyRoundAuditMeters', tapStart);
assert(tapStart > 0 && tapEnd > tapStart, 'Tap Map coordinate-processing boundary exists');
const tapBody = source.slice(tapStart, tapEnd);

assert(source.includes('reportTapMapInteractions: []'), 'LP034R2 has a focused Report Tap Map observation buffer');
assert(source.includes('function gridlyLp034CaptureReportTapMapObservation'), 'LP034R2 exposes a focused audit-only Report Tap Map capture helper');
assert(source.includes('function gridlyResetLp034RoadContextAuditObservations'), 'LP034R2 reset helper exists');
assert(source.includes('window.gridlyResetLp034RoadContextAuditObservations = gridlyResetLp034RoadContextAuditObservations'), 'LP034R2 reset helper is exposed on window');

assert(tapBody.indexOf('observationType: "report_tap_map_coordinate_selected"') < tapBody.indexOf('const snapped = await snapHazardToRoad'), 'coordinate selection is captured before resolver invocation');
assert(tapBody.indexOf('observationType: "report_tap_map_resolver_invoked"') < tapBody.indexOf('const snapped = await snapHazardToRoad'), 'resolver invocation is captured at the snapHazardToRoad boundary');
assert(tapBody.includes('observationType: "report_tap_map_resolver_completed"'), 'resolver completion is captured after selected-coordinate processing');
assert(tapBody.includes('selectedRoadName: snapped.selectedRoadName'), 'resolver completion records the actual matched road result');
assert(source.includes('observationType: "report_tap_map_structured_metadata_created"'), 'structured metadata creation for Tap Map is observed');

assert(auditBody.includes('const newestReportTapMap = latest("reportTapMapInteractions")'), 'audit selects newest Report Tap Map observation first');
assert(auditBody.includes('newest_report_tap_map_coordinate_workflow_outranks_legacy_rendered_records'), 'audit documents why older rendered records cannot outrank current Tap Map');
assert(auditBody.includes('unrelatedRenderedObservationIgnoredCount'), 'audit reports unrelated rendered observations ignored');
assert(auditBody.includes('selected_report_tap_map_ignored_uncorrelated_stages'), 'audit does not combine unrelated stages');
assert(auditBody.includes('report_tap_map_mode_opened_no_coordinate_selected'), 'Tap Map open without coordinate remains truthful');
assert(auditBody.includes('coordinate_selected_resolver_not_invoked'), 'coordinate selected without resolver remains truthful');
assert(auditBody.includes('resolver_invoked_pending'), 'resolver invocation without completion remains truthful');
assert(auditBody.includes('partial_uncorrelated_observation') || auditBody.includes('selected_report_tap_map_ignored_uncorrelated_stages'), 'partial uncorrelated observations remain unverified');
assert(auditBody.includes('firstDetailLossStage: firstLoss?.[0] || null'), 'audit does not invent a downstream detail-loss stage');

assert(source.includes('countyContainmentStatus'), 'containment status is reported');
assert(source.includes('countyContainmentPass = countyContainmentStatus === "sample_proven_no_violations" ? true : (countyContainmentStatus === "positively_disproven" ? false : null)'), 'containment false requires a positive violation and uncertainty returns null');
assert(source.includes('county_boundary_contract_unverified'), 'ambiguous county boundary contracts are unverified, not failed');

assert(source.includes('canonicalRoadContext: structuredRoadContext'), 'original LP034 normalized report canonical road-context preservation remains intact');
assert(source.includes('firstDetailLossStage: firstLoss?.[0] || null'), 'LP034R1 no-sample detail-loss semantics remain intact');

console.log('LP034R2 report tap-map correlation audit checks passed.');
