import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const args = app.indexOf('(', start);
  let parens = 0, body = -1;
  for (let i = args; i < app.length; i += 1) {
    if (app[i] === '(') parens += 1;
    if (app[i] === ')' && --parens === 0) { body = app.indexOf('{', i); break; }
  }
  let depth = 0;
  for (let i = body; i < app.length; i += 1) {
    if (app[i] === '{') depth += 1;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`could not parse ${name}`);
}

test('LP237.3 community traveler location uses structured priority and county only as fallback', () => {
  const source = functionSource('gridlyResolveCommunityTravelerLocation');
  assert.ok(source.indexOf('"governed_road"') < source.indexOf('"governed_reference_road"'));
  assert.ok(source.indexOf('"governed_reference_road"') < source.indexOf('"governed_resolved_location"'));
  assert.ok(source.indexOf('"governed_resolved_location"') < source.indexOf('"provider_location_phrase"'));
  assert.ok(source.indexOf('"provider_location_phrase"') < source.indexOf('"county_fallback"'));
  assert.match(source, /roadName.*routeName.*street.*streetName.*primaryRoad/);
  assert.doesNotMatch(source, /geocod|fetch\(|setTimeout|setInterval/i);
});

test('LP237.3 preserves submitted location lineage through persistence normalization and Alerts projection', () => {
  const normalization = functionSource('normalizeReports');
  for (const field of ['roadName', 'routeName', 'street', 'streetName', 'primaryRoad', 'locationName', 'location', 'crossStreet', 'referenceRoadA']) assert.match(normalization, new RegExp(`${field}:`));
  const projection = functionSource('gridlyProjectAlertIncidentLocation');
  for (const field of ['routeName', 'street', 'streetName', 'primaryRoad', 'crossStreet', 'resolvedLocation']) assert.match(projection, new RegExp(field));
});

test('LP237.3 community Show me shares the governed resolver and coordinate focus contract', () => {
  const mapTarget = functionSource('gridlyLP236MapTarget');
  assert.match(mapTarget, /gridlyResolveAlertShowOnMapTarget\(alert, canonicalId\)/);
  const resolver = functionSource('gridlyResolveAlertShowOnMapTarget');
  assert.match(resolver, /gridlyLp019OfficialCoords\(resolvedRecord\)/);
  assert.match(resolver, /findGridlyAlertMarker/);
  const handler = functionSource('gridlyLp019BindAlertFocusHandlers');
  assert.match(handler, /focusGridlyAlertIncident/);
  assert.match(handler, /minimizePortraitV2Sheet/);
  assert.match(handler, /gridlyLP236CaptureDisclosureState/);
});

test('LP237.3 audit exposes bounded fail-closed community coverage', () => {
  const audit = functionSource('gridlyLP236AlertsInformationArchitectureAudit');
  for (const field of ['communityReportLocationCoverageCount', 'communityReportCountyOnlyLocationCount', 'communityReportMissingSpecificLocationIds', 'communityReportShowMeEligibleCount', 'communityReportShowMeRenderedCount', 'communityReportShowMeMissingIds', 'communityReportSummaries', 'communityReportLocationPass', 'communityReportShowMeCoveragePass']) assert.match(audit, new RegExp(field));
  assert.match(audit, /slice\(0, 25\)/);
});

test('LP237.3 remains generic across flooding, road closure, blocked crossing and second-town records', () => {
  const production = functionSource('gridlyResolveCommunityTravelerLocation') + functionSource('gridlyLP236RenderAlertsPresentation');
  assert.doesNotMatch(production, /Austin|Travis|San Antonio|Bexar/);
  assert.doesNotMatch(production, /fetch\(|setTimeout|setInterval/);
  for (const fixture of ['flooding', 'road_closed', 'blocked_crossing']) assert.match(app, new RegExp(fixture));
});
