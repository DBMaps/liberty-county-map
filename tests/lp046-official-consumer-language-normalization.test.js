const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const normalizerSource = app.slice(app.indexOf('function gridlyOfficialConsumerSentenceCase'), app.indexOf('const GRIDLY_OFFICIAL_FRESHNESS_REASONABLE_MAX_MINUTES'));
const popupSource = app.match(/function gridlyLp0393ConsumerDriveTexasPopupHtml[\s\S]*?\n}\n/)?.[0] || '';

assert(app.includes('function gridlyNormalizeOfficialConsumerLanguage'), 'reusable LP046 official consumer-language normalizer exists');
assert(app.includes('sourceLocationDescription: gridlyNormalizeOfficialConsumerLanguage') && app.includes('normalizedDescription: gridlyNormalizeOfficialConsumerLanguage'), 'official summaries reuse the normalizer');
assert(app.includes('gridlyBuildTravelBriefModel'), 'Travel Brief ownership model remains present');
assert(app.includes('gridlyEvaluateDriveTexasGeographicOwnership'), 'LP039 authority remains unchanged');
assert(app.includes('renderGridlyDriveTexasOfficialMarkers'), 'official marker rendering remains unchanged');
assert(app.includes('focusPulseApplied'), 'marker focus/pulse audit remains unchanged');
assert(popupSource.includes('Official Source · DriveTexas'), 'popup still includes Official Source · DriveTexas');

const context = {
  String,
  RegExp,
  window: {},
  sanitizeText(value) { return String(value || '').replace(/[<>]/g, ''); },
  gridlyLp0393OfficialPopupFreshnessLine() { return 'Updated just now'; }
};
vm.createContext(context);
vm.runInContext(`${normalizerSource}\n${popupSource}`, context);

const construction = context.gridlyNormalizeOfficialConsumerLanguage(
  'US 59, MAIN LANES not affected.<br/><br/>FOR THE CONSTRUCTION OF safety improvement projects consisting of installing cable median barrier.',
  { routeName: 'US 59' }
);
assert(!/[<>]|<br|&lt;br/i.test(construction), 'HTML remnants remain absent');
assert(construction.includes('US 59'), 'roadway names are preserved');
assert(!construction.includes('MAIN LANES'), 'all-caps provider text becomes sentence case where appropriate');
assert(!/FOR THE CONSTRUCTION OF/.test(construction), 'provider construction boilerplate is simplified');
assert(/Main lanes remain open/i.test(construction), 'official lane meaning is preserved');
assert(/Crews are installing a cable median barrier/i.test(construction), 'construction wording becomes consumer-friendly');

const closure = context.gridlyNormalizeOfficialConsumerLanguage('US 59 alternating lanes closed. Motorists should expect delays.', { routeName: 'US 59' });
assert(closure.includes('US 59'), 'closure roadway name is preserved');
assert(/Alternating lane closures/i.test(closure), 'Road Closed wording becomes consumer-friendly');
assert(closure.includes('Expect delays.'), 'lane-status boilerplate is simplified without changing meaning');

const shouted = context.gridlyNormalizeOfficialConsumerLanguage('ALL LANES CLOSED ON FM 1960. MOTORISTS SHOULD EXPECT DELAYS.', { routeName: 'FM 1960' });
assert(!/ALL LANES|MOTORISTS SHOULD/i.test(shouted), 'all-caps transportation-agency wording is normalized');
assert(shouted.includes('FM 1960'), 'FM roadway formatting remains recognizable');

const popup = context.gridlyLp0393ConsumerDriveTexasPopupHtml({
  headline: 'Construction',
  routeName: 'US 59',
  category: 'Construction',
  description: 'US 59, MAIN LANES not affected.<br/>Construction of safety improvement projects consisting of installing cable median barrier.'
});
assert(popup.includes('Official Source · DriveTexas'), 'popup attribution remains unchanged');
assert(!/<\s*br|&lt;\s*br/i.test(popup) && !/MAIN LANES|FOR THE CONSTRUCTION/.test(popup), 'popup uses normalized consumer description');
assert(popup.includes('US 59'), 'popup preserves roadway names');

console.log('LP046 official consumer language normalization regression checks passed');
