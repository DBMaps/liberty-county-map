import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
const source = app.match(/function buildGridlyLocationContextMetricLines\([\s\S]*?\n}/)?.[0];
assert.ok(source, 'shared metric formatter exists');
const present = Function(`${source}; return buildGridlyLocationContextMetricLines;`)();

const line = (activeIssueCount, reportCount, crossingsWatchedCount) =>
  present({ activeIssueCount, reportCount, crossingsWatchedCount, crossingInventoryAvailable: true });

test('Dallas-style state preserves all governed values in a two-level hierarchy', () => {
  assert.deepEqual(line(16, 17, 209), {
    activeIssuesLine: '16 active issues nearby',
    secondaryMetricsLine: '17 community reports · 209 crossings watched'
  });
});

test('singular active issue and crossings remain readable without reports', () => {
  assert.deepEqual(line(1, 0, 209), { activeIssuesLine: '1 active issue nearby', secondaryMetricsLine: '209 crossings watched' });
});

test('zero active issues never hides a non-zero crossing metric', () => {
  assert.deepEqual(line(0, 0, 209), { activeIssuesLine: '0 active issues nearby', secondaryMetricsLine: '209 crossings watched' });
});

test('reports absent, crossings absent, and all-zero states have no stray separators', () => {
  assert.deepEqual(line(3, 0, 0), { activeIssuesLine: '3 active issues nearby', secondaryMetricsLine: '' });
  assert.deepEqual(line(3, 4, 0), { activeIssuesLine: '3 active issues nearby', secondaryMetricsLine: '4 community reports' });
  assert.deepEqual(line(0, 0, 0), { activeIssuesLine: '0 active issues nearby', secondaryMetricsLine: '' });
  for (const value of [line(3, 0, 0), line(3, 4, 0), line(0, 0, 0)]) {
    assert.doesNotMatch(value.secondaryMetricsLine, /(^|\s)·|·(\s|$)/);
  }
});

test('report presentation keeps its existing evidence threshold semantics', () => {
  assert.equal(line(3, 3, 8).secondaryMetricsLine, '8 crossings watched');
  assert.equal(line(3, 4, 8).secondaryMetricsLine, '4 community reports · 8 crossings watched');
});

test('DOM and responsive CSS preserve logical order and mobile/desktop contracts', () => {
  assert.ok(html.indexOf('id="mobileAwarenessPanelIssues"') < html.indexOf('id="mobileAwarenessPanelCrossings"'));
  assert.match(css, /Location Context metric hierarchy[\s\S]*max-width: 760px[\s\S]*text-overflow: clip/);
  assert.match(css, /@media \(min-width: 761px\), \(orientation: landscape\)/);
  assert.match(app, /safeText\("mobileAwarenessPanelIssues", awarenessSummary\.activeIssuesLine\)/);
  assert.match(app, /safeText\("mobileAwarenessPanelCrossings", awarenessSummary\.secondaryMetricsLine\)/);
});

test('count authorities remain inputs and are not replaced by presentation values', () => {
  assert.match(app, /resolveLocationContextActiveIssueCount/);
  assert.match(app, /crossingsWatchedCount: crossingsCount/);
  assert.match(app, /reportCount: evidenceReportCount/);
});
