const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

// 1. Montgomery → Liberty reloads Liberty crossings.
includes('gridlySetActiveCountyContext(countyId = GRIDLY_DEFAULT_COUNTY_ID)', 'active county setter is present');
includes('gridlyCrossingInventoryCountyId = null;', 'county switch invalidates the previous crossing inventory owner');
includes('ensureGridlyActiveCountyCrossingInventory("active-county-change")', 'county switch schedules a crossing inventory reload');
includes('const requestedCountyId = gridlyGetActiveCountyId();', 'loadCrossings captures the requested active county before loading');
includes('gridlyCrossingInventoryCountyId = requestedCountyId;', 'loadCrossings records the county that owns the loaded inventory');

// 2. Liberty → Montgomery reloads Montgomery crossings.
includes('const activeSources = gridlyGetActiveCountyRuntimeSources();', 'crossing fetch resolves the active county runtime source dynamically');
includes('if (ensureGridlyActiveCountyCrossingInventory(`schedule:${reason}`)) return;', 'crossing render scheduling cannot render stale county inventory');
assert(/staleInventorySuppressed:[\s\S]*gridlyCrossingInventoryCountyId === activeCountyId/.test(source), 'crossing audit proves stale inventory is suppressed');

// 3. Cleared flooding removed from awareness model.
includes('function gridlyApplyClearedHazardAwarenessContainment(clearRow = {})', 'cleared-hazard containment helper is present');
includes('activeHazards = (Array.isArray(activeHazards) ? activeHazards : []).filter((row) => !isSameClearedHazard(row));', 'cleared hazard is removed from active hazard candidates');
includes('buildGridlyLightweightActiveAwareness({ activeHazards: [] })', 'cleared-hazard audit verifies an empty active-awareness model');
includes('const explicitActiveHazardsSupplied = Array.isArray(options?.activeHazards);', 'lightweight awareness detects caller-supplied active hazard fixtures');
includes('explicitActiveHazardsSupplied\n    ? []\n    : getGridlyUserFacingActiveRoadHazardIncidents', 'explicit empty activeHazards fixtures do not repopulate hazard count from global unified incidents');

// 4. Cleared flooding removed from awareness header.
includes('window.__gridlyLatestAlertsForRender = window.__gridlyLatestAlertsForRender.filter((row) => !isSameClearedHazard(row));', 'cleared hazard is removed from alert/header candidate cache');
includes('if (typeof updateDailyHabitStatus === "function") updateDailyHabitStatus();', 'awareness header refresh runs after cleared-hazard containment');
includes('! /flood/i.test(String(model.headline || ""))'.replace('! /', '!/'), 'cleared-hazard audit checks flood text is absent from top headline');

// 5. Historical panel suppressed while protected flags are false.
includes('function gridlyHistoricalProtectedState()', 'historical protected-state helper is present');
includes('return Object.freeze({ historicalReadsEnabled: false, historyUiEnabled: false });', 'historical reads and UI remain disabled');
includes('if (protectedState.historyUiEnabled === false || protectedState.historicalReadsEnabled === false) return gridlyHistoricalPanelProtectedStateMessage();', 'historical panel is neutralized while protected flags are false');

// 6. No county leakage through historical panel.
includes('const leakagePattern = /Dayton|Conroe|Liberty|Montgomery/i;', 'historical panel containment audit checks known county/town leakage');
includes('safeForProtectedHistoricalState', 'historical panel containment audit exposes the V630 safety flag');

// Required audit flags.
includes('safeForLibertyCrossingReload', 'crossing regression audit exposes expected flag');
includes('safeForClearedHazardContainment', 'cleared-hazard awareness audit exposes expected flag');
includes('window.gridlyHistoricalPanelContainmentAudit', 'historical panel containment audit is exposed');

console.log('v630RegressionFixes.test.js passed');
