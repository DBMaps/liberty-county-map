const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const auditStart = app.indexOf('function gridlyLp065DecisionLanguageConsistencyAudit');
const auditEnd = app.indexOf('function openGridlyDestinationImpactPane', auditStart);
const audit = app.slice(auditStart, auditEnd);

assert(auditStart > 0 && auditEnd > auditStart, 'LP065 passive browser audit exists');
['quiet', 'developing', 'moderate', 'elevated', 'evidence', 'freshness'].forEach((standard) => {
  assert.match(app, new RegExp(`${standard}: Object\\.freeze`), `${standard} language standard exists`);
});
[
  'Travel normally and stay aware.', 'No active concerns are reported in the available local intelligence.',
  'Check before leaving.', 'Conditions may be changing.', 'Developing conditions.',
  'Allow extra travel time.', 'Community reports indicate travel impacts.', 'Multiple recent signals.',
  'Several conditions may affect travel.', 'Check your route before leaving.',
  'Community reports support this.', 'Official roadway information supports this.',
  'Weather conditions support this.', 'Crossing reports support this.',
  'Strong supporting evidence.', 'Quiet conditions.', 'Checked just now.', 'Updated 4 minutes ago.'
].forEach((copy) => assert(app.includes(`"${copy}"`), `standard copy is present: ${copy}`));

assert.match(html, />Travel normally and stay aware\.<\/h2>/, 'destination quiet first paint uses the shared decision language');
assert.match(html, />No active concerns are reported in the available local intelligence\.<\/p>/, 'destination quiet context uses the shared language');
assert.match(app, /window\.gridlyLp065DecisionLanguageConsistencyAudit = gridlyLp065DecisionLanguageConsistencyAudit/, 'browser audit is exposed');
['available: true', 'milestone: "LP065"', 'passive: true', 'presentationOnly: true', 'noFetches: true', 'noWrites: true', 'noStorageWrites: true', 'noPolling: true'].forEach((characteristic) => {
  assert(audit.includes(characteristic), `${characteristic} is certified`);
});
assert.doesNotMatch(audit, /fetch\(|localStorage|sessionStorage|setInterval|supabase\./i, 'audit performs no network, storage, polling, or backend work');
assert.match(audit, /existingIntelligencePreserved: true/, 'existing intelligence is explicitly preserved');
assert.match(audit, /presentationOnlyBehaviorPreserved: true/, 'presentation-only behavior is explicitly preserved');
assert.match(audit, /certificationStatus: Object\.values\(checks\)\.every\(Boolean\) \? "pass" : "fail"/, 'audit pass status derives from all checks');

console.log('LP065 Decision Language Consistency regression passed');
