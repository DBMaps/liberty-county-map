// LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const here = import.meta.dirname;
const base = readFileSync(join(here, '../phase26/apply.sql'), 'utf8');
const expected = '30182990cb1d5551eeddb2fe8b9ac7bf8c0a085c841c036b1fbcff047975253f';
const sha = createHash('sha256').update(base).digest('hex');
if (sha !== expected) throw new Error('Historical package changed');
const seed = readFileSync(join(here, '../phase26/seed-static-contract.sql'), 'utf8');
const extension = readFileSync(join(here, 'extension.sql'), 'utf8') + '\n' + readFileSync(join(here, 'closure.sql'), 'utf8');
// One transaction: historical rehearsal grants are never committed before hardening.
const sql = base.replace('\\ir seed-static-contract.sql', seed)
  .replace('\\ir compatibility.sql', '-- No permanent compatibility wrapper in absent/empty/unreferenced mode.')
  .replace(',dispatch_api.responder_public_projection', '')
  .replace(/COMMIT;\s*$/, () => extension + '\nCOMMIT;\n');
writeFileSync(join(here, 'package.local.sql'), sql);
console.log(JSON.stringify({historicalSha256: sha, packageSha256: createHash('sha256').update(sql).digest('hex')}));
