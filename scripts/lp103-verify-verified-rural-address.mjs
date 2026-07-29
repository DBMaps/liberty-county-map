#!/usr/bin/env node
import {
  adminRequest, collectLookupInput, lookupFingerprint, redactedVerification, TABLE,
  validateCredentials, validateLookupIdentity
} from './lp103-rural-address-admin-lib.mjs';

async function main() {
  const credentials = validateCredentials(process.env);
  const input = validateLookupIdentity(await collectLookupInput());
  const fingerprint = lookupFingerprint(input);
  const fields = 'verification_status,consumer_eligible,latitude,longitude,source_authority';
  const response = await adminRequest(credentials, `${TABLE}?lookup_hash=eq.${fingerprint}&select=${fields}`, {
    headers: { Accept: 'application/json' }
  });
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length > 1) throw new Error('Private registry returned an invalid result.');
  console.log(JSON.stringify(redactedVerification(rows[0] || null), null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ recordFound: false, privateValuesRedacted: true, error: error.message }));
  process.exitCode = 1;
});
