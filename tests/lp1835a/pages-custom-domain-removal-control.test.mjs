import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { ROOT, build, encode, verify } from '../../tools/lp1835a/build-pages-domain-removal-evidence.mjs';

test('official Cloudflare sources prove dashboard and exact API removal controls', () => {
  const evidence = build()['pages-custom-domain-removal-control.json'];
  assert.equal(evidence.evidenceClass, 'AUTHORITATIVE_PLATFORM_DOCUMENTED_CONTROL');
  assert.ok(evidence.provenance.every(source => source.provider === 'Cloudflare' && source.sourceType === 'OFFICIAL_PROVIDER_DOCUMENTATION'));
  assert.equal(evidence.apiControl.method, 'DELETE');
  assert.equal(evidence.apiControl.endpoint, '/accounts/{account_id}/pages/projects/{project_name}/domains/{domain_name}');
  assert.equal(evidence.apiControl.requiredPermission, 'Pages Write');
  assert.match(evidence.dashboardControl.procedure.join(' '), /CNAME.*Delete.*Workers & Pages.*Remove domain/);
});

test('closure preserves empty, undeployed, unmodified platform state', () => {
  const summary = build()['lp1835a-summary.json'];
  assert.deepEqual(summary.project.name, 'gridly-preview');
  assert.equal(summary.project.exists, true);
  assert.equal(summary.deploymentCount, 0);
  assert.equal(summary.customDomainCount, 0);
  assert.equal(summary.previewGridlygoComBound, false);
  for (const key of ['artifactUploaded', 'dnsChanged', 'accessChanged', 'automaticDeployment', 'destructiveControlExecuted']) assert.equal(summary[key], false);
});

test('no live rollback is claimed and every global authorization stays closed', () => {
  const reports = build();
  const control = reports['pages-custom-domain-removal-control.json'];
  const rollback = reports['first-deployment-rollback-closure.json'];
  assert.equal(control.ownerExecutedRemoveTest, false);
  assert.equal(control.liveRollbackExecuted, false);
  assert.equal(rollback.rollbackExecuted, false);
  assert.equal(rollback.rollbackAuthorization, 'NOT_AUTHORIZED');
  for (const value of Object.values(reports['lp1835a-summary.json'].globalAuthorizationState)) assert.equal(value, 'NOT_AUTHORIZED');
});

test('project deletion is documented only as a separately gated last resort', () => {
  const fallback = build()['first-deployment-rollback-closure.json'].controls.projectDeleteFallback;
  assert.equal(fallback.endpoint, '/accounts/{account_id}/pages/projects/{project_name}');
  assert.equal(fallback.role, 'LAST_RESORT_NOT_PREFERRED');
  assert.equal(fallback.separatelyAuthorizationGated, true);
  assert.equal(fallback.executionOccurred, false);
});

test('reports are canonical, deterministic, secret-safe LF UTF-8 without BOM', () => {
  assert.equal(encode({ b: 1, a: 2 }), encode({ a: 2, b: 1 }));
  assert.equal(verify(), true);
  const serialized = JSON.stringify(build());
  assert.doesNotMatch(serialized, /(?:bearer\s+\S+|api[_-]?key|cookie|password\s*[:=]|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i);
});

test('protected runtime and native surfaces are untouched', () => {
  const output = execFileSync('git', ['diff', '--name-only', '--', 'index.html', 'js/app.js', 'manifest.json', 'service-worker.js', 'android', 'ios'], { cwd: ROOT, encoding: 'utf8' }).trim();
  assert.equal(output, '');
});

test('LP183.5 historical owner evidence remains truthful and unchanged', () => {
  const historical = JSON.parse(fs.readFileSync(`${ROOT}/reports/lp1835/rollback-control-evidence.json`, 'utf8'));
  assert.equal(historical.controls.customDomainDetach.proven, false);
  assert.equal(historical.controls.customDomainDetach.executed, false);
});
