import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { areas, registry } from '../tools/lp240x/supported-area-identity-audit.mjs';
import { deriveGovernedNonPlaceAnchors, writeGovernedNonPlaceAnchors } from '../tools/lp24111/export-governed-non-place-anchors.mjs';

test('export derives the certified 29 only from governed runtime authority', () => {
  const payload = deriveGovernedNonPlaceAnchors();
  assert.equal(payload.count, 29);
  assert.equal(new Set(payload.rows.map((row) => row.stableGovernedIdentity)).size, 29);
  assert.ok(payload.rows.every((row) => row.identityClass === 'GOVERNED_NON_PLACE'));
  assert.ok(payload.rows.every((row) => registry[row.countyId]));
  assert.ok(payload.rows.every((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)));
  assert.ok(payload.rows.every((row) => row.placeGeoid === null));
  assert.ok(payload.rows.every((row) => !row.countyWide && !row.fallback && !/^48\d{5}$/.test(row.stableGovernedIdentity)));
  assert.equal(new Set(payload.rows.map((row) => `${row.countyId}:${row.communityKey}`)).size, 29);
  assert.deepEqual(payload.rows.find((row) => row.communityKey === 'tarkington'), {
    identityClass: 'GOVERNED_NON_PLACE', stableGovernedIdentity: 'liberty-tx:tarkington', communityKey: 'tarkington', displayLabel: 'Tarkington', countyId: 'liberty-tx', latitude: 30.3205, longitude: -94.996, radiusMiles: 8, placeGeoid: null, source: 'safe approximate community anchor'
  });
});

test('authority count drift fails closed rather than manufacturing a replacement', () => {
  const removed = areas.filter((area) => area.key !== 'tarkington');
  assert.throws(() => deriveGovernedNonPlaceAnchors(removed), /row count 28; expected 29/);
});

test('bounded exporter writes only its requested derived artifact and leaves runtime byte-identical', () => {
  const appPath = path.resolve('js/app.js');
  const before = fs.readFileSync(appPath);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gridly-d4a-'));
  const output = path.join(directory, 'anchors.json');
  const payload = writeGovernedNonPlaceAnchors(output);
  assert.equal(JSON.parse(fs.readFileSync(output, 'utf8')).count, 29);
  assert.equal(payload.count, 29);
  assert.deepEqual(fs.readFileSync(appPath), before);
});

test('export tooling contains no upstream fetch, D.3 execution, or runtime activation path', () => {
  const source = fs.readFileSync(new URL('../tools/lp24111/export-governed-non-place-anchors.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(|identity-governance|normalize\.mjs|taxonomy-review|activate|deploy|supabase/i);
});

test('D.4 execution explicitly validates and consumes the derived anchor envelope', () => {
  const source = fs.readFileSync(new URL('../tools/lp24111/coverage-certification.mjs', import.meta.url), 'utf8');
  assert.match(source, /governed-non-place-anchors\.json/);
  assert.match(source, /validateGovernedNonPlaceAnchors\(anchorEnvelope\.rows\)/);
});
