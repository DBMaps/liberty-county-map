import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');
const productImage = readFileSync(join(root, 'public-site/assets/gridly-product-current.png'));

test('surgical polish preserves the approved page architecture and story order', () => {
  const main = homepage.match(/<main\b[\s\S]*?<\/main>/)?.[0] || '';
  const sections = [...main.matchAll(/<section\b[^>]*class="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(sections, [
    'hero-section',
    'capabilities-section',
    'experience-section',
    'texas-section',
    'company-section',
  ]);
  assert.match(homepage, /<h1 id="home-title">See what’s ahead\.<\/h1>/);
  assert.match(homepage, /<h2 id="product-title">Know what matters\.<\/h2>/);
});

test('real Gridly interface remains the dominant product proof', () => {
  assert.match(homepage, /src="\/assets\/gridly-product-current\.png"/);
  assert.equal(
    createHash('sha256').update(productImage).digest('hex'),
    '44baf377f5fb72d2f425e60b52bd3f9d276d56a75bed47c66df8562e22dfbaac',
  );
  assert.match(css, /\.device-frame\s*{[\s\S]*?width:\s*min\(100%, 28rem\)/);
});

test('awareness signals use clear headings without unexplained acronym labels', () => {
  for (const heading of ['Weather Awareness', 'Railroad Crossings', 'Nearby Places', 'Community Awareness']) {
    assert.match(homepage, new RegExp(`<h3>${heading}<\\/h3>`));
  }
  assert.doesNotMatch(homepage, /class="signal-code"|>\s*(?:WX|RR|POI|YOU)\s*</);
  assert.doesNotMatch(css, /\.signal-code\b/);
  assert.match(css, /\.signal-row::before/);
});

test('Search Review Go remains a continuous, compact responsive journey', () => {
  for (const label of ['Search', 'Review', 'Go']) {
    assert.match(homepage, new RegExp(`<p class="journey-index">${label}<\\/p>`));
  }
  assert.match(css, /\.journey-step-middle\s*{\s*transform:\s*none;/);
  assert.match(css, /@media \(max-width: 46rem\)[\s\S]*?\.journey-route[\s\S]*?linear-gradient\(var\(--navy-900\), var\(--cyan-500\), var\(--navy-900\)\)/);
});

test('brand hierarchy keeps the hero identity larger than the header identity', () => {
  assert.match(css, /\.brand-logo\s*{\s*width:\s*clamp\(10\.5rem, 15vw, 13rem\)/);
  assert.match(css, /\.hero-logo\s*{\s*width:\s*clamp\(16rem, 27vw, 22rem\)/);
  assert.match(css, /\.site-footer[\s\S]*?font-size:\s*0\.92rem/);
  assert.match(css, /\.footer-meta[\s\S]*?font-size:\s*0\.84rem/);
});

test('protected Texas, availability, age, and company truths remain unchanged', () => {
  for (const statement of [
    'Built in Texas,',
    'for Texas.',
    'From rural communities to major cities.',
    'Coming to the Apple App Store and Google Play.',
    'Planned for adults 18 and over.',
    'DJ Burns Collective LLC develops Gridly as Texas-focused travel-awareness software',
  ]) {
    assert.ok(homepage.includes(statement), `${statement} is missing`);
  }
  assert.doesNotMatch(homepage, /16\+|at least 16|age 16|under 16/i);
  assert.doesNotMatch(homepage, /available now|download now|approved by Apple|approved by Google|review completed/i);
});

test('polish remains a static public-site change without runtime exposure', () => {
  for (const route of ['/privacy', '/terms', '/community-guidelines', '/delete-data', '/support']) {
    assert.match(homepage, new RegExp(`href="${route}"`));
  }
  assert.doesNotMatch(homepage, /<script\b|<form\b|<canvas\b|navigator\.geolocation|localStorage|sessionStorage|serviceWorker|leaflet|mapbox|supabase\.co/i);
  assert.doesNotMatch(homepage, /googletagmanager|google-analytics|analytics\.js|facebook\.net|segment\.com|mixpanel|hotjar/i);
  assert.doesNotMatch(css, /animation(?:-name)?\s*:/i);
});
