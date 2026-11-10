import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = readFileSync(new URL('../../js/app.js', import.meta.url), 'utf8');
const protocol = readFileSync(new URL('../../js/gridly-report-protocol.js', import.meta.url), 'utf8');
function section(start, end) {
  const first = app.indexOf(start);
  const last = app.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, start);
  return app.slice(first,last);
}

const liberty = Object.freeze({id:'FRA-123456A',countyId:'liberty-tx',lat:30,lng:-94,name:'Main Street'});
const hardin = Object.freeze({id:'FRA-654321B',countyId:'hardin-tx',lat:31,lng:-95,name:'First Street'});
const observationId = '00000000-0000-4000-8000-000000000091';
const syntheticProof = 'SYNTHETIC_CROSSING_REPORT_AUTHORITY';
const enabled = () => ({data:{protocol_version:2,reporting_enabled:true,changed_at:new Date().toISOString()}});
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(crossing = liberty) {
  const storage = new Map(), reads = [], writes = [], reviews = [];
  let queueWrites = 0;
  const state = { consent:async()=>true, availability:async()=>enabled(), review:false, proof:syntheticProof, retry:false };
  const client = {
    rpc: async name => {
      reads.push(name);
      assert.equal(name,'get_community_reporting_status');
      return state.availability();
    },
    functions: { invoke: async (name,{body}) => {
      assert.equal(name,'gridly-paid-report');
      assert.equal(body.proof,syntheticProof);
      writes.push(body);
      if (state.retry) return {error:{code:'FETCH_ERROR'}};
      return {data:{status:'accepted',report:{id:observationId,...body.args.report}}};
    } }
  };
  const context = vm.createContext({
    module:{exports:{}}, crypto:webcrypto, setTimeout, clearTimeout, supabaseClient:client, deviceId:'SYNTHETIC_DEVICE',
    activeSheet:'report', document:{querySelector:()=>({})}, county:crossing.countyId,
    gridlyGetActiveCountyId:()=>context.county, gridlyCrossingInventoryCountyId:crossing.countyId,
    gridlyActiveCountyTransitionGeneration:1, gridlyCrossingInventoryRevision:1, rows:[crossing],
    gridlyGetActiveCountyCrossingInventory:()=>context.rows,
    isGridlyPublicRoadwayCrossing:row=>!row.private, isGridlyReportableCrossing:row=>!row.bridge,
    gridlyResolveCountyIdForCoordinate:()=>({countyId:context.coordinateCounty}), coordinateCounty:crossing.countyId,
    getGridlySpecificCrossingLocation:row=>({label:row.name}),
    window:{
      setTimeout, clearTimeout,
      gridlyUgcCompliance:{ensureAccepted:()=>state.consent()},
      gridlyPaidReporting:{
        isReviewActive:()=>state.review, getProof:async()=>state.proof,
        validateReviewOperation:(name,args,authority)=>{
          assert.equal(authority,client);
          reviews.push({name,args});
          return {status:'review_validated'};
        }
      }
    }
  });
  const run = code => vm.runInContext(code,context);
  run(protocol);
  const reportClient = context.module.exports.create({
    crypto:webcrypto,
    storage:{
      getItem:key=>storage.get(key)??null,
      setItem:(key,value)=>{queueWrites++;storage.set(key,value);},
      removeItem:key=>storage.delete(key)
    }
  });
  context.gridlyGetCommunityProtocolClient = () => reportClient;
  context.crossing = crossing;
  run(section('function gridlyAuthorizedReportTransport(', '/* LP244.29A REPORTING AVAILABILITY RUNTIME END */'));
  run('const gridlyReportingAvailabilityRuntime = gridlyCreateReportingAvailabilityRuntime();');
  run(section('async function gridlySubmitCommunityOperation(', 'window.gridlyUgcComplianceBridge'));
  run(section('  // Independent reporting uses','  function buildReportHazardSurfaceHtml()'));
  run('crossingReportFlow={countyId:county,generation:1,revision:1,selected:{id:crossing.id,lat:crossing.lat,lng:crossing.lng,label:crossing.name}};');
  const flow = run('crossingReportFlow');
  const validate = () => {
    context.expectedFlow = flow;
    return Boolean(run('crossingReportSelected(expectedFlow)'));
  };
  const payload = {crossing_id:crossing.id,crossing_name:crossing.name,lat:crossing.lat,lng:crossing.lng,report_type:'blocked'};
  return {
    state, reads, writes, reviews, context, run, validate, reportClient, payload, client,
    queueWrites:()=>queueWrites,
    submit:(...args)=>context.gridlySubmitCommunityOperation('create',payload,client,'SYNTHETIC_DEVICE',...args)
  };
}
function rejectedBeforeBegin(f, result) {
  assert.equal(result.status,'invalid_request');
  assert.equal(result.blockedBeforeBegin,true);
  assert.equal(f.reportClient.pending(),null);
  assert.equal(f.queueWrites(),0);
  assert.equal(f.writes.length,0);
  assert.equal(f.reviews.length,0);
}

test('valid selection passes both checks and submits the exact governed crossing', async () => {
  const f=fixture();
  let checks=0;
  const result=await f.submit(()=>{checks++;return f.validate();});
  assert.equal(result.status,'accepted');
  assert.equal(result.report.id,observationId);
  assert.equal(checks,2);
  assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].operation,'submit_community_observation');
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes[0].args.report)),f.payload);
  assert.equal(f.reportClient.pending(),null);
});

