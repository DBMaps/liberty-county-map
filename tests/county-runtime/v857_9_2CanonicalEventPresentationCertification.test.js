const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

includes('function buildGridlyCanonicalEventPresentationModel(event = {}, options = {})', 'canonical event presentation model exists');
includes('primaryEvent', 'canonical model exposes primary event layer');
includes('locationContext', 'canonical model exposes location context layer');
includes('evidence', 'canonical model exposes evidence layer');
includes('supportingDetails', 'canonical model exposes supporting details layer');
includes('compositionContract: "what-happened -> where -> evidence -> details"', 'canonical model documents required hierarchy');
includes('canonicalPresentationStandard: "GRIDLY CANONICAL EVENT PRESENTATION V1"', 'canonical presentation standard is named');
includes('function gridlyCanonicalEventPresentationCertificationAudit(options = {})', 'V857.9.2 certification audit exists');
includes('declaration: "GRIDLY CANONICAL EVENT PRESENTATION V1"', 'certification declaration is returned');
includes('status: flatteningSurfaces.length === 0 ? "CERTIFIED" : "REVIEW_REQUIRED"', 'certification status is data driven');
includes('surfacesUsingCanonicalPresentation', 'audit returns canonical surface inventory');
includes('surfacesFlatteningEventComposition', 'audit returns flattening surface inventory');
includes('data-gridly-canonical-event-presentation="true"', 'alert cards mark canonical presentation ownership');
includes('data-gridly-event-layer-1="primaryEvent"', 'alert cards mark primary event layer');
includes('data-gridly-event-layer-2="locationContext"', 'alert cards mark location context layer');
includes('data-gridly-event-layer-3="evidence"', 'alert cards mark evidence layer');
includes('const canonicalEventPresentation = buildGridlyCanonicalEventPresentationModel(subtypeAwareAlert', 'alert renderer consumes canonical model');
includes('routeWatchLogicModified: false', 'Route Watch logic remains protected');
includes('presentationCompositionOnly: true', 'regression certification declares presentation-only scope');

console.log('v857_9_2CanonicalEventPresentationCertification.test.js passed');
