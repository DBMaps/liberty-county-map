import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const doc = fs.readFileSync('docs/LP051-7-ZIP-PERSONALIZATION-PRODUCTION-INTEGRATION.md', 'utf8');

assert.match(app, /function buildSettingsSurfaceHtml\(\)[\s\S]*data-gridly-lp0517-settings-home="true"[\s\S]*Home area[\s\S]*Home ZIP[\s\S]*settings-change-home-zip[\s\S]*Current view[\s\S]*Change Area[\s\S]*settings-choose-available-areas[\s\S]*Choose from available areas/, 'Portrait V2 Settings must visibly render Home ZIP management and the search-first available-area fallback');
assert.match(app, /function getGridlyLp0517SettingsHomeDisplay\(\)[\s\S]*gridlyReadHomePersonalizationRecord[\s\S]*consumerLabel[\s\S]*countyName[\s\S]*zip[\s\S]*Not set/, 'Settings home display must prefer canonical consumerLabel/countyName/zip and fall back to existing manual setup as Not set');
assert.match(app, /"settings-change-home-zip"[\s\S]*gridlyOpenLp0516ZipConfirmationPrototype/, 'Change home ZIP must open the LP051.7 ZIP confirmation flow');
assert.match(app, /"settings-choose-available-areas"[\s\S]*openGridlySettingsAvailableAreaPicker/, 'Choose from available areas must open the shared search-first awareness picker');
assert.match(app, /visibleSettingsSurfaceDetected[\s\S]*homeAreaVisible[\s\S]*homeZipVisible[\s\S]*savedZipVisibleInSettings[\s\S]*settingsZipManagementPass/, 'Production audit must inspect visible Settings DOM fields');
assert.doesNotMatch(app.match(/function buildSettingsSurfaceHtml\(\)[\s\S]*?return html;/)?.[0] || '', /countyId|communityKey|awarenessAreaKey|resolutionStatus|sourceVersion|schemaVersion/, 'Visible Settings renderer must not leak internal canonical keys');
assert.match(html, /settingsChangeAwarenessAreaBtn[\s\S]*Choose from available areas/, 'Legacy Settings modal fallback must retain ZIP/town-first area search and the search-first fallback');
assert.match(app, /Home area[\s\S]*Home ZIP[\s\S]*(Change home ZIP|Add home ZIP)/, 'Portrait V2 Settings must retain visible Home ZIP management');
assert.match(app, /countyWide !== true[\s\S]*setGridlySettingsAwarenessChooserOpen/, 'County-wide viewing/manual chooser path must remain available');
assert.match(doc, /root cause[\s\S]*Portrait V2 Settings[\s\S]*Home versus Current View[\s\S]*County-wide viewing/i, 'LP051.7 documentation must describe root cause, renderer, home/current distinction, and county-wide preservation');
assert.doesNotMatch(app, /routeIntelligenceTouched:\s*true/, 'LP051.7 must not mark Route Intelligence touched');
console.log('LP051.7R1 Settings ZIP management regression passed');
