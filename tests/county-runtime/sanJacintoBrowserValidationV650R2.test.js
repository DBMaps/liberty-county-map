const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(needle, message) {
  assert(source.includes(needle), message);
}

includes('activeCountyBoundaryCredibilityReview', 'boundary audit exposes credibility review');
includes('visualCorrectnessPass: activeBoundaryAuthoritativeSanJacinto', 'San Jacinto visual correctness follows authoritative boundary validation');
includes('sourceAssetRecommendedForProduction = Boolean(activeBoundaryUsesCountySpecificPayload && activeCountyQuality.pass && !activeCountyQuality.tooCoarse && activeCountyBoundaryCredibilityReview.visualCorrectnessPass', 'production recommendation requires visual correctness');
includes('currentSanJacintoVisibleReportCount', 'San Jacinto report audit exposes current visible report count');
includes('currentSanJacintoMarkerCount', 'San Jacinto report audit exposes current marker count');
includes('currentSanJacintoAlertCount', 'San Jacinto report audit exposes current alert count');
includes('currentSanJacintoAwarenessCount', 'San Jacinto report audit exposes current awareness count');
includes('visibleIncidentAuditPass', 'San Jacinto report audit exposes visible incident audit pass');
includes('countLineage: {', 'San Jacinto count reconciliation documents lineage');
includes('routeLocationPanelCount', 'San Jacinto count reconciliation includes route/location panel count');
assert(!/Road Closed on San Jacinto County/.test(source), 'runtime must not hard-code forbidden San Jacinto wording');
assert(!/Reported on San Jacinto County/.test(source), 'runtime must not hard-code forbidden San Jacinto location wording');
includes('replace(/^Reported\\s+on\\s+(.+ County)$/i', 'shared county-aware language path rewrites county-level Reported on fallback');

console.log('sanJacintoBrowserValidationV650R2.test.js passed');
