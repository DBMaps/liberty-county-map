#!/usr/bin/env node
import fs from 'node:fs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node tools/Validation/Test-PowerShellInterpolationSafety.mjs <file.ps1> [...]');
  process.exit(2);
}

const unsafePattern = /(?<!`)(?<!\$)\$[A-Za-z_][A-Za-z0-9_]*:/g;
const allowedScopes = new Set(['global', 'local', 'private', 'script', 'using', 'workflow', 'env', 'function', 'variable', 'alias']);
const failures = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(unsafePattern)) {
    const token = match[0].slice(1, -1).toLowerCase();
    if (allowedScopes.has(token)) continue;
    const before = text.slice(0, match.index);
    const line = before.split(/\r?\n/).length;
    const column = before.length - before.lastIndexOf('\n');
    failures.push(`${file}:${line}:${column} unsafe PowerShell interpolation '${match[0]}' (use \${name}: or formatting when a variable is followed by ':')`.replace('${name}', `{${match[0].slice(1, -1)}}`));
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`PowerShell interpolation safety check passed for ${files.length} file(s).`);
