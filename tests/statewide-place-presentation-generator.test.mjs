import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { zipSync } from 'fflate';
import { buildPlacePresentation } from '../tools/build-statewide-place-presentation-v1.mjs';

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function makeDbf(records) {
  const fields = [{ name: 'GEOID', length: 7 }, { name: 'INTPTLAT', length: 12 }, { name: 'INTPTLON', length: 13 }];
  const headerLength = 32 + fields.length * 32 + 1;
  const recordLength = 1 + fields.reduce((sum, field) => sum + field.length, 0);
  const bytes = Buffer.alloc(headerLength + records.length * recordLength + 1, 0);
  bytes[0] = 0x03;
  bytes.writeUInt32LE(records.length, 4);
  bytes.writeUInt16LE(headerLength, 8);
  bytes.writeUInt16LE(recordLength, 10);
  fields.forEach((field, index) => {
    const offset = 32 + index * 32;
    bytes.write(field.name, offset, 'ascii');
    bytes[offset + 11] = 0x4e;
    bytes[offset + 16] = field.length;
    bytes[offset + 17] = field.name === 'GEOID' ? 0 : 7;
  });
  bytes[headerLength - 1] = 0x0d;
  records.forEach((record, index) => {
    let offset = headerLength + index * recordLength;
    bytes[offset++] = 0x20;
    for (const field of fields) {
      const value = String(record[field.name]).padStart(field.length, ' ');
      bytes.write(value, offset, field.length, 'ascii');
      offset += field.length;
    }
  });
  bytes[bytes.length - 1] = 0x1a;
  return bytes;
}

function fixture(records = [
  { GEOID: '4800001', INTPTLAT: '+30.1234567', INTPTLON: '-097.1234567' },
  { GEOID: '4800002', INTPTLAT: '+31.7654321', INTPTLON: '-098.7654321' },
  { GEOID: '4800003', INTPTLAT: '+32.1111111', INTPTLON: '-099.1111111' }
]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gridly-place-presentation-'));
  const archiveBytes = Buffer.from(zipSync({ 'tl_2025_48_place.dbf': makeDbf(records) }, { level: 0 }));
  const archivePath = path.join(root, 'fixture.zip');
  fs.writeFileSync(archivePath, archiveBytes);
  const projectionPath = path.join(root, 'projection.json');
  fs.writeFileSync(projectionPath, JSON.stringify({
    schemaVersion: 'gridly.statewide-consumer-community-projection.v1',
    communities: [{ placeGeoid: '4800002' }, { placeGeoid: '4800001' }],
    exclusions: [{ placeGeoid: '4800003' }]
  }));
  return { root, archivePath, archiveBytes, projectionPath, sourceIdentity: { sourceFile: 'fixture.zip', byteLength: archiveBytes.length, sha256: sha256(archiveBytes) } };
}

function build(data, overrides = {}) {
  return buildPlacePresentation({ archivePath: data.archivePath, projectionPath: data.projectionPath, sourceIdentity: data.sourceIdentity, expectedEligibleCount: 2, write: false, ...overrides });
}

test('uses only GEOID-keyed Census internal points and excludes governed ineligible records', () => {
  const data = fixture();
  try {
    const { artifact } = build(data);
    assert.equal(artifact.schemaVersion, 'gridly.statewide-place-presentation.v1');
    assert.deepEqual(artifact.counts, { eligiblePlaceCount: 2, presentationTargetCount: 2 });
    assert.deepEqual(Object.keys(artifact.places), ['4800001', '4800002']);
    assert.deepEqual(artifact.places['4800001'], { lat: 30.1234567, lon: -97.1234567 });
    assert.equal(artifact.places['4800003'], undefined);
    assert.deepEqual(Object.keys(artifact), ['schemaVersion', 'source', 'counts', 'places']);
  } finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});

test('two builds are byte-identical and contain no nondeterministic or prohibited fields', () => {
  const data = fixture();
  try {
    const first = build(data).bytes;
    const second = build(data).bytes;
    assert.deepEqual(first, second);
    assert.doesNotMatch(first.toString(), /timestamp|generatedAt|countyMembership|displayName|zoom|fallback/i);
  } finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});

test('verifies byte length and SHA-256 before reading the archive', () => {
  const data = fixture();
  try {
    assert.throws(() => build(data, { sourceIdentity: { ...data.sourceIdentity, byteLength: data.archiveBytes.length + 1 } }), /byte length mismatch/);
    assert.throws(() => build(data, { sourceIdentity: { ...data.sourceIdentity, sha256: '0'.repeat(64) } }), /SHA-256 mismatch/);
  } finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});

test('fails closed for missing, duplicate, extra, and malformed Census PLACE records', () => {
  const cases = [
    [[{ GEOID: '4800001', INTPTLAT: '+30.1234567', INTPTLON: '-097.1234567' }], /missing governed/],
    [[{ GEOID: '4800001', INTPTLAT: '+30.1234567', INTPTLON: '-097.1234567' }, { GEOID: '4800001', INTPTLAT: '+30.1234567', INTPTLON: '-097.1234567' }], /duplicate Census/],
    [[{ GEOID: '4800001', INTPTLAT: '+30.1234567', INTPTLON: '-097.1234567' }, { GEOID: '4800002', INTPTLAT: '+31.7654321', INTPTLON: '-098.7654321' }, { GEOID: '4800003', INTPTLAT: '+32.1111111', INTPTLON: '-099.1111111' }, { GEOID: '4800004', INTPTLAT: '+33.1111111', INTPTLON: '-100.1111111' }], /absent from governed eligibility/],
    [[{ GEOID: '4800001', INTPTLAT: 'not-a-point', INTPTLON: '-097.1234567' }], /invalid Census internal point/]
  ];
  for (const [records, error] of cases) {
    const data = fixture(records);
    try { assert.throws(() => build(data), error); }
    finally { fs.rmSync(data.root, { recursive: true, force: true }); }
  }
});

test('requires exact eligible coverage and rejects duplicate projection GEOIDs', () => {
  const data = fixture();
  try {
    assert.throws(() => build(data, { expectedEligibleCount: 1859 }), /eligible PLACE count must be 1859/);
    const projection = JSON.parse(fs.readFileSync(data.projectionPath));
    projection.communities.push({ placeGeoid: '4800001' });
    fs.writeFileSync(data.projectionPath, JSON.stringify(projection));
    assert.throws(() => build(data), /duplicate eligible PLACE GEOIDs/);
  } finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});
