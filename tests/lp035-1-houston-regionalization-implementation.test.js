const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('function gridlyLp035HoustonRegionAwarenessArea(region)'), 'Houston regions are converted into awareness areas for persistence and active state');
assert(source.includes('parentCommunity: "Houston"'), 'Houston region selections preserve Houston as the parent community');
assert(source.includes('awarenessRegionId: region.id'), 'Houston region selections persist awarenessRegionId');
assert(source.includes('awarenessRegionLabel: label'), 'Houston region selections persist awarenessRegionLabel');
assert(source.includes('storageValue: `Houston — ${label}`'), 'Region storage values remain consumer-readable and avoid raw IDs');
assert(source.includes('GRIDLY_LP035_HOUSTON_REGION_MODEL.forEach((region)'), 'All approved Houston regions are added to awareness definitions');
assert(source.includes('area.parentCommunity === "Houston" ? `Houston / ${area.label || value}`'), 'Selector presents Houston regions under a Houston context instead of a flat technical list');
assert(source.includes('area?.houstonRegion === true ? "houston-region" : "town"'), 'Alert/awareness filtering has an explicit Houston-region mode');
assert(source.includes('record?.awarenessRegionId || record?.awareness_region_id'), 'Filtering accepts cached report/official region ownership metadata');
assert(source.includes('gridlyLp035FindHoustonRegion(raw)'), 'Backward-compatible human labels resolve to Houston regions without raw IDs');
assert(source.includes('reportOwnership: "region metadata fields supported; write-path ownership remains source-dependent"'), 'Audit does not manufacture unsupported report write-path guarantees');
assert(source.includes('officialOwnership: "coordinate/radius ownership supported after normalization; DriveTexas ingestion unchanged"'), 'Audit states official ownership without DriveTexas ingestion changes');
assert(source.includes('separateCommunityProtection: separatelyOwnedCommunityConflicts.length === 0'), 'Audit certifies separate Harris community protection from actual conflicts');
assert(source.includes('houstonWideMode: Boolean(selectedArea?.storageValue === "Houston")'), 'Houston-wide compatibility remains explicit');
assert(source.includes('try { return isGridlyRecordInAwarenessArea(record, selectedArea); }'), 'Community Pulse, Travel Brief, and Know Before You Go reuse selected-area active-record filtering');
assert(source.includes('travelBriefRegionFilteringAvailable: true'), 'Travel Brief participates through shared active-record filtering');
assert(source.includes('knowBeforeYouGoFiltering: true'), 'Know Before You Go participation is represented in the audit');
assert(!source.includes('id: "houston-kingwood"'), 'Kingwood remains independent and is not absorbed into Houston regions');
assert(!source.includes('id: "houston-clear-lake"'), 'Clear Lake remains independent and is not absorbed into Houston regions');

console.log('LP035.1 Houston regionalization implementation checks passed');
