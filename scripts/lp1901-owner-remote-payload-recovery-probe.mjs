#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUCKET, PREFIX, redact } from '../tools/lp108/lp108-core.mjs';
import { credentials, isDefinitiveStorageNotFound, storageObjectPath, storageRequest } from '../tools/lp108/sync-certified-address-storage.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const AUDIT_PATH = join(ROOT, 'reports/lp190/restricted-county-lp130-recovery-audit.json');
export const EVIDENCE_PATH = join(ROOT, 'evidence/lp1901/owner-remote-payload-probe.local.json');
export const QUARANTINE = join(ROOT, 'evidence/lp1901/recovered-payloads.local');
export const SCHEMA = 'gridly.lp1901.owner-remote-payload-probe.v1';
export const EXPECTED_FIPS = ['48061','48073','48113','48121','48135','48229','48329','48377','48401','48425','48441'];
const HASH = /^[a-f0-9]{64}$/;
const CLASSIFICATIONS = new Set(['REMOTE_OBJECT_PRESENT_METADATA_MATCH','REMOTE_OBJECT_PRESENT_METADATA_MISMATCH','REMOTE_OBJECT_PRESENT_IDENTITY_UNVERIFIED','REMOTE_OBJECT_NOT_FOUND','OWNER_CREDENTIALS_REQUIRED','PROBE_ERROR_FAIL_CLOSED','REMOTE_OBJECT_EXACT_MATCH','REMOTE_OBJECT_BYTE_LENGTH_MISMATCH','REMOTE_OBJECT_SHA256_MISMATCH','DOWNLOAD_ERROR_FAIL_CLOSED']);
const exact = bytes => ({ actualByteLength: bytes.byteLength, actualSha256: createHash('sha256').update(bytes).digest('hex') });

export function parseArguments(argv) {
  const selected = argv.filter(value => ['--whatif','--probe','--recover-quarantine','--verify-owner-evidence'].includes(value));
  const unknown = argv.filter(value => ![...selected, '--json'].includes(value));
  if (unknown.length) throw new Error(`unknown option: ${unknown[0]}`);
  if (selected.length !== 1) throw new Error('select exactly one of --whatif, --probe, --recover-quarantine, or --verify-owner-evidence');
  return { mode: selected[0].slice(2), json: argv.includes('--json') };
}

export async function governedExpectations(path = AUDIT_PATH) {
  const audit = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(audit.counties) || audit.counties.length !== 11 || JSON.stringify(audit.counties.map(x => x.countyFips).sort()) !== JSON.stringify(EXPECTED_FIPS)) throw new Error('LP190 governed restricted FIPS set is not exact');
  return audit.counties.map(item => {
    if (!HASH.test(item.expectedSha256) || !Number.isSafeInteger(item.expectedByteLength) || item.expectedByteLength <= 0) throw new Error(`invalid governed identity (${item.countyFips})`);
    const filename = basename(item.lp130ExpectedArtifact);
    const expectedFilename = `${item.countyName.toLowerCase().replaceAll(' ', '-')}-${item.countyFips}.addresses.jsonl.gz`;
    if (filename !== expectedFilename || item.lp130ExpectedArtifact !== `data/generated/lp104/txgio-addresses/${filename}`) throw new Error(`remote key cannot be deterministically established (${item.countyFips})`);
    return { countyFips: item.countyFips, countyName: item.countyName, lp130ExpectedArtifact: item.lp130ExpectedArtifact,
      expectedByteLength: item.expectedByteLength, expectedSha256: item.expectedSha256, remoteObjectKey: `${PREFIX}/${filename}` };
  });
}

const safeError = error => redact(error?.message || String(error)).slice(0, 320);
const evidence = (mode, counties) => ({ schemaVersion: SCHEMA, milestone: 'LP190.1', mode, provider: 'Supabase Storage', projectUrlEnvironmentVariable: 'SUPABASE_URL (GRIDLY_SUPABASE_URL fallback)', bucket: BUCKET,
  credentialRequirement: 'SUPABASE_SERVICE_ROLE_KEY', capturedAt: new Date().toISOString(), productionWritesPerformed: false, counties });
async function saveEvidence(value, path = EVIDENCE_PATH) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); }

async function requestObject(auth, item, method, hooks) {
  return storageRequest(auth, storageObjectPath(BUCKET, item.remoteObjectKey), { method }, { attempts: 3, timeoutMs: 300000, ...hooks });
}
async function failure(response) {
  let body = ''; try { body = await response.text(); } catch {}
  return isDefinitiveStorageNotFound(response.status, body) ? 'REMOTE_OBJECT_NOT_FOUND' : null;
}

