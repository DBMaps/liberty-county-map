const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');

const travelStart = source.indexOf('function gridlyTravelBriefCleanLine');
const travelEnd = source.indexOf('function gridlyBuildTravelBriefModel', travelStart);
assert(travelStart > 0 && travelEnd > travelStart, 'Travel Brief presentation helpers are present');

const travelSandbox = {
  gridlyEvidenceExperienceSafeText: (value) => String(value || '').trim(),
  gridlyStoryTransportationImpact: (record) => record.impact || null
};
vm.createContext(travelSandbox);
vm.runInContext(source.slice(travelStart, travelEnd), travelSandbox);

const roadwayLines = travelSandbox.gridlyTravelBriefDriveTexasLines([
  { title: 'Construction on US 59', routeName: 'US 59', impact: { detail: 'Construction may affect travel.' } },
  { title: 'Lane closure on US 59', routeName: 'US 59', impact: { detail: 'Lane closure may affect travel.' } },
  { title: 'Road closed on SH 146', routeName: 'SH 146', impact: { detail: 'Road closure may affect travel.' } }
]);
assert.strictEqual(roadwayLines[0], 'Construction and lane closure on US 59', 'Travel Brief consolidates duplicate roadway references without changing first roadway priority');
assert.strictEqual(roadwayLines[1], 'Road closed on SH 146', 'Travel Brief keeps next priority roadway after consolidated group');
assert.strictEqual(roadwayLines.filter((line) => /US 59/.test(line)).length, 1, 'Travel Brief suppresses duplicate US 59 roadway lines');

const crossingStart = source.indexOf('function gridlyConsumerCrossingClassificationLabel');
const crossingEnd = source.indexOf('function getGridlyCrossingPopupReportCount', crossingStart);
assert(crossingStart > 0 && crossingEnd > crossingStart, 'Crossing popup presentation helpers are present');

const crossingSandbox = {
  gridlyNowMs: () => 0,
  gridlyAddPopupAuditDuration: () => {},
  getGridlySpecificCrossingLocation: () => null,
  normalizeGridlyUserFacingRoadText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
  normalizeGridlyLightweightLocationLabelText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
  standardizeGridlyAlertHeadline: (value) => String(value || '').replace(/\b\w/g, (letter) => letter.toUpperCase())
};
vm.createContext(crossingSandbox);
vm.runInContext(source.slice(crossingStart, crossingEnd), crossingSandbox);

assert.strictEqual(crossingSandbox.gridlyConsumerCrossingClassificationLabel('PRIVATE'), 'Private Crossing', 'PRIVATE classification is converted to consumer language');
assert.strictEqual(crossingSandbox.gridlyConsumerCrossingClassificationLabel('PRIVATE_ROAD'), 'Private Crossing', 'PRIVATE_ROAD classification is converted to consumer language');
assert.strictEqual(crossingSandbox.resolveGridlyCrossingPopupLocationLabel({ crossingName: 'PRIVATE' }), 'Private Crossing', 'Crossing popup does not expose raw PRIVATE classification');
assert.strictEqual(crossingSandbox.gridlyConsumerCrossingClassificationLabel('PUBLIC_ROADWAY'), '', 'Non-meaningful internal crossing classification can be suppressed');

const publishedAwarenessSource = fs.readFileSync('js/gridlyAlertsPublishedAwareness.js', 'utf8');
const publishedAwarenessSandbox = {
  window: {},
  console,
  normalizeGridlyCountyAwareDisplayText: (value) => {
    if (value && typeof value === 'object') return value.canonicalDisplayLocation || value.phrasing || '';
    return String(value || '').trim();
  },
  cleanDisplayValue: (value) => String(value || '').trim(),
  esc: (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;'),
  gridlyBuildNeutralAlertsSheetMarkup: () => '<div>neutral</div>',
  formatGridlyAlertsFreshnessLine: () => 'Updated 12 minutes ago',
  formatGridlyAlertsTrustLine: () => 'Awaiting additional reports',
  buildGridlyAlertCardConsumerModel: undefined,
  isGridlyCachedAwarenessSummaryForCurrentArea: () => true,
  gridlyCommunityPulseAuditState: null,
  gridlyLP012RecordAlertsClick: () => {},
  gridlyAlertsOpenRefreshFixNow: () => 0,
  gridlyBeginAlertsSheetLifecycle: () => 1,
  gridlyBeginAlertsOpenRefreshFixTiming: () => {},
  gridlyRecordAlertsOpenRefreshFixTiming: () => {},
  gridlyInstantAlertsSheetAuditState: {},
  gridlyAlertsSheetLifecycleState: { lateResultIgnoredCount: 0 }
};
vm.createContext(publishedAwarenessSandbox);
vm.runInContext(publishedAwarenessSource, publishedAwarenessSandbox);

const crossingPublishedAwarenessHtml = publishedAwarenessSandbox.gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords([
  {
    id: 'lp018-private-crossing-published-awareness',
    title: 'Train Blocking Crossing',
    locationLabel: 'PRIVATE',
    crossingClassification: 'PRIVATE',
    summary: 'Train Blocking Crossing affecting nearby travel.',
    minutesAgo: 12
  },
  {
    id: 'lp018-unrelated-alert',
    title: 'Disabled Vehicle',
    locationLabel: 'US 59',
    summary: 'Disabled Vehicle affecting nearby travel.',
    minutesAgo: 8
  }
]);
const crossingPublishedAwarenessVisibleText = crossingPublishedAwarenessHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

assert(crossingPublishedAwarenessVisibleText.includes('Train Blocking Crossing'), 'published-awareness Alerts builder keeps Train Blocking Crossing title');
assert(crossingPublishedAwarenessVisibleText.includes('Private Crossing'), 'published-awareness Alerts builder maps PRIVATE fallback classification to Private Crossing');
assert(!/(^|\s)PRIVATE(?=\s|$)/.test(crossingPublishedAwarenessVisibleText), 'published-awareness Alerts builder does not expose raw PRIVATE as a standalone visible label');
assert(crossingPublishedAwarenessVisibleText.includes('12 minutes ago'), 'published-awareness Alerts builder keeps freshness line');
assert(crossingPublishedAwarenessVisibleText.includes('Awaiting additional reports'), 'published-awareness Alerts builder keeps trust copy');
assert(crossingPublishedAwarenessVisibleText.includes('Disabled Vehicle'), 'published-awareness Alerts builder still renders unrelated alerts');
assert(crossingPublishedAwarenessVisibleText.includes('US 59'), 'published-awareness Alerts builder preserves unrelated alert location');

console.log('LP018 consumer language polish regression passed');
