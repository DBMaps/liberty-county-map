const assert = require('node:assert');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');

assert(app.includes('V886-regional-search-coverage-expansion'));
assert(app.includes('regionalCoverageEnabled'));
assert(app.includes('regionalCountyCoverage'));
assert(app.includes('remainingRegionalCoverageGaps'));
assert(app.includes('protectedSystemsUnchanged: true'));

const seedsMatch = app.match(/const GRIDLY_LOCAL_POI_SEEDS = \[([\s\S]*?)\n\];\n\nconst GRIDLY_SEARCH_STATE_DEFAULTS/);
assert(seedsMatch, 'local POI seed list must be present');
const seedBlock = seedsMatch[1];
const seedCount = (seedBlock.match(/\bid:\s*"seed-/g) || []).length;
assert(seedCount > 33, `expected V886 seed count above V885 baseline, got ${seedCount}`);

const counties = ['Liberty', 'Montgomery', 'San Jacinto', 'Chambers', 'Jefferson', 'Hardin', 'Polk', 'Walker', 'Harris', 'Orange', 'Jasper', 'Newton'];
for (const county of counties) {
  assert(seedBlock.includes(`county: "${county}"`) || seedBlock.includes(`"${county}"`), `expected ${county} regional coverage`);
}

for (const category of ['road', 'government', 'hospital', 'school', 'crossing', 'transportation']) {
  assert(seedBlock.includes(`"${category}"`), `expected ${category} category coverage`);
}

const certificationMatch = app.match(/const GRIDLY_SEARCH_DISCOVERY_CERTIFICATION_QUERIES = Object\.freeze\(\[([\s\S]*?)\n\]\);/);
assert(certificationMatch, 'certification dataset must be present');
const certificationBlock = certificationMatch[1];
for (const query of ['Conroe City Hall', 'Montgomery County Courthouse', 'Coldspring', 'Chambers County Courthouse', 'Beaumont', 'Lamar University', 'Livingston', 'Huntsville', 'Houston', 'Orange County Courthouse', 'Jasper County Courthouse', 'Newton County Courthouse']) {
  assert(certificationBlock.includes(`query: "${query}"`), `expected certification query ${query}`);
}


assert(app.includes('function buildGridlySearchDiscoveryAudit()'));
assert(app.includes('function gridlyRunSearchCertificationAudit('));
assert(app.includes('regionalCoverageEnabled: countiesCovered.length >= 10 && GRIDLY_LOCAL_POI_SEEDS.length > 33'));
assert(app.includes('audit: "V886 Regional Search Certification Audit"'));
assert(app.includes('providerContribution: buildGridlySearchDiscoveryAudit().providerContribution'));

console.log('v886-regional-search-coverage-expansion.test.js passed');
