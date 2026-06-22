const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

includes('function isGridlyAlertsSurfaceUserFacingClear(snapshot = null)', 'alerts-surface clear helper exists');
includes('snapshot.hasActiveAlerts === false', 'clear helper requires hasActiveAlerts to be false');
includes('const alertsSurfaceUserFacingClear = isGridlyAlertsSurfaceUserFacingClear(snapshot);', 'awareness active-state reads alerts-surface clear state');
includes('const activeLocalizedAlertCount = alertsSurfaceUserFacingClear ? 0', 'localized intelligence is zeroed for user-facing active-state counts when alerts surface is clear');
includes('const activeHazardSourceCount = alertsSurfaceUserFacingClear ? 0', 'suppressed hazard source count is zeroed for Location Awareness when alerts surface is clear');
includes('if (activeState.activeCountsAreClear) return getGridlyQuietAwarenessBriefCopy();', 'Location Awareness copy uses quiet state when user-facing counts are clear');
includes('const alertsSurfaceSnapshot = typeof window !== "undefined" && typeof window.getAlertsSurfaceSnapshot === "function"', 'Location Awareness panel checks alerts surface snapshot before deriving visible count');
includes('const activeCountRaw = alertsSurfaceUserFacingClear ? 0 : Math.max(', 'Location Awareness visible count is aligned to alert-visible incidents instead of marker/localized fallback sources');

console.log('v666LocationAwarenessCountAlignment.test.js passed');
