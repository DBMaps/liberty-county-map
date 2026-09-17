import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const siteRoot = join(repositoryRoot, 'public-site');
const pageFiles = [
  'index.html',
  'privacy/index.html',
  'terms/index.html',
  'community-guidelines/index.html',
  'delete-data/index.html',
  'support/index.html',
];

const readSiteFile = (relativePath) => readFileSync(join(siteRoot, relativePath), 'utf8');

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&mdash;', '—')
    .replaceAll('&ndash;', '–')
    .replaceAll('&nbsp;', ' ');
}

function normalizedText(value) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*-\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

function markdownBlocks(value) {
  return value
    .split(/\r?\n\s*\r?\n/)
    .map(normalizedText)
    .filter(Boolean);
}

function resolveSiteReference(pageFile, reference) {
  const withoutQuery = reference.split(/[?#]/, 1)[0];
  if (withoutQuery.startsWith('/')) {
    const relative = withoutQuery.slice(1);
    if (!relative) return join(siteRoot, 'index.html');
    const direct = join(siteRoot, relative);
    if (existsSync(direct)) return direct;
    return join(direct, 'index.html');
  }
  return resolve(dirname(join(siteRoot, pageFile)), withoutQuery);
}

test('all six public pages and deployment files exist', () => {
  for (const pageFile of pageFiles) {
    assert.ok(existsSync(join(siteRoot, pageFile)), `${pageFile} is missing`);
  }
  for (const requiredFile of ['_headers', '_redirects', 'assets/site.css', 'assets/gridly-logo-horizontal.png']) {
    assert.ok(existsSync(join(siteRoot, requiredFile)), `${requiredFile} is missing`);
  }
});

test('every page has accessible document metadata and no executable runtime', () => {
  for (const pageFile of pageFiles) {
    const html = readSiteFile(pageFile);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, /<meta http-equiv="Content-Security-Policy"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /class="skip-link"/);
    assert.doesNotMatch(html, /<script\b/i);
    assert.doesNotMatch(html, /<form\b/i);
    assert.doesNotMatch(html, /\bon\w+\s*=/i);
  }
});

test('all local links and referenced assets resolve', () => {
  for (const pageFile of pageFiles) {
    const html = readSiteFile(pageFile);
    const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    for (const reference of references) {
      if (/^(?:mailto:|https:\/\/|data:)/.test(reference) || reference.startsWith('#')) continue;
      const resolved = resolveSiteReference(pageFile, reference);
      assert.ok(existsSync(resolved), `${pageFile} has unresolved reference ${reference}`);
    }
  }
});

test('published legal pages preserve every finalized source block', () => {
  const sources = [
    ['docs/LEGAL/GRIDLY-PRIVACY-POLICY.md', 'privacy/index.html'],
    ['docs/LEGAL/GRIDLY-TERMS-OF-USE.md', 'terms/index.html'],
    ['docs/LEGAL/GRIDLY-COMMUNITY-GUIDELINES.md', 'community-guidelines/index.html'],
  ];

  for (const [sourceFile, pageFile] of sources) {
    const source = readFileSync(join(repositoryRoot, sourceFile), 'utf8');
    const rendered = normalizedText(readSiteFile(pageFile));
    for (const block of markdownBlocks(source)) {
      assert.ok(rendered.includes(block), `${pageFile} omitted or changed source block: ${block.slice(0, 90)}`);
    }
  }
});

test('support contacts and required safety notice are correct', () => {
  const support = readSiteFile('support/index.html');
  for (const address of ['support@gridlygo.com', 'privacy@gridlygo.com', 'legal@gridlygo.com']) {
    assert.match(support, new RegExp(`href="mailto:${address}"`));
  }
  assert.match(support, /Gridly does not replace official emergency instructions, roadway authorities, weather agencies, or emergency services\./);
  assert.match(support, /href="https:\/\/gridlygo\.com"/);
  assert.match(support, /href="\/delete-data"/);
  assert.match(readSiteFile('privacy/index.html'), /href="\/delete-data"/);
});

test('data-deletion page states request steps, outcomes, and bounded retention', () => {
  const deletion = readSiteFile('delete-data/index.html');
  assert.match(deletion, /<h1>Delete Gridly Data<\/h1>/);
  assert.match(deletion, /<strong>Product:<\/strong> Gridly/);
  assert.match(deletion, /DJ Burns Collective LLC, doing business as Gridly App/);
  assert.match(deletion, /does not create consumer user accounts/);
  assert.match(deletion, /Delete mine/);
  assert.match(deletion, /href="mailto:privacy@gridlygo\.com"/);
  assert.match(deletion, /approximate time and place/);
  assert.match(deletion, /removes the public community report/);
  assert.match(deletion, /private device link and live submission receipt/);
  assert.match(deletion, /One-way replay evidence without a report or device reference/);
  assert.match(deletion, /day 149/);
  assert.match(deletion, /180 days/);
  assert.match(deletion, /no-more-than-90-day completion window/);
  assert.match(deletion, /does not promise deletion from a third-party provider's systems/);
  assert.match(deletion, /does not describe retained or de-linked information as anonymous/);
});

test('launch-facing legal copy consistently enforces the 18-and-over posture', () => {
  const launchFacingFiles = [
    'docs/LEGAL/GRIDLY-PRIVACY-POLICY.md',
    'docs/LEGAL/GRIDLY-TERMS-OF-USE.md',
    'docs/LEGAL/GRIDLY-COMMUNITY-GUIDELINES.md',
    'legal/drafts/privacy-policy.md',
    'legal/drafts/terms-of-service.md',
    'legal/privacy.html',
    'legal/terms.html',
    'legal/community-guidelines.html',
    'public-site/privacy/index.html',
    'public-site/terms/index.html',
    'public-site/community-guidelines/index.html',
  ];
  const copy = launchFacingFiles.map((file) => readFileSync(join(repositoryRoot, file), 'utf8')).join('\n');
  assert.doesNotMatch(copy, /16\+|at least 16|age 16|under 16|16 years old|minimum (?:product )?(?:eligibility )?age is 16/i);
  assert.match(copy, /at least 18/);
  assert.match(copy, /age 18 and older/);
  assert.match(copy, /Google has determined to be minors/);
  assert.match(copy, /gridly-ugc-2026-09-17-v2/);
});

test('site has no app, tracking, storage, or location runtime', () => {
  const source = pageFiles.map(readSiteFile).join('\n');
  assert.doesNotMatch(source, /<script\b|navigator\.geolocation|localStorage|sessionStorage|serviceWorker|createClient\s*\(|supabase\.co|googletagmanager|google-analytics|analytics\.js|facebook\.net|connect\.facebook/i);
  assert.doesNotMatch(source, /(?:src|href)="https:\/\/[^"\s]+\.(?:js|png|gif|jpe?g|webp|svg)(?:[?#][^"]*)?"/i);
  assert.doesNotMatch(source, /<img\b[^>]*width="1"[^>]*height="1"|<img\b[^>]*height="1"[^>]*width="1"/i);
});

test('Cloudflare Pages routing and security headers are ready', () => {
  const redirects = readSiteFile('_redirects');
  for (const route of ['privacy', 'terms', 'community-guidelines', 'delete-data', 'support']) {
    assert.match(redirects, new RegExp(`/${route}\\s+/${route}/index\\.html\\s+200`));
  }

  const headers = readSiteFile('_headers');
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(headers, /Permissions-Policy: camera=\(\), microphone=\(\), geolocation=\(\)/);
  assert.match(headers, /X-Frame-Options: DENY/);
  assert.match(headers, /frame-ancestors 'none'/);
});

test('responsive stylesheet includes mobile and reduced-motion handling', () => {
  const css = readSiteFile('assets/site.css');
  assert.match(css, /@media \(max-width: 34rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /font-size: 1rem/);
});
