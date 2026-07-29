import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  buildPendingRecord, lookupFingerprint, normalizeGeography, normalizeHouseNumber, normalizeRoadIdentity,
  redactedVerification, validateCredentials
} from '../scripts/lp103-rural-address-admin-lib.mjs';

const synthetic = Object.freeze({
  houseNumber: '412', road: 'County Road 912', locality: 'Exampleville', countyId: 'Example County',
  state: 'TX', postalCode: '75001', latitude: '32.95', longitude: '-96.84',
  coordinateSource: 'synthetic_test_fixture', verificationMethod: 'owner_confirmed_gps',
  verificationDate: '2026-07-29', sourceAuthority: 'synthetic owner authorization',
  aliasesJson: '["CR 912"]', precision: 'verified_entrance'
});
const privateSentinel = 'SYNTHETIC_PRIVATE_SENTINEL_8f41';

assert.deepEqual(['County Road 912', 'County Rd 912', 'CR 912', 'Co Rd 912'].map(normalizeRoadIdentity), Array(4).fill('cr 912'));
assert.equal(lookupFingerprint(synthetic), 'adbf4a21b4767c243e9bb9a864ba1b0322a99476a82ab000e740b82eaef78c26',
  'fingerprint includes JSON string encoding used by Edge crypto.subtle');
const edgeLookup = [normalizeHouseNumber(synthetic.houseNumber), normalizeRoadIdentity(synthetic.road),
  normalizeGeography(synthetic.state), synthetic.postalCode.slice(0, 5)].join('|');
const edgeDigest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(edgeLookup))))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
assert.equal(lookupFingerprint(synthetic), edgeDigest, 'Node administrator and Edge digest algorithms agree');

const record = buildPendingRecord(synthetic);
assert.equal(record.verification_status, 'pending');
assert.equal(record.consumer_eligible, false, 'enrollment is ineligible until separate approval');
assert.throws(() => buildPendingRecord({ ...synthetic, latitude: '24' }), /Invalid latitude/);
assert.throws(() => buildPendingRecord({ ...synthetic, longitude: '-200' }), /Invalid longitude/);
assert.throws(() => validateCredentials({}), /missing service URL/);

const redacted = redactedVerification({ verification_status: 'verified', consumer_eligible: true, latitude: 32, longitude: -96, source_authority: privateSentinel });
assert.deepEqual(redacted, { recordFound: true, verificationStatus: 'verified', consumerEligible: true,
  coordinatePresent: true, sourceAuthorityPresent: true, privateValuesRedacted: true });
assert.doesNotMatch(JSON.stringify(redacted), new RegExp(privateSentinel));

const enrollment = fs.readFileSync('scripts/lp103-enroll-verified-rural-address.mjs', 'utf8');
const approval = fs.readFileSync('scripts/lp103-approve-verified-rural-address.mjs', 'utf8');
assert.match(enrollment, /verificationStatus: 'pending'/);
assert.doesNotMatch(enrollment, /consumerEligible: true/);
assert.match(approval, /APPROVE VERIFIED RURAL ADDRESS/);
assert.match(approval, /verification_status: 'verified', consumer_eligible: true/);
assert.match(approval, /--verify/);

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).trim().split('\n');
assert(!tracked.includes('.env.lp103.local'), 'populated environment file is not tracked');
assert(fs.readFileSync('.gitignore', 'utf8').split(/\r?\n/).includes('.env.lp103.local'));
for (const file of ['.env.lp103.local.example', 'scripts/lp103-rural-address-admin-lib.mjs',
  'scripts/lp103-enroll-verified-rural-address.mjs', 'scripts/lp103-approve-verified-rural-address.mjs']) {
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), new RegExp(privateSentinel));
}

console.log('LP103.1 secure rural address enrollment contracts passed.');
