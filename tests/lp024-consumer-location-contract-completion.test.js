const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('js/app.js', 'utf8');

function block(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `${name} exists`);
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : source.length;
  assert(end > start, `${name} block end located`);
  return source.slice(start, end);
}

const crossingAdapter = block('gridlyLp023CrossingLocationAdapter', 'gridlyLp023OfficialLocationAdapter');
const officialAdapter = block('gridlyLp023OfficialLocationAdapter', 'gridlyLp023AdapterType');
const alertModel = block('buildGridlyAlertCardConsumerModel', 'gridlyRoadHazardLocationConsistencyAudit');
const crossingPopup = block('buildGridlyCrossingPopupConsumerModel', 'isGridlyAlertCardCrossingRelated');
const communityPopup = block('buildGridlyHazardPopupConsumerModel', 'resolveGridlyCrossingPopupState');
const officialPopup = block('gridlyLp019OfficialPopupHtml', 'gridlyLp019PointAudit');
const audit = block('gridlyLp023ConsumerLocationAdapterAudit', 'normalizeGridlyAlertCardLocationLabel');

assert(alertModel.includes('const lp023ConsumerLocation = typeof gridlyLp023ResolveConsumerLocation === "function" ? gridlyLp023ResolveConsumerLocation(alert)'), 'Alert builder consumes LP023 contract');
assert(alertModel.includes('const locationLabel = lp023ConsumerLocation?.displayLocation'), 'Alert location comes from lp023ConsumerLocation.displayLocation first');
assert(!/MAIN LANES not affected/i.test(officialAdapter), 'Official adapter does not special-case advisory text as location');
assert(officialAdapter.includes('GRIDLY_LP023_ADVISORY_PROSE.test([record?.description, record?.title, raw?.description].join(" "))'), 'Official adapter records advisory rejection without promoting prose');
assert(officialPopup.includes('gridlyLp023ResolveConsumerLocation(record, { adapterType: "official" })'), 'Official popup consumes official LP023 contract');
assert(officialPopup.includes('const location = lp023ConsumerLocation?.displayLocation'), 'Official popup renders lp023ConsumerLocation.displayLocation first');

assert(communityPopup.includes('gridlyLp023ResolveConsumerLocation(incident, { adapterType: "community" })'), 'Community popup consumes community LP023 contract');
assert(communityPopup.includes('const locationLine = normalizedRoadLabel'), 'Community popup preserves canonical contract display as its location line');
assert(source.includes('gridlyLp023ResolveConsumerLocation') && source.includes('resolveGridlyV313RoadHazardCommunityDistance'), 'Community-relative wording survives shared contract refresh path');

assert(crossingAdapter.indexOf('consumerCrossingName') < crossingAdapter.indexOf('const road ='), 'Crossing adapter prefers consumer crossing display name before roadway');
assert(crossingAdapter.indexOf('const road =') < crossingAdapter.indexOf('const communityRelative'), 'Crossing adapter prefers roadway before community-relative fallback');
assert(crossingAdapter.indexOf('const communityRelative') < crossingAdapter.indexOf('Private Crossing'), 'Crossing adapter uses community-relative before last-resort Private Crossing');
assert(crossingAdapter.includes('raw?.STREET') && crossingAdapter.includes('record?.roadway') && crossingAdapter.includes('record?.crossingRoad'), 'Crossing roadway candidates include record, raw FRA street, and crossing roadway fields');
assert(crossingPopup.includes('const locationLine = normalizeGridlyUserFacingRoadText(locationLabel)'), 'Crossing popup renders exact LP023 displayLocation without Reported at prefix');
assert(!crossingPopup.includes('Reported at"} ${locationLabel}'), 'Crossing popup no longer reconstructs location with generic prefix');

assert(audit.includes('rendererUsingSharedContract'), 'Audit reports rendererUsingSharedContract');
assert(audit.includes('rendererUsingLegacyFallback'), 'Audit reports rendererUsingLegacyFallback');
assert(audit.includes('rendererRebuiltLocation'), 'Audit reports rendererRebuiltLocation');
assert(audit.includes('officialAlertMatchesPopup'), 'Audit reports officialAlertMatchesPopup');
assert(audit.includes('communityAlertMatchesPopup'), 'Audit reports communityAlertMatchesPopup');
assert(audit.includes('crossingAlertMatchesPopup'), 'Audit reports crossingAlertMatchesPopup');
assert(audit.includes('officialAdvisoryLeakDetected'), 'Audit reports officialAdvisoryLeakDetected');
assert(audit.includes('crossingConsumerIdentifierStrength'), 'Audit reports crossingConsumerIdentifierStrength');
assert(audit.includes('sharedContractOwnershipPass'), 'Audit reports sharedContractOwnershipPass');
assert(audit.includes('safeForBrowserValidation: sharedContractOwnershipPass'), 'Audit gates browser validation on shared contract ownership');
assert(audit.includes('safeForMerge: rows.length > 0'), 'Audit gates merge safety on populated shared-contract checks');

console.log('LP024 consumer location contract completion static checks passed');
