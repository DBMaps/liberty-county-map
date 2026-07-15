const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');

const afterPaintStart = app.indexOf('function gridlyOpenAlertsSurfaceAfterPaint()');
const afterPaintEnd = app.indexOf('\nfunction openAlertsSurfaceFromDock()', afterPaintStart);
assert(afterPaintStart > -1 && afterPaintEnd > afterPaintStart, 'gridlyOpenAlertsSurfaceAfterPaint block found');
const afterPaintBlock = app.slice(afterPaintStart, afterPaintEnd);

const buildStart = app.indexOf('async function gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply()');
const buildEnd = app.indexOf('\nfunction invokeMobileAlertsEntry', buildStart);
assert(buildStart > -1 && buildEnd > buildStart, 'authoritative Alerts build block is async and found');
const buildBlock = app.slice(buildStart, buildEnd);

assert(app.includes('gridlyAlertsCooperativeBuildSourceResolution'), 'LP010 source-resolution documentation exists');
assert(app.includes('traceLocationAFunction: "gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply"'), 'trace location A enclosing function documented');
assert(app.includes('traceLocationBFunction: "gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply'), 'trace location B enclosing function documented');
assert(app.includes('dominantFunction: "gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply"'), 'dominant function documented');
assert(app.includes('"gridlyOpenAlertsSurfaceAfterPaint"') && app.includes('"renderAlertCard"'), 'dominant call chain documents LP009 deferred path through card generation');

assert(app.includes('function gridlyAlertsScheduleBrowserYield()'), 'cooperative browser-yield scheduler exists');
assert(/requestAnimationFrame[\s\S]*setTimeout\(resolve, 0\)/.test(app), 'scheduler yields through requestAnimationFrame followed by setTimeout');
assert(app.includes('async function gridlyAlertsCooperativeYieldIfNeeded'), 'cooperative yield helper exists');
assert(buildBlock.includes('await gridlyAlertsCooperativeYieldIfNeeded'), 'authoritative build yields inside processing');
assert(/for \(let index = 0; index < presentationAlerts\.length; index \+= 1\)[\s\S]*await gridlyAlertsCooperativeYieldIfNeeded/.test(buildBlock), 'PresentationRecord/card loops contain internal scheduling boundary');
assert(!/Promise\.resolve\(\)\s*\.then\(\(\) => gridlyOpenAlertsSurfaceAuthoritativeBuildAndApply\(\)\)/.test(afterPaintBlock), 'Promise microtask alone is not the LP010 fix');

assert(afterPaintBlock.includes('inFlightKey === key'), 'equivalent authoritative builds are coalesced');
assert(afterPaintBlock.includes('duplicateBuildPrevented'), 'duplicate-build prevention is audited');
assert(buildBlock.includes('cooperativeBuildGeneration !== gridlyAlertsCooperativeBuildState.generation'), 'obsolete builds are superseded by generation ownership');
assert(buildBlock.includes('cooperativeBuildContextKey === gridlyGetAlertsAuthoritativeContextKey()'), 'old context cannot overwrite a newer context');
assert(buildBlock.includes('gridlyIsAlertsSheetStillOpenForAuthoritativeApply()'), 'closed Alerts sheet is not reopened by completed work');

assert(buildBlock.includes('getAlertsSurfaceSnapshot'), 'snapshot creation remains in authoritative renderer');
assert(buildBlock.includes('gridlyFilterAlertRecordsBySelectedAwarenessArea'), 'awareness filtering remains present');
assert(buildBlock.includes('getGridlyAlertsPresentationCountModel'), 'grouping/count presentation model remains authoritative');
assert(buildBlock.includes('buildAlertPresentationGroups'), 'fallback grouping remains present');
assert(buildBlock.includes('formatGridlyAlertsTrustLine'), 'trust language remains present');
assert(buildBlock.includes('formatGridlyAlertsFreshnessLine'), 'freshness wording remains present');
assert(buildBlock.includes('gridlyStoreAlertsAuthoritativeRenderedCache'), 'authoritative cache remains updated');
assert(buildBlock.includes('window.openGridlyPortraitV2Sheet("alerts"'), 'final authoritative renderer remains unchanged');

assert(app.includes('gridlyAlertsAuthoritativeOutputSignature'), 'stable output signature validation exists');
assert(app.includes('outputSignatureBefore') && app.includes('outputSignatureAfter') && app.includes('outputEquivalent'), 'output equivalence fields are tracked');
assert(app.includes('window.gridlyAlertsCooperativeBuildAudit = gridlyAlertsCooperativeBuildAudit'), 'LP010 audit helper is exposed');

assert(!app.includes('gridlyDisplayCandidateRuntime'), 'no Display Candidate runtime is introduced');
assert(!/disabled\s*[:=]\s*true[^\n]*(DriveTexas|Weather|Provider|provider|Supabase|supabase)/i.test(app), 'no providers are disabled');
assert(!/slice\(0,\s*\d+\)[\s\S]{0,80}(discard|performance|lp010)/i.test(buildBlock), 'Alerts/reports are not sliced away for performance');

assert(app.includes('gridlyRunAlertsBackgroundRefreshAfterOpen("alerts_open_background_refresh")'), 'LP008 post-paint shared-report refresh remains present');
assert(app.includes('gridlyBuildNeutralAlertsSheetMarkup') && app.includes('scheduleAfterPaint(() => { gridlyOpenAlertsSurfaceAfterPaint(); })'), 'LP009 immediate shell and deferred authoritative build remain present');

console.log('LP010 alerts cooperative build fix static guard passed');
