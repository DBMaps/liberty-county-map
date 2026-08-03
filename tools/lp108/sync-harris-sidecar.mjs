#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BUCKET, credentialHeaders, redact } from './lp108-core.mjs';
import { SIDECAR_OBJECT, SIDECAR_CERTIFICATE_OBJECT } from './harris-sidecar-core.mjs';

export const RESPONSE_BODY_LIMIT = 2_000;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const authenticationMode = key => key.startsWith('eyJ')
  ? 'legacy_jwt_apikey_and_authorization'
  : 'modern_sb_secret_apikey_only';

const objectUrl = (base, authenticated, objectPath) => `${base}/storage/v1/object/${authenticated ? 'authenticated/' : ''}${BUCKET}/${objectPath.split('/').map(encodeURIComponent).join('/')}`;
const endpointPath = value => new URL(value).pathname;

export async function boundedResponseText(response, limit = RESPONSE_BODY_LIMIT) {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  try {
    while (text.length < limit) {
      const { done, value } = await reader.read();
      if (done) { text += decoder.decode(); break; }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    if (text.length >= limit) await reader.cancel().catch(() => {});
  }
  return redact(text).slice(0, limit);
}

export async function uploadFailureDetails({ response, objectPath, localByteSize, key, uploadUrl, contentType, remoteExists, replace }) {
  const responseBody = await boundedResponseText(response);
  let parsed;
  if ((response.headers.get('content-type') || '').toLowerCase().includes('json')) {
    try { parsed = JSON.parse(responseBody); } catch { parsed = undefined; }
  }
  const value = field => parsed && typeof parsed === 'object' && parsed[field] != null ? redact(parsed[field]) : null;
  return {
    operation: 'upload',
    objectPath,
    localByteSize,
    httpStatus: response.status,
    httpStatusText: response.statusText,
    responseContentType: response.headers.get('content-type') || '',
    responseBody,
    supabaseErrorCode: value('code') ?? value('errorCode'),
    supabaseErrorMessage: value('message') ?? value('error'),
    statusCode: value('statusCode') ?? value('status'),
    objectAlreadyExistsRemotely: Boolean(remoteExists),
    authenticationMode: authenticationMode(key),
    uploadEndpointPath: endpointPath(uploadUrl),
    contentTypeSent: contentType,
    upsertReplaceMode: replace ? 'replace (PUT, x-upsert=true)' : 'create (POST, x-upsert=false)'
  };
}

export async function syncItems({ command, replace = false, base, key, items, fetchImpl = fetch, log = console.log }) {
  for (const item of items) {
    const bytes = await readFile(item.file);
    item.size ??= bytes.length;
    item.sha ??= digest(bytes);
    let response = await fetchImpl(objectUrl(base, true, item.path), { headers: credentialHeaders(key) });
    let remote = response.ok ? Buffer.from(await response.arrayBuffer()) : null;
    if (command === 'upload' && (!remote || remote.length !== item.size || digest(remote) !== item.sha)) {
      if (remote && !replace) throw new Error(`${item.path} mismatched; pass --replace-mismatched`);
      const uploadUrl = objectUrl(base, false, item.path);
      response = await fetchImpl(uploadUrl, {
        method: remote ? 'PUT' : 'POST',
        headers: { ...credentialHeaders(key), 'content-type': item.type, 'x-upsert': String(Boolean(remote)) },
        body: bytes
      });
      if (!response.ok) {
        const details = await uploadFailureDetails({ response, objectPath: item.path, localByteSize: bytes.length, key, uploadUrl, contentType: item.type, remoteExists: Boolean(remote), replace: Boolean(remote) });
        throw new Error(`${item.path} upload failed (${response.status})\n${JSON.stringify(details, null, 2)}`);
      }
      response = await fetchImpl(objectUrl(base, true, item.path), { headers: credentialHeaders(key) });
      remote = response.ok ? Buffer.from(await response.arrayBuffer()) : null;
    }
    if (!remote || remote.length !== item.size || digest(remote) !== item.sha) throw new Error(`${item.path} remote byte verification failed`);
    log(`${item.path}: ${item.size} bytes ${item.sha} matching`);
  }
}

export async function run(argv = process.argv.slice(2), env = process.env, options = {}) {
  const command = argv[0], replace = argv.includes('--replace-mismatched');
  const base = String(env.SUPABASE_URL || env.GRIDLY_SUPABASE_URL || '').replace(/\/$/, ''), key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!['upload', 'verify-remote'].includes(command)) throw new Error('usage: upload|verify-remote [--replace-mismatched]');
  if (!base || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const dir = join(process.cwd(), '.artifacts/lp108'), certPath = join(dir, 'harris-48201.certified-lookup-certificate.json');
  const cert = JSON.parse(await readFile(certPath, 'utf8'));
  const items = [
    { path: SIDECAR_OBJECT, file: join(dir, 'harris-48201.certified-lookup.bin'), size: cert.sizeBytes, sha: cert.sha256, type: 'application/octet-stream' },
    { path: SIDECAR_CERTIFICATE_OBJECT, file: certPath, type: 'application/json' }
  ];
  return syncItems({ command, replace, base, key, items, ...options });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await run();
