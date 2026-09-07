import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const draftLifecycle = between('let governedRoadHazardReportDraft = null;', 'window.submitHazardNearMe = function');
const useLocation = between('window.submitHazardNearMe = function', 'function getGridlyForegroundLocationProvider');
const reportTemplate = between('function buildReportHazardSurfaceHtml()', 'const sheetTemplates =');
const v2Bridges = between('const bridges = {', 'const bridge = bridges[canonicalAction]');
const tapMap = between('async function handleHazardPlacementMapClick', 'function gridlyRoundAuditMeters');

test('LP244.2A ready GPS draft renders a truthful review instead of location choices', () => {
  assert.match(reportTemplate, /governedRoadHazardReportDraft\?\.reviewState === "ready"/);
  assert.match(reportTemplate, /data-v2-report-review/);
  assert.match(reportTemplate, /Review your report/);
  assert.match(reportTemplate, /data-v2-review-hazard[\s\S]*hazardLabel/);
  assert.match(reportTemplate, /data-v2-review-location[\s\S]*location/);
  assert.match(reportTemplate, /data-v2-review-road[\s\S]*road/);
  assert.match(reportTemplate, /data-v2-action="report-confirm-governed-draft"[\s\S]*Submit Report/);
  assert.match(reportTemplate, /data-v2-action="report-cancel-governed-draft"[\s\S]*Back/);
  const readyBranch = reportTemplate.slice(0, reportTemplate.indexOf('const primaryOptionsHtml'));
  assert.doesNotMatch(readyBranch, /report-use-location|report-tap-map|Use my location|Tap the map/);
  assert.match(reportTemplate, /toFixed\(6\)/);
  assert.match(reportTemplate, /recordGovernedRoadHazardReviewStage\("review_presented"/);
});

test('LP244.2A first Use My Location acquires and snaps once without submission', () => {
  assert.equal((useLocation.match(/requestGridlyForegroundPosition\(/g) || []).length, 1);
  assert.equal((useLocation.match(/await snapHazardToRoad\(/g) || []).length, 1);
  assert.equal((useLocation.match(/createSharedHazardReport\(/g) || []).length, 0);
  assert.match(useLocation, /recordGovernedRoadHazardReviewStage\("location_acquired"/);
  assert.match(useLocation, /recordGovernedRoadHazardReviewStage\("road_snap_settled"/);
  assert.match(useLocation, /continueGovernedRoadHazardDraftToReview\(draft\)/);
  assert.match(useLocation, /reportUseLocationSubmitted: false/);
  assert.match(useLocation, /Location permission was denied/);
  assert.match(useLocation, /Location is taking too long/);
  assert.match(useLocation, /No location fix is available/);
  assert.match(app, /kind: "browser", plugin: navigator\.geolocation/);
});

test('LP244.2A explicit confirmation is the sole exact-once owner of retained GPS draft', () => {
  const submit = between('async function submitGovernedRoadHazardDraft()', 'window.submitGovernedRoadHazardDraft');
  assert.match(submit, /if \(governedRoadHazardSubmissionPromise\) return governedRoadHazardSubmissionPromise/);
  assert.equal((submit.match(/createSharedHazardReport\(/g) || []).length, 1);
  assert.match(submit, /draft\.hazardType[\s\S]*draft\.finalCoordinate\.lat[\s\S]*draft\.finalCoordinate\.lng/);
  assert.match(submit, /draft\.rawCoordinate/);
  assert.match(submit, /selectedRoadName: draft\.selectedRoadName/);
  assert.match(submit, /countyResolution: draft\.countyResolution/);
  assert.match(submit, /countyMetadata: draft\.countyMetadata/);
  assert.match(submit, /communityMetadata: draft\.communityMetadata/);
  assert.match(submit, /await invokeSharedSubmissionOwner\(\)[\s\S]*governedRoadHazardReportDraft = null/);
  assert.match(submit, /closeVisiblePortraitV2ReportSurfaceAfterSubmit\(\)/);
  assert.doesNotMatch(submit, /requestGridlyForegroundPosition|snapHazardToRoad/);
  assert.match(v2Bridges, /"report-confirm-governed-draft"/);
});

test('LP244.2A Back cancels without submitting while close and reopen preserve review truth', () => {
  const cancel = between('function cancelGovernedRoadHazardDraft()', 'window.cancelGovernedRoadHazardDraft');
  assert.match(cancel, /"cancellation_invoked"/);
  assert.match(cancel, /governedRoadHazardReportDraft = null/);
  assert.doesNotMatch(cancel, /createSharedHazardReport/);
  assert.match(v2Bridges, /"report-cancel-governed-draft"[\s\S]*cancelGovernedRoadHazardDraft\(\)[\s\S]*openGridlyPortraitV2Sheet\("report"\)/);
  const opener = between('function openGridlyPortraitV2Sheet(', 'function openPortraitV2Sheet(');
  assert.match(opener, /continuingGovernedReportReview/);
  assert.match(opener, /!continuingGovernedReportReview/);
  const close = between('function closePortraitV2Sheet()', 'function buildGridlyLiveServerRuntimeAudit');
  assert.doesNotMatch(close, /governedRoadHazardReportDraft\s*=\s*null/);
});

test('LP244.2A bounded audit stages are distinct and Tap Map ownership is unchanged', () => {
  for (const stage of ['location_acquired', 'road_snap_settled', 'governed_draft_ready', 'review_presented', 'explicit_confirmation_invoked', 'submission_invoked', 'submission_settled', 'cancellation_invoked']) {
    assert.match(app, new RegExp(`"${stage}"`));
  }
  assert.match(draftLifecycle, /length > 40/);
  assert.equal((tapMap.match(/await snapHazardToRoad\(/g) || []).length, 1);
  assert.equal((tapMap.match(/await createSharedHazardReport\(/g) || []).length, 1);
});
