#!/usr/bin/env node
import { adminRequest, collectLookupInput, lookupFingerprint, redactedVerification, TABLE, validateCredentials, validateLookupIdentity } from './lp103-rural-address-admin-lib.mjs';

async function locate(credentials, fingerprint) {
  const fields = 'verification_status,consumer_eligible,latitude,longitude,source_authority';
  const response = await adminRequest(credentials, `${TABLE}?lookup_hash=eq.${fingerprint}&select=${fields}`, { headers: { Accept: 'application/json' } });
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('Private registry returned an invalid result.');
  return rows[0] || null;
}

async function main() {
  const credentials = validateCredentials(process.env);
  const input = validateLookupIdentity(await collectLookupInput());
  const fingerprint = lookupFingerprint(input);
  if (process.argv.includes('--verify')) {
    console.log(JSON.stringify(redactedVerification(await locate(credentials, fingerprint)), null, 2));
    return;
  }
  const confirmation = process.env.LP103_APPROVAL_CONFIRMATION ?? '';
  if (confirmation !== 'APPROVE VERIFIED RURAL ADDRESS') throw new Error('Explicit approval confirmation was not provided.');
  const current = await locate(credentials, fingerprint);
  if (!current) throw new Error('No matching pending private record was found.');
  await adminRequest(credentials, `${TABLE}?lookup_hash=eq.${fingerprint}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ verification_status: 'verified', consumer_eligible: true, updated_at: new Date().toISOString() })
  });
  console.log(JSON.stringify({ approved: true, verificationStatus: 'verified', consumerEligible: true, privateValuesRedacted: true }, null, 2));
}

main().catch((error) => { console.error(JSON.stringify({ approved: false, privateValuesRedacted: true, error: error.message })); process.exitCode = 1; });
