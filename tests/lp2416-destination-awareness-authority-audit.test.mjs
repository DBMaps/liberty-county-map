import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync('js/app.js', 'utf8');
const auditDoc = fs.readFileSync('LP241.6-DESTINATION-AWARENESS-AUTHORITY-AUDIT.md', 'utf8');

test('destination selection remains independent of governed awareness selection', () => {
  const selection = app.slice(app.indexOf('function selectGridlySearchResult'), app.indexOf('function getGridlyLiveDestinationSearchOptions'));
  assert.match(selection, /state\.selectedDestination = normalized/);
  assert.match(selection, /buildGridlyDestinationRoutePreview/);
  assert.doesNotMatch(selection, /gridlyApplyConfirmedHomePersonalization|saveGridlyHomeTownPreference|syncGridlyAwarenessAreaSurfacesImmediately/);
});

test('audit helper exposes independent authorities and route-corridor evidence', () => {
  assert.match(app, /window\.gridlyDestinationAuthorityAudit = function/);
  assert.match(app, /authority: "origin-to-destination route corridor"/);
  assert.match(app, /corridorWidthFeet: intelligence\?\.corridorWidthFeet/);
  assert.match(app, /matchedEvidence/);
  assert.match(app, /current activeHazards collection/);
  assert.match(app, /officialRoadways: "not directly queried by Destination Intelligence"/);
  assert.match(auditDoc, /destination-authority\/coverage defect/);
  assert.match(auditDoc, /Do not require destination selection to mutate awareness/);
  assert.match(auditDoc, /Do not declare Chambers PASS/);
});