export async function probe(expectations, env = process.env, hooks = {}) {
  let auth;
  try { auth = credentials(env); } catch (error) {
    const result = evidence('probe', expectations.map(item => ({ ...item, classification: 'OWNER_CREDENTIALS_REQUIRED', errorSummary: safeError(error) })));
    if (!hooks.noWrite) await saveEvidence(result, hooks.evidencePath); return result;
  }
  const counties = [];
  for (const item of expectations) {
    try {
      const response = await requestObject(auth, item, 'HEAD', hooks);
      if (!response.ok) { const missing = await failure(response); counties.push({ ...item, classification: missing || 'PROBE_ERROR_FAIL_CLOSED', ...(missing ? {} : { errorSummary: `Storage metadata request failed (${response.status})` }) }); continue; }
      const value = response.headers.get('content-length');
      const actualByteLength = value !== null && /^\d+$/.test(value) ? Number(value) : null;
      const metadata = { contentType: response.headers.get('content-type'), etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') };
      const classification = actualByteLength === null ? 'REMOTE_OBJECT_PRESENT_IDENTITY_UNVERIFIED' : actualByteLength === item.expectedByteLength ? 'REMOTE_OBJECT_PRESENT_METADATA_MATCH' : 'REMOTE_OBJECT_PRESENT_METADATA_MISMATCH';
      counties.push({ ...item, actualByteLength, classification, providerMetadata: metadata });
    } catch (error) { counties.push({ ...item, classification: 'PROBE_ERROR_FAIL_CLOSED', errorSummary: safeError(error) }); }
  }
  const result = evidence('probe', counties); if (!hooks.noWrite) await saveEvidence(result, hooks.evidencePath); return result;
}

export function classifyBytes(item, bytes) {
  const identity = exact(bytes);
  return { ...identity, classification: identity.actualByteLength !== item.expectedByteLength ? 'REMOTE_OBJECT_BYTE_LENGTH_MISMATCH' : identity.actualSha256 !== item.expectedSha256 ? 'REMOTE_OBJECT_SHA256_MISMATCH' : 'REMOTE_OBJECT_EXACT_MATCH' };
}
function assertQuarantinePath(path, root = ROOT) {
  const governed = resolve(root, 'data/generated/lp104/txgio-addresses'); const target = resolve(path); const quarantine = resolve(root, 'evidence/lp1901/recovered-payloads.local');
  if (!(target === quarantine || target.startsWith(`${quarantine}${sep}`)) || target === governed || target.startsWith(`${governed}${sep}`)) throw new Error('recovery destination is not the owner-local quarantine');
}
export async function recover(expectations, env = process.env, hooks = {}) {
  let auth; try { auth = credentials(env); } catch (error) { const result = evidence('recover-quarantine', expectations.map(item => ({ ...item, classification: 'DOWNLOAD_ERROR_FAIL_CLOSED', errorSummary: safeError(error) }))); if (!hooks.noWrite) await saveEvidence(result, hooks.evidencePath); return result; }
  const quarantine = hooks.quarantine || QUARANTINE; assertQuarantinePath(quarantine, hooks.root || ROOT); await mkdir(quarantine, { recursive: true }); const counties = [];
  for (const item of expectations) {
    const target = join(quarantine, basename(item.lp130ExpectedArtifact)); assertQuarantinePath(target, hooks.root || ROOT);
    try {
      const response = await requestObject(auth, item, 'GET', hooks);
      if (!response.ok) { const missing = await failure(response); counties.push({ ...item, classification: missing || 'DOWNLOAD_ERROR_FAIL_CLOSED', ...(missing ? {} : { errorSummary: `Storage download failed (${response.status})` }) }); continue; }
      const bytes = Buffer.from(await response.arrayBuffer()); const identity = classifyBytes(item, bytes); const temporary = `${target}.${process.pid}.tmp`; await writeFile(temporary, bytes, { flag: 'wx' }); await rename(temporary, target);
      counties.push({ ...item, ...identity, quarantinedLocalPath: relative(ROOT, target).replaceAll(sep, '/') });
    } catch (error) { counties.push({ ...item, classification: 'DOWNLOAD_ERROR_FAIL_CLOSED', errorSummary: safeError(error) }); }
  }
  const result = evidence('recover-quarantine', counties); if (!hooks.noWrite) await saveEvidence(result, hooks.evidencePath); return result;
}

async function digestFile(path) { const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk); return { actualByteLength: (await stat(path)).size, actualSha256: hash.digest('hex') }; }
export async function verifyOwnerEvidence(expectations, options = {}) {
  const path = options.evidencePath || EVIDENCE_PATH; const owner = JSON.parse(await readFile(path, 'utf8'));
  if (owner.schemaVersion !== SCHEMA || !Array.isArray(owner.counties) || owner.counties.length !== 11) throw new Error('owner evidence schema/count is invalid');
  if (JSON.stringify(owner.counties.map(x => x.countyFips).sort()) !== JSON.stringify(EXPECTED_FIPS) || new Set(owner.counties.map(x => x.countyFips)).size !== 11) throw new Error('owner evidence has missing, extra, or duplicate counties');
  const byFips = new Map(expectations.map(x => [x.countyFips, x]));
  for (const row of owner.counties) {
    const expected = byFips.get(row.countyFips);
    if (!CLASSIFICATIONS.has(row.classification) || row.countyName !== expected.countyName || row.lp130ExpectedArtifact !== expected.lp130ExpectedArtifact || row.remoteObjectKey !== expected.remoteObjectKey) throw new Error(`invalid owner evidence row (${row.countyFips})`);
    if (row.expectedSha256 !== expected.expectedSha256 || row.expectedByteLength !== expected.expectedByteLength || !HASH.test(row.expectedSha256) || !Number.isSafeInteger(row.expectedByteLength) || row.expectedByteLength <= 0) throw new Error(`invalid or drifted expected identity (${row.countyFips})`);
    if (row.actualSha256 !== undefined && !HASH.test(row.actualSha256)) throw new Error(`malformed actual hash (${row.countyFips})`);
    if (row.actualByteLength !== undefined && row.actualByteLength !== null && (!Number.isSafeInteger(row.actualByteLength) || row.actualByteLength < 0)) throw new Error(`invalid actual length (${row.countyFips})`);
    if (row.classification === 'REMOTE_OBJECT_EXACT_MATCH') {
      if (typeof row.quarantinedLocalPath !== 'string') throw new Error(`exact claim lacks quarantine path (${row.countyFips})`);
      const local = resolve(ROOT, row.quarantinedLocalPath); assertQuarantinePath(local); const actual = await digestFile(local);
      if (actual.actualByteLength !== expected.expectedByteLength || actual.actualSha256 !== expected.expectedSha256 || actual.actualByteLength !== row.actualByteLength || actual.actualSha256 !== row.actualSha256) throw new Error(`quarantined byte identity changed (${row.countyFips})`);
    }
  }
  return readiness(owner);
}

