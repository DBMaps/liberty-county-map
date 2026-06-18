const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const markup = fs.readFileSync('index.html', 'utf8');

assert(markup.includes('<h2>Choose Your County</h2>'), 'setup has county selection step');
assert(markup.includes('data-gridly-county="liberty-tx"') && markup.includes('>Liberty County</button>'), 'Liberty County appears in county selection');
assert(markup.includes('data-gridly-county="montgomery-tx"') && markup.includes('>Montgomery County</button>'), 'Montgomery County appears in county selection');
assert(markup.includes('<h3 class="gridly-welcome-subtitle">Choose Your Home Area</h3>'), 'setup has home-area selection step');
assert(markup.includes('data-gridly-home-area-group="liberty-tx"'), 'Liberty home-area group exists');
assert(markup.includes('data-gridly-home-area-group="montgomery-tx"'), 'Montgomery home-area group exists');

const libertyGroup = markup.match(/data-gridly-home-area-group="liberty-tx"[\s\S]*?<\/div>/)[0];
const montgomeryGroup = markup.match(/data-gridly-home-area-group="montgomery-tx"[\s\S]*?<\/div>/)[0];
['Dayton', 'Liberty', 'Cleveland', 'Ames', 'Hardin', 'Devers', 'Hull', 'Daisetta', 'Moss Hill', 'Raywood', 'Kenefick', 'Tarkington', 'Entire Liberty County'].forEach((area) => {
  assert(libertyGroup.includes(`data-gridly-town="${area}"`), `${area} appears only after Liberty county selection`);
  assert(!montgomeryGroup.includes(`data-gridly-town="${area}"`), `${area} is not mixed into Montgomery home-area list`);
});
['Montgomery County', 'Conroe', 'The Woodlands', 'Magnolia', 'Willis', 'Montgomery', 'New Caney', 'Porter', 'Splendora', 'Other'].forEach((area) => {
  assert(montgomeryGroup.includes(`data-gridly-town="${area}"`), `${area} appears only after Montgomery county selection`);
});
['Conroe', 'The Woodlands', 'Magnolia', 'Willis', 'Montgomery', 'New Caney', 'Porter', 'Splendora'].forEach((area) => {
  const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`storageValue: "${escaped}", countyId: "montgomery-tx"`).test(source), `${area} resolves to montgomery-tx`);
});
['Dayton', 'Liberty', 'Cleveland', 'Ames', 'Hardin', 'Devers'].forEach((area) => {
  const escaped = area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`key: "[^"]+", label: "${escaped}", storageValue: "${escaped}"`).test(source), `${area} remains a Liberty home area`);
});
assert(source.includes('return gridlyNormalizeCountyId(area?.countyId || GRIDLY_DEFAULT_COUNTY_ID);'), 'unknown area does not resolve to Montgomery');
assert(source.includes('const GRIDLY_DEFAULT_COUNTY_ID = "liberty-tx";'), 'Liberty remains default fallback');
assert(source.includes('function gridlySetActiveCountyContext(countyId = GRIDLY_DEFAULT_COUNTY_ID)') && source.includes('window.GRIDLY_ACTIVE_COUNTY_ID = normalized'), 'setup persists active county context');
assert(source.includes('const MONTGOMERY_COUNTY_AWARENESS_BOUNDS = {') && source.includes('function getGridlyMontgomeryCountyBounds()'), 'Montgomery map context has a county bounds fallback');
assert(source.includes('gridlyGetCountyBounds(gridlyResolveCountyIdForAwarenessArea(homeTownAnchor.storageValue))'), 'map context fits selected county bounds instead of Liberty-only bounds');
assert(source.includes('County: ${countyLabel}. Awareness: ${awarenessLabel}.'), 'awareness labels include consistent county and awareness state');

[
  'historicalReadsEnabled: false',
  'historyUiEnabled: false',
  'historicalApiExposure: false',
  'consumerFacingHistoryDashboard: false',
  'DriveTexasPaused: true',
  'TransportationIntelligenceEnabled: false',
  'TransportationIntelligenceDisplay: false',
  'TransportationIntelligenceActivation: false'
].forEach((needle) => assert(source.includes(needle), `Protected boundary unchanged: ${needle}`));

console.log('COUNTY-FIRST AWARENESS SETUP COMPLETE');
