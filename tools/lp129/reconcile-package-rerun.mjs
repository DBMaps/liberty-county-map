#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const files = [
  'burleson-48051.addresses.jsonl.gz',
  'trinity-48455.addresses.jsonl.gz',
  'victoria-48469.addresses.jsonl.gz'
];
const value = (flag) => process.argv[process.argv.indexOf(flag) + 1];
const first = value('--first');
const second = value('--second');
if (!first || !second) {
  console.error('Usage: node tools/lp129/reconcile-package-rerun.mjs --first <package-dir> --second <package-dir>');
  process.exitCode = 2;
} else {
  let mismatch = false;
  for (const filename of files) {
    const inspect = async (directory) => {
      const path = join(directory, filename);
      return { bytes: (await stat(path)).size, sha256: createHash('sha256').update(await readFile(path)).digest('hex') };
    };
    const a = await inspect(first);
    const b = await inspect(second);
    const identical = a.bytes === b.bytes && a.sha256 === b.sha256;
    mismatch ||= !identical;
    console.log(JSON.stringify({ filename, first: a, second: b, identical }));
  }
  if (mismatch) process.exitCode = 1;
}
