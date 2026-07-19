import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const appPath = path.join(process.cwd(), 'js/app.js');
const app = fs.readFileSync(appPath, 'utf8');
const countyIds = [
  'liberty-tx', 'montgomery-tx', 'san-jacinto-tx', 'chambers-tx', 'jefferson-tx', 'hardin-tx', 'polk-tx',
  'walker-tx', 'orange-tx', 'jasper-tx', 'newton-tx', 'tyler-tx', 'galveston-tx', 'brazoria-tx',
  'fort-bend-tx', 'waller-tx', 'austin-tx', 'washington-tx', 'brazos-tx', 'grimes-tx', 'wharton-tx',
  'colorado-tx', 'fayette-tx', 'lavaca-tx', 'jackson-tx', 'matagorda-tx', 'calhoun-tx', 'harris-tx'
];

function entryBlock(countyId) {
  const start = app.indexOf(`"${countyId}": Object.freeze({`);
  assert.notEqual(start, -1, `${countyId} is missing from GRIDLY_COUNTY_REGISTRY`);
  const next = app.indexOf('\n  "', start + 1);
  return app.slice(start, next === -1 ? app.indexOf('\n});', start) : next);
}

const rows = countyIds.map((countyId) => {
  const block = entryBlock(countyId);
  const pathMatch = block.match(/roadSegmentsPath:\s*(null|"([^"]*)")/);
  const roadSegmentsPath = pathMatch?.[2] || null;
  const browserLoadable = Boolean(roadSegmentsPath && !/^[a-z]:\\/i.test(roadSegmentsPath) && !/^file:/i.test(roadSegmentsPath) && /\.geojson$/i.test(roadSegmentsPath) && !/\.(?:shp|dbf|shx|prj)$/i.test(roadSegmentsPath));
  const exists = browserLoadable ? fs.existsSync(path.join(process.cwd(), roadSegmentsPath)) : false;
  return { countyId, roadSegmentsPath, browserLoadable, exists };
});

assert.equal(rows.length, 28, 'LP028 covered county count changed');
assert.match(app, /function gridlyLp028RegionalRoadwayRuntimeAudit\(\)/, 'passive LP028 audit helper is missing');
const loaderBlock = app.slice(app.indexOf('async function loadRoadwayDataset()'), app.indexOf('function findNearestRoadwaySegment', app.indexOf('async function loadRoadwayDataset()')));
assert.doesNotMatch(loaderBlock, /GRIDLY_LP028_COVERED_COUNTY_IDS/, 'loader must not iterate an LP028 all-county table');
assert.match(loaderBlock, /const activeRoadSources = gridlyGetActiveCountyRuntimeSources\(\);/, 'loader must derive roadway source from county runtime registry');
const lp028AuditBlock = app.slice(app.indexOf('function gridlyLp028RegionalRoadwayRuntimeAudit()'), app.indexOf('if (typeof exposeGridlyAuditHelper', app.indexOf('function gridlyLp028RegionalRoadwayRuntimeAudit()')));
assert.doesNotMatch(lp028AuditBlock, /fetch\(/, 'LP028 passive audit must not fetch roadway files');

for (const countyId of ['polk-tx', 'harris-tx', 'liberty-tx', 'montgomery-tx', 'san-jacinto-tx']) {
  assert.ok(rows.some((row) => row.countyId === countyId), `${countyId} is absent from LP028 registry coverage`);
}

const registered = rows.filter((row) => row.browserLoadable);
const missing = rows.filter((row) => !row.browserLoadable);
const missingFiles = rows.filter((row) => row.browserLoadable && !row.exists);

console.log(JSON.stringify({
  coveredCountyCount: rows.length,
  registeredCountyCount: registered.length,
  missingRoadSegmentsPathCount: missing.length,
  missingRuntimeFilesCount: missingFiles.length,
  registeredCountyIds: registered.map((row) => row.countyId),
  blockedCountyIds: [...missing.map((row) => row.countyId), ...missingFiles.map((row) => row.countyId)]
}, null, 2));
