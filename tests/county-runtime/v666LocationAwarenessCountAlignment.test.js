const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

includes('function isGridlyAlertsSurfaceUserFacingClear(snapshot = null)', 'alerts-surface clear helper exists');
includes('snapshot.hasActiveAlerts === false', 'clear helper requires hasActiveAlerts to be false');
includes('function getGridlyAlertsSurfaceVisibleActiveIncidentCount(snapshot = null)', 'alerts-visible active incident count helper exists');
includes('if (visibleAlertCount > 0 && activeIncidentCount > 0) return Math.min(visibleAlertCount, activeIncidentCount);', 'alert-visible active incident count caps fallback counts to visible alerts');
includes('const alertsSurfaceUserFacingClear = isGridlyAlertsSurfaceUserFacingClear(snapshot);', 'awareness active-state reads alerts-surface clear state');
includes('const activeLocalizedAlertCount = alertsSurfaceUserFacingClear ? 0', 'localized intelligence is zeroed for user-facing active-state counts when alerts surface is clear');
includes('const activeHazardSourceCount = alertsSurfaceUserFacingClear ? 0', 'suppressed hazard source count is zeroed for Location Awareness when alerts surface is clear');
includes('if (activeState.activeCountsAreClear) return getGridlyQuietAwarenessBriefCopy();', 'Location Awareness copy uses quiet state when user-facing counts are clear');
includes('const alertsSurfaceSnapshot = typeof window !== "undefined" && typeof window.getAlertsSurfaceSnapshot === "function"', 'Location Awareness panel checks alerts surface snapshot before deriving visible count');
includes('const alertVisibleActiveIncidentCount = getGridlyAlertsSurfaceVisibleActiveIncidentCount(alertsSurfaceSnapshot);', 'Location Awareness panel derives count from alert-visible active incidents first');
includes('const activeCountRaw = alertsSurfaceUserFacingClear ? 0 : (Number.isFinite(Number(alertVisibleActiveIncidentCount))', 'Location Awareness visible count is aligned to alert-visible incidents instead of marker/localized fallback sources');
includes('const hasAlertVisibleActiveIncidentCount = Number.isFinite(alertVisibleActiveIncidentCount) && alertVisibleActiveIncidentCount > 0;', 'Awareness brief active copy prefers alert-visible incident count over localized or hazard fallback counts');

function getExpectedVisibleActiveIncidentCount(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const alerts = Array.isArray(snapshot.alerts) ? snapshot.alerts : [];
  const visibleAlertCount = Math.max(0, alerts.length);
  const activeIncidentCount = Math.max(0, Number(snapshot.activeIncidentCount ?? snapshot.count ?? 0) || 0);
  if (visibleAlertCount > 0 && activeIncidentCount > 0) return Math.min(visibleAlertCount, activeIncidentCount);
  if (visibleAlertCount > 0) return visibleAlertCount;
  if (activeIncidentCount > 0 && snapshot.hasActiveAlerts === true) return activeIncidentCount;
  return null;
}

assert.strictEqual(
  getExpectedVisibleActiveIncidentCount({ activeIncidentCount: 0, alerts: [], hasActiveAlerts: false, activeHazardSourceCount: 2, activeLocalizedAlertCount: 2 }),
  null,
  'clear state remains available for zero-count quiet behavior'
);
assert.strictEqual(
  getExpectedVisibleActiveIncidentCount({ activeIncidentCount: 1, alerts: [{ id: 'point-blank-flooding' }], hasActiveAlerts: true, activeHazardSourceCount: 2, activeLocalizedAlertCount: 2, unifiedIncidentSourceCount: 2 }),
  1,
  'one alert-visible incident remains 1 even if localized/hazard source counts are higher'
);
assert.strictEqual(
  getExpectedVisibleActiveIncidentCount({ activeIncidentCount: 1, alerts: [{ id: 'san-jacinto-shepherd-crossing' }], hasActiveAlerts: true, activeHazardSourceCount: 1, activeLocalizedAlertCount: 1 }),
  1,
  'San Jacinto Shepherd crossing ownership containment keeps one visible active incident'
);

console.log('v666LocationAwarenessCountAlignment.test.js passed');
