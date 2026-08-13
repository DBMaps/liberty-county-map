import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildProjection } from '../tools/build-statewide-consumer-community-projection.mjs';

const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gridly-community-projection-'));
  const packageRoot = path.join(root, 'packages');
  const counties = path.join(packageRoot, 'counties');
  fs.mkdirSync(counties, { recursive: true });
  const identities = [];
  for (let index = 1; index <= 254; index++) {
    const countyFips = `48${String(index).padStart(3, '0')}`;
    const censusPlaces = [{ placeGeoid: `48${String(index).padStart(5, '0')}`, displayName: `Place ${index}`, governedType: 'INCORPORATED_PLACE', consumerEligible: true, countyMemberships: [countyFips] }];
    if (index === 1) censusPlaces.push({ placeGeoid: '4899001', displayName: 'Shared Place', governedType: 'CENSUS_DESIGNATED_PLACE', consumerEligible: true, countyMemberships: ['48001', '48002'] });
    if (index === 2) censusPlaces.push({ placeGeoid: '4899001', displayName: 'Shared Place', governedType: 'CENSUS_DESIGNATED_PLACE', consumerEligible: true, countyMemberships: ['48001', '48002'] });
    if (index === 3) censusPlaces.push({ placeGeoid: '4899002', displayName: 'Governed C9', governedType: 'INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE', consumerEligible: false, countyMemberships: ['48003'] });
    const payload = { schemaVersion: 'gridly.community-package.identity.v1', county: { countyFips, displayName: `County ${index}` }, censusPlaces, legacyAwarenessAreas: [], communities: [] };
    const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(path.join(counties, `${countyFips}.json`), bytes);
    identities.push({ countyFips, countyName: `County ${index}`, schemaVersion: payload.schemaVersion, relativePackagePath: `counties/${countyFips}.json`, byteLength: bytes.byteLength, sha256: digest(bytes) });
  }
  const inventoryPath = path.join(root, 'inventory.json');
  fs.writeFileSync(inventoryPath, `${JSON.stringify({ schemaVersion: 'gridly.community-package.portable-identity-inventory.lp1885.v1', source: 'LP188.3 authoritative statewide package manufacturing', expectedCountyCount: 254, packages: identities }, null, 2)}\n`);
  return { root, packageRoot, inventoryPath, identities };
}

test('projects governed eligible identities and preserves complete memberships and exclusions', () => {
  const data = fixture();
  try {
    const { artifact } = buildProjection({ packageRoot: data.packageRoot, inventoryPath: data.inventoryPath, write: false });
    assert.deepEqual(artifact.provenance.sourcePackageCount, 254);
    assert.deepEqual(artifact.provenance.acceptedPackageCount, 254);
    assert.deepEqual(artifact.counts, { uniquePlaceCount: 255, membershipCount: 256, multiCountyPlaceCount: 1, excludedIneligibleCount: 1 });
    assert.deepEqual(artifact.communities.find(row => row.placeGeoid === '4899001').countyMemberships, ['48001', '48002']);
    assert.equal(artifact.exclusions[0].governedType, 'INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE');
    assert.equal(artifact.counties.find(row => row.countyFips === '48003').exclusions.length, 1);
  } finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});

test('two builds are byte-identical and contain no timestamp provenance', () => {
  const data = fixture();
  try {
    const first = buildProjection({ packageRoot: data.packageRoot, inventoryPath: data.inventoryPath, write: false }).bytes;
    const second = buildProjection({ packageRoot: data.packageRoot, inventoryPath: data.inventoryPath, write: false }).bytes;
    assert.deepEqual(first, second);
    assert.doesNotMatch(first.toString(), /generatedAt|timestamp/i);
  } finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});

test('fails closed for missing, byte-length, hash, FIPS, and incomplete membership identity', () => {
  for (const failure of ['missing', 'bytes', 'hash', 'fips', 'membership']) {
    const data = fixture();
    try {
      const target = path.join(data.packageRoot, 'counties/48001.json');
      if (failure === 'missing') fs.rmSync(target);
      if (failure === 'bytes') fs.appendFileSync(target, ' ');
      if (failure === 'hash') { data.identities[0].sha256 = '0'.repeat(64); fs.writeFileSync(data.inventoryPath, JSON.stringify({ schemaVersion: 'gridly.community-package.portable-identity-inventory.lp1885.v1', source: 'fixture', expectedCountyCount: 254, packages: data.identities })); }
      if (failure === 'fips' || failure === 'membership') {
        const payload = JSON.parse(fs.readFileSync(target));
        if (failure === 'fips') payload.county.countyFips = '48002';
        else payload.censusPlaces.find(row => row.placeGeoid === '4899001').countyMemberships = ['48001'];
        const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`); fs.writeFileSync(target, bytes);
        data.identities[0].byteLength = bytes.byteLength; data.identities[0].sha256 = digest(bytes);
        fs.writeFileSync(data.inventoryPath, JSON.stringify({ schemaVersion: 'gridly.community-package.portable-identity-inventory.lp1885.v1', source: 'fixture', expectedCountyCount: 254, packages: data.identities }));
      }
      assert.throws(() => buildProjection({ packageRoot: data.packageRoot, inventoryPath: data.inventoryPath, write: false }), /failed closed/);
    } finally { fs.rmSync(data.root, { recursive: true, force: true }); }
  }
});

test('requires exactly 254 inventory identities', () => {
  const data = fixture();
  try {
    data.identities.pop();
    fs.writeFileSync(data.inventoryPath, JSON.stringify({ schemaVersion: 'gridly.community-package.portable-identity-inventory.lp1885.v1', source: 'fixture', expectedCountyCount: 254, packages: data.identities }));
    assert.throws(() => buildProjection({ packageRoot: data.packageRoot, inventoryPath: data.inventoryPath, write: false }), /exactly 254/);
  } finally { fs.rmSync(data.root, { recursive: true, force: true }); }
});
