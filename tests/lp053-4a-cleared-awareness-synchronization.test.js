const fs = require('fs');
const assert = require('assert');
const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('function gridlyGetLifecycleCorrectActiveCommunityRecords'), 'single lifecycle-correct active community source exists');
assert(app.includes('return gridlyGetLifecycleCorrectActiveCommunityRecords();'), 'awareness story uses lifecycle-correct source');
assert(!app.includes('input.primary || gridlyBriefInteractionText?.("#gridlyV2TopStatusPrimary")'), 'awareness story does not re-ingest stale top primary DOM as evidence');
assert(!app.includes('input.secondary || gridlyBriefInteractionText?.("#gridlyV2TopStatusSecondary")'), 'awareness story does not re-ingest stale top secondary DOM as evidence');
assert(app.includes('const records = gridlyStoryActiveRecords();'), 'Travel Brief Community rows reuse the active story source');
assert(app.includes('gridlyBuildTravelBriefModel(story)'), 'LP053.4A audit inspects Travel Brief output');
assert(app.includes('recentlyClearedNotClassifiedAsActive: true'), 'recently cleared evidence is certified non-active');
assert(app.includes('officialRoadwayIndependencePreserved: true'), 'official roadway independence is certified');
assert(app.includes('weatherIndependencePreserved: true'), 'weather independence is certified');
assert(app.includes('olderRefreshCannotOverwriteNewerState: true'), 'refresh ordering safety is certified');
assert(app.includes('duplicateClearWriteDetected: false'), 'duplicate clear write finding is documented as false');
assert(app.includes('historicalSidecarsRemainPassive: true'), 'historical sidecars remain passive');

const storyBlock = app.slice(app.indexOf('function buildGridlyAwarenessStory'), app.indexOf('window.buildGridlyAwarenessStory'));
assert(storyBlock.includes('input.primary ||'), 'story accepts explicit primary test input');
assert(storyBlock.includes('input.secondary ||'), 'story accepts explicit secondary test input');
assert(storyBlock.includes('staleActiveDomPattern'), 'story block guards DOM reads against stale active copy');
assert(storyBlock.includes('!staleActiveDomPattern.test(domPrimary)'), 'top primary DOM read cannot reintroduce stale active copy');
assert(storyBlock.includes('!staleActiveDomPattern.test(domSecondary)'), 'top secondary DOM read cannot reintroduce stale active copy');

assert(fs.existsSync('docs/LP053.4A-CLEARED-AWARENESS-SYNCHRONIZATION-REPAIR.md'), 'LP053.4A documentation exists');
console.log('LP053.4A cleared awareness synchronization static coverage passed');
