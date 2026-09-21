import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pilot,disposition,consumerVisible} from '../tools/responder/phase28/policy-model.mjs';
test('planning artifact cannot enable a real pilot or create sector authority',()=>{
 assert.equal(pilot.status,'PLANNING');assert.equal(pilot.environment,'NON_PRODUCTION');
 assert.deepEqual(pilot.automaticPoliceCapabilities,[]);assert.equal(pilot.departments.length,2);
 assert.ok(pilot.departments.every(x=>x.state==='PLANNED'&&!x.consumerPublishingEnabled));
 assert.equal(pilot.structureDecision,'OWNER_REVIEW_REQUIRED_PER_DEPARTMENT');
 assert.equal(pilot.consumerInvalidation.integrationEnabled,false);
 assert.deepEqual(pilot.roles,['OWNER','ORGANIZATION_ADMIN','SUPERVISOR','OPERATOR','VIEWER']);
 assert.equal(pilot.aal,'aal2');assert.equal(pilot.factorType,'totp');
});
test('approved public capability policy has no hazard or road closure alias',()=>{
 assert.deepEqual(pilot.permittedPilotCapabilities,['awareness.condition.publish','awareness.planned_work.publish','awareness.official_notice.publish']);
 assert.deepEqual(pilot.disabledPilotCapabilities,['awareness.hazard.publish','awareness.road_closure.publish']);
 assert.equal(pilot.capabilityMaxDays,90);assert.equal(pilot.automaticRenewal,false);assert.equal(pilot.gracePeriodSeconds,0);
});
test('law enforcement exclusions and fixed neutral record vocabulary',()=>{
 assert.deepEqual(pilot.recordTypes,['CONDITION','HAZARD','PLANNED_WORK','OPERATIONAL_NOTICE']);
 for(const k of ['systemOfRecord','cad','rms','evidenceManagement','emergency911','cjisApproved'])assert.equal(pilot.lawEnforcement[k],false);
 assert.equal(pilot.prohibitedData.length,16);assert.equal(pilot.lawEnforcement.operationalAwarenessOnly,true);
});
for(const [category,years] of Object.entries(pilot.retention.years))test(`retention baseline ${category}: ${years} years, active and hold override`,()=>{
 const terminalAt='2026-09-18T12:00:00.000Z';const expiry=`${2026+years}-09-18T12:00:00.000Z`;
 const args={category,terminalAt,now:expiry};assert.equal(disposition(args).expiresAt,expiry);
 assert.equal(disposition(args).eligible,true);assert.equal(disposition({...args,now:new Date(+new Date(expiry)-1)}).eligible,false);
 assert.equal(disposition({...args,active:true}).eligible,false);assert.equal(disposition({...args,legalHold:true}).eligible,false);
 assert.equal(disposition(args).legalApprovalRequired,true);assert.equal(pilot.retention.legalPrivacyApproved,false);
});
test('calendar retention clamps leap-day anniversary',()=>assert.equal(disposition({category:'invitations',terminalAt:'2024-02-29T12:00:00Z',now:'2025-02-28T12:00:00Z'}).expiresAt,'2025-02-28T12:00:00.000Z'));
test('retention fails closed on unknown class and invalid time',()=>{
 assert.throws(()=>disposition({category:'unknown'}));assert.throws(()=>disposition({category:'audit',terminalAt:'bad',now:'bad'}));
 assert.equal(disposition({category:'audit',now:'2026-09-18'}).eligible,false);
});
test('online and offline visibility cannot outlive five-minute lease',()=>{
 const start='2026-09-18T12:00:00Z';
 for(const online of [true,false]){
  const p={receivedAt:start,lastValidatedAt:start,expiresAt:'2026-09-18T13:00:00Z',online};
  assert.equal(consumerVisible({...p,now:'2026-09-18T12:04:59Z'}),true);
  assert.equal(consumerVisible({...p,now:'2026-09-18T12:05:00Z'}),false);
  assert.equal(consumerVisible({...p,now:'2026-09-18T11:59:59Z'}),false);
  assert.equal(consumerVisible({...p,now:'bad'}),false);
  assert.equal(consumerVisible({...p,expiresAt:'2026-09-18T12:01:00Z',now:'2026-09-18T12:01:00Z'}),false);
 }
});
test('frozen Phase 27 MFA and recovery contracts are carried forward without bypass',()=>{
 assert.equal(pilot.ownershipTransferFreshTotpSeconds,600);assert.equal(pilot.recovery.freshTotpSeconds,300);
 assert.equal(pilot.recovery.distinctApprovers,2);assert.equal(pilot.recovery.trainedNamedAdministrators,3);
 assert.equal(pilot.recovery.bypassAllowed,false);assert.equal(pilot.invitation.expiryDays,7);
});
test('additive package explicitly guards historical weak paths',()=>{
 const s=readFileSync(new URL('../tools/responder/phase28/extension.sql',import.meta.url),'utf8');
 assert.match(s,/REVOKE ALL ON ALL TABLES/);assert.doesNotMatch(s,/GRANT .* ON ALL TABLES/);
 assert.match(s,/PHASE28_RECOVERY_DISABLED/);assert.match(s,/source forbidden/);assert.match(s,/independent sanitation review required/);
 assert.match(s,/PRIVATE_TO_UNIT/);assert.match(s,/SHARED_WITH_SELECTED_UNITS/);
});
