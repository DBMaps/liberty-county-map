import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ROOT, canonical, digest, generate} from '../tools/lp18811/provision-wave0-fixtures.mjs';

const files = () => generate(ROOT);
const ownerResult = `${ROOT}/evidence/lp18811/execution-results/owner-result.json`;
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

test('approved authority, complete defect inventory, counts, and exact scope remain immutable', () => {
  const c=files()['wave0-fixture-contract.json']; const inv=JSON.parse(fs.readFileSync(`${ROOT}/reports/lp18811f2/defect-inventory.json`));
  assert.equal(c.wave0ContractDigest,'sha256:a05d8fbb07bcdf1ee4b067d0aacbe6e690a8531f160396472f76757f3beeb257');
  assert.equal(c.severityTaxonomyDigest,'sha256:f920f96e8a6175f594368e400bef26717662aa4e316503acd4c867fc95654329');
  assert.equal(inv.completeness,'COMPLETE'); assert.deepEqual(inv.derivedCounts,{severity1OpenCount:0,severity2OpenCount:0});
  assert.equal(c.exactFipsScope.length,28); assert.equal(new Set(c.exactFipsScope).size,28);
});

test('every assertion has governed fixtures or an explicit unresolved authority blocker', () => {
  const c=files()['wave0-fixture-contract.json']; const ids=JSON.parse(fs.readFileSync(`${ROOT}/reports/lp18811f2/owner-governance-decision.json`)).approvedAssertionIds;
  for(const id of ids) assert.ok(c.fixtures.some(f=>f.assertionId===id)||c.unresolvedFixtureBlockers.some(b=>b.assertionId===id),id);
  assert.deepEqual(c.unresolvedFixtureBlockers.map(x=>x.assertionId),ids);
});

test('fixture results are concrete, sourced, canonical, and use only governed counties', () => {
  const c=files()['wave0-fixture-contract.json'];
  for(const f of c.fixtures){assert.notDeepEqual(f.expectedResult,'PASS');assert.ok(Object.keys(f.expectedResult).length>1);assert.ok(f.evidenceSource.length);assert.ok(f.applicableFips.every(x=>c.exactFipsScope.includes(x)));assert.ok(f.fixtureId.endsWith(f.applicableFips[0]));}
  assert.equal(c.fixtures.filter(x=>x.assertionId==='CERTIFIED_ARTIFACT_STABILITY').length,28);
  assert.equal(c.fixtures.filter(x=>x.assertionId==='OPERATIONAL_COUNTY_RESULT_STABILITY').length,28);
  assert.equal(c.placeholdersRemain,false);
});

test('browser need is explicit and no framework or runner is silently added', () => {
  const a=files()['browser-infrastructure-audit.json'];
  assert.equal(a.discovery,'NO_BROWSER_AUTOMATION_FRAMEWORK_OR_EXECUTABLE_HARNESS'); assert.equal(a.newDependencyAdded,false); assert.equal(a.runnerImplemented,false);
  assert.equal(a.classifications.length,6); assert.ok(a.classifications.every(x=>x.executionClassification==='BROWSER_REQUIRED'));
  const pkg=JSON.parse(fs.readFileSync(`${ROOT}/package.json`)); for(const n of ['playwright','puppeteer','webdriver','selenium-webdriver']) assert.equal(pkg.dependencies?.[n]||pkg.devDependencies?.[n],undefined);
});

test('result contract requires identity/access-safe portable fields and rejects production classification', () => {
  const s=files()['wave0-result.schema.json'];
  for(const k of ['deploymentId','buildIdentity','executorEvidenceReference','productionMutationObserved','activationObserved']) assert.ok(s.required.includes(k));
  assert.deepEqual(s.properties.environmentClassification,{const:'OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION'});
  const serialized=canonical(s); assert.doesNotMatch(serialized,/clientSecret|accessClientSecret/i);
});

test('generator is read-only, preserves state, and never touches authoritative owner result', () => {
  const before=sha(ownerResult); const a=files(), b=files(), summary=a['lp18811f3-summary.json'];
  assert.deepEqual(a,b); for(const [n,v] of Object.entries(a)) assert.equal(fs.readFileSync(`${ROOT}/reports/lp18811f3/${n}`,'utf8'),canonical(v));
  assert.equal(digest(a['wave0-fixture-contract.json']),summary.fixtureContractDigest); assert.equal(sha(ownerResult),before);
  assert.deepEqual(summary.state,{currentOperationalCount:28,restrictedCountyCount:11,newActivatedCount:0,runtimeOperationalCountChanged:false,restrictedCountyStateChanged:false});
  const source=fs.readFileSync(`${ROOT}/tools/lp18811/provision-wave0-fixtures.mjs`,'utf8');
  for(const forbidden of ['fetch(', 'supabase.from', 'wrangler deploy', 'activateCounty(', 'owner-result.json\', canonical']) assert.equal(source.includes(forbidden),false);
});

