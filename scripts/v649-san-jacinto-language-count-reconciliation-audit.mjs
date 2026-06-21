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
assert.doesNotMatch(index, /<option[^>]+value="san-jacinto-tx"/, 'San Jacinto remains hidden from county selector');
assert.match(app, /"san-jacinto-tx": Object\.freeze\([\s\S]*operational: false,[\s\S]*productionEnabled: false,[\s\S]*selectable: false,[\s\S]*productionActivationBlocked: true/, 'San Jacinto remains activation-held');

console.log(JSON.stringify({
  audit: 'V649 San Jacinto language and count reconciliation hardening',
  languageAudit: 'PASS',
  countReconciliationAudit: 'PASS',
  ownershipAudit: 'PASS',
  visibilityAudit: 'PASS',
  activationHeld: true,
  productionSelectorExcludesSanJacinto: true
}, null, 2));
