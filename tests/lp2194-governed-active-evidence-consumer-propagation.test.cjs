const test = require('node:test');
const assert = require('node:assert/strict');
const governed = require('../js/governed-awareness.js');
const NOW = Date.parse('2026-08-22T12:00:00Z');
const hazard = (id, extra={}) => ({ id, sourceKind:'active_hazard', reportKind:'hazard', type:'road_hazard', status:'active', active:true, countyId:'reeves-tx', canonicalCommunity:'Town of Pecos', canonicalKey:'4873493', ...extra });
const crossing = (id, extra={}) => ({ id, sourceKind:'community_report', type:'blocked_crossing', status:'active', active:true, countyId:'reeves-tx', canonicalCommunity:'Town of Pecos', canonicalKey:'4873493', ...extra });
const project = records => governed.buildConsumerProjection({records, nowMs:NOW, countyId:'reeves-tx', canonicalCommunity:'Town of Pecos', canonicalKey:'4873493'});

test('quiet control stays quiet for Alerts and KBYG', () => {
 const out=project([]); assert.equal(out.snapshot.governedEligibleEvidenceCount,0); assert.equal(out.surfaces.alerts.length,0); assert.equal(out.surfaces.kbygCommunity.length,0);
});
test('active road hazard follows existing Alerts and KBYG policy', () => {
 const out=project([hazard('h1')]); assert.equal(out.snapshot.governedEligibleEvidenceCount,1); assert.deepEqual(out.surfaces.alerts.map(x=>x.evidenceId),['active_hazard:h1']); assert.deepEqual(out.surfaces.kbygCommunity.map(x=>x.evidenceId),['active_hazard:h1']);
});
test('blocked crossing remains an explicit product-policy deferral', () => {
 const out=project([crossing('c1')]); assert.equal(out.snapshot.governedEligibleEvidenceCount,1); assert.equal(out.surfaces.alerts.length,0); assert.equal(out.surfaces.kbygCommunity.length,0); assert.equal(out.lineage[0].alertsOmissionReason,'PRODUCT_CONTRACT_UNDEFINED'); assert.equal(out.lineage[0].kbygCommunityOmissionReason,'PRODUCT_CONTRACT_UNDEFINED');
});
test('mixed Pecos control publishes only policy-eligible evidence without inflation', () => {
 const out=project([crossing('c1'),hazard('h1'),hazard('h1')]); assert.equal(out.snapshot.governedEligibleEvidenceCount,2); assert.equal(out.snapshot.duplicateEvidenceIds.length,1); assert.equal(out.surfaces.alerts.length,1); assert.equal(out.surfaces.kbygCommunity.length,1);
});
test('cleared history is retained but excluded from consumers', () => {
 const out=project([hazard('h1',{status:'cleared'})]); assert.equal(out.snapshot.evidence[0].lifecycle.retainedForHistory,true); assert.equal(out.snapshot.governedEligibleEvidenceCount,0); assert.equal(out.surfaces.alerts.length,0); assert.equal(out.surfaces.kbygCommunity.length,0);
});
test('stale and old-area evidence do not propagate', () => {
 const out=project([hazard('stale',{status:'stale'}),hazard('old',{countyId:'ward-tx',canonicalCommunity:'Monahans',geographicEligible:false})]); assert.equal(out.snapshot.governedEligibleEvidenceCount,0); assert.equal(out.surfaces.alerts.length,0); assert.equal(out.surfaces.kbygCommunity.length,0); assert.equal(out.lineage[0].alertsOmissionReason,'STALE_OR_INACTIVE'); assert.equal(out.lineage[1].alertsOmissionReason,'GEOGRAPHICALLY_INELIGIBLE');
});
