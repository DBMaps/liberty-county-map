const assert = require('assert');
const fs = require('fs');
const source = fs.readFileSync('js/app.js', 'utf8');

function slice(start, end) {
  const s = source.indexOf(start);
  assert(s >= 0, `${start} exists`);
  const e = source.indexOf(end, s + start.length);
  assert(e >= 0, `${end} exists after ${start}`);
  return source.slice(s, e);
}

function functionBody(name) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} exists`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} body closed`);
}

const selectedArea = slice('function getGridlySelectedAwarenessArea()', 'function getGridlyCanonicalAwarenessPresentationContext');
const normalizeArea = slice('function normalizeGridlyAwarenessAreaLookupText(value = "")', 'function resolveGridlyAwarenessArea');
const resolveArea = slice('function resolveGridlyAwarenessArea(value = "")', 'function resolveGridlyAwarenessAreaForCounty');
const buildRoadContext = slice('function buildGridlyRoadEvaluationContext(options = {})', 'function gridlyIsInvalidCountyAwareRoadLabel');
const evaluateRoad = slice('function evaluateRoadNameCandidate(value = "", roadEvaluationContext = null)', 'function normalizeRoadDisplayCase');
const normalizeSettings = slice('function normalizeGridlySettings(raw = null)', 'function getGridlySettingsPreferences');
const settingsPrefs = slice('function getGridlySettingsPreferences()', 'function saveGridlySettingsPreferences');
const openAlerts = functionBody('openAlertsSurfaceFromDock');
const contextFactory = slice('function gridlyCreateAlertsOpenContext(eventType = "manual")', 'function gridlyAlertsAwarenessHotPathAudit()');
const mobileAudit = slice('function gridlyMobileStartupOwnershipAudit()', 'function gridlyAlertsOpenAuditBegin');
const dockBinding = slice('function bindBottomDockRealButtons()', 'function setMobileUiMode');

assert(!selectedArea.includes('gridlyActiveAlertsOpenContext'), 'selected awareness helper does not read Alerts context during startup');
assert(normalizeArea.includes('gridlyNormalizeAwarenessAreaLookupForAlertsOpen(value)'), 'normalizer keeps optional Alerts cache hook');
assert(!resolveArea.includes('return activeContext.resolvedAwarenessArea'), 'awareness resolver does not short-circuit to Alerts context');
assert(resolveArea.includes('const perResolutionCandidateLookup = new Map()'), 'awareness resolver keeps default per-resolution path');
assert(!buildRoadContext.includes('return gridlyActiveAlertsOpenContext.roadEvaluationContext'), 'road context builder does not globally reuse Alerts context');
assert(!evaluateRoad.includes('gridlyActiveAlertsOpenContext?.roadEvaluationContext && !roadEvaluationContext'), 'road candidate evaluation requires explicit context');
assert(!normalizeSettings.includes('gridlyActiveAlertsOpenContext'), 'settings normalization does not return scoped Alerts settings outside Alerts');
assert(!settingsPrefs.includes('gridlyActiveAlertsOpenContext?.settingsPreferences'), 'settings preferences do not return scoped Alerts preferences outside Alerts');
assert(contextFactory.includes('context.roadEvaluationContext = buildGridlyRoadEvaluationContext'), 'Alerts click creates a scoped context and road evaluation context');
assert(openAlerts.includes('const alertsOpenContext = gridlyCreateAlertsOpenContext(eventType);'), 'Alerts open creates context from the click/tap entrypoint');
assert(openAlerts.includes('try {') && openAlerts.includes('} finally {') && openAlerts.includes('gridlyActiveAlertsOpenContext = null') && openAlerts.includes('contextClearedAfterOpen = true'), 'Alerts context cleanup occurs in finally');
assert(openAlerts.includes('getGridlyAlertsPresentationCountModel(alertsForRender, { alertsOpenContext })'), 'Alerts-only presentation receives explicit context');
assert(dockBinding.includes("button.addEventListener('click'") && !dockBinding.includes('pointerover'), 'Alerts still opens through click/tap and not pointerover');
assert(openAlerts.includes('renderAlertCard(a, i, false)'), 'one construction alert card path still renders');
assert(mobileAudit.includes('window.gridlyMobileStartupOwnershipAudit'), 'mobile startup ownership audit is exposed');
[
  'portraitModeDetected',
  'mobilePortraitShellVisible',
  'legacyDispatchShellVisible',
  'legacyDispatchInitializationRan',
  'legacyDispatchFallbackActivated',
  'alertsContextActiveDuringStartup',
  'alertsContextCreatedBeforeAlertsClick',
  'alertsContextClearedAfterOpen',
  'sharedHelperBehaviorPreserved',
  'portraitActivationCompleted',
  'portraitOwnershipPass',
  'blockingFindings'
].forEach((key) => assert(mobileAudit.includes(key), `mobile audit returns ${key}`));

console.log('lp004eMobileStartupContextIsolation.test.js passed');
