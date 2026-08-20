import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

function productionFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist in production`);
  const signatureEnd = app.indexOf(') {', start);
  const bodyStart = signatureEnd + 2;
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === '{') depth += 1;
    if (app[index] === '}' && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const quietPresentation = vm.runInNewContext(
  `(${productionFunction('buildGridlyQuietMobilityPresentation')})`,
  { Object }
);

const controls = [
  { community: 'Chester', countyId: 'tyler-tx', placeGeoid: '4814584' },
  { community: 'Anahuac', countyId: 'chambers-tx', placeGeoid: '4803144' }
];

test('shared production quiet presentation is geography-neutral for statewide healthy-empty communities', () => {
  for (const context of controls) {
    const result = quietPresentation(context);
    assert.equal(result.routeImpactSummary, 'No active route impacts reported.');
    assert.equal(result.topStatus, 'Local routes moving normally');
    assert.doesNotMatch(JSON.stringify(result), /Liberty|US 90|Dayton|Chester|Anahuac|Tyler|Chambers/i);
  }
});

test('community transition cannot retain previous place or roadway identity', () => {
  const previous = quietPresentation(controls[0]);
  const current = quietPresentation(controls[1]);
  assert.deepEqual({ ...current }, { ...previous });
  assert.doesNotMatch(JSON.stringify(current), /Chester|Tyler|Liberty|US 90/i);
});

test('actual shared localized-intelligence owner uses neutral copy only on its quiet branches', () => {
  const owner = productionFunction('buildCommuteConsequenceIntelligence');
  assert.match(owner, /const quietMobilityPresentation = buildGridlyQuietMobilityPresentation\(\)/);
  assert.match(owner, /routeImpactItems\.length > 0 \? `Expect delays into Dayton/);
  assert.match(owner, /top \? top\.localizedSummary/);
  assert.match(owner, /highestPriorityCorridor \? buildCommunityConsequenceLabel/);
  assert.match(owner, /: quietMobilityPresentation\.routeImpactSummary/);
  assert.match(owner, /: quietMobilityPresentation\.topStatus/);
  assert.doesNotMatch(owner, /Route into Liberty moving normally|US 90 moving normally/);
});

test('healthy-empty source health and alert-preference readiness remain independent', () => {
  const publisher = fs.readFileSync(new URL('../js/gridlyAwarenessOfficialRoadwayPublisherRepair.js', import.meta.url), 'utf8');
  assert.match(publisher, /HEALTHY_EMPTY:\s*"HEALTHY_EMPTY"/);
  assert.match(app, /Alert preferences are off — turn on to receive commute alerts/);
  assert.doesNotMatch(productionFunction('buildGridlyQuietMobilityPresentation'), /sourceStatus|preference|notification/i);
});

test('equivalent mobile operational quiet fallback uses the shared neutral owner', () => {
  const owner = productionFunction('getOperationalInsightLine');
  assert.match(owner, /if \(!incidents\.length\) return buildGridlyQuietMobilityPresentation\(\)\.topStatus/);
  assert.doesNotMatch(owner, /US 90 moving normally and roads around Dayton are clear/);
});
