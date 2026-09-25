const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');
const governed = require('../js/governed-awareness.js');
const app = fs.readFileSync('js/app.js', 'utf8');
const section = (a,b) => app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
const h = { window: { GridlyGovernedAwareness: governed }, activeReports: [], activeHazards: [],
  getGridlySelectedAwarenessArea: () => ({label:'Test area',canonicalKey:'test'}),
  gridlyGetActiveCountyId: () => 'test-county', gridlyReadAlertsFamilyAuthority: () => ({}) };
vm.createContext(h);
vm.runInContext(section('function compareReportsByRecency(', 'function getConsolidatedIncidents('),h);
vm.runInContext(section('function gridlyGetGovernedConsumerProjection(', 'function gridlyGetGovernedActiveAwarenessRows('),h);
const row = (id,type,crossingId='crossing-a',minute=0) => ({id,reportKind:'crossing',source:'user',crossingId,type,submittedAt:new Date(Date.now()-minute*60000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
function project(reports,hazards=[]) { h.activeReports=reports;h.activeHazards=hazards;return h.gridlyGetGovernedConsumerProjection(); }
function counts(p,n) {for(const key of ['locationContext','communityPulse','kbygCommunity','alerts','map','popup'])assert.equal(p.surfaces[key].length,n,key);}

test('a governed crossing delay is one active issue, never official roadway evidence',()=>{
  const report=Object.freeze(row('delay','heavy'));
  const p=project([report]);counts(p,1);assert.equal(p.surfaces.kbygOfficialRoadways.length,0);assert.equal(p.surfaces.history.length,0);
  assert.equal(p.surfaces.alerts[0].subtype,'crossing_delay');assert.equal(p.surfaces.alerts[0].record.type,'heavy');
  assert.equal(p.lineage[0].consumerOwnership.popup.owningPublisher,'crossing_specific');
  assert.equal(governed.subtypeOf({type:'heavy',reportKind:'hazard',source:'user'}),'heavy');
});

test('latest canonical crossing condition wins without deleting reports or duplicating raw aliases',()=>{
  const blocked=row('blocked','blocked','crossing-a',5), delay=row('delay','heavy');
  const reports=[blocked,delay,{...delay}];counts(project(reports),1);assert.equal(project(reports).surfaces.locationContext[0].record.id,'delay');assert.equal(reports.length,3);
  counts(project([row('a','heavy'),row('b','heavy','crossing-b')]),2);
});

test('clear and expiry exclude active issues; an independent hazard survives',()=>{
  const blocked=row('blocked','blocked','crossing-a',5),delay=row('delay','heavy','crossing-a',3),clear=row('clear','cleared');
  counts(project([]),0);counts(project([blocked]),1);counts(project([delay]),1);counts(project([blocked,clear]),0);counts(project([delay,clear]),0);
  const hazard={...row('hazard','flooding'),reportKind:'hazard',crossingId:undefined};
  counts(project([blocked],[hazard]),2);counts(project([delay],[hazard]),2);counts(project([delay,clear],[hazard]),1);
  counts(project([{...delay,expired:true}]),0);
});

test('blocked → clear → delay uses the existing canonical ordering and remains uncertain',()=>{
  const reports=[row('blocked','blocked','crossing-a',5),row('clear','cleared','crossing-a',3),row('new-delay','heavy')];
  const p=project(reports);counts(p,1);assert.equal(p.surfaces.locationContext[0].record.id,'new-delay');assert.equal(p.surfaces.locationContext[0].record.confidence,undefined);
});
