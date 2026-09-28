import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
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
