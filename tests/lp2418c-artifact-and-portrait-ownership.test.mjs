import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ROOT, isIncluded, REMOTE_GEOMETRY } from '../tools/lp1831/prepare-cloudflare-preview-artifact.mjs';
import { trackedPaths } from '../tools/lp18321/git-asset-identity.mjs';

const strip = (value) => decodeURIComponent(value.split(/[?#]/, 1)[0].replace(/^\.\//, ''));
const local = (value) => value && !/^(?:[a-z]+:|\/\/|#|data:)/i.test(value);
function entrypointReferences(root = ROOT) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const refs = new Set();
  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) if (local(match[1])) refs.add(strip(match[1]));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  for (const icon of manifest.icons || []) if (local(icon.src)) refs.add(strip(icon.src));
  for (const shortcut of manifest.shortcuts || []) {
    if (local(shortcut.url)) refs.add(strip(shortcut.url));
    for (const icon of shortcut.icons || []) if (local(icon.src)) refs.add(strip(icon.src));
  }
  // Stylesheets are deployed entrypoints too: their local url() dependencies
  // must be present even when the browser discovers them after parsing HTML.
  for (const stylesheet of [...refs].filter((ref) => ref.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(root, stylesheet), 'utf8');
    for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      if (!local(match[1])) continue;
      refs.add(path.posix.normalize(path.posix.join(path.posix.dirname(stylesheet), strip(match[1]))));
    }
  }
  return [...refs].sort();
}

test('LP241.8C generic artifact contains every local deployed-entrypoint reference', () => {
  const staged = new Set(trackedPaths(ROOT).filter(isIncluded));
  const references = entrypointReferences();
  const missing = references.filter((reference) => !staged.has(reference));
  assert.deepEqual(missing, [], `missing runtime references:\n${missing.join('\n')}`);
  assert.ok(staged.has('audits/lp2403-condition-label-audit.js'));
  const oversized = [...staged].filter((file) => fs.statSync(path.join(ROOT, file)).size > 25 * 1024 * 1024);
  assert.deepEqual(oversized, [REMOTE_GEOMETRY.canonicalPath]);
});

test('LP241.8C JavaScript references cannot be an HTML fallback', () => {
  const staged = new Set(trackedPaths(ROOT).filter(isIncluded));
  const index = fs.readFileSync(path.join(ROOT, 'index.html'));
  for (const reference of entrypointReferences().filter((ref) => ref.endsWith('.js'))) {
    assert.ok(staged.has(reference), reference);
    const bytes = fs.readFileSync(path.join(ROOT, reference));
    assert.notDeepEqual(bytes, index, `${reference} fell through to index.html`);
    assert.match(bytes.subarray(0, 512).toString('utf8'), /(?:function|const|let|var|class|=>|window\.|import\s)/, `${reference} is not JavaScript`);
  }
});

test('LP241.8C ownership boundary preserves only the shared map substrate', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  assert.match(app, /window\.gridlyLP2418PortraitOwnershipAudit/);
  assert.match(app, /GRIDLY_PORTRAIT_DUPLICATE_ROOTS/);
  assert.match(app, /legacyDashboard\?\.setAttribute\("inert"/);
  assert.match(css, /#mapSection > \.map-card > \.map-frame > :not\(#map\)/);
});
