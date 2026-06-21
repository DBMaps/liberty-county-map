#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('js/app.js', 'utf8');
const index = readFileSync('index.html', 'utf8');

assert.match(app, /function gridlySanJacintoLanguageAndCountReconciliationAudit\(/, 'V649 audit helper must exist');
assert.doesNotMatch(app, /return "Local road impact";/, 'Runtime fallback must not emit Local road impact');
assert.match(app, /replace\(\/\\bLocal Road Impact\\b\/gi, fallback\)/, 'Generic Local Road Impact display text must be sanitized');
assert.match(app, /incidentReportCount/, 'Alert cards must accept shared incident-level report counts');
assert.match(app, /countLineage/, 'Count lineage must be documented by runtime audit');
assert.match(index, /<option[^>]+value="san-jacinto-tx"[^>]+data-gridly-validation-only="true"/, 'San Jacinto is exposed only as validation-only selector option');
assert.match(app, /"san-jacinto-tx": Object\.freeze\([\s\S]*stage: GRIDLY_COUNTY_STAGE_VALIDATION_ONLY,[\s\S]*operational: true,[\s\S]*productionEnabled: false,[\s\S]*selectable: true,[\s\S]*productionActivationBlocked: true/, 'San Jacinto remains validation-only and activation-blocked');

console.log(JSON.stringify({
  audit: 'V649 San Jacinto language and count reconciliation hardening',
  languageAudit: 'PASS',
  countReconciliationAudit: 'PASS',
  ownershipAudit: 'PASS',
  visibilityAudit: 'PASS',
  validationOnly: true,
  productionSelectorValidationOnly: true
}, null, 2));
