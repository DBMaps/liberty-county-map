import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

execFileSync(process.execPath, ['tools/lp202/consumer-selector-rca-audit.mjs'], { stdio: 'inherit' });
const audit = JSON.parse(readFileSync('reports/lp2022/consumer-selector-rca-audit.json', 'utf8'));
assert.deepEqual(audit.results.grayson.stages, { input: 240, countyMatch: 240, classificationEligible: 240, reportable: 240, awarenessOwned: 0, localityEligible: 0, geometryEligible: 0, fraIdentityValidAndDeduped: 0, hiddenLegacyEligibility: 0, final: 0 });
assert.equal(audit.results.dallas.stages.input, 789);
assert.equal(audit.results.liberty.stages.input, 115);
assert.equal(audit.results.liberty.classifications.PUBLIC_ROADWAY, 80);
assert.equal(audit.statewideImpact.activePositiveCounties, 202);
assert.equal(audit.statewideImpact.countiesWithoutLegacyAwarenessBounds, 175);
assert.equal(audit.observationalOnly, true);
