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

test('premium art direction preserves the five-part product-led story', () => {
  const main = homepage.match(/<main\b[\s\S]*?<\/main>/)?.[0] || '';
  const sections = [...main.matchAll(/<section\b[^>]*class="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(sections, ['hero-section', 'capabilities-section', 'experience-section', 'texas-section', 'company-section']);
  for (const statement of ['See what’s ahead.', 'Know what matters.', 'Search', 'Review', 'Go', 'Built in Texas,', 'Built for awareness.']) {
    assert.ok(homepage.includes(statement), `${statement} is missing`);
  }
});

test('the approved real interface remains unchanged and prominently referenced', () => {
  assert.match(homepage, /class="product-stage"[\s\S]*?src="\/assets\/gridly-product-current\.png"/);
  assert.equal(
    createHash('sha256').update(productImage).digest('hex'),
    '44baf377f5fb72d2f425e60b52bd3f9d276d56a75bed47c66df8562e22dfbaac',
  );
});

test('desktop and mobile both receive deliberate angled-device treatments', () => {
  assert.ok(css.includes('perspective(75rem) rotateY(-8deg) rotateX(1.5deg) rotateZ(5.5deg)'));
  assert.ok(css.includes('perspective(70rem) rotateY(-3deg) rotateX(1deg) rotateZ(-4deg)'));
  assert.match(css, /\.hero-copy\s*{[\s\S]*?grid-row:\s*1;/);
  assert.match(css, /\.product-stage\s*{[\s\S]*?grid-row:\s*1;/);
});

test('art-directed story surfaces retain readable consumer language', () => {
  for (const heading of ['Road Conditions', 'Weather Awareness', 'Railroad Crossings', 'Nearby Places', 'Community Awareness']) {
    assert.match(homepage, new RegExp(`<h3>${heading}<\\/h3>`));
  }
  assert.match(css, /LP244\.41 premium art direction/);
  assert.match(css, /\.capability-grid\s*{[\s\S]*?border-radius:\s*4rem 1\.2rem 4rem 1\.2rem/);
  assert.match(css, /\.journey-step::before/);
  assert.match(css, /\.texas-road\s*{[\s\S]*?background-color:\s*var\(--navy-900\)/);
  assert.doesNotMatch(homepage, /class="signal-code"|>\s*(?:WX|RR|POI|YOU)\s*</);
});

test('launch, age, reporting, and organization truths remain explicit', () => {
  for (const statement of [
    'Coming to the Apple App Store and Google Play.',
    'Planned for adults 18 and over.',
    'Community reporting is activated only when available; it is not currently open for public reporting.',
    'DJ Burns Collective LLC develops Gridly as Texas-focused travel-awareness software',
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
