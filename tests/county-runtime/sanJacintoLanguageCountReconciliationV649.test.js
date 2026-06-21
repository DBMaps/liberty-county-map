const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.ok(source.includes('function gridlySanJacintoLanguageAndCountReconciliationAudit('), 'V649 San Jacinto language/count audit helper exists');
assert.ok(source.includes('function gridlyResolveCountyAwareFallbackLocation'), 'county-aware fallback resolver remains available');
assert.ok(source.includes('allowActivationHeldCountyContext'), 'activation-held county display context is explicit and audit-only safe');
assert.ok(source.includes('Reported ${gridlyBuildCountyAwareLocationPhrase("near", record, options)}'), 'Reported near Local Road Impact fallback is county-aware');
assert.ok(source.includes('replace(/\\bLocal Road Impact\\b/gi, fallback)'), 'generic Local Road Impact is sanitized for non-Liberty county contexts');
assert.ok(source.includes('return `${hazardLabel} near ${countyFallback}`;'), 'alert title fallback uses county-aware wording instead of Reported-only generic title');
assert.ok(source.includes('incidentReportCount'), 'alert card report count can use shared incident-level count');
assert.ok(source.includes('countLineage'), 'V649 audit documents count lineage');
assert.ok(source.includes('languageAudit'), 'V649 audit exposes language audit');
assert.ok(source.includes('countAudit'), 'V649 audit exposes count audit');
assert.ok(source.includes('visibilityAudit'), 'V649 audit exposes visibility audit');
['topAwarenessText', 'alertPanelText', 'locationCardText', 'visibleMarkerCount', 'visibleAlertCount', 'visibleLocationCardActiveCount', 'visualSurfaceReconciliationPass'].forEach((field) => {
  assert.ok(source.includes(field), `${field} is audited from browser-visible surfaces`);
});
assert.ok(source.includes('validationOnly: true'), 'V650R keeps San Jacinto validation-only');
assert.ok(!source.includes('return "Local road impact";'), 'inferCorridorLabel no longer emits Local road impact fallback');

const protectedFlags = ['historicalReadsEnabled: false', 'historyUiEnabled: false', 'DriveTexasPaused: true', 'TransportationIntelligenceEnabled: false', 'TransportationIntelligenceDisplay: false', 'TransportationIntelligenceActivation: false'];
protectedFlags.forEach((needle) => assert.ok(source.includes(needle), `${needle} remains protected`));

console.log('sanJacintoLanguageCountReconciliationV649.test.js passed');
