import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const report = JSON.parse(await readFile(new URL('reports/lp232/statewide-crossing-place-attribution-certification.json', root)));
test('LP232 report rebuild is byte-identical', () => assert.match(execFileSync(process.execPath, ['tools/lp232/build-crossing-place-attribution-certification.mjs', '--verify'], { cwd: root, encoding: 'utf8' }), /verify PASS/));
test('source search precedes derivation and no competing artifact is emitted', () => { assert.equal(report.sourceWorkspace.searchBeforeDerivationPerformed, true); assert.equal(report.sourceWorkspace.existingAttributionFound, false); assert.equal(report.attribution.artifactProduced, false); });
test('missing authoritative geometry fails closed rather than inventing geography', () => { assert.equal(report.finalClassification, 'F. INSUFFICIENT_EVIDENCE'); assert.match(report.geometryAuthority.finding, /NOT_PRESENT/); assert.equal(report.geometryAuthority.repairPerformed, false); });
test('spatial and identity contract prohibits approximations', () => { assert.equal(report.contract.stableGeoidJoinRequired, true); assert.equal(report.contract.nameOnlyJoinAllowed, false); assert.equal(report.contract.nearestPlaceAllowed, false); assert.equal(report.contract.presentationRadiusAllowed, false); assert.equal(report.contract.countyUnionAllowed, false); assert.match(report.contract.predicate, /boundary/); });
test('certified statewide identity baseline remains governed', () => assert.deepEqual(report.canonicalBaseline, { canonicalCommunities: 1859, governedMemberships: 2058, multiCountyIdentities: 163, counties: 254 }));
test('production behavior is untouched', () => assert.deepEqual(Object.values(report.safety), Array(8).fill(false)));
test('builder contains no network or production runtime integration', async () => { const source = await readFile(new URL('tools/lp232/build-crossing-place-attribution-certification.mjs', root), 'utf8'); assert.doesNotMatch(source, /https?:|fetch\(|js\/app\.js|DriveTexas/); });
