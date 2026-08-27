import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const packageRoot = 'Crossing-Packages';
const packageFiles = fs.readdirSync(packageRoot, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => path.join(packageRoot, entry.name, 'Production', `${entry.name}-production-crossings.geojson`))
  .filter(file => fs.existsSync(file));

const isAuthoritativePublicReportableHighway = properties => (
  properties.TYPEXING === 'Public'
  && properties.POSXING === 'At Grade'
  && String(properties.XPURPOSE) === '1'
);

test('all 254 governed packages have a deterministic source-field eligibility census', () => {
  const census = { inventory: 0, sourcePublic: 0, sourcePrivate: 0, publicReportableAtGradeHighway: 0 };
  for (const file of packageFiles) {
    const collection = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    for (const feature of collection.features) {
      const properties = feature.properties;
      census.inventory += 1;
      census.sourcePublic += properties.TYPEXING === 'Public' ? 1 : 0;
      census.sourcePrivate += properties.TYPEXING === 'Private' ? 1 : 0;
      census.publicReportableAtGradeHighway += isAuthoritativePublicReportableHighway(properties) ? 1 : 0;
    }
  }
  assert.equal(packageFiles.length, 254);
  assert.deepEqual(census, {
    inventory: 16099,
    sourcePublic: 11195,
    sourcePrivate: 4902,
    publicReportableAtGradeHighway: 9162
  });
});

test('Box Canyon six-candidate cohort separates geography from traveler eligibility', () => {
  const collection = JSON.parse(fs.readFileSync('Crossing-Packages/val-verde/Production/val-verde-production-crossings.geojson', 'utf8'));
  const candidateIds = new Set(['924451G', '920408M', '763840R', '763842E', '763841X', '763843L']);
  const candidates = collection.features.filter(feature => candidateIds.has(feature.properties.CROSSING));
  assert.equal(candidates.length, 6);
  assert.deepEqual(candidates.filter(feature => isAuthoritativePublicReportableHighway(feature.properties)).map(feature => feature.properties.CROSSING), []);
  assert.deepEqual(candidates.filter(feature => feature.properties.TYPEXING === 'Private').map(feature => feature.properties.CROSSING).sort(), ['763840R', '763841X', '763842E', '763843L', '920408M']);
});
