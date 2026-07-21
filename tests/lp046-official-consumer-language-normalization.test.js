const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const normalizerSource = app.slice(app.indexOf('function gridlyOfficialConsumerNormalizeRouteIdentifier'), app.indexOf('const GRIDLY_OFFICIAL_FRESHNESS_REASONABLE_MAX_MINUTES'));
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


assert.strictEqual(context.gridlyNormalizeOfficialConsumerLanguage('US0059', {}), 'US 59.', 'compact US route IDs are expanded');
assert.strictEqual(context.gridlyNormalizeOfficialConsumerLanguage('US 0059', {}), 'US 59.', 'zero-padded US route IDs are normalized');
assert.strictEqual(context.gridlyNormalizeOfficialConsumerLanguage('US 59', {}), 'US 59.', 'valid US route IDs remain stable');
assert.strictEqual(context.gridlyNormalizeOfficialConsumerLanguage('FM 1960', {}), 'FM 1960.', 'valid FM route IDs remain stable');
assert.strictEqual(
  context.gridlyNormalizeOfficialConsumerLanguage('FOR THE CONSTRUCTION OF SAFETY IMPROVEMENT PROJECTS CONSISTING OF INSTALL CALE MEDIAN BARRIER.', { routeName: 'US0059' }),
  'Crews are installing a cable median barrier.',
  'known CALE median-barrier typo is repaired only through the official construction phrase'
);
assert.strictEqual(
  context.gridlyNormalizeOfficialConsumerLanguage('CALE MEDIAN BARRIER near US0059.', { routeName: 'US0059' }),
  'CALE MEDIAN BARRIER near US 59.',
  'CALE typo is not corrected by broad spelling cleanup outside the known phrase'
);
assert.strictEqual(
  context.gridlyNormalizeOfficialConsumerLanguage('US0059, Alternating lanes closed.<br/> Motorists should expect delays.<br/>FOR THE CONSTRUCTION OF SAFETY IMPROVEMENT PROJECTS CONSISTING OF INSTALL CALE MEDIAN BARRIER', { routeName: 'US0059' }),
  'Alternating lane closures on US 59. Expect delays while crews install a cable median barrier.',
  'Road Closed language uses concise final official wording'
);
assert.strictEqual(
  context.gridlyNormalizeOfficialConsumerLanguage('US 0059, MAIN LANES not affected.<br/>Construction of safety improvement projects consisting of installing cable median barrier.', { routeName: 'US 0059' }),
  'US 59 main lanes remain open. Crews are installing a cable median barrier.',
  'Construction language uses final official wording'
);
assert(!/US0059|CALE MEDIAN BARRIER|CONSISTING OF INSTALL|<br|&lt;br|\.\./.test(context.gridlyNormalizeOfficialConsumerLanguage('US0059, Alternating lanes closed.<br/> Motorists should expect delays.<br/>FOR THE CONSTRUCTION OF SAFETY IMPROVEMENT PROJECTS CONSISTING OF INSTALL CALE MEDIAN BARRIER', { routeName: 'US0059' })), 'remaining raw provider artifacts are absent');

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
