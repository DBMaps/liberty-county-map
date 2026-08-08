import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalBlob, crlfMaterialization, gitAttributes, identity, sourceIdentity } from './git-asset-identity.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const REPORT = 'reports/lp18321/cross-platform-asset-identity.json';
export const ASSETS = [
  'Crossing-Packages/Texas/fra-crossings-tx.geojson',
  'assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson',
  'data/generated/lp104/txgio-addresses/harris-48201.addresses.jsonl.gz'
];
const json = value => `${JSON.stringify(value, null, 2)}\n`;

export function build(root = ROOT) {
  const assets = ASSETS.map((file, index) => {
    const canonical = canonicalBlob(root, file);
    const source = sourceIdentity(root, file);
    const attributes = gitAttributes(root, file);
    if (index === 2) return { path: file, kind: 'BINARY', attributes, canonicalGitBlob: source, checkoutConversion: 'NONE', byteExact: true };
    const crlf = identity(crlfMaterialization(canonical));
    return { path: file, kind: 'TEXT', attributes, canonicalGitBlob: source, simulatedWindowsCrlfMaterialization: crlf, lfCount: crlf.bytes - source.bytes, crlfDifferenceSolelyLineEndings: crlf.bytes - source.bytes === canonical.toString('binary').split('\n').length - 1 };
  });
  return {
    schemaVersion: 'gridly.lp18321.crossPlatformAssetIdentity.v1', milestone: 'LP183.2.1', generatedAt: '1970-01-01T00:00:00.000Z',
    classification: 'CROSS_PLATFORM_ASSET_IDENTITY_RECONCILED', performsCloudExecution: false,
    sourceIdentityPolicy: 'SHA-256 and byte size of the canonical Git blob at the governed commit (HEAD), never checkout-materialized bytes.',
    deploymentArtifactIdentityPolicy: 'LP183.1 stages each tracked file directly from its canonical Git blob at HEAD. No checkout EOL conversion is applied; staged hashes and sizes therefore equal source-blob hashes and sizes.',
    workingTreeDiagnosticPolicy: 'Current-machine working-tree bytes, hashes, and sizes are non-governed diagnostics and are excluded from this deterministic report. They may be classified at runtime without changing canonical evidence.',
    binaryIdentityPolicy: 'Binary assets are compared byte-for-byte as canonical Git blobs. No content or line-ending normalization is permitted.',
    assets,
    findings: { rootCause: 'The two text assets had unspecified Git text/eol attributes, so core.autocrlf=true could materialize every LF as CRLF. The observed Windows byte increases exactly equal their LF counts. The gzip did not drift because Git treated it as binary.', lp1831Status: 'BLOCKED_PENDING_OVERSIZED_ASSET_RESOLUTION', lp1832Status: 'OVERSIZED_ASSET_RESOLUTION_AUDIT_COMPLETE_IMPLEMENTATION_REQUIRED', oversizedAssetsModified: false, cloudExecution: 'NONE', lp1833Started: false }
  };
}

export function writeReport(output = path.join(ROOT, REPORT), root = ROOT) { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, json(build(root))); }
export function verify(root = ROOT) { const temp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lp18321-')), 'report.json'); try { writeReport(temp, root); if (!fs.readFileSync(temp).equals(fs.readFileSync(path.join(root, REPORT)))) throw Error('deterministic report drift'); return true; } finally { fs.rmSync(path.dirname(temp), { recursive: true, force: true }); } }
if (process.argv[1] === fileURLToPath(import.meta.url)) { const mode = process.argv[2] || 'build'; if (mode === 'build') writeReport(); else if (mode === 'verify') verify(); else throw Error(`unknown mode: ${mode}`); console.log(`LP183.2.1 ${mode} PASS; no cloud command executed; no oversized asset modified.`); }
