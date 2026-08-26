import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { canonicalizeCsvNewlines, csvArtifactMatches, lp239ArtifactMatches } from '../tools/lp239/csv-artifact-newlines.mjs';
import { buildCertification as buildMembership, renderCsv as renderMembershipCsv } from '../tools/lp239/build-statewide-place-membership-certification.mjs';
import { buildCertification as buildCrossing, renderCsv as renderCrossingCsv } from '../tools/lp239/build-statewide-crossing-certification.mjs';

const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');

test('LF and checkout-converted CRLF CSV artifacts verify equivalently', () => {
  const lf = 'heading,value\nalpha,1\nbeta,2\n';
  const crlf = lf.replaceAll('\n', '\r\n');
  assert.equal(csvArtifactMatches(lf, lf), true);
  assert.equal(csvArtifactMatches(crlf, lf), true);
  assert.equal(canonicalizeCsvNewlines(crlf), lf);
});

test('CSV content differences and non-checkout newline changes still fail', () => {
  assert.equal(csvArtifactMatches('heading,value\nalpha,9\n', 'heading,value\nalpha,1\n'), false);
  assert.equal(csvArtifactMatches('heading,value\ralpha,1\r', 'heading,value\nalpha,1\n'), false);
});

test('JSON and Markdown remain byte-exact rather than newline-normalized', () => {
  assert.equal(lp239ArtifactMatches('report.json', '{\n  "pass": true\n}\n', '{\r\n  "pass": true\r\n}\r\n'), false);
  assert.equal(lp239ArtifactMatches('README.md', '# Report\n', '# Report\r\n'), false);
});

test('both builders retain generated CSV content, order, LF policy, and statewide totals', async () => {
  const membership = buildMembership();
  const crossing = await buildCrossing();
  const membershipCsv = renderMembershipCsv(membership.rows);
  const crossingCsv = renderCrossingCsv(crossing.rows);

  assert.equal(membership.summary.canonicalPlaceCount, 1859);
  assert.equal(membership.summary.totalMembershipCount, 2058);
  assert.equal(crossing.summary.canonicalPlaceCount, 1859);
  assert.equal(crossing.summary.totalCanonicalCrossingIdentityCount, 9094);
  assert.equal(membershipCsv.includes('\r'), false);
  assert.equal(crossingCsv.includes('\r'), false);
  assert.equal(csvArtifactMatches(read('reports/lp239-statewide/statewide-place-membership-certification.csv'), membershipCsv), true);
  assert.equal(csvArtifactMatches(read('reports/lp239-crossing-statewide/statewide-crossing-certification.csv'), crossingCsv), true);
  assert.deepEqual(membershipCsv.trimEnd().split('\n').slice(1).map(line => line.match(/(?:^|,)(48\d{5})(?:,|$)/)?.[1]), [...membership.rows].map(row => row.canonicalPlaceId));
  assert.deepEqual(crossingCsv.trimEnd().split('\n').slice(1).map(line => line.match(/(?:^|,)(48\d{5})(?:,|$)/)?.[1]), [...crossing.rows].map(row => row.canonicalPlaceId));
});
