const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const start = source.indexOf('const GRIDLY_ROUTE_PANEL_ENCODING_ARTIFACT_GUARD_VERSION');
const end = source.indexOf('function findGridlyRoadDisplayInconsistencies', start);
assert(start > 0 && end > start, 'consumer text normalization block is present');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source.slice(start, end), sandbox);

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

const nestedStructuredLocation = {
  structuredDisplayLocation: {
    phrasing: '1 mile south of Livingston'
  }
};

assert.strictEqual(
  sandbox.normalizeGridlyUserFacingRoadText(nestedStructuredLocation),
  '1 mile south of Livingston',
  'nested structured location phrasing is rendered without raw field names'
);

assert(!/canonicalDisplayLocation|structuredDisplayLocation/.test(
  sandbox.normalizeGridlyUserFacingRoadText(structuredDisabledVehicleLocation)
), 'raw runtime location metadata is not exposed in consumer text');

assert(source.includes('canonicalDisplayLocation') && source.includes('structuredDisplayLocation') && source.includes('canonicalLocationPhrase'), 'technical metadata audit covers raw location field names');
