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
includes('weight: active ? 3.25 : 1.5', 'active county style is visibly stronger than passive county style');
includes('dashArray: active ? "" : "8 10"', 'passive county style differs from active county style');
includes('interactive: false', 'boundary polygons are non-interactive');
includes('function renderGridlyCountyBoundaryOverlay(reason = "unknown")', 'overlay render helper exists');
includes('renderGridlyCountyBoundaryOverlay("active-county-change")', 'active boundary emphasis refreshes when active county changes');
includes('async function loadGridlyCountyBoundaryOverlay()', 'overlay loader exists');
includes('GRIDLY_COUNTY_REGISTRY[countyId]?.boundaryPath', 'overlay reuses county registry boundary assets');
includes('usesStatewidePayload: false', 'audit reports no statewide payload');
includes('payloadScope: "supported_counties_only:liberty-tx,montgomery-tx"', 'audit reports the phase-1 payload scope');
includes('window.gridlyCountyBoundaryOverlayAudit = gridlyCountyBoundaryOverlayAudit;', 'audit helper is exposed on window');
includes('safeForCountyBoundaryOverlay:', 'audit exposes safeForCountyBoundaryOverlay');
includes('activeCountyBbox:', 'audit reports active county bbox');
includes('renderedLayerCount:', 'audit reports rendered layer count');
includes('activeLayerOnMap:', 'audit reports active layer map presence');
includes('passiveLayersOnMap,', 'audit reports passive layers on map');

console.log('v637bCountyBoundaryOverlay.test.js passed');
