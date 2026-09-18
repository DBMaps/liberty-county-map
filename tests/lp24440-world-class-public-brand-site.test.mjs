import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');
const productImagePath = join(root, 'public-site/assets/gridly-hero.png');
const certification = readFileSync(join(root, 'docs/launch/GRIDLY-LP24440-WORLD-CLASS-PUBLIC-BRAND-SITE.md'), 'utf8');

test('Gridly and the real product dominate the hero hierarchy', () => {
  const hero = homepage.match(/<section class="hero-section"[\s\S]*?<\/section>/)?.[0] || '';
  assert.doesNotMatch(hero, /class="hero-logo"/);
  assert.match(hero, /Know Before You Go/);
  assert.match(hero, /<h1 id="home-title">See what’s ahead\.<\/h1>/);
  assert.match(hero, /class="product-stage"/);
  assert.match(hero, /src="\/assets\/gridly-hero\.png"/);
  assert.doesNotMatch(hero.match(/<h1[\s\S]*?<\/h1>/)?.[0] || '', /DJ Burns Collective LLC/);
  assert.ok(homepage.indexOf('Gridly') < homepage.indexOf('DJ Burns Collective LLC'));
});

test('approved hero is an unretouched crop of the audited quiet-state native capture', () => {
  assert.ok(existsSync(productImagePath));
  const digest = createHash('sha256').update(readFileSync(productImagePath)).digest('hex');
  assert.equal(digest, '8e2a661c5a4f18e9e9cb0a05c8efeb7cb22213d414b50197aeafcd2cdd1fcee8');
  assert.match(homepage, /alt="Actual Gridly interface showing a quiet community, a Dallas search result, and nearby-place controls around Dayton\."/);
});

test('product story is editorial rather than a generic equal-card grid', () => {
  assert.match(homepage, /<h2 id="product-title">Know what matters\.<\/h2>/);
  assert.match(homepage, /class="product-evidence"/);
  assert.match(homepage, /class="signal-list"/);
  for (const capability of ['Road Conditions', 'Weather Awareness', 'Railroad Crossings', 'Nearby Places', 'Community Awareness']) {
    assert.match(homepage, new RegExp(`<h3>${capability}<\\/h3>`));
  }
  assert.doesNotMatch(homepage, /capability-card|capability-icon/);
});

test('experience and Texas stories retain concise launch truths', () => {
  for (const statement of [
    'Choose a Texas community or destination.',
    'Check available local conditions and alerts.',
    'Leave with a clearer picture.',
    'Built in Texas,',
    'for Texas.',
    'From rural communities to major cities.',
    'Coming soon to the Apple App Store and Google Play.',
    'For adults 18 and over.',
  ]) {
    assert.ok(homepage.includes(statement), `${statement} is missing`);
  }
  assert.match(homepage, /See community-reported conditions and help keep local information current\./);
});

test('company remains visible without taking over the hero', () => {
  assert.match(homepage, /Gridly is developed by DJ Burns Collective LLC,/);
  assert.match(homepage, /a Texas-focused software company helping people understand what may affect a trip before they leave/);
  assert.match(homepage, /gridlygo\.com/);
  assert.match(homepage, /href="mailto:support@gridlygo\.com"/);
  assert.doesNotMatch(homepage, /<h[12][^>]*>[^<]*DJ Burns Collective LLC/i);
});

test('homepage stays scannable and omits internal or unsupported marketing language', () => {
  const paragraphWordCounts = [...homepage.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length);
  assert.ok(paragraphWordCounts.every((count) => count <= 32), `paragraph exceeds copy limit: ${Math.max(...paragraphWordCounts)} words`);
  assert.doesNotMatch(homepage, /Awareness Platform First|Route Intelligence Second|Product position|>\s*Focus\s*<|>\s*Format\s*<|>\s*Status\s*</i);
  assert.doesNotMatch(homepage, /revolutionary|game-changing|unmatched|best-in-class|comprehensive|everything you need/i);
});

test('store, age, legal, canonical, and privacy safeguards remain correct', () => {
  for (const route of ['/privacy', '/terms', '/community-guidelines', '/delete-data', '/support']) {
    assert.match(homepage, new RegExp(`href="${route}"`));
  }
  assert.match(homepage, /<link rel="canonical" href="https:\/\/gridlygo\.com\/">/);
  assert.doesNotMatch(homepage, /www\.gridlygo\.com|16\+|at least 16|age 16|under 16/i);
  assert.doesNotMatch(homepage, /available now|download now|approved by Apple|approved by Google|review completed/i);
  assert.doesNotMatch(homepage, /<script\b|<form\b|<canvas\b|navigator\.geolocation|localStorage|sessionStorage|serviceWorker|leaflet|mapbox|supabase\.co/i);
  assert.doesNotMatch(homepage, /googletagmanager|google-analytics|analytics\.js|facebook\.net|segment\.com|mixpanel|hotjar/i);
});

test('responsive product-led composition preserves accessible static behavior', () => {
  for (const selector of ['.hero-copy', '.product-stage', '.device-frame', '.product-evidence', '.signal-row', '.journey-step', '.texas-figure']) {
    assert.ok(css.includes(selector), `${selector} is missing`);
  }
  assert.match(homepage, /class="skip-link"/);
  assert.match(homepage, /<main class="home-main" id="main-content">/);
  assert.match(css, /a:focus-visible/);
  assert.match(css, /@media \(max-width: 54rem\)/);
  assert.match(css, /@media \(max-width: 46rem\)/);
  assert.match(css, /@media \(max-width: 34rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /animation(?:-name)?\s*:/i);
});

test('certification records required sections, screenshots, boundaries, and verdict', () => {
  for (let index = 1; index <= 19; index += 1) {
    assert.match(certification, new RegExp(`^## ${index}\\. `, 'm'));
  }
  assert.match(certification, /desktop-1440\.png/);
  assert.match(certification, /mobile-430\.png/);
  assert.match(certification, /No deployment or merge was performed\./);
  assert.match(certification, /A\. READY FOR OWNER VISUAL REVIEW/);
});
