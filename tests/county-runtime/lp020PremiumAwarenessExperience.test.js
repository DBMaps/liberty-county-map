const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/styles.css', 'utf8');

assert(app.includes('function gridlyLp020PremiumAwarenessAudit()'), 'LP020 audit helper exists');
assert(app.includes('window.gridlyLp020PremiumAwarenessAudit = gridlyLp020PremiumAwarenessAudit'), 'LP020 audit helper is exposed');

assert(!/data-unified-action="view-area"[^>]*>View Area<\/button>/.test(app), 'VIEW AREA removed from unified/community popup actions');
assert(app.includes('Confirm Active') && app.includes('Mark Cleared'), 'community popup actions preserved with concise labels');
assert(app.includes('gridly-popup-meta') && app.includes('gridly-popup-trust'), 'community popup uses compact metadata and trust hierarchy');

const officialPopup = app.slice(app.indexOf('function gridlyLp019OfficialPopupHtml'), app.indexOf('function gridlyLp019PointAudit'));
['provider payload', 'provider IDs', 'JSON', 'normalization fields', 'future_source', 'gridly_structured', 'technical metadata'].forEach((term) => {
  assert(!officialPopup.toLowerCase().includes(term.toLowerCase()), `official popup omits ${term}`);
});
assert(officialPopup.includes('Official roadway condition'), 'official popup includes consumer trust line');
assert(!officialPopup.includes('popup-report-btn'), 'official popup does not add community confirmation controls');

assert(app.includes('record?.namedCrossing') && app.includes('record?.roadCrossingName'), 'best available location prefers crossing names');
assert(app.includes('record?.canonicalDisplayLocation') && app.includes('record?.canonicalLocationPhrase'), 'best available location prefers canonical display fields');
assert(app.includes('record?.authoritativeLocationLabel'), 'best available location considers authoritative labels');
assert(app.includes('source: "countyFallback"'), 'county fallback still works and is traceable');
assert(app.includes('function gridlyLp020LocationPresentationTrace()'), 'LP020 location presentation trace exists');
assert(app.includes('selectedLocationCandidate') && app.includes('strongestTrustedLocationLostBeforePresentation'), 'trace compares selected and rendered location fields');

assert(css.includes('gridly-official-roadway-marker-icon .gridly-official-roadway-marker'), 'official marker styling refined');
assert(css.includes('content: "i"') && css.includes('border-radius: 8px 8px 11px 11px'), 'official marker uses recognizable shield/info treatment');
assert(css.includes('white-space: nowrap'), 'community action labels resist awkward wrapping');
assert(app.includes('className: "gridly-official-roadway-marker-icon"'), 'official marker owner remains distinct');
assert(app.includes('class="gridly-popup gridly-premium-popup" data-gridly-hazard-popup="consumer"'), 'community popup ownership retained and styled');
assert(!css.includes('.gridly-hazard-marker.has-production-marker {\n  background: radial-gradient(circle at 35% 30%, rgba(219, 234, 254'), 'community marker styling unchanged by LP020 official marker CSS');

assert(app.includes('GRIDLY_HAZARD_POPUP_TECHNICAL_METADATA_PATTERN'), 'LP017 metadata sanitization pattern still present');
assert(app.includes('consumerLanguagePass'), 'LP018 consumer language audit coverage still present');
assert(app.includes('gridlyLp019BindAlertFocusHandlers'), 'LP019 alert focus architecture still present');

assert(app.includes('communityPopupOwner') && app.includes('crossingPopupOwner') && app.includes('officialPopupOwner'), 'LP020 audit reports popup ownership findings');
console.log('LP020 premium awareness presentation regression checks passed');