test('cancel during consent stops before reviewer validation, status read, queue or write', async () => {
  const f=fixture(), consent=deferred();
  f.state.review=true;
  f.state.consent=()=>consent.promise;
  const operation=f.submit(f.validate);
  f.run('crossingReportFlow=null');
  consent.resolve(true);
  rejectedBeforeBegin(f,await operation);
  assert.deepEqual(f.reads,[]);
});

for (const [label, change] of [
  ['county change', c=>{c.county='hardin-tx'; c.gridlyActiveCountyTransitionGeneration++;}],
  ['inventory revision', c=>{c.gridlyCrossingInventoryRevision++;}],
  ['closed reporting sheet', c=>{c.activeSheet=null;}],
  ['selection cancellation', (_c,f)=>f.run('crossingReportFlow=null')]
]) {
  test(label+' during availability stops before queue creation or write',async()=>{
    const f=fixture(), entered=deferred(), availability=deferred();
    f.state.availability=()=>{entered.resolve();return availability.promise;};
    const operation=f.submit(f.validate);
    await entered.promise;
    change(f.context,f);
    availability.resolve(enabled());
    rejectedBeforeBegin(f,await operation);
    assert.deepEqual(f.reads,['get_community_reporting_status']);
  });
}

test('stale identity, coordinates, label and coordinate county fail closed without substitution',async()=>{
  for (const change of [
    c=>{c.rows=[{...liberty,id:'FRA-111111Z'}];},
    c=>{c.rows=[{...liberty,lat:31}];},
    c=>{c.rows=[{...liberty,name:'Different Road'}];},
    c=>{c.coordinateCounty='hardin-tx';},
    c=>{c.rows=[liberty,liberty];},
    c=>{c.rows=[liberty,{...liberty,id:'FRA-111111Z'}];}
  ]) {
    const f=fixture();
    change(f.context);
    rejectedBeforeBegin(f,await f.submit(f.validate));
    assert.deepEqual(f.reads,[]);
  }
});

test('cross-county inventory cannot substitute an out-of-county match', async()=>{
  const f=fixture(hardin);
  f.context.rows=[liberty,hardin];
  const result=await f.submit(f.validate);
  assert.equal(result.status,'accepted');
  assert.equal(f.writes[0].args.report.crossing_id,hardin.id);
  assert.equal(f.writes[0].args.report.lat,hardin.lat);
  assert.equal(f.writes[0].args.report.lng,hardin.lng);
});

test('malformed, asynchronous or throwing explicit validators stop before queue creation',async()=>{
  for (const callback of [null,()=>false,()=>Promise.resolve(true),()=>{throw Error('synthetic');}]) {
    const f=fixture();
    rejectedBeforeBegin(f,await f.submit(callback));
  }
});

test('legacy consent and maintenance decisions do not create a queue or invoke the paid writer',async()=>{
  const consent=fixture();
  consent.state.consent=async()=>false;
  assert.equal((await consent.submit()).status,'terms_required');
  assert.deepEqual(consent.reads,[]);
  const maintenance=fixture();
  maintenance.state.availability=async()=>({data:{...enabled().data,reporting_enabled:false}});
  assert.equal((await maintenance.submit()).status,'maintenance');
  for (const f of [consent,maintenance]) {
    assert.equal(f.reportClient.pending(),null);
    assert.equal(f.queueWrites(),0);
    assert.equal(f.writes.length,0);
  }
});

test('a successful validator cannot grant paid reporting access',async()=>{
  const f=fixture();
  f.state.proof=null;
  assert.equal((await f.submit(f.validate)).status,'authorization_required');
  assert.equal(f.writes.length,0);
});

test('legacy and guarded reviewer calls retain the review transport and never enter the queue',async()=>{
  for (const guarded of [false,true]) {
    const f=fixture();
    f.state.review=true;
    const result=guarded ? await f.submit(f.validate) : await f.submit();
    assert.equal(result.status,'review_validated');
    assert.equal(f.reviews.length,1);
    assert.equal(f.reviews[0].name,'submit_community_observation');
    assert.equal(f.reviews[0].args.report.crossing_id,liberty.id);
    assert.equal(f.writes.length,0);
    assert.equal(f.queueWrites(),0);
  }
});

test('legacy retry retains the submission token and confirm and clear retain the original observation',async()=>{
  const f=fixture();
  f.state.retry=true;
  assert.equal((await f.submit()).status,'retryable_failure');
  const token=f.writes[0].args.submission_token;
  f.state.retry=false;
  f.context.client=f.client;
  const authorized=f.run('gridlyAuthorizedReportTransport(client)');
  assert.equal((await f.reportClient.retry(authorized,'SYNTHETIC_DEVICE')).status,'accepted');
  assert.equal(f.writes[1].args.submission_token,token);
  for (const action of ['confirm','clear']) {
    const result=await f.context.gridlySubmitCommunityOperation(action,{observation_id:observationId,changes:{}},f.client,'SYNTHETIC_DEVICE');
    assert.equal(result.status,'accepted');
    const request=f.writes.at(-1);
    assert.equal(request.operation,'mutate_community_observation');
    assert.equal(request.args.action,action);
    assert.equal(request.args.observation_id,observationId);
  }
  assert.equal(f.reportClient.pending(),null);
});
