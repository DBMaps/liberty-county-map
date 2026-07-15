const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

const openStart = app.indexOf('function openAlertsSurfaceFromDock()');
const openEnd = app.indexOf('\nfunction invokeMobileAlertsEntry', openStart);
assert(openStart > -1 && openEnd > openStart, 'openAlertsSurfaceFromDock block found');
const openBlock = app.slice(openStart, openEnd);

const backgroundStart = app.indexOf('function gridlyRunAlertsBackgroundRefreshAfterOpen');
const backgroundEnd = app.indexOf('\nfunction gridlyAlertsOpenRefreshFixAudit', backgroundStart);
assert(backgroundStart > -1 && backgroundEnd > backgroundStart, 'background refresh helper block found');
const backgroundBlock = app.slice(backgroundStart, backgroundEnd);

assert(!/await\s+loadSharedReports\(["']alerts_open_background_refresh/.test(openBlock), 'Alerts open does not await alerts_open_background_refresh');
assert(!/loadSharedReports\(["']alerts_open_background_refresh["']\)\.then\([^)]*openGridlyPortraitV2Sheet/s.test(app), 'Alerts opening is not chained from alerts_open_background_refresh completion');
assert(openBlock.indexOf('window.openGridlyPortraitV2Sheet("alerts"') < openBlock.indexOf('gridlyRunAlertsBackgroundRefreshAfterOpen("alerts_open_background_refresh"'), 'Alerts sheet open/render occurs before scheduling alerts_open_background_refresh');
assert(backgroundBlock.includes('requestAnimationFrame(() => setTimeout(callback, 0))'), 'alerts_open_background_refresh is scheduled after a paint boundary');
assert(backgroundBlock.includes('.catch((error) =>'), 'detached alerts refresh has rejection handling');
assert(backgroundBlock.includes('loadSharedReports(sourceTag)'), 'final refreshed data still enters the existing loadSharedReports state/render path');
assert(app.includes('function gridlyAlertsOpenRefreshFixAudit()'), 'LP008 passive audit helper exists');
assert(app.includes('window.gridlyAlertsOpenRefreshFixAudit = gridlyAlertsOpenRefreshFixAudit'), 'LP008 passive audit helper is exposed');
assert(app.includes('exposeGridlyAuditHelper("gridlyAlertsOpenRefreshFixAudit", gridlyAlertsOpenRefreshFixAudit)'), 'LP008 passive audit helper is registered');

assert(openBlock.includes('getAlertsSurfaceSnapshot'), 'existing Alerts snapshot path remains authoritative');
assert(openBlock.includes('getGridlyAlertsPresentationCountModel'), 'existing final Alerts presentation renderer remains authoritative');
assert(!app.includes('gridlyDisplayCandidateRuntime'), 'no Display Candidate runtime exists');
assert(!/disabled\s*[:=]\s*true[^\n]*(DriveTexas|Weather|Provider|provider|Supabase|supabase)/i.test(app), 'no provider is disabled');
assert(!/fake loading|loading card|skeleton card/i.test(openBlock), 'no fake loading/skeleton card was added as the fix');
assert(openBlock.includes('gridlyFilterAlertRecordsBySelectedAwarenessArea'), 'awareness-area filtering remains in the Alerts open path');
assert(openBlock.includes('buildAlertPresentationGroups'), 'grouping behavior remains in the Alerts open path');
assert(app.includes('activeHazards = gridlyFilterRoadHazardsByLatestLifecycle'), 'hazard lifecycle behavior remains in loadSharedReports');
assert(backgroundBlock.includes('refreshWasAlreadyInFlight') && backgroundBlock.includes('refreshWasCoalesced'), 'in-flight refresh coalescing is audited when present');

console.log('LP008 alerts open refresh fix static guard passed');
