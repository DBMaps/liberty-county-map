import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {handleChallengeGateway} from '../tools/subscription-challenge-gateway/worker.mjs';
import {challengeGatewayLimiter} from '../supabase/functions/_shared/entitlement/challenge-gateway.mjs';

const secret='a'.repeat(64),url='https://fixture.supabase.co/functions/v1/gridly-subscription-challenge';
const make=(forward='198.51.100.2',ip='203.0.113.5')=>new Request('https://gateway.invalid/subscription-challenge',{
  method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':ip,'X-Forwarded-For':forward},
  body:'{"platform":"apple"}'});
test('Cloudflare connection source is rate key; forwarding-header changes cannot bypass',async()=>{
  const keys=[],out=[];const env={CHALLENGE_EDGE_URL:url,CHALLENGE_GATEWAY_TOKEN:secret,
    CHALLENGE_RATE:{limit:async({key})=>{keys.push(key);return {success:keys.length<=2};}}};
  const fetchImpl=async(target,options)=>{out.push({target,options});return Response.json({challenge:'a'.repeat(43),
    expiresAt:'2026-09-28T00:02:00Z',protocolVersion:'gridly-subscription-verification-v1'});};
  assert.equal((await handleChallengeGateway(make('a'),env,{fetchImpl})).status,200);
  assert.equal((await handleChallengeGateway(make('b'),env,{fetchImpl})).status,200);
  assert.equal((await handleChallengeGateway(make('c'),env,{fetchImpl})).status,429);
  assert.deepEqual(keys,['203.0.113.5','203.0.113.5','203.0.113.5']);
  assert.equal(out.length,2);
  assert.equal(out[0].target,url);assert.equal(out[0].options.headers['X-Gridly-Challenge-Gateway-Token'],secret);
  assert.equal(out[0].options.body,'{"platform":"apple"}');
  assert.equal((await handleChallengeGateway(make('a',''),env,{fetchImpl})).status,503);
});
test('direct challenge issue requires a valid gateway token and no caller source ID',async()=>{
  const limiter=challengeGatewayLimiter(secret,webcrypto);
  for(const value of [null,'b'.repeat(64),'malformed']){
    const headers=value?{'X-Gridly-Challenge-Gateway-Token':value}:{};
    assert.equal(await limiter.allow({request:new Request(url,{headers})}),false);
  }
  assert.equal(await limiter.allow({request:new Request(url,{headers:{'X-Gridly-Challenge-Gateway-Token':secret}})}),true);
});

test('gateway configuration keeps one narrow route and the expected local rate binding',async()=>{
  const config=JSON.parse(await readFile(new URL('../tools/subscription-challenge-gateway/wrangler.jsonc',import.meta.url),'utf8'));
  assert.equal(config.name,'gridly-subscription-challenge-gateway');
  assert.equal(config.main,'worker.mjs');
  assert.equal(config.compatibility_date,'2026-09-27');
  assert.equal(config.workers_dev,false);
  assert.deepEqual(config.routes,[{pattern:'gridlygo.com/subscription-challenge',zone_name:'gridlygo.com'}]);
  assert.deepEqual(config.ratelimits,[{name:'CHALLENGE_RATE',namespace_id:'24466',simple:{limit:10,period:60}}]);
  assert.equal(config.vars,undefined,'gateway credentials must not be plaintext Wrangler vars');
});

test('gateway rejects missing configuration, invalid requests, and malformed bodies without forwarding',async()=>{
  let forwarded=0;
  const fetchImpl=async()=>{forwarded++;throw Error('unexpected upstream call');};
  const env={CHALLENGE_GATEWAY_TOKEN:secret,CHALLENGE_EDGE_URL:url,
    CHALLENGE_RATE:{limit:async()=>({success:true})}};
  const validHeaders={'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.5'};
  const make=(body='{"platform":"apple"}',headers=validHeaders,path='/subscription-challenge',method='POST')=>
    new Request(`https://gridlygo.com${path}`,{method,headers,...(method==='POST'?{body}:{})});
  const cases=[
    [make(undefined,validHeaders,'/subscription-challenge','GET'),env,405],
    [make(undefined,validHeaders,'/subscription-challenge?x=1'),env,405],
    [make(undefined,validHeaders,'/other'),env,405],
    [make(undefined,{'Content-Type':'application/json'}),env,503],
    [make(undefined,{...validHeaders,'CF-Connecting-IP':'not-an-ip'}),env,503],
    [make(),{...env,CHALLENGE_RATE:undefined},503],
    [make(),{...env,CHALLENGE_RATE:{limit:async()=>({success:false})}},429],
    [make(undefined,{'CF-Connecting-IP':'203.0.113.5'}),env,400],
    [make('not-json'),env,503],
    [make('{"platform":"apple","extra":true}'),env,400],
    [make('{"platform":"web"}'),env,400],
    [make(JSON.stringify({platform:'apple',extra:'x'.repeat(130)})),env,503],
    [make(),{...env,CHALLENGE_GATEWAY_TOKEN:undefined},503],
    [make(),{...env,CHALLENGE_GATEWAY_TOKEN:'malformed'},503],
    [make(),{...env,CHALLENGE_EDGE_URL:'http://fixture.supabase.co/functions/v1/gridly-subscription-challenge'},503],
  ];
  for(const [request,bindings,status] of cases){
    const response=await handleChallengeGateway(request,bindings,{fetchImpl});
    assert.equal(response.status,status);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{error:'verification_unavailable'});
    assert.equal(forwarded,0,'invalid request reached Supabase');
  }
});

test('gateway does not expose upstream failures or unexpected provider-shaped output',async()=>{
  const env={CHALLENGE_GATEWAY_TOKEN:secret,CHALLENGE_EDGE_URL:url,
    CHALLENGE_RATE:{limit:async()=>({success:true})}};
  const make=()=>new Request('https://gridlygo.com/subscription-challenge',{method:'POST',
    headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.5'},body:'{"platform":"apple"}'});
  for(const upstream of [
    new Response('synthetic-private-upstream-body',{status:500}),
    Response.json({secret:'synthetic-private-upstream-body'}),
  ]){
    const response=await handleChallengeGateway(make(),env,{fetchImpl:async()=>upstream});
    assert.equal(response.status,503);
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{error:'verification_unavailable'});
  }
});
