import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';

const packagePath = new URL('../data/generated/lp104/txgio-addresses/liberty-48291.addresses.jsonl.gz', import.meta.url);
const certificatePath = new URL('../data/generated/lp1051/certificates/liberty-48291.runtime-certificate.json', import.meta.url);
const certificationPath = new URL('../data/generated/lp1051/certification/liberty-48291.certification.json', import.meta.url);

test('certified Liberty artifact records the unresolved 274 conflict without changing package truth', async () => {
  const bytes = await readFile(packagePath);
  const [certificate, certification] = await Promise.all([
    readFile(certificatePath, 'utf8').then(JSON.parse),
    readFile(certificationPath, 'utf8').then(JSON.parse),
  ]);
  assert.equal(bytes.byteLength, certificate.sizeBytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), certificate.sha256);
  assert.equal(certification.sha256, certificate.sha256);
  assert.equal(certification.certificationStatus, 'PASS');
  assert.equal(certificate.acceptance.interpolation, false);
  assert.equal(certificate.acceptance.nearbyHouseSubstitution, false);

  const records = gunzipSync(bytes).toString('utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length, certification.indexedAddressCount);
  const road = records.filter(({ r, p, z, f }) => r === 'COUNTY ROAD 677' && p === 'DAYTON' && z === '77535' && f === '48291');
  assert.equal(road.length, 23);
  assert.equal(road.filter(({ h }) => h === '274').length, 0, '274 is absent from the certified snapshot');
  assert.equal(road.filter(({ h }) => h === '275').length, 0, '275 is the maintained absent control');
  const exact276 = road.filter(({ h }) => h === '276');
  assert.equal(exact276.length, 1);
  assert.deepEqual({ h: exact276[0].h, r: exact276[0].r, p: exact276[0].p, z: exact276[0].z, f: exact276[0].f },
    { h: '276', r: 'COUNTY ROAD 677', p: 'DAYTON', z: '77535', f: '48291' });
});
