import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('js/lp24110-poi-search-certification.js', 'utf8'), sandbox);
const policy = sandbox.window.GRIDLY_LP24110_POI_SEARCH;
assert.equal(policy.classify('Walmart').type, 'NAMED_ENTITY_SEARCH', 'named business intent');
for (const query of ['gas station', 'hospital', 'pharmacy', 'restaurant', 'grocery store', 'hotel', 'school', 'urgent care']) {
  assert.equal(policy.classify(query).type, 'CATEGORY_DISCOVERY', `${query}: category intent`);
}
const context = { community: 'Tarkington', county: 'Liberty County', countyId: 'liberty-tx', lat: 30.31, lng: -94.93, source: 'awareness_area' };
const local = { title: 'Local Walmart', lat: 30.3, lng: -94.9, provider: 'nominatim', raw: { address: { city: 'Tarkington', county: 'Liberty County' } }, searchRank: { rank: 1, anchorDistanceMiles: 4, isLocality: true } };
const far = { title: 'Houston Walmart', lat: 29.7, lng: -95.3, provider: 'nominatim', raw: { address: { city: 'Houston', county: 'Harris County' } }, searchRank: { rank: 2, anchorDistanceMiles: 90 } };
let current = { ...context };
const audit = policy.createAudit({ search: async () => [local, far], context: () => ({ ...current }) });
const report = await audit('Walmart');
assert.equal(report.rankedResults[0].name, 'Local Walmart', 'locality bias / named ranking');
assert.equal(report.localResultAvailable, true, 'rural/non-PLACE local result');
assert.equal(report.staleContextDetected, false, 'no stale community carryover');
assert.equal(report.destinationHandoffAvailable, true, 'destination handoff');
assert.equal(report.pass, true);
const noResult = policy.createAudit({ search: async () => [far], context: () => ({ ...context }) });
assert.equal((await noResult('Walmart')).localResultAvailable, false, 'truthful bounded no-result');
assert.equal((await noResult('Walmart')).pass, false);
current = { ...context };
const stale = policy.createAudit({ search: async () => { current = { ...context, community: 'Houston' }; return [local]; }, context: () => ({ ...current }) });
assert.equal((await stale('Walmart')).staleContextDetected, true);
const cohort = JSON.parse(fs.readFileSync('reports/lp24110/statewide-poi-cohort.json', 'utf8'));
assert.equal(cohort.communities.length, 22, 'statewide cohort coverage');
assert.ok(cohort.communities.some(x => x.contextType === 'NON_PLACE'), 'non-PLACE context');
assert.ok(cohort.communities.some(x => x.contextType === 'MULTI_COUNTY'), 'multi-county context');
const app = fs.readFileSync('js/app.js', 'utf8');
assert.match(app, /GRIDLY_DESTINATION_INTENTS\.ADDRESS/, 'address search remains intact');
assert.match(app, /getGridlySelectedAwarenessArea/, 'Home Area search remains intact');
