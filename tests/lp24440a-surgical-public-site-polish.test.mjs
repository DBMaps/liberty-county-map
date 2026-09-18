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
  assert.match(homepage, /src="\/assets\/gridly-hero\.png"/);
  assert.equal(
    createHash('sha256').update(productImage).digest('hex'),
    '8e2a661c5a4f18e9e9cb0a05c8efeb7cb22213d414b50197aeafcd2cdd1fcee8',
  );
  assert.match(homepage, /Actual Gridly interface · Dallas search/);
});

test('awareness signals use clear headings without unexplained acronym labels', () => {
  for (const heading of ['Weather Awareness', 'Railroad Crossings', 'Nearby Places', 'Community Awareness']) {
    assert.match(homepage, new RegExp(`<h3>${heading}<\\/h3>`));
  }
  assert.doesNotMatch(homepage, /class="signal-code"|>\s*(?:WX|RR|POI|YOU)\s*</);
  assert.doesNotMatch(css, /\.signal-code\b/);
  assert.doesNotMatch(homepage, /story-geometry|road-node/);
});

test('Search Review Go keeps evidence in the first two steps and an outcome in the third', () => {
  const steps = [...homepage.matchAll(/<article class="journey-step[^"]*">([\s\S]*?)<\/article>/g)].map(m => m[1]);
  assert.equal(steps.length, 3);
  for (const [i,label] of ['Search','Review','Go'].entries()) assert.ok(steps[i].includes('<h3>'+label+'</h3>'));
  assert.match(steps[0], /gridly-search-detail/);
  assert.match(steps[1], /gridly-review-detail/);
  assert.doesNotMatch(steps[2], /<img|<svg|<canvas/);
  assert.doesNotMatch(homepage, /journey-route|journey-dot|→/);
});

test('brand identity appears once before the product and once in the footer', () => {
  assert.equal((homepage.match(/src="\/assets\/gridly-wordmark.png"/g) || []).length, 2);
  const hero = homepage.match(/<section class="hero-section"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(hero, /gridly-wordmark|hero-logo/);
  assert.match(hero, /Understand local road conditions, weather/);
});

test('protected Texas, availability, age, and company truths remain unchanged', () => {
  for (const statement of [
    'Built in Texas,',
    'for Texas.',
    'From rural communities to major cities.',
    'Coming soon to the Apple App Store and Google Play.',
    'For adults 18 and over.',
    'a Texas-focused software company helping people understand what may affect a trip before they leave',
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
