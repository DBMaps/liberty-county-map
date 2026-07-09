const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V917-CROSSING-VISIBILITY-AUDIT.md', 'utf8');

assert.match(app, /function gridlyCrossingVisibilityAudit\(\)/, 'V917 audit helper function exists');
assert.match(app, /window\.gridlyCrossingVisibilityAudit\s*=\s*gridlyCrossingVisibilityAudit/, 'V917 helper is exposed on window');
assert.match(app, /exposeGridlyAuditHelper\("gridlyCrossingVisibilityAudit",\s*gridlyCrossingVisibilityAudit\)/, 'V917 helper is registered');
assert.match(app, /const maximumVisibleZoom = Number\.isFinite/, 'V917 computes absent high-zoom max in helper');
assert.match(app, /markersDisappearAtHighZoom/, 'V917 reports high-zoom disappearance status');
assert.match(app, /renderedCrossingMarkerCount/, 'V917 reports live rendered marker count');
assert.match(app, /liveRenderMatchesPolicy/, 'V917 compares live render state with policy');
assert.match(app, /possibleLifecycleRefreshIssue/, 'V917 reports lifecycle refresh diagnosis');

assert.match(app, /function getGridlyPolicyVisibleCrossings/, 'V917 lifecycle render path has a policy-scoped visible crossing helper');
assert.match(app, /visibilityPolicy\.renderMode === "viewport-all"/, 'street zoom uses viewport-all policy source instead of geo-filter subset');
assert.match(app, /function isGridlyPublicRoadwayCrossing/, 'V917 preserves public-roadway-only crossing visibility');
assert.match(app, /!crossing \|\| !isGridlyReportableCrossing\(crossing\) \|\| !isGridlyPublicRoadwayCrossing\(crossing\)/, 'V917 render helper rejects non-reportable and non-public-roadway crossings');
assert.match(app, /const streetZoomRepopulationEligible = Boolean/, 'V917 has a same-cycle street zoom repopulation safeguard');
assert.match(app, /renderCrossingMarkersFromList\(repopulationCrossings, \{ ignoreClusterHidden: true \}\)/, 'V917 repopulates from policy-scoped visible crossings when initial render is empty');
assert.match(app, /streetZoomRepopulationSucceeded/, 'V917 reports street zoom repopulation success');
assert.match(app, /candidateCrossingCount/, 'V917 reports candidate crossing count');
assert.match(app, /skippedCandidateReasons/, 'V917 reports candidate skip reasons');
assert.match(app, /buildCrossingRenderSignature\(visibleCrossings = \[\], visibilityPolicy = null, bounds = null\)/, 'V917 render signature includes policy and viewport lifecycle inputs');
assert.match(app, /visibilityPolicy\?\.renderMode \|\| "unknown"/, 'V917 render signature changes when zoom policy stage changes');
assert.match(app, /boundsKey/, 'V917 render signature changes when viewport bounds change');

const start = app.indexOf('function gridlyCrossingVisibilityAudit()');
const end = app.indexOf('function shouldShowCrossingInfrastructureMarkers');
assert.ok(start > -1 && end > start, 'V917 slice boundaries found');

const visibleNode = {
  closest: () => ({ getBoundingClientRect: () => ({ width: 24, height: 24 }) }),
  getBoundingClientRect: () => ({ width: 24, height: 24 })
};

