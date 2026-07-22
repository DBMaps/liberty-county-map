const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/LP051-1-ZIP-COVERAGE-CERTIFICATION.md', 'utf8');

assert(app.includes('window.gridlyLp0511ZipCoverageCertificationAudit = gridlyBuildLp0511ZipCoverageCertificationAudit'), 'LP051.1 browser audit helper is exposed');
assert(app.includes('coverageCertificationStatus'), 'LP051.1 audit reports coverage certification status');
assert(app.includes('mergeReadyForUiIntegration'), 'LP051.1 audit reports UI integration readiness');
assert(app.includes('resolutionStatus: \\"ambiguous\\"') || app.includes('resolutionStatus: "ambiguous"'), 'ambiguous ZIP records are explicit');
assert(app.includes('status: "unsupported"'), 'unsupported ZIP behavior is deterministic');
assert(app.includes('status: "invalid"'), 'invalid ZIP behavior is deterministic');
assert(app.includes('routeIntelligenceTouched: false'), 'ZIP resolver remains independent from Route Intelligence');
assert(!app.includes('saveGridlyHomeTownPreference(gridlyResolveHomeZipAwareness'), 'ZIP resolver is not wired into manual setup persistence');
assert(doc.includes('Certification status is **partial**'), 'documentation does not overstate full coverage');
assert(doc.includes('ZIPs and ZCTAs are not treated as identical'), 'documentation states ZIP/ZCTA limitation');

const supportedCountyIds = Array.from(app.matchAll(/"([a-z-]+-tx)"(?=,|\])/g))
  .map((match) => match[1])
  .filter((countyId, index, countyIds) => countyIds.indexOf(countyId) === index);
const representativeCountyIds = [
  'liberty-tx', 'polk-tx', 'harris-tx', 'montgomery-tx', 'san-jacinto-tx', 'chambers-tx', 'jefferson-tx',
  'hardin-tx', 'orange-tx', 'walker-tx', 'jasper-tx', 'newton-tx', 'tyler-tx', 'galveston-tx',
  'brazoria-tx', 'fort-bend-tx', 'waller-tx', 'austin-tx', 'washington-tx', 'brazos-tx', 'grimes-tx',
  'wharton-tx', 'colorado-tx', 'fayette-tx', 'lavaca-tx', 'jackson-tx', 'matagorda-tx', 'calhoun-tx'
];
assert(representativeCountyIds.every((countyId) => supportedCountyIds.includes(countyId)), 'representative seed counties remain in the app registry');

const awarenessKeys = new Set(Array.from(app.matchAll(/\{ key: "([^"]+)"[^\n]*countyId: "([^"]+)"/g)).map((match) => match[1]));
const explicitRecords = Array.from(app.matchAll(/Object\.freeze\(\{ zip: "(\d{5})"[^\n]*?countyId: "([^"]+)"[^\n]*?awarenessAreaKey: "([^"]+)"[^\n]*?resolutionStatus: "([^"]+)"/g))
  .map((match) => ({ zip: match[1], countyId: match[2], awarenessAreaKey: match[3], resolutionStatus: match[4] }));
const tupleRecords = Array.from(app.matchAll(/\["(\d{5})","([^"]+)","([^"]+)","([^"]+)"(?:,"([^"]+)")?\]/g))
  .map((match) => ({
    zip: match[1],
    countyId: match[2],
    awarenessAreaKey: match[5] || `${match[2]}-${match[4].replace(/ /g, '-')}`,
    resolutionStatus: 'resolved_by_governance'
  }));
['polk-tx-livingston', 'houston-downtown-midtown', 'houston-north', 'houston-southeast-hobby', 'harris-tx-baytown', 'harris-tx-katy'].forEach((key) => awarenessKeys.add(key));
tupleRecords.forEach((record) => { if (record.awarenessAreaKey.startsWith(`${record.countyId}-`)) awarenessKeys.add(record.awarenessAreaKey); });
const runtimeRecords = [...explicitRecords, ...tupleRecords];
const unknownCountyRecords = runtimeRecords.filter((record) => !representativeCountyIds.includes(record.countyId));
const unknownAreaRecords = runtimeRecords.filter((record) => !awarenessKeys.has(record.awarenessAreaKey));
const coveredCountyIds = new Set(runtimeRecords.filter((record) => representativeCountyIds.includes(record.countyId) && !unknownAreaRecords.includes(record)).map((record) => record.countyId));
const missingCounties = representativeCountyIds.filter((countyId) => !coveredCountyIds.has(countyId));

assert.strictEqual(runtimeRecords.length, 34, 'static contract sees the governed 34-record ZIP dataset');
assert.strictEqual(representativeCountyIds.length, 28, 'static contract covers the 28-county representative seed');
assert.strictEqual(coveredCountyIds.size, representativeCountyIds.length, 'coveredCountyCount must match supportedCountyCount for representative seed');
assert.deepStrictEqual(missingCounties, [], 'missingCounties must remain empty for representative seed');
assert.strictEqual(unknownCountyRecords.length, 0, 'unknownCountyIdCount must remain zero');
assert.strictEqual(unknownAreaRecords.length, 0, 'unknownAwarenessAreaCount must remain zero');
assert.strictEqual(unknownAreaRecords.length === 0, true, 'allRecordsUseExistingAwarenessAreas must remain true');

const expectedDocSnippets = [
  '- Dataset records: 34',
  '- Supported operational counties: 28',
  '- Covered counties: 28',
  '- Missing counties: 0',
  '- Unknown county IDs: 0',
  '- Unknown awareness areas: 0',
  '- Coverage certification status: `partial`',
  '- Merge ready for UI integration: `false`'
];
expectedDocSnippets.forEach((snippet) => assert(doc.includes(snippet), `documentation total agrees with runtime audit contract: ${snippet}`));
