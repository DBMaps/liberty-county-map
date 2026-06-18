const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const markup = fs.readFileSync('index.html', 'utf8');

assert(markup.includes('id="gridlyWelcomeCountySelect"'), 'County selector appears in onboarding Awareness Area setup');
assert(markup.includes('id="gridlyWelcomeHomeAreaSelect"'), 'Home-area dropdown appears in onboarding Awareness Area setup');
const homeAreaOptionsBlock = source.match(/const GRIDLY_HOME_AREA_OPTIONS_BY_COUNTY = Object\.freeze\(\{[\s\S]*?\n\}\);/)[0];
const requiredOnboardingOptions = ['Entire Liberty County', 'Dayton', 'Montgomery County', 'Conroe', 'The Woodlands', 'Magnolia', 'Willis', 'Montgomery', 'New Caney', 'Porter', 'Splendora'];
requiredOnboardingOptions.forEach((option) => {
  assert(homeAreaOptionsBlock.includes(`"${option}"`) || (option === 'Entire Liberty County' && homeAreaOptionsBlock.includes('GRIDLY_COUNTY_WIDE_HOME_TOWN')) || (option === 'Montgomery County' && homeAreaOptionsBlock.includes('GRIDLY_MONTGOMERY_COUNTY_WIDE_HOME_TOWN')), `${option} appears in controlled onboarding Awareness Area setup`);
});

assert(source.includes('const GRIDLY_AWARENESS_AREA_DEFINITIONS = ['), 'Awareness setup options are runtime awareness-area definitions');
assert(source.includes('const GRIDLY_HOME_TOWN_OPTIONS = GRIDLY_AWARENESS_AREA_DEFINITIONS.map((area) => area.storageValue);'), 'Home-town/setup options are awareness-area driven');
assert(source.includes('GRIDLY_COUNTY_WIDE_HOME_TOWN = "Entire Liberty County"'), 'Liberty County remains the county-wide setup default option');
assert(source.includes('key: "dayton", label: "Dayton", storageValue: "Dayton"'), 'Dayton awareness option is preserved');

assert(source.includes('storageValue: GRIDLY_MONTGOMERY_COUNTY_WIDE_HOME_TOWN, countyId: "montgomery-tx"'), 'Montgomery County is available and resolves to montgomery-tx');
const montgomeryOptions = ['Conroe', 'The Woodlands', 'Magnolia', 'Willis', 'Montgomery', 'New Caney', 'Porter', 'Splendora'];
montgomeryOptions.forEach((option) => {
  const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const areaPattern = new RegExp(`storageValue: "${escaped}", countyId: "montgomery-tx"`);
  assert(areaPattern.test(source), `${option} is available and resolves to montgomery-tx`);
});

assert(source.includes('function gridlyResolveCountyIdForAwarenessArea'), 'Awareness-area selections expose county-id resolution');
assert(source.includes('return gridlyNormalizeCountyId(area?.countyId || GRIDLY_DEFAULT_COUNTY_ID);'), 'Unknown/no county awareness selection falls back to Liberty default');
assert(source.includes('const montgomeryCountyAliases = new Set(["montgomery county", "entire montgomery county", "all montgomery county"]);'), 'Montgomery County aliases resolve county-first selection');
assert(source.includes('settingsCommunity: settings.community'), 'Awareness setup test helper reports stored settings community state');
assert(source.includes('resolvedCountyId: gridlyResolveCountyIdForAwarenessArea(area.storageValue)'), 'Selecting Montgomery reports montgomery-tx in setup test helper output');

assert(source.includes('"montgomery-tx": Object.freeze({'), 'Montgomery runtime registry entry is present');
assert(source.includes('stage: GRIDLY_COUNTY_STAGE_OPERATIONAL'), 'Operational registry stages remain present');
assert(source.includes('selectable: true'), 'Selectable runtime registry fields remain present');

const protectedBoundaryNeedles = [
  'historicalReadsEnabled: false',
  'historyUiEnabled: false',
  'historicalApiExposure: false',
  'consumerFacingHistoryDashboard: false',
  'DriveTexasPaused: true',
  'TransportationIntelligenceEnabled: false',
  'TransportationIntelligenceDisplay: false',
  'TransportationIntelligenceActivation: false'
];
protectedBoundaryNeedles.forEach((needle) => assert(source.includes(needle), `Protected boundary unchanged: ${needle}`));

console.log('MONTGOMERY AWARENESS SETUP INTEGRATION COMPLETE');