export function readiness(owner) {
  const rows = owner?.counties || []; const count = c => rows.filter(x => c.includes(x.classification)).length;
  const aggregate = { expectedCountyCount: 11, remoteObjectsPresent: count(['REMOTE_OBJECT_PRESENT_METADATA_MATCH','REMOTE_OBJECT_PRESENT_METADATA_MISMATCH','REMOTE_OBJECT_PRESENT_IDENTITY_UNVERIFIED','REMOTE_OBJECT_EXACT_MATCH','REMOTE_OBJECT_BYTE_LENGTH_MISMATCH','REMOTE_OBJECT_SHA256_MISMATCH']), remoteObjectsMissing: count(['REMOTE_OBJECT_NOT_FOUND']), metadataMatches: count(['REMOTE_OBJECT_PRESENT_METADATA_MATCH']), metadataMismatches: count(['REMOTE_OBJECT_PRESENT_METADATA_MISMATCH']), exactMatches: count(['REMOTE_OBJECT_EXACT_MATCH']), byteLengthMismatches: count(['REMOTE_OBJECT_BYTE_LENGTH_MISMATCH']), sha256Mismatches: count(['REMOTE_OBJECT_SHA256_MISMATCH']), probeErrors: count(['PROBE_ERROR_FAIL_CLOSED','DOWNLOAD_ERROR_FAIL_CLOSED']), ownerCredentialsRequired: count(['OWNER_CREDENTIALS_REQUIRED']), safeForGovernedRestoration: rows.length === 11 && rows.every(x => x.classification === 'REMOTE_OBJECT_EXACT_MATCH') };
  return { overallClassification: aggregate.safeForGovernedRestoration ? 'EXACT_BYTES_QUARANTINED_OWNER_VERIFIED' : owner ? 'NOT_READY_FAIL_CLOSED' : 'OWNER_EXECUTION_REQUIRED', aggregate, counties: rows };
}

export async function run(argv = process.argv.slice(2), hooks = {}) {
  const options = parseArguments(argv); const expectations = await governedExpectations(hooks.auditPath);
  let result;
  if (options.mode === 'whatif') result = { overallClassification: 'OWNER_EXECUTION_REQUIRED', provider: 'Supabase Storage', bucket: BUCKET, credentialRequirement: 'SUPABASE_URL (or GRIDLY_SUPABASE_URL) plus SUPABASE_SERVICE_ROLE_KEY', plannedOperation: 'Read-only HEAD probe; owner-triggered GET downloads only to ignored quarantine', productionWriteWillOccur: false, countyActivationWillOccur: false, counties: expectations };
  else if (options.mode === 'probe') result = await probe(expectations, hooks.env || process.env, hooks);
  else if (options.mode === 'recover-quarantine') result = await recover(expectations, hooks.env || process.env, hooks);
  else result = await verifyOwnerEvidence(expectations, hooks);
  if (!hooks.silent) console.log(options.json ? JSON.stringify(result, null, 2) : `${options.mode}: ${JSON.stringify(result, null, 2)}`);
  if (['probe','recover-quarantine'].includes(options.mode) && result.counties.some(x => ['OWNER_CREDENTIALS_REQUIRED','PROBE_ERROR_FAIL_CLOSED','DOWNLOAD_ERROR_FAIL_CLOSED'].includes(x.classification))) process.exitCode = 1;
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run().catch(error => { console.error(redact(error.message)); process.exitCode = 1; });
