const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(needle, message) {
  assert(source.includes(needle), message);
}

includes('const GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS = Object.freeze(["liberty-tx", "montgomery-tx"]);', 'overlay is scoped to Liberty and Montgomery only');
includes('map.createPane("countyBoundaryOverlayPane")', 'dedicated county boundary overlay pane is created');
includes('map.getPane("countyBoundaryOverlayPane").style.zIndex = 425;', 'county boundary overlay pane sits above base tiles and below awareness/marker panes');
includes('map.getPane("countyBoundaryOverlayPane").style.pointerEvents = "none";', 'county boundary pane does not intercept marker clicks');
includes('gridlyCountyBoundaryOverlayLayer = L.layerGroup().addTo(map);', 'dedicated overlay layer group is added to the map');
includes('function getGridlyCountyBoundaryOverlayStyle(countyId = GRIDLY_DEFAULT_COUNTY_ID)', 'overlay has a dedicated county-aware style helper');
includes('weight: active ? 4.25 : passiveCountyWeight', 'active county style is visibly stronger than passive county style');
includes('dashArray: active ? "" : "3 12"', 'passive county style differs from active county style');
includes('interactive: false', 'boundary polygons are non-interactive');
includes('function renderGridlyCountyBoundaryOverlay(reason = "unknown")', 'overlay render helper exists');
includes('renderGridlyCountyBoundaryOverlay("active-county-change")', 'active boundary emphasis refreshes when active county changes');
includes('async function loadGridlyCountyBoundaryOverlay()', 'overlay loader exists');
includes('GRIDLY_STANDARD_TEXAS_COUNTY_BOUNDARY_SOURCE_PATH', 'overlay uses the standard Texas county boundary asset');
includes('usesStatewidePayload: true', 'audit reports statewide payload usage');
includes('payloadScope: GRIDLY_STANDARD_TEXAS_COUNTY_BOUNDARY_PAYLOAD_SCOPE', 'audit reports the standard Texas county payload scope');
includes('window.gridlyCountyBoundaryOverlayAudit = gridlyCountyBoundaryOverlayAudit;', 'audit helper is exposed on window');
includes('safeForCountyBoundaryOverlay:', 'audit exposes safeForCountyBoundaryOverlay');
includes('activeCountyBbox:', 'audit reports active county bbox');
includes('renderedLayerCount:', 'audit reports rendered layer count');
includes('activeLayerOnMap:', 'audit reports active layer map presence');
includes('passiveLayersOnMap,', 'audit reports passive layers on map');
includes('passiveCountyRenderMode: "statewide_suppressed"', 'audit reports statewide suppressed passive render mode');
includes('activeCountyVisualDominancePass,', 'audit reports active county visual dominance');
includes('passiveCountyVisualSuppressionPass,', 'audit reports passive county suppression');
includes('safeForCountyBoundaryVisualRefinement:', 'audit exposes safe visual refinement state');
includes('activeCountyFillEnabled: Boolean(activeStyle.fill)', 'audit reports active fill state');
includes('passiveCountyOpacity: passiveStyle.opacity', 'audit reports passive opacity');
includes('passiveCountyWeight: passiveStyle.weight', 'audit reports passive weight');

console.log('v637bCountyBoundaryOverlay.test.js passed');
