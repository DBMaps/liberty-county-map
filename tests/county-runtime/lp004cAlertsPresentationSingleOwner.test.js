const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

const between = (start, end) => {
  const startIndex = source.indexOf(start);
  assert(startIndex >= 0, `${start} exists`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(endIndex >= 0, `${end} exists after ${start}`);
  return source.slice(startIndex, endIndex);
};

const openAlerts = between('function openAlertsSurfaceFromDock()', '    if (typeof isGridlyExplicitDebugModeEnabled');
const snapshot = between('function getAlertsSurfaceSnapshot()', '  window.getAlertsSurfaceSnapshot = getAlertsSurfaceSnapshot;');
const renderCard = between('const renderAlertCard = (alert, index, isHidden = false) => {', '};\n\n      const normalizeAlertPresentationKey');
const header = between('const alertsPanelHeadingModel = gridlyAlertsOpenAuditMeasureMicro("preInsertionSubphases", "outer sheet/header markup"', '      const html = gridlyAlertsOpenAuditMeasureMicro');
const domGeneration = between('const renderedRows = gridlyAlertsOpenAuditMeasure("DOM generation", () => ({', '      const rows = renderedRows.rows;');

const presentationCreationMatches = openAlerts.match(/gridlyAlertsOpenAuditMeasure\("presentation model creation"/g) || [];
assert.strictEqual(presentationCreationMatches.length, 1, 'openAlertsSurfaceFromDock creates the presentation model exactly once');
assert(openAlerts.includes('gridlyAlertsOpenPerformanceAuditState.activeRenderContext = alertsOpenRenderContext;'), 'open path publishes the authoritative per-open model');
assert(openAlerts.includes('presentationModel: presentationCountModel'), 'downstream render context owns the exact presentation model object');
assert(openAlerts.includes('const presentationAlerts = gridlyAlertsOpenAuditMeasure("situation clustering", () => presentationCountModel.alerts.length ? presentationCountModel.alerts : buildAlertPresentationGroups(alertsForRender));'), 'grouping/counting reuses the presentation model alerts');
assert(!renderCard.includes('getGridlyAlertsPresentationCountModel'), 'card renderer does not rebuild the presentation model');
assert(!header.includes('getGridlyAlertsPresentationCountModel'), 'header path does not rebuild the presentation model');
assert(!domGeneration.includes('getGridlyAlertsPresentationCountModel'), 'DOM/card generation does not rebuild the presentation model');
assert(!snapshot.includes('gridlyAlertsOpenAuditMeasure("presentation model creation"'), 'snapshot creation no longer creates an Alerts presentation model');
assert(snapshot.includes('groupedAlertCount: normalizedAlertItems.length'), 'snapshot exposes raw available data without synchronous presentation regrouping');
assert(openAlerts.indexOf('const presentationCountModel = gridlyAlertsOpenAuditMeasure("presentation model creation"') < openAlerts.indexOf('const presentationAlerts = gridlyAlertsOpenAuditMeasure("situation clustering"'), 'presentation model is created before downstream grouping/count use');
assert(openAlerts.indexOf('const presentationCountModel = gridlyAlertsOpenAuditMeasure("presentation model creation"') < openAlerts.indexOf('const headerLeadAlert = presentationAlerts[0]'), 'header uses the already-created presentation alerts');
assert(openAlerts.indexOf('const presentationCountModel = gridlyAlertsOpenAuditMeasure("presentation model creation"') < openAlerts.indexOf('const renderedRows = gridlyAlertsOpenAuditMeasure("DOM generation"'), 'card rendering uses the already-created model');
assert(!openAlerts.slice(openAlerts.indexOf('const presentationCountModel = gridlyAlertsOpenAuditMeasure("presentation model creation"')).includes('DriveTexas official situation promotion'), 'provider promotion is not re-entered after model creation');
assert(!openAlerts.includes('awareness/location initialization'), 'cold awareness/location initialization is not synchronously invoked by the Alerts tap path');
assert(source.includes('presentationModelCalls'), 'audit reports individual presentation-model calls');
assert(source.includes('presentationModelSingleOwnerPass'), 'audit reports single-owner pass/fail');
assert(source.includes('presentationModelObjectReusePass'), 'audit reports object reuse pass/fail');
assert(source.includes('instrumentationMateriallyInflatesOpenTime'), 'instrumentation still reports whether timing boundaries inflate open time');
assert(source.includes('totalOpenDurationMs'), 'audit still measures the full user interaction duration');

console.log('lp004cAlertsPresentationSingleOwner.test.js passed');
