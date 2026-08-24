import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('window.gridlyLP228CommunityCrossingScopeAudit = function');
const end = app.indexOf('window.gridlySafeBrowserCrossingAudit', start);
const helper = app.slice(start, end);

test('LP228 exposes the requested passive crossing-scope evidence', () => {
  assert.notEqual(start, -1);
  for (const field of ['canonicalCommunity', 'canonicalKey', 'selectedMembership', 'allGovernedMemberships', 'countyInventories', 'currentWatchedCount', 'currentWatchedSource', 'currentWatchedPolicy', 'watchedCrossingIds', 'watchedCrossingsByCounty', 'renderedMarkerCount', 'viewportInfluenced', 'radiusInfluenced', 'selectedMembershipLimited', 'multiCountyAggregated', 'deduplicated', 'communityCrossingAuthority', 'communityCrossingAuthorityConfidence', 'proposedCanonicalCommunityCount', 'differenceFromCurrentCount', 'safeToRepair', 'classification']) {
    assert.match(helper, new RegExp(`\\b${field}\\b`));
  }
});

test('audit observes the existing count selector without changing production behavior', () => {
  assert.match(helper, /gridlySelectConsumerVisibleCrossings\(selectedArea/);
  assert.match(helper, /REPAIR_REQUIRES_NEW_AUTHORITY/);
  assert.match(helper, /viewportInfluenced: false/);
  assert.match(helper, /multiCountyAggregated: false/);
  assert.match(helper, /safeToRepair: false/);
  assert.doesNotMatch(helper, /renderCrossings\s*\(|setActiveCounty|applyGridly|selectGridly|\.setView\s*\(|\.fitBounds\s*\(|\.panTo\s*\(|fetch\s*\(|localStorage|sessionStorage|setTimeout|setInterval|requestAnimationFrame|\.innerHTML\s*=|\.textContent\s*=/);
});

test('audit contains no town-specific production logic and does not alter sources or governance', () => {
  assert.doesNotMatch(helper, /Katy|Abilene|Midland|Austin|harris-tx|fort-bend-tx|waller-tx/);
  assert.doesNotMatch(helper, /crossingSource\s*=|countyMemberships\s*=|activeCounty\s*=|selectedMembership\s*=.*selectedArea/);
});

test('LP228 report preserves the statewide baseline and no-repair classification', () => {
  const report = fs.readFileSync('LP228-STATEWIDE-COMMUNITY-CROSSING-SCOPE-AUDIT.md', 'utf8');
  for (const value of ['1,859', '2,058', '163', '254', 'REPAIR_REQUIRES_NEW_AUTHORITY', '1,159', '175', '46']) assert.match(report, new RegExp(value));
  assert.match(report, /NO PRODUCTION CROSSING BEHAVIOR WAS CHANGED/);
});
