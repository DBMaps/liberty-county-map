const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

includes('function gridlyLocationTruthAudit(options = {})', 'V869 location truth audit exists');
includes('window.gridlyLocationTruthAudit = gridlyLocationTruthAudit;', 'browser audit is exposed');
includes('exposeGridlyAuditHelper("gridlyLocationTruthAudit", gridlyLocationTruthAudit);', 'audit helper is exposed');
includes('available: true', 'audit reports availability');
includes('headlineUsesHazardLocation', 'audit reports headline hazard-location ownership');
includes('briefUsesHazardLocation', 'audit reports expanded brief hazard-location ownership');
includes('popupUsesHazardLocation', 'audit reports popup hazard-location ownership');
includes('alertUsesHazardLocation', 'audit reports alert hazard-location ownership');
includes('locationContextUsesAwarenessArea', 'audit reports Location Context awareness-area ownership');
includes('reportLocationSeparated', 'audit reports report-location separation');
includes('mixedLocationDetected', 'audit detects mixed location wording');
includes('canonicalContextPass', 'audit reports canonical context pass state');
includes('sourceInventory: surfaceInventory', 'audit returns location source inventory');
includes('presents: "Hazard location"', 'inventory labels hazard-location surfaces');
includes('presents: "Awareness Area"', 'inventory labels Location Context as Awareness Area');
includes('presents: "Report location"', 'inventory labels community report wording separately');
includes('const authoritativeHazardLocation = typeof resolveGridlyRoadHazardAuthoritativeLocationLabel === "function"', 'canonical event model resolves authoritative hazard location');
includes('const hazardLocationLine = authoritativeHazardLocation', 'canonical event model builds hazard-location line');
includes('hazardLocationLine || cardModel?.locationLine', 'hazard location takes precedence over report/location metadata');
includes('authoritativeHazardLocation || cardModel?.locationLabel', 'location label prioritizes authoritative hazard location');
includes('v865CanonicalAwarenessPass', 'V865 canonical awareness audit remains protected');
includes('v867ControlRailPass', 'V867 control rail audit remains protected');
includes('v868BriefPass', 'V868 Brief audit remains protected');
includes('marker placement unchanged', 'audit documents marker placement is unchanged');

console.log('v869LocationTruthAudit.test.js passed');
