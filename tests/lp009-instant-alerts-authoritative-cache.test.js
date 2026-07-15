const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

const openStart = app.indexOf('function openAlertsSurfaceFromDock()');
const openEnd = app.indexOf('\nfunction gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply', openStart);
assert(openStart > -1 && openEnd > openStart, 'instant openAlertsSurfaceFromDock wrapper exists before authoritative builder');
const instantOpen = app.slice(openStart, openEnd);

const authoritativeStart = app.indexOf('function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply()');
const authoritativeEnd = app.indexOf('\nfunction invokeMobileAlertsEntry', authoritativeStart);
assert(authoritativeStart > -1 && authoritativeEnd > authoritativeStart, 'existing authoritative Alerts renderer was retained under an explicit builder name');
const authoritativeBlock = app.slice(authoritativeStart, authoritativeEnd);

assert(instantOpen.indexOf('openGridlyPortraitV2Sheet("alerts"') > -1, 'sheet insertion is performed by the instant wrapper');
assert(instantOpen.indexOf('openGridlyPortraitV2Sheet("alerts"') < instantOpen.indexOf('gridlyOpenAlertsSurfaceAfterPaint()'), 'sheet insertion occurs before deferred authoritative model construction');
assert(!instantOpen.includes('getGridlyAlertsPresentationCountModel('), 'full PresentationRecord creation is not called before initial sheet insertion');
assert(!instantOpen.includes('getAlertsSurfaceSnapshot('), 'snapshot creation is not called before initial sheet insertion');
assert(instantOpen.includes('gridlyReadValidAlertsAuthoritativeCache(contextKey)'), 'valid authoritative cache may be resolved immediately');
assert(instantOpen.includes('cacheRead.contextMatched ? cacheRead.cache.renderedMarkup'), 'valid authoritative cache markup may render immediately');
assert(app.includes('function gridlyGetAlertsAuthoritativeContextKey()'), 'cache ownership includes an Alerts context key helper');
assert(app.includes('cache.contextKey === contextKey'), 'cache context must match the current awareness/county/filter context');
assert(instantOpen.includes('neutral-empty-state'), 'invalid-context or missing cache falls back to a neutral existing-style state');
assert(!instantOpen.includes('skeleton') && !instantOpen.includes('fake loading') && !instantOpen.includes('loading card'), 'no skeleton or fake loading card exists in the instant open path');
assert(!app.includes('gridlyDisplayCandidateRuntime'), 'no Display Candidate runtime exists');
assert(authoritativeBlock.includes('getGridlyAlertsPresentationCountModel(alertsForRender)'), 'existing final PresentationRecord renderer remains authoritative');
assert(authoritativeBlock.includes('gridlyStoreAlertsAuthoritativeRenderedCache({'), 'authoritative completion owns cache update only after complete markup generation');
assert(authoritativeBlock.indexOf('gridlyStoreAlertsAuthoritativeRenderedCache({') < authoritativeBlock.indexOf('innerHTML or equivalent assignment'), 'completed authoritative output is cached before replacement render is applied');
assert(app.includes('gridlyDetectDuplicateAlertCards()'), 'authoritative completion audits duplicate cards after replacement');
assert(app.includes('.catch((error) =>') && app.includes('deferred authoritative alerts render failed'), 'detached authoritative work has rejection handling');
assert(app.includes('gridlyInstantAlertsSheetAuditState.inFlight') && app.includes('duplicateBuildPrevented'), 'equivalent in-flight authoritative builds are coalesced');
assert(authoritativeBlock.includes('gridlyFilterAlertRecordsBySelectedAwarenessArea'), 'awareness-area filtering remains unchanged in the authoritative path');
assert(authoritativeBlock.includes('buildAlertPresentationGroups'), 'grouping remains unchanged in the authoritative path');
assert(authoritativeBlock.includes('presentationAlerts.length') && authoritativeBlock.includes('presentationCountModel.alerts'), 'final sorting/count presentation path remains unchanged');
assert(app.includes('activeHazards = gridlyFilterRoadHazardsByLatestLifecycle'), 'hazard lifecycle remains unchanged in loadSharedReports');
assert(app.includes('loadSharedReports(sourceTag)'), 'shared-report provider refresh remains enabled');
assert(app.includes('window.gridlyInstantAlertsSheetAudit = gridlyInstantAlertsSheetAudit'), 'LP009 focused audit helper is exposed');

console.log('LP009 instant alerts authoritative cache static guard passed');
