import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPORT_NAMES, ROOT, writeReports } from './audit-production-readiness.mjs';

export function verify(root = ROOT) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lp168-verify-'));
  try {
    const first = path.join(temporary, 'first');
    const second = path.join(temporary, 'second');
    writeReports(first, root);
    writeReports(second, root);
    for (const name of REPORT_NAMES) {
      const a = fs.readFileSync(path.join(first, name));
      const b = fs.readFileSync(path.join(second, name));
      if (!a.equals(b)) throw new Error(`LP168 nondeterministic report: ${name}`);
      const governed = fs.readFileSync(path.join(root, 'reports/lp168', name));
      if (!a.equals(governed)) throw new Error(`LP168 governed report drift: ${name}`);
    }
    return true;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verify();
  console.log('LP168 deterministic verification: PASS');
}
