import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');

test('product details remain unretouched crops of inspected native captures', () => {
  // Source coordinates and hashes are recorded in the execution artifact's imagery-provenance.json.
  // Hero/local/review source: gridly-product-current.png; Search source: .artifacts/lp24424a-search.png.
  const expected = {
    'gridly-hero.png': '6f79f6633f2b9c8dd7037267996dddc4caaba0c0421da1993c24e22221e5c94c',
    'gridly-local-detail.png': '6de37deff5ef3da80818c3cc629aaa6b4d0a9e8c4133eca86d6d6fb72bc126d6',
    'gridly-search-detail.png': '6246e919be5cc80981b4aa55ac07b3a6c0f8ca95fedf8149b74adc5b4ca915d9',
    'gridly-review-detail.png': 'a7217efb51dcaae319bd2606822fce5d1cdbabf0c11a85e6903a57b4914b0325',
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
