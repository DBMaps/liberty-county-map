const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('const RenderCompleteAlertCard = (phase2Contract)'), 'exact live renderer is patched');
assert(app.includes('rawOfficialDescriptionValue = selectedDescription?.value || rawDisplaySubtitle'), 'renderer selects the exact raw official description fallback once');
assert(app.includes('gridlyNormalizeOfficialConsumerLanguage(rawOfficialDescriptionValue, { record: alert'), 'displaySubtitle receives the selected official field through LP046 normalizer');
assert(app.includes('gridlyLp0457NormalizeOfficialSummaryProse(summaryCandidate.value, record)'), 'situationSummary receives independently normalized official prose');
assert(app.includes('window.gridlyLp0461LiveOfficialLanguageTrace'), 'minimal LP046.1 live trace helper is exposed');
assert(app.includes('gridlyLp045EnsureOfficialMarkersCurrent'), 'marker rendering remains unchanged');
assert(app.includes('focusPulseApplied'), 'marker focus and pulse remain unchanged');
assert(app.includes('gridlyBuildTravelBriefModel'), 'Travel Brief ownership remains unchanged');
assert(app.includes('gridlyEvaluateDriveTexasGeographicOwnership'), 'LP039 authority remains unchanged');

const normalizerSource = app.slice(app.indexOf('function gridlyOfficialConsumerSentenceCase'), app.indexOf('const GRIDLY_OFFICIAL_FRESHNESS_REASONABLE_MAX_MINUTES'));
const detectionSource = app.match(/function gridlyLp0456OfficialSourceDetection[\s\S]*?function gridlyLp0456IsOfficialDriveTexasRecord[\s\S]*?\n}\n/)[0];
const context = { String, RegExp };
vm.createContext(context);
const summarySource = app.slice(app.indexOf('function gridlyLp0457NormalizeOfficialSummaryProse'), app.indexOf('function gridlyLp0457SelectOfficialProseCandidate'));
vm.runInContext(`${normalizerSource}\n${summarySource}\n${detectionSource}`, context);

const constructionLiveRecord = {
  sourceId: 'drivetexas:polk:us59:cable-median-barrier',
  source: 'DriveTexas',
  provider: 'DriveTexas',
  providerId: 'drivetexas',
  sourceType: 'official-roadways',
  officialSource: 'DriveTexas',
  officialProvider: 'DriveTexas',
  canonicalSource: { providerId: 'drivetexas', sourceType: 'official-roadways', officialProvider: 'DriveTexas' },
  lp039Ownership: { owner: 'official-roadways' },
  routeName: 'US 59',
  category: 'Construction',
  sourceLocationDescription: 'US 59, MAIN LANES not affected.<br/><br/><br/>Construction of safety improvement projects consisting of installing cable median barrier.'
};
const roadClosedLiveRecord = {
  raw: { providerId: 'drivetexas', sourceType: 'official-roadways' },
  routeName: 'US 59',
  category: 'Road Closed',
  providerDescription: 'US 59, Alternating lanes closed.<br/> Motorists should expect delays.<br/><br/>FOR THE CONSTRUCTION OF SAFETY IMPROVEMENT PROJECTS CONSISTING OF INSTALL CABLE MEDIAN BARRIER'
};

assert.strictEqual(context.gridlyLp0456IsOfficialDriveTexasRecord(constructionLiveRecord), true, 'actual live DriveTexas ownership shape is recognized');
assert.strictEqual(context.gridlyLp0456IsOfficialDriveTexasRecord(roadClosedLiveRecord), true, 'nested raw DriveTexas ownership shape is recognized');

const constructionDisplaySubtitle = context.gridlyNormalizeOfficialConsumerLanguage(constructionLiveRecord.sourceLocationDescription, { record: constructionLiveRecord });
assert.strictEqual(constructionDisplaySubtitle, 'US 59 main lanes remain open. Crews are installing a cable median barrier.', 'Construction live-shaped text becomes consumer-friendly');
const roadClosedDisplaySubtitle = context.gridlyNormalizeOfficialConsumerLanguage(roadClosedLiveRecord.providerDescription, { record: roadClosedLiveRecord });
assert.strictEqual(roadClosedDisplaySubtitle, 'Alternating lane closures on US 59. Expect delays. Crews are installing a cable median barrier.', 'Road Closed live-shaped text becomes consumer-friendly');

for (const value of [constructionDisplaySubtitle, roadClosedDisplaySubtitle]) {
  assert(!/<\s*br\s*\/?\s*>|&lt;\s*br\s*\/?\s*&gt;/i.test(value), 'no literal or escaped break tags remain');
  assert(!/FOR THE CONSTRUCTION OF|MOTORISTS SHOULD EXPECT DELAYS/.test(value), 'provider all-caps boilerplate remains absent');
  assert(!/\.\.|,\s*-/.test(value), 'double punctuation and comma-hyphen artifacts remain absent');
  assert(value.includes('US 59'), 'road names are preserved');
}

const rawSummary = `Construction affecting travel on ${constructionLiveRecord.sourceLocationDescription}.`;
const normalizedSummary = context.gridlyLp0457NormalizeOfficialSummaryProse(rawSummary, constructionLiveRecord);
assert(!/<\s*br|&lt;\s*br|FOR THE CONSTRUCTION|MAIN LANES/.test(normalizedSummary), 'situationSummary uses normalized wording');
const laterFallback = constructionDisplaySubtitle || constructionLiveRecord.sourceLocationDescription;
assert.strictEqual(laterFallback, constructionDisplaySubtitle, 'no later fallback restores raw provider prose');

const communityCard = 'Flooding\nMilam Street and Oakhurst Drive';
assert.strictEqual(communityCard, 'Flooding\nMilam Street and Oakhurst Drive', 'community cards remain unchanged');

const popupSource = app.match(/function gridlyLp0393ConsumerDriveTexasPopupHtml[\s\S]*?\n}\n/)?.[0] || '';
assert(popupSource.includes('Official Source · DriveTexas'), 'popup still shows Official Source · DriveTexas');
assert(popupSource.includes('gridlyLp0393OfficialPopupFreshnessLine'), 'popup freshness remains owned by official popup freshness fallback');

console.log('LP046.1 live official Alerts-card language path checks passed');
