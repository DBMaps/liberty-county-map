const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const markup = fs.readFileSync('index.html', 'utf8');

assert(markup.includes('id="gridlyWelcomeCountySelect"'), 'County selector exists');
assert(markup.includes('data-gridly-county-select'), 'County selector has controlled data hook');
assert(/<option value="liberty-tx"[^>]*>Liberty County<\/option>/.test(markup), 'Liberty County is selectable');
assert(/<option value="montgomery-tx"[^>]*>Montgomery County<\/option>/.test(markup), 'Montgomery County is selectable');
assert(markup.includes('id="gridlyWelcomeHomeAreaSelect"'), 'Home-area dropdown exists');
assert(markup.includes('data-gridly-home-area-select'), 'Home-area dropdown has controlled data hook');

assert(source.includes('const GRIDLY_HOME_AREA_OPTIONS_BY_COUNTY = Object.freeze({'), 'County-scoped home-area option registry exists');
const optionsBlock = source.match(/const GRIDLY_HOME_AREA_OPTIONS_BY_COUNTY = Object\.freeze\(\{[\s\S]*?\n\}\);/)[0];
const libertyOptions = optionsBlock.match(/"liberty-tx": \[([\s\S]*?)\],/)[1];
const montgomeryOptions = optionsBlock.match(/"montgomery-tx": \[([\s\S]*?)\]/)[1];

['Entire Liberty County', 'Dayton', 'Liberty', 'Cleveland', 'Ames', 'Hardin', 'Devers', 'Hull', 'Daisetta', 'Moss Hill', 'Raywood', 'Kenefick', 'Tarkington'].forEach((area) => {
  assert(libertyOptions.includes(`"${area}"`) || (area === 'Entire Liberty County' && libertyOptions.includes('GRIDLY_COUNTY_WIDE_HOME_TOWN')), `${area} is a Liberty dropdown option`);
  assert(!montgomeryOptions.includes(`"${area}"`) && !montgomeryOptions.includes(`GRIDLY_COUNTY_WIDE_HOME_TOWN`), `${area} is excluded from Montgomery dropdown options`);
});

['Montgomery County', 'Conroe', 'The Woodlands', 'Magnolia', 'Willis', 'Montgomery', 'New Caney', 'Porter', 'Splendora', 'Other'].forEach((area) => {
  assert(montgomeryOptions.includes(`"${area}"`) || (area === 'Montgomery County' && montgomeryOptions.includes('GRIDLY_MONTGOMERY_COUNTY_WIDE_HOME_TOWN')), `${area} is a Montgomery dropdown option`);
  assert(!libertyOptions.includes(`"${area}"`) && !libertyOptions.includes('GRIDLY_MONTGOMERY_COUNTY_WIDE_HOME_TOWN'), `${area} is excluded from Liberty dropdown options`);
});

assert(source.includes('els.gridlyWelcomeCountySelect?.addEventListener("change"'), 'County selector is switchable through a change handler');
assert(source.includes('gridlyWelcomeSelectedCountyId = gridlyNormalizeCountyId(els.gridlyWelcomeCountySelect.value || GRIDLY_DEFAULT_COUNTY_ID);'), 'County change reads either Liberty or Montgomery selection');
assert(source.includes('const resetHomeArea = getGridlyDefaultHomeAreaForCounty(gridlyWelcomeSelectedCountyId);'), 'Changing county resets incompatible home-area selection');
assert(source.includes('saveGridlyHomeTownPreference(resetHomeArea, { source: "welcome_county_change" });'), 'County change persists the reset home area immediately');
assert(source.includes('els.gridlyWelcomeHomeAreaSelect?.addEventListener("change"'), 'Home-area dropdown persists selected area');
assert(source.includes('function gridlyIsHomeAreaValidForCounty(homeArea = "", countyId = GRIDLY_DEFAULT_COUNTY_ID)'), 'Home-area selection is validated against selected county');

assert(/key: "conroe", label: "Conroe", storageValue: "Conroe", countyId: "montgomery-tx"/.test(source), 'Montgomery County + Conroe resolves to montgomery-tx');
assert(/key: "dayton", label: "Dayton", storageValue: "Dayton"/.test(source), 'Liberty County + Dayton resolves to liberty-tx by default fallback');
assert(source.includes('return gridlyNormalizeCountyId(area?.countyId || GRIDLY_DEFAULT_COUNTY_ID);'), 'Blank/unknown awareness selection fails safe to Liberty, not Montgomery');
assert(source.includes('const GRIDLY_DEFAULT_COUNTY_ID = "liberty-tx";'), 'Liberty remains default when no county is selected');

assert(source.includes('County: ${countyLabel}. Awareness: ${awarenessLabel}.'), 'Completion/setup status shows county/home-area context');
assert(source.includes('identity.textContent = `${networkTown} Awareness Network`;'), 'Completion screen shows selected home-area context');
assert(source.includes('renderGridlyAwarenessMapIdentity("test-awareness-area-switcher")'), 'Main app awareness identity can render selected context');
assert(source.includes('countyLabel') && source.includes('awarenessLabel'), 'Main app context includes county/home-area labels');
assert(source.includes('const countyBounds = gridlyGetCountyBounds(gridlyResolveCountyIdForAwarenessArea(area.storageValue));'), 'Map context uses selected county bounds');
assert(source.includes('const raw = normalized === "montgomery-tx" ? MONTGOMERY_COUNTY_AWARENESS_BOUNDS : LIBERTY_COUNTY_AWARENESS_BOUNDS;'), 'Montgomery map context does not remain centered over Liberty');

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

console.log('COUNTY HOME AREA DROPDOWN FIX COMPLETE');
