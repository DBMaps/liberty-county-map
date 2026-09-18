import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');

test('featured product evidence tells one coherent Dayton story', () => {
  assert.doesNotMatch(homepage, /Dallas|Nearby places around Dayton/i);
  assert.match(homepage, /Actual Gridly interface · Dayton, Texas/);
  assert.match(homepage, /Find a community\. Dayton search example\./);
  assert.match(homepage, /Know Before You Go\. Dayton Travel Brief\./);
  assert.match(homepage, /Dayton map and local awareness context\./);
  for (const file of ['gridly-hero.png', 'gridly-local-detail.png', 'gridly-search-detail.png', 'gridly-review-detail.png']) {
    const img = homepage.match(new RegExp('<img[^>]+src="/assets/' + file + '"[^>]+>'))[0];
    assert.match(img, /alt="[^"]*Dayton/);
    const png = readFileSync(join(root, 'public-site/assets', file));
    assert.ok(img.includes(`width="${png.readUInt32BE(16)}" height="${png.readUInt32BE(20)}"`));
  }
});

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
  // Owner-authoritative Dayton sources and rectangles: docs/launch/GRIDLY-LP24442-DAYTON-IMAGERY.md.
  const expected = {
    'gridly-hero.png': '52e7aee1bb93fcf3925c425d5a6c9a5382d8de92dc6c3f2f6e0e567d03c1e355',
    'gridly-local-detail.png': '801a0ea2f6035734e9f9197127cae3d01de732505aace56ad975b4fd699354f6',
    'gridly-search-detail.png': '4890f10e48f0c0f816b0c89da63ef3ca71e24133801bc822fc9fe2563fa68fe8',
    'gridly-review-detail.png': 'c87d5d65e89bed6aaa4f6020ad3d6f03836d67990fc527a7c1fe0ff25c4cd188',
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
