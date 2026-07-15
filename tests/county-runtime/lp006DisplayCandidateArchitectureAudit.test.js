const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('js/app.js', 'utf8');
const report = fs.readFileSync('docs/architecture/lp006-display-candidate-architecture-audit.md', 'utf8');

assert(source.includes('function gridlyDisplayCandidateArchitectureAudit()'), 'LP006 passive audit helper exists');
assert(source.includes('architectureOnly: true'), 'LP006 helper is architecture-only');
assert(source.includes('protectedSystemsChanged: false'), 'LP006 helper declares no protected-system changes');
assert(source.includes('earliestCandidateStage: "after alert snapshot creation returns snapshot.alerts; before presentation model creation/grouping"'), 'LP006 helper documents post-snapshot/pre-grouping candidate stage');
assert(source.includes('candidateCanExistBeforeGrouping: true'), 'LP006 helper reports candidate feasibility before grouping');
assert(source.includes('rawArrivalIncremental: false'), 'LP006 helper reports current non-incremental raw arrival ownership');
assert(!source.includes('RenderDisplayCandidate'), 'LP006 does not introduce runtime Display Candidate rendering');
assert(!source.includes('gridlyDisplayCandidate ='), 'LP006 does not create a runtime Display Candidate model');

[
  'Current cold Alerts execution map',
  'Phase timing breakdown',
  'Exact point where the first valid individual alert becomes available',
  'Proposed minimal Display Candidate contract',
  'PresentationRecord remains authoritative',
  'Proceed with a future Display Candidate only as a tightly scoped, non-authoritative, post-snapshot/pre-grouping milestone'
].forEach((text) => assert(report.includes(text), `report includes ${text}`));

console.log('lp006DisplayCandidateArchitectureAudit.test.js passed');
