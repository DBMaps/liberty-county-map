import fs from 'node:fs';
import assert from 'node:assert/strict';

const app = fs.readFileSync('js/app.js', 'utf8');
const report = fs.readFileSync('GRIDLY-V740-LIBERTY-COMMUNITY-PULSE-RECORD-DIFF-STABILIZATION.md', 'utf8');
const evidence = JSON.parse(fs.readFileSync('assets/evidence/v740-liberty-community-pulse-record-diff-stabilization.json', 'utf8'));

assert.match(app, /function gridlyV740NormalizeEquivalentRecordField/, 'V740 equivalent record field normalizer must exist');
assert.match(app, /function gridlyV740StableRecordSignatureParts/, 'V740 canonical record parts builder must exist');
assert.match(app, /function gridlyV740EncodeStableRecordSignature/, 'V740 canonical JSON record signature encoder must exist');
assert.match(app, /JSON\.parse\(recordSignature\)/, 'V739 diff parser must preserve visibility for JSON record signatures');
assert.match(app, /recordSignature\.split\(":"\)/, 'V739 diff parser must remain backward compatible with legacy colon signatures');
assert.match(app, /lifecycle: parsed\?\.lifecycle/, 'V739/V740 audit must expose lifecycle field');
assert.match(app, /reportCount: parsed\?\.reportCount/, 'V739/V740 audit must expose report count field');
assert.match(app, /lat: parsed\?\.lat/, 'V739/V740 audit must expose latitude field');
assert.match(app, /lng: parsed\?\.lng/, 'V739/V740 audit must expose longitude field');
assert.doesNotMatch(app, /cacheOutcome: "hit"[\s\S]{0,120}cache_miss_authoritative_signature_changed/, 'V740 must not force cache hits blindly');

assert.match(report, /Final determination/);
assert.match(report, /Exact record-level diff finding/);
assert.match(report, /Patch applied or patch withheld/);
assert.match(report, /Protected-system confirmation/);
assert.equal(evidence.version, 'V740');
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false);
assert.equal(evidence.protectedSystems.historyUiEnabled, false);
assert.equal(evidence.protectedSystems.DriveTexasPaused, true);
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false);
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false);

console.log('V740 Liberty Community Pulse record diff stabilization validation passed');
