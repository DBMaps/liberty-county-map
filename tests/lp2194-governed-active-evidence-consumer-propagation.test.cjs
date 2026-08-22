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
test('blocked crossing follows the explicit LP223 Alerts and KBYG policy', () => {
 const out=project([crossing('c1')]); assert.equal(out.snapshot.governedEligibleEvidenceCount,1); assert.equal(out.surfaces.alerts.length,1); assert.equal(out.surfaces.kbygCommunity.length,1); assert.equal(out.lineage[0].alertsOmissionReason,null); assert.equal(out.lineage[0].kbygCommunityOmissionReason,null);
});
test('mixed Pecos control publishes each policy-eligible identity without inflation', () => {
 const out=project([crossing('c1'),hazard('h1'),hazard('h1')]); assert.equal(out.snapshot.governedEligibleEvidenceCount,2); assert.equal(out.snapshot.duplicateEvidenceIds.length,1); assert.equal(out.surfaces.alerts.length,2); assert.equal(out.surfaces.kbygCommunity.length,2);
});
test('cleared history is retained but excluded from consumers', () => {
 const out=project([hazard('h1',{status:'cleared'})]); assert.equal(out.snapshot.evidence[0].lifecycle.retainedForHistory,true); assert.equal(out.snapshot.governedEligibleEvidenceCount,0); assert.equal(out.surfaces.alerts.length,0); assert.equal(out.surfaces.kbygCommunity.length,0);
});
test('stale and old-area evidence do not propagate', () => {
 const out=project([hazard('stale',{status:'stale'}),hazard('old',{countyId:'ward-tx',canonicalCommunity:'Monahans',geographicEligible:false})]); assert.equal(out.snapshot.governedEligibleEvidenceCount,0); assert.equal(out.surfaces.alerts.length,0); assert.equal(out.surfaces.kbygCommunity.length,0); assert.equal(out.lineage[0].alertsOmissionReason,'STALE_OR_INACTIVE'); assert.equal(out.lineage[1].alertsOmissionReason,'GEOGRAPHICALLY_INELIGIBLE');
});

const fs = require('node:fs');
const vm = require('node:vm');
const appSource = fs.readFileSync('js/app.js', 'utf8');
function productionFunction(name, nextName, globals = {}) {
  const start = appSource.indexOf(`function ${name}`);
  const end = appSource.indexOf(`function ${nextName}`, start + 1);
  assert.ok(start >= 0 && end > start, `${name} production function is extractable`);
  const context = vm.createContext({ ...globals });
  vm.runInContext(`${appSource.slice(start, end)};this.result=${name};`, context);
  return context.result;
}

test('Sulphur Springs browser-equivalent authority reaches active KBYG and Alerts DOM inputs', () => {
  const control = hazard('37e6718f-a853-4b8f-a2bb-31cd64625153', {
    countyId: 'hopkins-tx', canonicalCommunity: '', canonicalKey: '4870904',
    lat: 33.1384, lng: -95.6011, title: 'Road hazard', updatedAt: '2026-08-22T11:55:00Z'
  });
  const projection = governed.buildConsumerProjection({ records: [control], nowMs: NOW, countyId: 'hopkins-tx', canonicalCommunity: 'Sulphur Springs', canonicalKey: '4870904' });
  assert.equal(projection.snapshot.governedEligibleEvidenceCount, 1);
  assert.deepEqual(projection.surfaces.locationContext.map(row => row.evidenceId), [`active_hazard:${control.id}`]);
  assert.deepEqual(projection.surfaces.kbygCommunity.map(row => row.evidenceId), [`active_hazard:${control.id}`]);
  assert.deepEqual(projection.surfaces.alerts.map(row => row.evidenceId), [`active_hazard:${control.id}`]);

  const homeCopy = productionFunction('getGridlyHomeCommunityPulseCopy', 'gridlyCommunityPulseConsumerHeadlineAvailable', {
    gridlyGetAwarenessEvidenceCompleteness: () => ({ canStateCommunityQuiet: false, canStateTravelNormal: false }),
    getGridlyAwarenessCoverageState: () => ({ state: 'available' })
  });
  const finalKbyg = homeCopy({ quiet: false, activeCount: projection.surfaces.kbygCommunity.length, activityLevel: 'active', coverage: { state: 'available' } });
  assert.equal(finalKbyg.state, 'one_issue');
  assert.doesNotMatch(`${finalKbyg.headline} ${finalKbyg.subline}`, /No active local issues|No active concerns/i);

  const areaPredicate = productionFunction('gridlyRecordTextMatchesAwarenessArea', 'gridlyGetGovernedAwarenessGeometry', {
    normalizeGridlyAwarenessAreaLookupText: value => String(value || '').trim().toLowerCase(),
    gridlyNormalizeCountyId: value => String(value || '').trim().toLowerCase(),
    gridlyGetActiveCountyId: () => 'hopkins-tx',
    getGridlyAwarenessIntelligenceCrossing: () => null
  });
  assert.equal(areaPredicate(control, { label: 'Sulphur Springs', countyId: 'hopkins-tx', placeGeoid: '4870904' }), true);
  assert.equal(areaPredicate({ ...control, countyId: 'other-tx' }, { label: 'Sulphur Springs', countyId: 'hopkins-tx', placeGeoid: '4870904' }), false, 'PLACE match cannot bypass canonical county agreement');

  const geographyResolver = productionFunction('gridlyResolveAlertCanonicalGeography', 'gridlyAlertAreaFilterRecordSummary', {
    getGridlySelectedAwarenessArea: () => ({ label: 'Sulphur Springs', countyId: 'hopkins-tx', placeGeoid: '4870904' }),
    gridlyNormalizeCountyId: value => String(value || '').trim().toLowerCase(),
    gridlyGetActiveCountyId: () => 'hopkins-tx'
  });
  assert.deepEqual({ ...geographyResolver(control) }, { canonicalCommunity: 'Sulphur Springs', canonicalKey: '4870904', countyId: 'hopkins-tx' });
  assert.equal(geographyResolver({ ...control, countyId: 'other-tx' }).canonicalCommunity, '', 'presentation cannot recover town ownership across counties');

  assert.match(appSource, /intelItems\.length && !canonicalActiveCommunityRecords\?\.length/, 'governed Alerts candidates outrank unrelated localized intelligence');
  assert.match(appSource, /return \{\s*\.\.\.item,\s*id: item\?\.id \|\| item\?\.crossingId/s, 'Alerts presentation preserves governed identity and geography');
  assert.match(appSource, /window\.__gridlyLp2194AlertStages = Object\.freeze/, 'production records every Alerts authority stage');
  assert.match(appSource, /governedKbygAuthorityIds/, 'KBYG cache authority includes governed evidence membership');
  assert.match(appSource, /const portraitKbygSynced = governedKbygAuthorityIds\.length[\s\S]*gridlyRenderTravelBrief\(\)/, 'governed refresh invokes the actual expanded portrait writer');
  assert.match(appSource, /const portraitKbygDomText = String\(portraitKbygNode\?\.textContent/, 'audit reads the actual expanded portrait DOM separately');
  assert.match(appSource, /authorityToDomParity/, 'audit distinguishes authority-to-portrait-DOM parity');
  assert.match(appSource, /lp2194AuthorityAudit/, 'owner audit exposes final consumer authority and first losing stage');
});
