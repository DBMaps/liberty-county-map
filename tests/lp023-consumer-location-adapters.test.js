const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('function gridlyLp023ResolveConsumerLocation'), 'LP023 shared consumer-location contract resolver exists');
assert(source.includes('function gridlyLp023CommunityReportLocationAdapter'), 'Community Report Location Adapter exists');
assert(source.includes('function gridlyLp023CrossingLocationAdapter'), 'Crossing Location Adapter exists');
assert(source.includes('function gridlyLp023OfficialLocationAdapter'), 'Official / DriveTexas Location Adapter exists');
assert(source.includes('displayLocation') && source.includes('primaryLocation') && source.includes('secondaryLocation') && source.includes('specificityLevel') && source.includes('locationSource') && source.includes('adapterType'), 'canonical consumer-location contract fields are present');

const communityStart = source.indexOf('function gridlyLp023CommunityReportLocationAdapter');
const crossingStart = source.indexOf('function gridlyLp023CrossingLocationAdapter');
const officialStart = source.indexOf('function gridlyLp023OfficialLocationAdapter');
const communityBlock = source.slice(communityStart, crossingStart);
const crossingBlock = source.slice(crossingStart, officialStart);
const officialBlock = source.slice(officialStart, source.indexOf('function gridlyLp023AdapterType'));

assert(communityBlock.indexOf('existingTrustedCanonical') < communityBlock.indexOf('gridlyLp023RoadRelative'), 'community adapter first honors trusted canonical location');
assert(communityBlock.indexOf('gridlyLp023RoadRelative') < communityBlock.indexOf('gridlyLp023CommunityRelative'), 'community adapter prefers trusted road-relative location before community-relative calculation');
assert(communityBlock.includes('calculatedCommunityRelativeLocation'), 'community adapter labels coordinate-backed community-relative location source');
assert(!/selectedRoadName[\s\S]{0,120}gridlyLp023CommunityRelative/.test(communityBlock), 'selectedRoadName is not required before community-relative calculation is attempted');
assert(communityBlock.indexOf('trustedCommunityName') < communityBlock.indexOf('countyFallback'), 'community adapter falls back to county only after community name');

assert(crossingBlock.includes('consumerCrossingName') && crossingBlock.includes('trustedCrossingDisplayName'), 'crossing adapter prefers consumer/trusted crossing names');
assert(crossingBlock.includes('gridlyConsumerCrossingClassificationLabel'), 'crossing adapter preserves consumer crossing classification cleanup');
assert(!/Flooding Railroad Crossing|Roadway Crossing/.test(crossingBlock), 'crossing adapter does not hard-code hazard/generic crossing labels');

assert(officialBlock.includes('providerGeographicLocation') && officialBlock.includes('trustedOfficialRouteFields'), 'official adapter preserves trusted geographic fields');
assert(officialBlock.includes('GRIDLY_LP023_ADVISORY_PROSE') && officialBlock.includes('providerAdvisoryTextRejected'), 'official adapter classifies and rejects advisory prose as location');
assert(!/sourceLocationDescription[\s\S]{0,200}displayLocation/.test(officialBlock), 'official adapter does not promote arbitrary sourceLocationDescription into displayLocation');

assert(source.includes('const lp023ConsumerLocation = typeof gridlyLp023ResolveConsumerLocation === "function" ? gridlyLp023ResolveConsumerLocation(alert)'), 'Alert cards consume LP023 contract');
assert(source.includes('gridlyLp023ResolveConsumerLocation(incident, { adapterType: "community" })'), 'Community hazard popups consume LP023 contract');
assert(source.includes('gridlyLp023ResolveConsumerLocation(incident, { adapterType: "crossing" })'), 'Crossing popups consume LP023 contract');
assert(source.includes('gridlyLp023ResolveConsumerLocation(record, { adapterType: "official" })'), 'Official popups consume LP023 contract');
assert(source.includes('model.locationLine = model.consumerLocation?.displayLocation ? model.locationLine'), 'Popup LP021 fallback no longer overrides LP023 contract location');

assert(source.includes('function gridlyLp023ConsumerLocationAdapterAudit'), 'LP023 audit helper exists');
assert(source.includes('exposeGridlyAuditHelper("gridlyLp023ConsumerLocationAdapterAudit", gridlyLp023ConsumerLocationAdapterAudit)'), 'LP023 audit helper is exposed');
['recordsByAdapterType','communityRecordsChecked','crossingRecordsChecked','officialRecordsChecked','finalDisplayLocation','locationSource','specificityLevel','reportCoordinate','nearestCommunity','communityAnchorCoordinate','distanceMiles','bearingDegrees','cardinalDirection','calculatedCommunityRelativeLocation','trustedRoadRelativeLocation','providerGeographicLocation','providerAdvisoryTextRejected','countyFallbackUsedDespiteStrongerLocation','roadwayOnlyUsedDespiteStrongerLocation','internalIdentifierDisplayed','genericLocationDisplayed','duplicateRoadwayDetected','hazardLabelUsedAsLocation','alertLocation','popupLocation','alertPopupLocationMatch','communityRelativeCalculationInvoked','officialAdvisoryPromotedToLocation','safeForMerge'].forEach((field) => {
  assert(source.includes(field), `LP023 audit reports ${field}`);
});

assert(source.includes('gridlyLp023ResolveConsumerLocation') && source.includes('resolveGridlyV313RoadHazardCommunityDistance'), 'LP023 reuses existing community-relative capability instead of replacing it');
assert(source.includes('getAlertsSurfaceSnapshot') && source.includes('buildAlertPresentationGroups'), 'LP016/Alerts caching and resolver-call protected path remains present');
assert(!/LP016|awareness-area selection|source activation/.test(source.slice(communityStart, source.indexOf('function normalizeGridlyAlertCardLocationLabel'))), 'LP023 adapter block avoids protected-system ownership changes');
