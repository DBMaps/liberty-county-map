#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
const pairs = [
  ['assets/location-resolution/gridly-authoritative-county-geometry-v1.json', 'android/app/src/main/assets/public/assets/location-resolution/gridly-authoritative-county-geometry-v1.json'],
  ['assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json', 'android/app/src/main/assets/public/assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json']
];
const copied = [];
const skipped = [];
for (const [src, dest] of pairs) {
  const absSrc = path.join(repoRoot, src);
  const absDest = path.join(repoRoot, dest);
  if (!fs.existsSync(absSrc)) { skipped.push(src); continue; }
  fs.mkdirSync(path.dirname(absDest), { recursive: true });
  fs.copyFileSync(absSrc, absDest);
  copied.push(dest);
}
console.log(JSON.stringify({ copied, skipped }, null, 2));
