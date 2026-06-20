const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

// 1. Cleared road-hazard records have an explicit awareness classifier.
includes('function gridlyIsClearedHazardAwarenessRecord(record = {})', 'cleared hazard awareness classifier is present');
includes('typeText === "cleared" || typeText === "hazard_cleared" || categoryText === "hazard_cleared"', 'cleared type/category records are recognized');
includes('const clearLifecycleState = ["cleared", "recently_cleared", "hazard_cleared", "inactive"].includes(lifecycleText);', 'clear lifecycle states are recognized');
includes('const clearWording = /\\bhazard(?:\\s+appears)?\\s+cleared\\b|\\bappears\\s+cleared\\b|✅\\s*hazard\\s+cleared/i.test(titleSummaryText);', 'hazard-cleared title/summary wording is recognized');

// 2. Cleared hazards cannot enter active road-hazard awareness sources.
includes('if (gridlyIsClearedHazardAwarenessRecord(item)) return "cleared";', 'lightweight lifecycle treats cleared hazards as cleared, not active');
includes('return latestActiveHazards.filter((hazard) => !gridlyIsClearedHazardAwarenessRecord(hazard) && getGridlyLightweightLifecycleState(hazard) === "active");', 'active hazard awareness lifecycle excludes cleared hazard records');
includes('return latestReports.filter((report) => !gridlyIsClearedHazardAwarenessRecord(report) && getGridlyLightweightLifecycleState(report) === "active");', 'active report awareness lifecycle excludes cleared hazard records');

// 3. Cleared hazards cannot be selected for active top awareness.
includes('if (gridlyIsClearedHazardAwarenessRecord(item)) return false;', 'top-awareness eligibility rejects cleared hazard records');
includes('if (state !== "active") return false;', 'meaningful top-awareness detail still requires an active lifecycle');
includes('if (/\\b(?:cleared|resolved|expired|historical|history|sample|audit|route intelligence|destination|eta|osrm|community pulse|conditions normal)\\b/i.test(text)) return false;', 'cleared wording remains suppressed from active top-awareness copy');

// 4. Audit road-hazard candidates exclude cleared hazard records while crossing logic remains intact.
includes('function gridlyAwarenessClassificationAuditIsCrossing(record = {})', 'crossing classification remains present');
includes('if (typeof isGridlyCrossingReportRecord === "function" && isGridlyCrossingReportRecord(record)) return true;', 'crossing classifier path remains untouched');
includes('if (gridlyIsClearedHazardAwarenessRecord(record)) return false;', 'diagnostic road hazard classifier rejects cleared hazards');
includes('classifiedAsRoadHazard: row.sourceKind === "activeHazard" && !gridlyIsClearedHazardAwarenessRecord(row.item || row),', 'awareness diagnostic candidates reject cleared active-hazard samples');

// 5. Regression audit is still exposed and reports the containment safety flag.
includes('window.gridlyClearedHazardAwarenessRegressionAudit = function gridlyClearedHazardAwarenessRegressionAudit()', 'cleared hazard awareness regression audit is exposed');
includes('safeForClearedHazardContainment', 'cleared hazard containment audit exposes safety flag');

console.log('v632ClearedHazardAwarenessClassificationFix.test.js passed');
