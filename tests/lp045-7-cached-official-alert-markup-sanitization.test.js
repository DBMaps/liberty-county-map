const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('const gridlyAlertsAuthoritativeCache = {'), 'exact cached portrait Alerts markup owner is identified');
assert(app.includes('function gridlyStoreAlertsAuthoritativeRenderedCache'), 'exact cached markup writer is identified');
assert(app.includes('function gridlyReadValidAlertsAuthoritativeCache'), 'exact cache reader used by openAlertsSurfaceFromDock is identified');
assert(app.includes('const cacheRead = gridlyReadValidAlertsAuthoritativeCache(contextKey);'), 'openAlertsSurfaceFromDock uses the cache reader on tap');
assert(app.includes('GRIDLY_LP0457_ALERTS_PRESENTATION_SCHEMA_VERSION'), 'cache key includes narrow LP045.7 presentation schema version');
assert(app.includes('gridlyLp0457CachedMarkupLooksOfficial(cache.renderedMarkup) && gridlyLp0457MarkupHasBreakArtifacts(cache.renderedMarkup)'), 'stale cached official markup with break artifacts is rejected rather than rewritten');
assert(app.includes('window.gridlyLp0457CachedOfficialAlertMarkupAudit'), 'passive LP045.7 cache audit is exposed');
assert(app.includes('sourceCollectionName: "presentationAlerts from presentationCountModel.alerts fallback buildAlertPresentationGroups(alertsForRender)"'), 'cache-generation source collection is documented');
assert(app.includes('gridlyLp0457SanitizeOfficialCardCopy(alert'), 'official card copy is sanitized during cache generation');
assert(app.includes('gridlyNormalizeOfficialConsumerLanguage(rawOfficialDescriptionValue'), 'cached location line is sanitized before escaping');
assert(app.includes('gridlyLp0457NormalizeOfficialSummaryProse'), 'cached situation summary has independent sanitizer');
assert(app.includes('data-gridly-alert-situation-summary="true"'), 'situation summary is rendered from the card contract');
assert(app.includes('gridlyLp0455OfficialFreshnessResult(alert).renderedFreshnessLine'), 'official card freshness remains unchanged');
assert(app.includes('gridlyLp0393ConsumerDriveTexasPopupHtml'), 'official popup path remains present');
assert(app.includes('Update time unavailable'), 'popup freshness unavailable copy remains present');
assert(app.includes('gridlyLp045EnsureOfficialMarkersCurrent'), 'marker creation path remains present');
assert(app.includes('focusPulseApplied'), 'marker focus and pulse auditing remains present');
assert(app.includes('gridlyEvaluateDriveTexasGeographicOwnership'), 'LP039 authority remains unchanged');
assert(app.includes('Travel Brief'), 'Travel Brief ownership remains unchanged');

const sanitizerSource = app.slice(app.indexOf('function gridlyOfficialConsumerNormalizeRouteIdentifier'), app.indexOf('const GRIDLY_OFFICIAL_FRESHNESS_REASONABLE_MAX_MINUTES'));
const normalizeSource = app.match(/function gridlyLp0457NormalizeOfficialSummaryProse[\s\S]*?\n}\n/)[0];
const detectionSource = app.match(/function gridlyLp0456OfficialSourceDetection[\s\S]*?function gridlyLp0456IsOfficialDriveTexasRecord[\s\S]*?\n}\n/)[0];
const context = { String, RegExp };
vm.createContext(context);
vm.runInContext(`${sanitizerSource}\n${normalizeSource}\n${detectionSource}`, context);

const liveRecord = {
  providerId: 'drivetexas',
  sourceType: 'official-roadways',
  recordType: 'official_roadway_situation',
  sourceLocationDescription: 'US 59, MAIN LANES not affected.&lt;br/&gt;&lt;br/&gt;&lt;br/&gt;Construction of safety improvement projects consisting of installing cable median barrier.'
};
assert.strictEqual(context.gridlyLp0456IsOfficialDriveTexasRecord(liveRecord), true, 'live-shaped official DriveTexas record is recognized during cache generation');
const location = context.gridlySanitizeOfficialConsumerProse(liveRecord.sourceLocationDescription);
const summary = context.gridlyLp0457NormalizeOfficialSummaryProse(`Construction affecting travel on US 59, - MAIN LANES not affected.<br/><br/>Construction of safety improvement projects consisting of installing cable median barrier..`);
for (const text of [location, summary]) {
  assert(!/<\s*br\s*\/?\s*>/i.test(text), 'literal break tags are absent from cached copy');
  assert(!/&lt;\s*br\s*\/?\s*&gt;/i.test(text), 'escaped break tags are absent from cached copy');
  assert(!/(?:^|\s)[/|]+(?:\s|$)/.test(text), 'slash-only artifacts are absent');
  assert(!/,\s*-/.test(text), 'comma-hyphen artifacts are absent');
  assert(!/\.\s*\./.test(text), 'double punctuation is absent');
}
assert(/Crews are installing a cable median barrier/i.test(location), 'meaningful provider prose remains in consumer location line');
assert(/cable median barrier/i.test(summary), 'meaningful provider prose remains in situation summary');

const publishedAwarenessBlock = app.slice(app.indexOf('function gridlyBuildAlertsSheetMarkupFromPublishedAwarenessRecords'), app.indexOf('function openAlertsSurfaceFromDock'));
assert(publishedAwarenessBlock.includes('const cleanOfficialLocation'), 'published-awareness fallback producer sanitizes official location without changing community cards globally');
assert(!/community[\s\S]{0,180}gridlySanitizeOfficialConsumerProse/i.test(publishedAwarenessBlock), 'community cards remain semantically unchanged by scoped official-only sanitizer');
assert(app.includes('authoritativeBuildSkippedOnOpen = true'), 'Alerts sheet cache-first opening still works');
assert(app.includes('"alerts_open_is_cache_only"'), 'no additional asynchronous render is required merely to open the sheet');

console.log('LP045.7 cached official alert markup sanitization checks passed');
