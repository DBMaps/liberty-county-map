const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const auditStart = source.indexOf('function gridlySanJacintoReportSubmissionAudit()');
assert.ok(auditStart >= 0, 'San Jacinto report submission audit exists');
const auditEnd = source.indexOf('\nfunction gridlyReportLocationCountyOwnershipAudit()', auditStart);
assert.ok(auditEnd > auditStart, 'San Jacinto report submission audit can be isolated');
const auditSource = source.slice(auditStart, auditEnd);

[
  'visibleCountyOwnershipMismatch',
  'visibleCountyOwnershipMismatchReason',
  'visibleCountyOwnershipTextSample',
  'visibleLineageCount',
  'visibleSurfaceCountMax'
].forEach((field) => assert.ok(auditSource.includes(field), `${field} is exposed by San Jacinto ownership audit`));

[
  'visibleMarkerCount',
  'visibleAlertCount',
  'visibleLocationCardActiveCount',
  'currentSanJacintoMarkerCount',
  'currentSanJacintoAlertCount',
  'currentSanJacintoAwarenessCount',
  'currentSanJacintoLocationCardCount'
].forEach((field) => assert.ok(auditSource.includes(field), `${field} participates in visible surface ownership comparison`));

assert.ok(auditSource.includes('activeCounty === "san-jacinto-tx"'), 'ownership mismatch is scoped to San Jacinto active county');
assert.ok(auditSource.includes('visibleLineageCount === 0 && visibleSurfaceCountMax > 0'), 'visible surfaces fail when county-owned lineage is zero');
assert.ok(/Montgomery County\|Liberty County/.test(auditSource), 'supported-county name leaks are detected in visible text');
assert.ok(auditSource.includes('&& !visibleCountyOwnershipMismatch'), 'visual reconciliation fails on visible ownership mismatch');

console.log('sanJacintoOwnershipAuditHardeningV662.test.js passed');
