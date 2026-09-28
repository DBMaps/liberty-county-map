import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash, webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {PRODUCTION_ENTITLEMENT_SPKI_B64, PRODUCTION_ENTITLEMENT_SPKI_SHA256, importProductionEntitlementKey} from '../js/gridly-entitlement-public-key.mjs';
import {productionPaidComposition} from '../js/gridly-paid-config.mjs';
import {verifyAuthorityProof, accessDecision} from '../js/gridly-entitlement.mjs';
import {normalizeApple, signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';
import {createAppleVerificationAuthority} from '../js/gridly-apple-storekit.mjs';
import {createGoogleVerificationAuthority} from '../js/gridly-google-play-billing.mjs';

const fingerprint='963a8a6b5c79f20d0f3948f4cad187794d42276d4c71f40dd577830f865e0d7c';

test('bundled public SPKI is the exact production P-256 verification pin',async()=>{
  const bytes=Buffer.from(PRODUCTION_ENTITLEMENT_SPKI_B64,'base64');
  assert.equal(bytes.toString('base64'),PRODUCTION_ENTITLEMENT_SPKI_B64);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),fingerprint);
  assert.equal(PRODUCTION_ENTITLEMENT_SPKI_SHA256,fingerprint);
  const key=await importProductionEntitlementKey(webcrypto);
  assert.equal(key.type,'public');assert.equal(key.algorithm.name,'ECDSA');
  assert.equal(key.algorithm.namedCurve,'P-256');assert.deepEqual(key.usages,['verify']);
  assert.equal(key.extractable,false);
  const source=readFileSync(new URL('../js/gridly-entitlement-public-key.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/PRIVATE KEY|pkcs8|service_role|localStorage|URLSearchParams|fetch\(/i);
});

test('production config pins only native platforms and stays closed without admitted transport',async()=>{
  for(const cap of [undefined,{isNativePlatform:()=>false,getPlatform:()=> 'ios'},
    {isNativePlatform:()=>true,getPlatform:()=> 'web'}]){
    const config=await productionPaidComposition(cap);
    assert.equal(config.publicKey,null);assert.equal(config.authority,null);assert.equal(config.plugin,null);
  }
  for(const platform of ['ios','android']){
    const cap={isNativePlatform:()=>true,getPlatform:()=>platform,Plugins:{GridlyStoreKit:{},GridlyPlayBilling:{},GridlyContinuity:{}}};
    const config=await productionPaidComposition(cap);
    assert.equal(config.publicKey.type,'public');assert.equal(config.authority,null);
    assert.equal(config.plugin,null);
    assert.equal(config.continuityVault,cap.Plugins.GridlyContinuity);
  }
});

test('malformed SPKI or failed digest/import cannot provide paid authority',async()=>{
  const bad={subtle:{digest:async()=>new Uint8Array(32),importKey:async()=>{throw Error('must not import');}}};
  assert.equal(await importProductionEntitlementKey(bad),null);
  const invalid={subtle:{digest:async(...args)=>webcrypto.subtle.digest(...args),importKey:async()=>{throw Error('invalid SPKI');}}};
  assert.equal(await importProductionEntitlementKey(invalid),null);
  const proof='malformed';
  for(const key of [null,await importProductionEntitlementKey(webcrypto)]){
    const result=await verifyAuthorityProof({proof,publicKey:key,nonce:'a'.repeat(48),platform:'apple',crypto:webcrypto});
    assert.equal(accessDecision(result,{platform:'apple'}).allowed,false);
  }
});

test('local signing key interoperates through production-format SPKI import and proof verification',async()=>{
  const pair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const spki=await webcrypto.subtle.exportKey('spki',pair.publicKey);
  const pin=await webcrypto.subtle.importKey('spki',spki,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  const now=Date.parse('2026-09-27T18:00:00.000Z'),end=now+86400000,nonce='n'.repeat(48);
  const record=normalizeApple({bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:'Production',originalTransactionId:'local-chain',expiresDate:end},
    {originalTransactionId:'local-chain',productId:'com.gridlygo.gridly.monthly',environment:'Production',autoRenewStatus:1},1,
    {env:'production',originalReference:'local-chain',now});
  const proof=await signResponse(record,nonce,pair.privateKey,webcrypto);
  const check=async(options={})=>verifyAuthorityProof({proof,publicKey:pin,nonce,platform:'apple',now,crypto:webcrypto,...options});
  assert.equal(accessDecision(await check(),{platform:'apple',now}).allowed,true);
  const wrong=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
  for(const options of [{publicKey:wrong.publicKey},{platform:'google'},{environment:'sandbox/test'},{now:now+300000}])
    assert.equal(accessDecision(await check(options),{platform:'apple',now}).allowed,false);
  const parts=proof.split('.');parts[1]=Buffer.from(JSON.stringify({tampered:true})).toString('base64url');
  const tampered=await verifyAuthorityProof({proof:parts.join('.'),publicKey:pin,nonce,platform:'apple',now,crypto:webcrypto});
  assert.equal(accessDecision(tampered,{platform:'apple',now}).allowed,false);
});

test('fixed native Edge routes distinguish explicit denial from outage without returning evidence',async()=>{
  for(const [platform,create,name,evidence] of [
    ['apple',createAppleVerificationAuthority,'gridly-verify-apple-subscription',{signedTransactions:['test.payload.signature']}],
    ['google',createGoogleVerificationAuthority,'gridly-verify-google-subscription',{purchaseTokens:['test-token']}]
  ]){
    const request={platform,environment:'production',nonce:'n'.repeat(48),evidence};
    for(const status of [401,403]){
      const authority=create({invoke:async(route,{body})=>{assert.equal(route,name);assert.equal(body.platform,platform);return {error:{context:{status}}};}});
      await assert.rejects(()=>authority.reconcile(request),/authority_denied/);
    }
    for(const result of [{error:{context:{status:500}}},{error:Error('private test evidence')},{data:{error:'unavailable'}}]){
      const authority=create({invoke:async()=>result});
      await assert.rejects(()=>authority.reconcile(request),/verification_unavailable/);
    }
  }
});
