import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');

test('final product copy separates launch capabilities from store distribution', () => {
  assert.match(homepage, /See community-reported conditions and help keep local information current\./);
  assert.match(homepage, /For adults 18 and over\./);
  assert.match(homepage, /Coming soon to the Apple App Store and Google Play\./);
  assert.equal((homepage.match(/coming soon/gi) || []).length, 1);
  assert.doesNotMatch(homepage, /Public community reporting is not open yet|Planned for adults|limited local coverage|temporarily unavailable|not ready|not implemented|\b(?:disabled|inactive|beta|test|preview|internal|experimental)\b/i);
  for (const route of ['privacy', 'terms', 'community-guidelines', 'delete-data', 'support']) {
    const page = readFileSync(join(root, 'public-site', route, 'index.html'), 'utf8');
    assert.doesNotMatch(page, /reporting is not open|planned for adults|limited local coverage|temporarily unavailable|\b(?:beta|debug|experimental)\b/i);
    assert.doesNotMatch(page, /<script\b|<iframe\b|<form\b/i);
  }
});

test('product details remain unretouched crops of inspected native captures', () => {
  // Source coordinates and hashes are recorded in the execution artifact's imagery-provenance.json.
  // All four crops use the genuine quiet-state native capture .artifacts/lp24424a-search.png.
  const expected = {
    'gridly-hero.png': '8e2a661c5a4f18e9e9cb0a05c8efeb7cb22213d414b50197aeafcd2cdd1fcee8',
    'gridly-local-detail.png': '2b40917dd30a3e92fb9a0c195e46fb66dedba2c170e425ae1a010a4eada72c6e',
    'gridly-search-detail.png': '6246e919be5cc80981b4aa55ac07b3a6c0f8ca95fedf8149b74adc5b4ca915d9',
    'gridly-review-detail.png': '60068dfe0a3f2ffed8eb99a3e29c1ba23caf68debb4e2b36251d82a20a5a3502',
  };
  for (const [file, hash] of Object.entries(expected)) {
    assert.equal(createHash('sha256').update(readFileSync(join(root, 'public-site/assets', file))).digest('hex'), hash, file);
  }
});

// The Astra brief supersedes the earlier decorative layout requirements.
test('experience message states the consumer journey directly', () => {
  assert.match(homepage, /<h2 id="experience-title">Know before you go\.<\/h2>/);
  for (const statement of ['Choose a Texas community or destination.', 'Check available local conditions and alerts.', 'Leave with a clearer picture.']) assert.ok(homepage.includes(statement));
  assert.doesNotMatch(homepage, /in three clear steps|three clear moves/);
});
test('self-hosted typography has a bundled open license and no remote font request', () => {
  assert.match(css, /@font-face/);
  assert.match(css, /url\('\/assets\/InterVariable\.woff2'\)/);
  assert.match(readFileSync(join(root, 'public-site/assets/Inter-LICENSE.txt'), 'utf8'), /SIL OPEN FONT LICENSE/);
  assert.doesNotMatch(css, /@import|https?:/);
});
test('Texas uses actual geography without coverage indicators', () => {
  const svg = readFileSync(join(root, 'public-site/assets/texas.svg'), 'utf8');
  assert.match(svg, /254 county boundaries/);
  assert.doesNotMatch(svg, /<script|<circle|<image|coverage is available/i);
  assert.match(homepage, /Silhouette of the state of Texas/);
});
test('trust and footer remain connected to company identity without decorative navigation', () => {
  assert.match(homepage, /<aside class="trust-note" aria-labelledby="trust-title">/);
  assert.match(homepage, /Awareness, not authority/);
  const footer = homepage.match(/<footer[\s\S]*?<\/footer>/)[0];
  assert.doesNotMatch(footer, /↗|→|<span>gridlygo.com/);
  for (const route of ['privacy','terms','community-guidelines','delete-data','support']) assert.ok(footer.includes('href="/'+route+'"'));
});
