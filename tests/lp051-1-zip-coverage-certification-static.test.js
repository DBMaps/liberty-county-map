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
