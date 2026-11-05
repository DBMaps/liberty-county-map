import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {createLabelDiagnostic,pngTileValid} from '../../tools/arcgis-maintenance/diagnostic.mjs';
import {createFileBudgetLedger} from '../../tools/arcgis-maintenance/budget-ledger.mjs';
import {fixture,png} from './fixtures.mjs';
const token='SYNTHETIC_REPLACEMENT_LABELS';
const request=(key=token)=>({method:'GET',url:'https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/1/0/0?token='+key,
  headers:new Map([['referer','https://localhost/private?token='+key],['origin','https://localhost']])});
function host() {
  let hooks=null,network=0;
  return {capability:'gridly.native-label-interceptor.v1',beforeFirstNetwork:true,wholeContext:true,retriesDisabled:true,redirectsDisabled:true,reconnectPreservesLedger:true,
    async install(value){hooks=value;},count:()=>network,
    async dispatch(req=request(),response={status:200,contentType:'image/png',bytes:png(),rendered:true}){
      const verdict=await hooks.beforeDispatch(req);if(verdict.action!=='CONTINUE_UNMODIFIED')return verdict;
      assert.equal(verdict.maxRetries,0);assert.equal(verdict.maxRedirects,0);network++;
      await hooks.afterResponse({...response,ordinal:verdict.ordinal});return verdict;
    },hooks:()=>hooks};
}
async function setup(platform='android',suffix='one') {
  const f=await fixture(),ledger=await createFileBudgetLedger({directory:f.root,verifyPrivateDirectory:async()=>true});
  const runId='synthetic-'+suffix,scope=platform+':'+runId;await ledger.initialize(scope);
  const interceptor=host(),options={mode:'OWNER_ISOLATED_NATIVE_LABEL_DIAGNOSTIC',platform,runId,candidateToken:token,interceptor,ledger,observeContext:async()=>({origin:platform==='ios'?'capacitor://localhost':'https://localhost'})};
  const gate=createLabelDiagnostic(options);await gate.install();return {...f,ledger,interceptor,gate,options,scope};
}
test('default mode and insufficient whole-native-context interception are rejected',()=>{
  assert.throws(()=>createLabelDiagnostic(),/EXPLICIT_ACTIVATION_REQUIRED/);
  const options={mode:'OWNER_ISOLATED_NATIVE_LABEL_DIAGNOSTIC',platform:'android',runId:'synthetic-a',candidateToken:token,observeContext:async()=>({origin:'https://localhost'})};
  assert.throws(()=>createLabelDiagnostic(options),/INTERCEPTION_UNAVAILABLE/);
  assert.throws(()=>createLabelDiagnostic({...options,interceptor:{...host(),wholeContext:false}}),/INTERCEPTION_UNAVAILABLE/);
  assert.throws(()=>createLabelDiagnostic({...options,interceptor:host(),ledger:{}}),/DURABLE_BUDGET_REQUIRED/);
});
for(const platform of ['android','ios'])test(platform+': no pre-arm traffic, exactly two reservations, third rejected, safe origin evidence',async()=>{
  const f=await setup(platform,platform);try{
    assert.equal((await f.interceptor.dispatch()).action,'ABORT');assert.equal(f.interceptor.count(),0);
    await f.gate.arm();await f.interceptor.dispatch();await f.interceptor.dispatch();
    assert.equal((await f.interceptor.dispatch()).action,'ABORT');assert.equal(f.interceptor.count(),2);
    assert.equal(f.gate.state().stopped,true);await assert.rejects(()=>f.gate.arm(),/ARM_REJECTED/);
    const rows=f.gate.evidence();assert.equal(rows.length,2);assert.equal(rows[0].origin,platform==='ios'?'capacitor://localhost':'https://localhost');assert.equal(rows[0].referer,'https://localhost');
    const text=JSON.stringify({state:f.gate.state(),evidence:rows});assert.equal(text.includes(token),false);assert.equal(text.includes('token='),false);assert.equal(text.includes('/private'),false);
    assert.equal(rows[0].tileValidity,'PNG_STRUCTURE_AND_CRC_PASS');assert.equal(f.gate.state().nativeAdapterCertified,false);
  }finally{await f.dispose();}
});
test('parallel attempts cannot race the cap or cause hidden retries',async()=>{
  const f=await setup();try{await f.gate.arm();await Promise.all(Array.from({length:20},()=>f.interceptor.dispatch()));
    assert.equal(f.interceptor.count(),1);await f.interceptor.dispatch();assert.equal(f.interceptor.count(),2);await f.interceptor.dispatch();assert.equal(f.interceptor.count(),2);
  }finally{await f.dispose();}
});
test('HTTP authorization failures and redirects stop immediately without consuming remaining request allowance',async()=>{
  for(const status of [401,403,429,302,500]){
    const f=await setup('android','error-'+status);try{await f.gate.arm();await f.interceptor.dispatch(request(),{status,contentType:'text/html; token='+token,bytes:Buffer.from(token)});await f.interceptor.dispatch();
      assert.equal(f.interceptor.count(),1);assert.equal(f.gate.state().stopped,true);assert.equal(JSON.stringify(f.gate.evidence()).includes(token),false);
    }finally{await f.dispose();}
  }
});
test('wrong credential and unsupported origin are blocked before network and stop the session',async()=>{
  const f=await setup();try{await f.gate.arm();await f.interceptor.dispatch(request('SYNTHETIC_ORIGINAL_LABELS'));await f.interceptor.dispatch();assert.equal(f.interceptor.count(),0);assert.equal(f.gate.state().stopped,true);}finally{await f.dispose();}
  const g=await setup('android','origin');try{const intercept=host(),gate=createLabelDiagnostic({...g.options,interceptor:intercept,observeContext:async()=>({origin:'https://unapproved.invalid/'})});await gate.install();await gate.arm();await intercept.dispatch();assert.equal(intercept.count(),0);assert.equal(gate.state().stopped,true);}finally{await g.dispose();}
});
test('other providers, duplicate token parameters and header changes are never forwarded',async()=>{
  const f=await setup();try{await f.gate.arm();for(const req of [{...request(),url:'https://example.invalid/drivetexas'}, {...request(),method:'POST'}, {...request(),url:request().url+'&token='+token}, {...request(),url:request().url+'#fragment'}])assert.equal((await f.interceptor.dispatch(req)).action,'ABORT');assert.equal(f.interceptor.count(),0);
    const req=request(),before=req.headers;await f.interceptor.dispatch(req);assert.equal(req.headers,before);assert.equal(req.headers.get('referer'),'https://localhost/private?token='+token);
  }finally{await f.dispose();}
});
test('durable reservations survive controller and ledger restart without resetting the allowance',async()=>{
  const f=await setup();try{await f.gate.arm();await f.interceptor.dispatch();
    const ledger=await createFileBudgetLedger({directory:f.root,verifyPrivateDirectory:async()=>true});
    const interceptor=host(),next=createLabelDiagnostic({...f.options,ledger,interceptor});await next.install();await next.arm();await interceptor.dispatch();
    assert.equal(f.interceptor.count()+interceptor.count(),2);
    const last=createLabelDiagnostic({...f.options,ledger,interceptor:host()});await last.install();await assert.rejects(()=>last.arm(),/ARM_REJECTED/);
    await assert.rejects(()=>ledger.initialize(f.scope),/BUDGET_UNAVAILABLE/);
  }finally{await f.dispose();}
});
test('corrupt or stale-locked budgets and crash after reservation fail closed',async()=>{
  const f=await setup();try{
    const filename=join(f.root,createHash('sha256').update(f.scope).digest('hex')+'.json');
    await writeFile(filename+'.lock','synthetic crash');await assert.rejects(()=>f.gate.arm(),/BUDGET_UNAVAILABLE/);assert.equal(f.interceptor.count(),0);
  }finally{await f.dispose();}
  const g=await setup('android','corrupt');try{
    const filename=join(g.root,createHash('sha256').update(g.scope).digest('hex')+'.json');await writeFile(filename,'corrupt synthetic ledger');await assert.rejects(()=>g.gate.arm(),/BUDGET_UNAVAILABLE/);
  }finally{await g.dispose();}
  const h=await setup('android','reservation-crash');try{await h.ledger.reserve(h.scope,2);const fresh=await createFileBudgetLedger({directory:h.root,verifyPrivateDirectory:async()=>true});assert.equal((await fresh.reserve(h.scope,2)).ordinal,2);assert.equal((await fresh.reserve(h.scope,2)).allowed,false);}finally{await h.dispose();}
});
test('PNG validation rejects corrupt CRC truncated dimensions and content without claiming native decoding',()=>{
  const good=png();assert.equal(pngTileValid(good),true);
  const bad=Buffer.from(good);bad[20]^=1;
  for(const bytes of [bad,Buffer.from('not png'),good.subarray(0,good.length-1),Buffer.concat([good,Buffer.from('trailing')])])assert.equal(pngTileValid(bytes),false);
});
