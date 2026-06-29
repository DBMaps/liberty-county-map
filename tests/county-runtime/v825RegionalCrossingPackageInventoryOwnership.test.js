const assert = require('assert');
const fs = require('fs');
const crypto = require('crypto');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const adapterSource = fs.readFileSync('js/gridlyCrossingPackageAdapter.js', 'utf8');

assert(appSource.includes('gridlyInspectCrossingPackageInventory'), 'V825 package inventory ownership inspector exists');
assert(appSource.includes('packageContentBelongsToActiveCounty'), 'Regional audit validates package content county ownership');
assert(appSource.includes('suspiciousExpectedCountCleared'), 'Regional audit detects suspicious county inventory scale');
assert(appSource.includes('duplicatePackageInventoryNotDetected'), 'Regional audit detects duplicate package inventories');
assert(appSource.includes('gridlyCrossingInventoryExpectedMinimum'), 'Regional audit has explicit expected minimum inventory logic');
assert(appSource.includes('if (countyId === "harris-tx") return 500;'), 'Harris inventory below 500 crossings is suspicious');
assert(appSource.includes('packageSourceLineage'), 'Regional audit reports package source lineage');
assert(adapterSource.includes('countyName'), 'Crossing adapter preserves package county names for runtime ownership validation');

function loadGeoJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

function featureId(feature, index) {
  const p = feature.properties || {};
  return String(p.CROSSING || p.crossing || p.crossing_id || p.crossingId || p.id || feature.id || `index:${index}`).trim();
}

function fingerprint(features) {
  return crypto.createHash('sha256').update(features.map(featureId).sort().join('\n')).digest('hex');
}

const harris = loadGeoJson('Crossing-Packages/harris/harris-crossings.geojson');
const liberty = loadGeoJson('Crossing-Packages/liberty/liberty-crossings.geojson');

assert.strictEqual(harris.features.length, 1159, 'Harris package should contain the full Harris inventory, not the Liberty-sized 115 records');
assert.strictEqual(liberty.features.length, 115, 'Liberty package baseline remains 115 crossings');
assert.notStrictEqual(fingerprint(harris.features), fingerprint(liberty.features), 'Harris and Liberty crossing packages must not share the same crossing inventory content');
assert(harris.features.every((feature) => (feature.properties || {}).COUNTYNAME === 'HARRIS'), 'Every Harris crossing feature is Harris-owned');
assert(liberty.features.every((feature) => (feature.properties || {}).COUNTYNAME === 'LIBERTY'), 'Every Liberty crossing feature is Liberty-owned');

console.log('v825RegionalCrossingPackageInventoryOwnership.test.js passed');
