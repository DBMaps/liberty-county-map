import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('function gridlyGetCanonicalCommunityEvidenceProjection()');
const end = app.indexOf('// LP229 observes', start);
const lp230 = app.slice(start, end);

test('LP230 exposes one projection and the complete passive audit contract', () => {
  assert.notEqual(start, -1);
  for (const field of ['canonicalCommunity', 'canonicalKey', 'selectedMembership', 'allGovernedMemberships', 'geometry', 'crossings', 'driveTexas', 'localHazards', 'blockedCrossingReports', 'weather', 'consumers', 'consumerParity', 'governancePreserved', 'overallPass']) assert.match(lp230, new RegExp(`\\b${field}\\b`));
  assert.match(lp230, /window\.gridlyGetCanonicalCommunityEvidenceProjection/);
  assert.match(lp230, /window\.gridlyLP230CanonicalCommunityEvidenceAudit/);
});

test('PLACE-polygon dependent evidence fails closed without silently approximating', () => {
  assert.match(lp230, /COMMUNITY_GEOMETRY_AUTHORITY_UNAVAILABLE/);
  assert.match(lp230, /MEMBERSHIP_SOURCE_UNAVAILABLE/);
  assert.match(lp230, /PROVIDER_GEOGRAPHY_UNRESOLVED/);
  assert.match(lp230, /providerCountyUnionApplied: false/);
  assert.doesNotMatch(lp230, /Katy|Corpus Christi|Austin|Abilene|Midland|Sulphur Springs|Liberty|Fredericksburg|Pecos|FM0529|7BA082B4/i);
});

test('projection is passive and preserves provider/lifecycle owners', () => {
  assert.match(lp230, /buildGridlyCommunityAwarenessIntelligenceSummary\(\)/);
  assert.match(lp230, /getNormalizedRecords/);
  assert.match(lp230, /isGridlyRecordInAwarenessArea/);
  assert.doesNotMatch(lp230, /fetch\s*\(|setTimeout|setInterval|requestAnimationFrame|localStorage|sessionStorage|\.setView\s*\(|\.fitBounds\s*\(|\.panTo\s*\(|render\w*\s*\(|publish\w*\s*\(|refresh\w*\s*\(/i);
});

test('statewide certification is evidence-backed rather than fabricated', () => {
  const report = JSON.parse(fs.readFileSync('data/generated/lp230-statewide-canonical-community-evidence-certification.json', 'utf8'));
  assert.deepEqual(report.inventory, { canonicalCommunities: 1859, memberships: 2058, multiCountyIdentities: 163, counties: 254 });
  assert.equal(report.crossings.communitiesWithCertifiedGeometry, 0);
  assert.equal(report.crossings.communitiesWithoutCertifiedGeometry, 1859);
  assert.equal(report.crossings.multiCountyCommunitiesFailClosed, 163);
  assert.equal(report.crossings.communitiesWhereSelectedMembershipChangesCanonicalCount, 0);
  assert.equal(report.weather.providerGeographyPreserved, true);
  assert.equal(report.protections.blindCountyUnionIntroduced, false);
});
