const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const normalizationStart = source.indexOf('const GRIDLY_ROUTE_PANEL_ENCODING_ARTIFACT_GUARD_VERSION');
const normalizationEnd = source.indexOf('function findGridlyRoadDisplayInconsistencies', normalizationStart);
assert(normalizationStart > 0 && normalizationEnd > normalizationStart, 'consumer text normalization block is present');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source.slice(normalizationStart, normalizationEnd), sandbox);

const structuredDisabledVehicleLocation = {
  canonicalDisplayLocation: '1 mile south of Livingston',
  structuredDisplayLocation: {
    canonicalDisplayLocation: 'canonicalDisplayLocation should not render',
    phrasing: 'structuredDisplayLocation should not render'
  }
};

assert.strictEqual(
  sandbox.normalizeGridlyUserFacingRoadText(structuredDisabledVehicleLocation),
  '1 mile south of Livingston',
  'Disabled Vehicle presentation uses consumer-facing canonical display location from runtime objects'
);

const cardStart = source.indexOf('const GRIDLY_HAZARD_POPUP_TECHNICAL_METADATA_PATTERN');
const cardEnd = source.indexOf('function gridlyRoadHazardLocationConsistencyAudit', cardStart);
assert(cardStart > 0 && cardEnd > cardStart, 'alert card consumer presentation block is present');

const cardSandbox = {
  window: {},
  console,
  GRIDLY_HAZARD_POPUP_TECHNICAL_METADATA_PATTERN: undefined,
  normalizeGridlyUserFacingRoadText: sandbox.normalizeGridlyUserFacingRoadText,
  normalizeGridlyCountyAwareDisplayText: (value) => sandbox.normalizeGridlyUserFacingRoadText(value),
  normalizeGridlyLightweightLocationLabelText: (value) => sandbox.normalizeGridlyUserFacingRoadText(value),
  standardizeGridlyAlertHeadline: (value) => sandbox.normalizeGridlyUserFacingRoadText(value),
  getHazardCategory: (value) => String(value || '').toLowerCase() === 'disabled_vehicle' ? 'disabled_vehicle' : String(value || 'other_hazard').toLowerCase(),
  formatRoadHazardCategoryLabel: (category) => category === 'disabled_vehicle' ? 'Disabled Vehicle' : 'Road Hazard',
  HAZARD_TYPES: { disabled_vehicle: { label: 'Disabled Vehicle' }, other_hazard: { label: 'Road Hazard' } },
  resolveOtherHazardSubtypeFromRecord: () => '',
  getOtherHazardSubtypeLabel: () => 'Other Hazard',
  getGridlySpecificCrossingLocation: () => null,
  isGridlyAlertRailOrCrossingRelated: () => false,
  getSharedResolvedRoadLookup: () => ({ locationContext: { primary: '', phrasing: '' } }),
  buildGridlyRoadHazardTxDotStyleCandidate: () => ({ text: '' }),
  buildGridlyCanonicalRoadHazardDisplayLocation: (record) => record.canonicalDisplayLocation || '',
  gridlyResolveCountyAwareFallbackLocation: () => 'Polk County',
  gridlyIsInvalidCountyAwareRoadLabel: (value) => /^(?:this area|nearby|unknown|undefined|null)$/i.test(String(value || '').trim()),
  gridlyBuildCountyAwareLocationPhrase: () => 'near Polk County',
  gridlyNowMs: () => 0,
  gridlyAddPopupAuditDuration: () => {},
  recordOtherHazardRenderedAlert: () => {}
};
vm.createContext(cardSandbox);
vm.runInContext(source.slice(cardStart, cardEnd), cardSandbox);

const leakingObject = {
  future_s: 'do-not-render',
  bidot_incident: true,
  gridly_structured: true,
  canonicalDisplayLocation: '1 mile south of Livingston',
  canonicalLocationPhrase: '1 mile south of Livingston',
  authoritativeLocationLabel: 'Polk County',
  structuredDisplayLocation: { phrasing: '1 mile south of Livingston' }
};
const disabledVehicleAlert = {
  id: 'lp017-disabled-vehicle',
  type: 'disabled_vehicle',
  report_type: 'disabled_vehicle',
  title: 'Disabled Vehicle',
  location: leakingObject,
  locationLabel: 'Polk County',
  canonicalDisplayLocation: '1 mile south of Livingston',
  canonicalLocationPhrase: '1 mile south of Livingston',
  authoritativeLocationLabel: 'Polk County',
  structuredDisplayLocation: { phrasing: '1 mile south of Livingston' },
  description: `Shared report disabled vehicle may slow travel. ${JSON.stringify(leakingObject)}`,
  minutesAgo: 10,
  reports_count: 1
};

const model = cardSandbox.buildGridlyAlertCardConsumerModel(disabledVehicleAlert, { fallbackTitle: 'Disabled Vehicle' });
const visibleOutput = [model.title, model.locationLine, model.freshnessLine, model.reportCountLine, model.trustLine, model.freshnessCountLine].join(' ');
assert.strictEqual(model.title, 'Disabled Vehicle', 'actual Alert Card model keeps disabled vehicle title');
assert.strictEqual(model.locationLine, '1 mile south of Livingston', 'actual Alert Card model prefers canonical consumer location over county text');
assert(visibleOutput.includes('Awaiting additional reports'), 'actual Alert Card model keeps trust line');
assert(!/Polk County/.test(model.locationLine), 'specific consumer location suppresses redundant county location line');
assert(!/canonicalDisplayLocation|structuredDisplayLocation|canonicalLocationPhrase|authoritativeLocationLabel|future_s|bidot_incident|gridly_structured|\[object Object\]|\{\s*"/.test(visibleOutput), 'actual Alert Card visible output does not leak structured object metadata or JSON-like content');

assert(source.includes('canonicalDisplayLocation') && source.includes('structuredDisplayLocation') && source.includes('canonicalLocationPhrase'), 'technical metadata audit covers raw location field names');
console.log('LP017 consumer presentation refinement regression passed');
