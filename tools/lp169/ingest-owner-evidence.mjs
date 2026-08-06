import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode, evidenceContentIdentity, validateEvidence } from './certify-production-configuration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = process.argv[2];
const destination = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'evidence/lp169/owner-evidence.json');

if (!source) {
  console.error('Usage: node tools/lp169/ingest-owner-evidence.mjs <reviewed-owner-evidence-draft.json> [test-output-path]');
  process.exitCode = 2;
} else {
  try {
    const draft = JSON.parse(fs.readFileSync(path.resolve(source), 'utf8'));
    const evidence = {
      ...draft,
      schemaVersion: 2,
      provenance: {
        ...draft.provenance,
        schemaVersion: 2,
        deterministicContentIdentity: evidenceContentIdentity(draft.records || [])
      }
    };
    validateEvidence(evidence);
    fs.writeFileSync(destination, encode(evidence));
    console.log('LP169 owner evidence ingestion: PASS (sanitized canonical evidence written; no values displayed)');
  } catch {
    console.error('LP169 owner evidence ingestion: SANITIZATION_FAILED (input rejected; no input content displayed)');
    process.exitCode = 1;
  }
}
