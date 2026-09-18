import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const homepage = readFileSync(join(root, 'public-site/index.html'), 'utf8');
const css = readFileSync(join(root, 'public-site/assets/site.css'), 'utf8');

test('experience message states the consumer journey directly', () => {
  assert.match(homepage, /<h2 id="experience-title">Know before you go in three clear steps\.<\/h2>/);
  assert.doesNotMatch(homepage, /From place to picture|three clear moves/i);
  for (const statement of [
    'Choose a Texas community or destination.',
    'See the local awareness that’s available.',
    'Leave with a clearer picture.',
  ]) {
    assert.ok(homepage.includes(statement), `${statement} is missing`);
  }
});

test('shared layout, spacing, type, radius, border, and depth tokens are defined', () => {
  for (const token of [
    '--layout-max',
    '--layout-inset',
    '--space-section',
    '--space-heading',
    '--radius-card',
    '--radius-feature',
    '--border-dark',
    '--shadow-card',
    '--shadow-feature',
    '--text-eyebrow',
    '--text-body',
    '--leading-copy',
  ]) {
    assert.match(css, new RegExp(`${token}:`), `${token} is missing`);
  }
  assert.match(css, /LP244\.42 design-system normalization/);
});

test('major sections share one grid and spacing rhythm', () => {
  assert.match(css, /\.section-shell,[\s\S]*?\.hero-inner,[\s\S]*?\.journey-card\s*{[\s\S]*?--layout-max/);
  assert.match(css, /\.capabilities-section,[\s\S]*?\.experience-section,[\s\S]*?\.texas-section,[\s\S]*?\.company-section\s*{[\s\S]*?--space-section/);
  assert.match(css, /@media \(max-width: 56rem\)[\s\S]*?--layout-inset:\s*2rem/);
});

test('decorative background numerals are removed from both story systems', () => {
  assert.match(css, /\.signal-row::after,[\s\S]*?\.journey-step::before\s*{[\s\S]*?display:\s*none;[\s\S]*?content:\s*none;/);
});
