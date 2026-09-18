import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');
const certification = readFileSync(join(root, 'docs/launch/GRIDLY-LP24439-PREMIUM-PUBLIC-WEBSITE-REDESIGN.md'), 'utf8');

test('premium homepage uses five focused main sections and a restrained footer', () => {
  assert.equal((homepage.match(/<main\b[\s\S]*?<\/main>/)?.[0].match(/<section\b/g) || []).length, 5);
  for (const selector of ['hero-section', 'capabilities-section', 'texas-section', 'experience-section', 'company-section']) {
    assert.match(homepage, new RegExp(`class="${selector}`));
  }
  assert.match(homepage, /<footer class="site-footer">/);
});

test('homepage answers the core consumer and organization questions concisely', () => {
  for (const statement of [
    'Gridly',
    'Know Before You Go',
    'Built in Texas, for Texas.',
    'From rural communities to major cities',
    'a Texas-focused software company helping people understand what may affect a trip before they leave',
    'gridlygo.com',
    'support@gridlygo.com',
  ]) {
    assert.ok(homepage.includes(statement), `${statement} is missing`);
  }

  const paragraphs = [...homepage.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length);
  assert.ok(paragraphs.every((count) => count <= 35), `homepage paragraph exceeds concise-copy limit: ${Math.max(...paragraphs)} words`);
});

test('capability and journey language remains consumer-facing and truthful', () => {
  for (const capability of ['Road Conditions', 'Weather Awareness', 'Railroad Crossings', 'Nearby Places', 'Community Awareness']) {
    assert.match(homepage, new RegExp(`<h3>${capability}<\\/h3>`));
  }
  assert.match(homepage, /See community-reported conditions and help keep local information current\./);
  assert.match(homepage, /Choose a Texas community/);
  assert.match(homepage, /Check available local conditions and alerts/);
  assert.match(homepage, /Leave with a clearer picture/);
});

test('internal product-position and audit language was removed', () => {
  assert.doesNotMatch(homepage, /Awareness Platform First|Route Intelligence Second|Product position|brief-facts|company-identity|capability-index/i);
  assert.doesNotMatch(homepage, />\s*Focus\s*<|>\s*Format\s*<|>\s*Status\s*</i);
});

test('store language is restrained, pre-launch, and consistently 18+', () => {
  assert.match(homepage, /Coming soon to the Apple App Store and Google Play\./);
  assert.match(homepage, /For adults 18 and over\./);
  assert.doesNotMatch(homepage, /16\+|at least 16|age 16|under 16/i);
  assert.doesNotMatch(homepage, /available now|download now|approved by Apple|approved by Google|review completed|app-store-badge|google-play-badge/i);
});

test('visual treatment uses only local, traceable product and geographic assets', () => {
  const sources = [...homepage.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual([...new Set(sources)], ['/assets/gridly-wordmark.png', '/assets/gridly-hero.png', '/assets/gridly-local-detail.png', '/assets/gridly-search-detail.png', '/assets/gridly-review-detail.png', '/assets/texas.svg']);
  for (const source of sources) assert.ok(existsSync(join(root, 'public-site', source)));
});

test('legal, support, canonical, and static-site safeguards remain intact', () => {
  for (const route of ['/privacy', '/terms', '/community-guidelines', '/delete-data', '/support']) {
    assert.match(homepage, new RegExp(`href="${route}"`));
  }
  assert.match(homepage, /<link rel="canonical" href="https:\/\/gridlygo\.com\/">/);
  assert.doesNotMatch(homepage, /www\.gridlygo\.com/i);
  assert.doesNotMatch(homepage, /<script\b|<form\b|<canvas\b|navigator\.geolocation|localStorage|sessionStorage|serviceWorker|leaflet|mapbox|supabase\.co/i);
  assert.doesNotMatch(homepage, /googletagmanager|google-analytics|analytics\.js|facebook\.net|segment\.com|mixpanel|hotjar/i);
});

test('responsive and accessible styling covers required layout behavior', () => {
  assert.match(homepage, /class="skip-link"/);
  assert.match(homepage, /<main class="home-main" id="main-content">/);
  assert.match(homepage, /aria-labelledby="home-title"/);
  assert.match(css, /a:focus-visible/);
  assert.match(css, /@media \(max-width: 68rem\)/);
  assert.match(css, /@media \(max-width: 54rem\)/);
  assert.match(css, /@media \(max-width: 46rem\)/);
  assert.match(css, /@media \(max-width: 34rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css, /animation(?:-name)?\s*:/i);
});

test('redesign certification records all required sections and scope boundaries', () => {
  for (let index = 1; index <= 18; index += 1) {
    assert.match(certification, new RegExp(`^## ${index}\\. `, 'm'));
  }
  assert.match(certification, /Astra was not used\./);
  assert.match(certification, /No deployment was performed\./);
  assert.match(certification, /A\. PREMIUM REDESIGN READY FOR OWNER VISUAL REVIEW/);
});
