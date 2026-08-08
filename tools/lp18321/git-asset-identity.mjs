import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

const git = (root, args, options = {}) => execFileSync('git', args, {
  cwd: root,
  encoding: options.encoding,
  maxBuffer: 1024 * 1024 * 1024,
  input: options.input,
  stdio: [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
});

export function trackedPaths(root) {
  return git(root, ['ls-files', '-z']).toString().split('\0').filter(Boolean).sort();
}

export function canonicalBlob(root, file, revision = 'HEAD') {
  return git(root, ['show', `${revision}:${file}`]);
}

export function canonicalBlobs(root, files, revision = 'HEAD') {
  if (!files.length) return new Map();
  const output = git(root, ['cat-file', '--batch'], { input: `${files.map(file => `${revision}:${file}`).join('\n')}\n` });
  const result = new Map();
  let offset = 0;
  for (const file of files) {
    const headerEnd = output.indexOf(10, offset);
    const header = output.subarray(offset, headerEnd).toString('utf8');
    const match = header.match(/^[0-9a-f]+ blob (\d+)$/);
    if (!match) throw Error(`cannot read canonical Git blob for ${file}: ${header}`);
    const size = Number(match[1]);
    const start = headerEnd + 1;
    result.set(file, output.subarray(start, start + size));
    offset = start + size + 1;
  }
  return result;
}

export function gitAttributes(root, file) {
  const output = git(root, ['check-attr', 'text', 'eol', 'binary', '--', file], { encoding: 'utf8' });
  return Object.fromEntries(output.trim().split('\n').map(line => {
    const match = line.match(/^.*?: (text|eol|binary): (.*)$/);
    if (!match) throw Error(`unexpected git check-attr output: ${line}`);
    return [match[1], match[2]];
  }));
}

export function identity(bytes) {
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

export function sourceIdentity(root, file, revision = 'HEAD') {
  const bytes = canonicalBlob(root, file, revision);
  return { ...identity(bytes), gitObjectId: git(root, ['rev-parse', `${revision}:${file}`], { encoding: 'utf8' }).trim() };
}

export function workingIdentity(root, file) {
  return identity(fs.readFileSync(path.join(root, file)));
}

export function crlfMaterialization(bytes) {
  return Buffer.from(bytes.toString('binary').replace(/(?<!\r)\n/g, '\r\n'), 'binary');
}

// This is intentionally diagnostic only. Governed identity must always come from
// sourceIdentity(); a checkout can legitimately differ because of Git EOL
// materialization without changing the blob at HEAD.
export function workingTreeDiagnostic(root, file, kind, revision = 'HEAD') {
  const canonicalBytes = canonicalBlob(root, file, revision);
  const canonical = sourceIdentity(root, file, revision);
  const working = workingIdentity(root, file);
  const expectedCrlf = kind === 'TEXT' ? identity(crlfMaterialization(canonicalBytes)) : null;
  let classification = 'WORKING_TREE_DIFFERS_FROM_CANONICAL';
  if (working.bytes === canonical.bytes && working.sha256 === canonical.sha256) classification = 'CANONICAL_MATCH';
  else if (expectedCrlf && working.bytes === expectedCrlf.bytes && working.sha256 === expectedCrlf.sha256) classification = 'CRLF_CHECKOUT_MATERIALIZATION';
  return { governed: false, identitySource: 'CURRENT_MACHINE_WORKING_TREE', classification, canonical, working, expectedCrlf };
}