const sandbox = {
  window: {},
  document: { querySelectorAll: () => [visibleNode] },
  getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
  L: {},
  map: { getZoom: () => 17 },
  crossingLayer: { getLayers: () => [{}, {}] },
  crossings: [],
  exposeGridlyAuditHelper: (name, fn) => { sandbox[name] = fn; },
  gridlyGetActiveCountyId: () => 'liberty',
  gridlyGetActiveCountyCrossingInventory: () => ([
    { id: 'public-1', gridlyClassification: 'PUBLIC_ROADWAY', lat: 30, lng: -94 },
    { id: 'public-2', gridlyClassification: 'PUBLIC_ROADWAY', lat: 30.1, lng: -94.1 }
  ]),
  isGridlyReportableCrossing: () => true,
  renderCrossings: () => {},
  getCurrentCrossingInfrastructureZoom: () => 17,
  getGridlyRegionalCrossingVisibilityPolicy: ({ zoom = 17, inventoryCount = 2, activeCountyId = 'liberty' } = {}) => {
    const currentZoom = Number(zoom);
    if (!inventoryCount) return { currentZoom, activeCountyId, stage: 'empty-inventory', renderMode: 'none', allowMarkers: false, markerLimit: 0, useViewport: false };
    if (currentZoom < 12) return { currentZoom, activeCountyId, stage: 'county-view', renderMode: 'none', allowMarkers: false, markerLimit: 0, useViewport: false };
    if (currentZoom < 14) return { currentZoom, activeCountyId, stage: 'medium-zoom', renderMode: 'representative', allowMarkers: true, markerLimit: 80, useViewport: true };
    if (currentZoom < 15) return { currentZoom, activeCountyId, stage: 'neighborhood-zoom', renderMode: 'viewport-limited', allowMarkers: true, markerLimit: 160, useViewport: true };
    return { currentZoom, activeCountyId, stage: currentZoom >= 17 ? 'very-close-zoom' : 'street-zoom', renderMode: 'viewport-all', allowMarkers: true, markerLimit: null, useViewport: true };
  },
  getGridlyCrossingLayerMarkerCount: () => 2,
  buildSmartIncidentClusters: () => ({ hiddenIds: new Set(), leadCounts: new Map() })
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(`const DISTANT_CROSSING_MIN_ZOOM = 14; const CROSSING_INFRASTRUCTURE_MIN_ZOOM = 14; const GRIDLY_REGIONAL_CROSSING_VISIBILITY_POLICY = Object.freeze({ version: \"V829 regional-crossing-visibility\", mediumZoomMin: 12, neighborhoodZoomMin: 14, streetZoomMin: 15, veryCloseZoomMin: 17, mediumRepresentativeLimit: 80, neighborhoodViewportLimit: 160 });\n${app.slice(start, end)}`, sandbox, { filename: 'v917-crossing-visibility-slice.js' });

const audit = sandbox.gridlyCrossingVisibilityAudit();
assert.strictEqual(audit.available, true);
assert.strictEqual(audit.version, 'V917');
assert.strictEqual(audit.productionRuntimeDetected, true);
assert.strictEqual(audit.crossingLayerDetected, true);
assert.strictEqual(audit.minimumVisibleZoom, 12);
assert.strictEqual(audit.maximumVisibleZoom, null);
assert.strictEqual(audit.markersDisappearAtHighZoom, false);
assert.strictEqual(audit.protectedSystemsUnchanged, true);
assert.strictEqual(audit.onlyPublicRoadwayCrossingsInScope, true);
assert.strictEqual(audit.currentVisibilityStage, 'very-close-zoom');
assert.strictEqual(audit.currentPolicyAllowsMarkers, true);
assert.strictEqual(audit.crossingLayerMarkerCount, 2);
assert.strictEqual(audit.renderedCrossingMarkerCount, 2);
assert.strictEqual(audit.crossingMarkerDomCount, 1);
assert.strictEqual(audit.publicRoadwayCrossingCountForArea, 2);
assert.strictEqual(audit.expectedNearbyCrossingCount, 2);
assert.strictEqual(audit.visibleAtCurrentZoom, true);
assert.strictEqual(audit.renderPolicyAllowsCurrentZoom, true);
assert.strictEqual(audit.liveRenderMatchesPolicy, true);
assert.strictEqual(audit.possibleVisualStackingIssue, false);
assert.strictEqual(audit.possibleLifecycleRefreshIssue, false);
assert.strictEqual(audit.possibleLayerOwnershipIssue, false);
assert.strictEqual(audit.possibleViewportFilterIssue, false);
assert.strictEqual(audit.markersDisappearObserved, false);
assert.strictEqual(audit.streetZoomRepopulationAttempted, false);
assert.strictEqual(audit.streetZoomRepopulationSucceeded, false);
assert.strictEqual(audit.candidateCrossingCount, 0);
assert.strictEqual(audit.likelyDisappearanceCause, 'not_reproduced_by_current_audit_sample');
assert.ok(Array.isArray(audit.manualComparisonInstructions), 'manual comparison instructions are returned');

for (const section of ['Executive summary', 'Current visibility behavior', 'Zoom-level analysis', 'Marker lifecycle', 'Clustering behavior', 'Decluttering behavior', 'Layer ownership', 'Render ownership', 'High-zoom behavior', 'Low-zoom behavior', 'Live render mismatch diagnosis', 'Manual two-zoom audit instructions', 'Risks', 'Recommended fix', 'Final recommendation']) {
  assert.ok(doc.includes(section), `doc includes ${section}`);
}
assert.ok(doc.includes('window.gridlyCrossingVisibilityAudit?.()'), 'doc includes audit command');
assert.ok(doc.includes('minimumVisibleZoom: 12'), 'doc includes expected first visible zoom');
assert.ok(doc.includes('maximumVisibleZoom: null'), 'doc includes expected no max zoom');
assert.ok(doc.includes('liveRenderMatchesPolicy'), 'doc includes live render policy comparison');
assert.ok(doc.includes('markersDisappearObserved'), 'doc includes observed disappearance field');
assert.ok(doc.includes('streetZoomRepopulationSucceeded'), 'doc includes repopulation success field');
assert.ok(doc.includes('candidateCrossingCount'), 'doc includes candidate diagnostics');

console.log('V917 crossing visibility audit test passed');
