#!/usr/bin/env node
import { adminRequest, buildPendingRecord, collectInput, TABLE, validateCredentials } from './lp103-rural-address-admin-lib.mjs';

async function main() {
  const credentials = validateCredentials(process.env);
  const record = buildPendingRecord(await collectInput());
  await adminRequest(credentials, `${TABLE}?on_conflict=lookup_hash`, {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(record)
  });
  console.log(JSON.stringify({ enrolled: true, verificationStatus: 'pending', consumerEligible: false, privateValuesRedacted: true }, null, 2));
}

main().catch((error) => { console.error(JSON.stringify({ enrolled: false, privateValuesRedacted: true, error: error.message })); process.exitCode = 1; });
