import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('window.gridlyLP229CanonicalCommunityAwarenessScopeAudit = function');
const end = app.indexOf('// LP228 is deliberately observational.', start);
const helper = app.slice(start, end);

test('LP229 exposes every requested passive evidence-family and consumer field', () => {
  assert.notEqual(start, -1);
  for (const field of ['canonicalCommunity', 'canonicalKey', 'selectedMembership', 'allGovernedMemberships', 'activeCounty', 'communityReports', 'blockedCrossingEvidence', 'driveTexas', 'weather', 'consumers', 'consumerDivergences', 'overallClassification', 'safeToRepairBeforeLaunch']) {
    assert.match(helper, new RegExp(`\\b${field}\\b`));
  }
  for (const field of ['authority', 'eligibleIds', 'sourceCounties', 'selectedMembershipLimited', 'safeToAggregate', 'classification', 'coordinateAuthority', 'deduplicationAuthority', 'providerGeography', 'communityRelevanceAuthority']) {
    assert.match(helper, new RegExp(`\\b${field}\\b`));
  }
});

test('LP229 observes production selectors but invokes no writers or state transitions', () => {
  assert.match(helper, /buildGridlyCommunityAwarenessIntelligenceSummary\(\)/);
  assert.match(helper, /isGridlyRecordInAwarenessArea\(record, selectedArea\)/);
  assert.doesNotMatch(helper, /render\w*\s*\(|refresh\w*\s*\(|reload\w*\s*\(|publish\w*\s*\(|writer\w*\s*\(|setActiveCounty|applyGridly|selectGridly|\.setView\s*\(|\.fitBounds\s*\(|\.panTo\s*\(|fetch\s*\(|localStorage|sessionStorage|setTimeout|setInterval|requestAnimationFrame|\.innerHTML\s*=|\.textContent\s*=/i);
});

test('LP229 does not branch production behavior for control towns or memberships', () => {
  assert.doesNotMatch(helper, /Katy|Abilene|Midland|Austin|Sulphur Springs|Liberty|Fredericksburg|Pecos|harris-tx|fort-bend-tx|waller-tx/);
  assert.doesNotMatch(helper, /activeCounty\s*=\s*["']|selectedMembership\s*=\s*["']|countyMemberships\s*=/);
});

test('LP229 preserves accepted systems and the marker finding', () => {
  const report = fs.readFileSync('LP229-STATEWIDE-CANONICAL-COMMUNITY-AWARENESS-SCOPE-AUDIT.md', 'utf8');
  for (const statement of ['NO PRODUCTION AWARENESS BEHAVIOR WAS CHANGED', 'NO WEATHER BEHAVIOR WAS CHANGED', 'NO DRIVETEXAS BEHAVIOR WAS CHANGED', 'NO ALERTS BEHAVIOR WAS CHANGED', 'NO KBYG BEHAVIOR WAS CHANGED', 'NO CROSSING BEHAVIOR WAS CHANGED', 'NO MULTI-COUNTY GOVERNANCE WAS CHANGED', 'NO UNRELATED PRODUCTION CHANGE WAS APPLIED']) assert.match(report, new RegExp(statement));
  assert.match(report, /markerIdentity: null/);
  assert.match(report, /MIXED_AUTHORITY/);
});
