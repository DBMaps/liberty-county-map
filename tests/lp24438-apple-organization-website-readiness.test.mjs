import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');
const certification = readFileSync(join(root, 'docs/launch/GRIDLY-LP24438-APPLE-ORGANIZATION-WEBSITE-READINESS.md'), 'utf8');

test('homepage presents Gridly and the legal organization prominently', () => {
  assert.match(homepage, /Gridly/);
  assert.match(homepage, /Know Before You Go/);
  assert.match(homepage, /Built in Texas, for Texas\./);
  assert.match(homepage, /Gridly is developed by DJ Burns Collective LLC\./);
  assert.match(homepage, /DJ Burns Collective LLC develops Gridly as Texas-focused travel-awareness software/);
  assert.match(homepage, /From rural communities to major cities/);
  assert.match(homepage, /gridlygo\.com/);
  assert.match(homepage, /travel-awareness software/i);
});

test('homepage describes only governed product capabilities and reporting state', () => {
  for (const capability of ['Road Conditions', 'Weather Awareness', 'Railroad Crossings', 'Nearby Places', 'Community Awareness']) {
    assert.match(homepage, new RegExp(`>${capability}<`));
  }
  assert.match(homepage, /Gridly brings roads, weather, railroad crossings, nearby places and community awareness into one clear view before a trip/);
  assert.match(homepage, /Community reporting is activated only when available; it is not currently open for public reporting\./);
  assert.match(homepage, /attributed official alerts/);
  assert.doesNotMatch(homepage, /Awareness Platform First|Route Intelligence Second|Product position/);
});

test('store language is coming-soon only and remains 18+', () => {
  assert.match(homepage, /Coming to the Apple App Store and Google Play\./);
  assert.match(homepage, /Planned for adults 18 and over\./);
  assert.doesNotMatch(homepage, /16\+|at least 16|age 16|under 16/i);
  assert.doesNotMatch(homepage, /(?:download|get|available) (?:it |Gridly )?now|now available|available today|approved by Apple|approved by Google/i);
  assert.doesNotMatch(homepage, /app-store-badge|google-play-badge/i);
});

test('homepage visibly exposes every legal and support destination', () => {
  for (const route of ['/privacy', '/terms', '/community-guidelines', '/support', '/delete-data']) {
    assert.match(homepage, new RegExp(`href="${route}"`));
  }
  assert.match(homepage, /href="mailto:support@gridlygo\.com"/);
});

test('homepage is canonical to the root domain without a www dependency', () => {
  assert.match(homepage, /<link rel="canonical" href="https:\/\/gridlygo\.com\/">/);
  assert.doesNotMatch(homepage, /https:\/\/www\.gridlygo\.com/i);
});

test('homepage remains a static company site without app or tracking runtime', () => {
  assert.doesNotMatch(homepage, /<script\b|<form\b|navigator\.geolocation|localStorage|sessionStorage|serviceWorker|createClient\s*\(|supabase\.co/i);
  assert.doesNotMatch(homepage, /googletagmanager|google-analytics|analytics\.js|facebook\.net|segment\.com|mixpanel|hotjar/i);
  assert.doesNotMatch(homepage, /<canvas\b|id="map"|leaflet|mapbox|report-category/i);
  assert.doesNotMatch(homepage, /testimonial|trusted by|customers served|partner logo/i);
});

test('shared design supplies responsive company, capability, trust, and resource layouts', () => {
  for (const selector of ['.product-stage', '.capability-grid', '.texas-panel', '.journey-card', '.company-layout', '.footer-primary']) {
    assert.ok(css.includes(selector), `${selector} is missing`);
  }
  assert.match(css, /@media \(max-width: 54rem\)/);
  assert.match(css, /@media \(max-width: 34rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('readiness record preserves scope, deployment status, and final verdict', () => {
  for (let index = 1; index <= 16; index += 1) {
    assert.match(certification, new RegExp(`^## ${index}\\. `, 'm'));
  }
  assert.match(certification, /No deployment was performed\./);
  assert.match(certification, /makes no guarantee of approval/);
  assert.match(certification, /A\. READY FOR OWNER REVIEW AND PUBLIC-SITE DEPLOYMENT/);
});
