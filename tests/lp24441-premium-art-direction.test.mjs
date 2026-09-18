import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');
const productImage = readFileSync(join(root, 'public-site/assets/gridly-hero.png'));

test('premium art direction preserves the five-part product-led story', () => {
  const main = homepage.match(/<main\b[\s\S]*?<\/main>/)?.[0] || '';
  const sections = [...main.matchAll(/<section\b[^>]*class="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(sections, ['hero-section', 'capabilities-section', 'experience-section', 'texas-section', 'company-section']);
  for (const statement of ['See what’s ahead.', 'Know what matters.', 'Search', 'Review', 'Go', 'Built in Texas,', 'Built for awareness.']) {
    assert.ok(homepage.includes(statement), `${statement} is missing`);
  }
});

test('the approved real interface remains unchanged and prominently referenced', () => {
  assert.match(homepage, /class="product-stage"[\s\S]*?src="\/assets\/gridly-hero\.png"/);
  assert.equal(
    createHash('sha256').update(productImage).digest('hex'),
    '52e7aee1bb93fcf3925c425d5a6c9a5382d8de92dc6c3f2f6e0e567d03c1e355',
  );
});

test('product imagery is upright and its caption does not obscure the interface', () => {
  assert.doesNotMatch(css, /rotate[XYZ]?\(|perspective\(/);
  assert.match(homepage, /<figcaption><span>Actual Gridly interface/);
  assert.doesNotMatch(homepage, /hero-route|screen-label|hero-logo/);
});

test('awareness capabilities have equal editorial roles and reporting is separated', () => {
  const list = homepage.match(/<div class="signal-list">([\s\S]*?)<\/div>/)[1];
  for (const label of ['Road Conditions','Weather Awareness','Railroad Crossings','Nearby Places']) assert.ok(list.includes('<h3>'+label+'</h3>'));
  assert.doesNotMatch(list, /Community Awareness/);
  assert.match(homepage, /<aside class="community-note"><h3>Community Awareness<\/h3><p>See community-reported conditions and help keep local information current\./);
});

test('launch, age, reporting, and organization truths remain explicit', () => {
  for (const statement of [
    'Coming soon to the Apple App Store and Google Play.',
    'For adults 18 and over.',
    'See community-reported conditions and help keep local information current.',
    'a Texas-focused software company helping people understand what may affect a trip before they leave',
    'Awareness, not authority.',
  ]) {
    assert.ok(homepage.includes(statement), `${statement} is missing`);
  }
  assert.doesNotMatch(homepage, /16\+|at least 16|age 16|under 16/i);
  assert.doesNotMatch(homepage, /download now|available now|get it on google play|download on the app store|approved by apple|approved by google/i);
});

test('legal, support, canonical, and accessible navigation remain complete', () => {
  for (const route of ['/privacy', '/terms', '/community-guidelines', '/delete-data', '/support']) {
    assert.match(homepage, new RegExp(`href="${route}"`));
  }
  assert.match(homepage, /href="mailto:support@gridlygo\.com"/);
  assert.match(homepage, /<link rel="canonical" href="https:\/\/gridlygo\.com\/">/);
  assert.match(homepage, /class="skip-link"/);
  assert.match(css, /a:focus-visible/);
});

test('public brand site remains static and non-tracking', () => {
  assert.doesNotMatch(homepage, /<script\b|<form\b|<canvas\b|navigator\.geolocation|localStorage|sessionStorage|serviceWorker|leaflet|mapbox|supabase\.co/i);
  assert.doesNotMatch(homepage, /googletagmanager|google-analytics|analytics\.js|facebook\.net|segment\.com|mixpanel|hotjar/i);
  assert.doesNotMatch(css, /animation(?:-name)?\s*:/i);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
