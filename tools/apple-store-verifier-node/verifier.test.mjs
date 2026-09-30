import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, generateKeyPairSync } from 'node:crypto';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { makeHandler, verifyStore } from './verifier.mjs';
import { encodePrivateKeyBytes } from './prepare-private-key-console.mjs';

const {privateKey:fixturePrivateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const values = {
  GRIDLY_APPLE_NODE_INTERNAL_TOKEN:'A'.repeat(43),
  GRIDLY_APPLE_NODE_RESPONSE_HMAC_KEY:Buffer.alloc(32,7).toString('base64'),
  GRIDLY_APPLE_ISSUER_ID:'11111111-1111-1111-1111-111111111111',
  GRIDLY_APPLE_KEY_ID:'SYNTHETIC1',
  GRIDLY_APPLE_PRIVATE_KEY_P8:fixturePrivateKey.export({type:'pkcs8',format:'pem'}).toString(),
  GRIDLY_APPLE_APP_ID:'123456789'
};
const signed='aaa.bbb.ccc';
const event=(body={environment:'sandbox/test',signedTransaction:signed},token=values.GRIDLY_APPLE_NODE_INTERNAL_TOKEN)=>({
  requestContext:{http:{method:'POST'}},rawPath:'/',rawQueryString:'',isBase64Encoded:false,
  headers:{'content-type':'application/json','x-gridly-apple-node-token':token},body:JSON.stringify(body)
});
const base={bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:'Sandbox',originalTransactionId:'public-test-id',expiresDate:Date.now()+3600000};
const renewal={originalTransactionId:'public-test-id',productId:base.productId,environment:'Sandbox',autoRenewStatus:1};

test('Lambda rejects non-POST, missing token, malformed body and wrong environment before provider call',async()=>{
  let called=0;const handler=makeHandler({readSecret:name=>values[name],verify:async()=>{called++;throw Error('must_not_run');}});
  assert.equal((await handler({...event(),requestContext:{http:{method:'GET'}}})).statusCode,405);
  assert.equal((await handler(event(undefined,'bad'))).statusCode,401);
  assert.equal((await handler(event({environment:'sandbox/test',signedTransaction:signed,extra:true}))).statusCode,400);
  assert.equal((await handler(event({environment:'development',signedTransaction:signed}))).statusCode,400);
  assert.equal((await handler(event({environment:'sandbox/test',signedTransaction:'not-jws'}))).statusCode,400);
  assert.equal((await handler({...event(),isBase64Encoded:true,body:'%%%'})).statusCode,400);
  assert.equal(called,0);
});

test('Lambda closes when configuration or provider is unavailable',async()=>{
  assert.equal((await makeHandler({readSecret:()=>undefined})(event())).statusCode,503);
  const handler=makeHandler({readSecret:name=>values[name],verify:async()=>{throw Error('provider_unavailable');}});
  assert.equal((await handler(event())).statusCode,502);
});

test('temporary failure header carries bounded stage without evidence',async()=>{
  const handler=makeHandler({readSecret:name=>values[name],verify:async(_signed,_env,_config,_library,checkpoint)=>{
    checkpoint('status_api');
    const error=Error('synthetic');error.httpStatusCode=401;throw error;
  }});
  const denied=await handler(event());
  assert.equal(denied.statusCode,502);
  assert.equal(denied.headers['x-gridly-lp24466s-stage'],'status_api');
  assert.equal(denied.headers['x-gridly-lp24466s-http-status'],'401');
  assert.equal(JSON.stringify(denied).includes(signed),false);
  assert.equal(JSON.stringify(denied).includes(values.GRIDLY_APPLE_NODE_INTERNAL_TOKEN),false);
});

test('IAM-only signing check returns booleans without a JWT or private key',async()=>{
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const safeValues={...values,GRIDLY_APPLE_PRIVATE_KEY_P8:privateKey.export({type:'pkcs8',format:'pem'}).toString()};
  const check=await makeHandler({readSecret:name=>safeValues[name]})({probe:'lp24466s_api_signing'});
  assert.deepEqual(check,{configurationUsable:true,signingUsable:true});
  assert.equal(JSON.stringify(check).includes('PRIVATE KEY'),false);
  const malformed={...values,GRIDLY_APPLE_PRIVATE_KEY_P8:'-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----'};
  assert.deepEqual(await makeHandler({readSecret:name=>malformed[name]})({probe:'lp24466s_api_signing'}),
    {configurationUsable:false,signingUsable:false});
});

test('strict base64 transport decodes exact PEM bytes before Apple ES256 signing',async()=>{
  const pem=values.GRIDLY_APPLE_PRIVATE_KEY_P8;
  const encoded='b64:'+Buffer.from(pem,'utf8').toString('base64');
  const configured={...values,GRIDLY_APPLE_PRIVATE_KEY_P8:encoded};
  const handler=makeHandler({readSecret:name=>configured[name]});
  assert.deepEqual(await handler({probe:'lp24466s_api_signing'}),
    {configurationUsable:true,signingUsable:true});
  assert.equal((await handler(event(undefined,'wrong'))).statusCode,401);
  const result=await handler({probe:'lp24466s_key_stage'});
  assert.deepEqual(result,{stage:'ready'});
  assert.equal(JSON.stringify(result).includes(encoded),false);
  for(const invalid of ['b64:','b64:@@@','b64:AAAA','b64:'+Buffer.from('not-pem').toString('base64')]){
    const wrong={...values,GRIDLY_APPLE_PRIVATE_KEY_P8:invalid};
    assert.deepEqual(await makeHandler({readSecret:name=>wrong[name]})({probe:'lp24466s_api_signing'}),
      {configurationUsable:false,signingUsable:false});
  }
});

test('local console encoding preserves exact source bytes and rejects unusable keys',()=>{
  const source=Buffer.from(values.GRIDLY_APPLE_PRIVATE_KEY_P8,'utf8');
  const encoded=encodePrivateKeyBytes(source);
  assert.ok(encoded.startsWith('b64:'));
  assert.deepEqual(Buffer.from(encoded.slice(4),'base64'),source);
  assert.throws(()=>encodePrivateKeyBytes(Buffer.from('not a key')),/source_key_unusable/);
  assert.throws(()=>encodePrivateKeyBytes(Buffer.from([0xff,0x00])),/source_key_unusable/);
});

test('IAM-only Sandbox status probe returns fixed API class without provider data',async()=>{
  const calls=[];
  const configured={...values,GRIDLY_APPLE_PRIVATE_KEY_P8:'b64:'+Buffer.from(values.GRIDLY_APPLE_PRIVATE_KEY_P8).toString('base64')};
  class InvalidReferenceClient {
    constructor(_key,_keyId,_issuer,_bundle,environment){calls.push(environment);}
    createBearerToken(){return 'header.payload.signature';}
    async getAllSubscriptionStatuses(reference){calls.push(reference);const error=Error('provider body must not escape');error.httpStatusCode=400;error.apiError=4000006;throw error;}
  }
  const handler=makeHandler({readSecret:name=>configured[name],statusClient:InvalidReferenceClient});
  const result=await handler({probe:'lp24466s_status_path'});
  assert.deepEqual(result,{statusPath:'apple_invalid_transaction_id'});
  assert.deepEqual(calls,['Sandbox','00000000000000000000']);
  assert.equal(JSON.stringify(result).includes('provider body'),false);
  assert.equal(JSON.stringify(result).includes(configured.GRIDLY_APPLE_PRIVATE_KEY_P8),false);
  class UnauthorizedClient extends InvalidReferenceClient{
    async getAllSubscriptionStatuses(){const error=Error('secret provider response');error.httpStatusCode=401;throw error;}
  }
  assert.deepEqual(await makeHandler({readSecret:name=>configured[name],statusClient:UnauthorizedClient})({probe:'lp24466s_status_path'}),
    {statusPath:'apple_unauthorized'});
  class TransportClient extends InvalidReferenceClient{
    async getAllSubscriptionStatuses(){const error=Error('private network details');error.name='FetchError';throw error;}
  }
  assert.deepEqual(await makeHandler({readSecret:name=>configured[name],statusClient:TransportClient})({probe:'lp24466s_status_path'}),
    {statusPath:'transport_unavailable'});
  assert.equal((await makeHandler({readSecret:()=>undefined})({...event(),probe:'lp24466s_status_path'})).statusCode,503);
});

test('IAM-only key stage isolates PEM, type, curve and JWT readiness without evidence',async()=>{
  const probe={probe:'lp24466s_key_stage'};
  const stage=async privateKey=>{
    const configured={...values,GRIDLY_APPLE_PRIVATE_KEY_P8:privateKey};
    const result=await makeHandler({readSecret:name=>configured[name]})(probe);
    assert.deepEqual(Object.keys(result),['stage']);
    assert.equal(JSON.stringify(result).includes('PRIVATE KEY'),false);
    assert.equal(JSON.stringify(result).includes(values.GRIDLY_APPLE_NODE_INTERNAL_TOKEN),false);
    return result.stage;
  };
  const {privateKey:ecKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const goodPem=ecKey.export({type:'pkcs8',format:'pem'}).toString();
  assert.equal(await stage(goodPem),'ready');
  assert.equal(await stage(goodPem.replaceAll('\n','\\n')),'pem_literal_newlines');
  assert.equal(await stage('-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----'),'pem_parse_failed');
  const {privateKey:rsaKey}=generateKeyPairSync('rsa',{modulusLength:2048});
  assert.equal(await stage(rsaKey.export({type:'pkcs8',format:'pem'}).toString()),'key_type_not_ec');
  const {privateKey:otherCurve}=generateKeyPairSync('ec',{namedCurve:'secp384r1'});
  assert.equal(await stage(otherCurve.export({type:'pkcs8',format:'pem'}).toString()),'curve_not_p256');
  assert.deepEqual(await makeHandler({readSecret:()=>undefined})(probe),{stage:'configuration_unusable'});
  assert.equal((await makeHandler({readSecret:()=>undefined})({...event(),probe:probe.probe})).statusCode,503);
});

test('IAM-only encoding probe classifies safe repairs and damaged PEM without key output',async()=>{
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const pem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
  const probe=async value=>{
    const configured={...values,GRIDLY_APPLE_PRIVATE_KEY_P8:value};
    const result=await makeHandler({readSecret:name=>configured[name]})({probe:'lp24466s_pem_encoding'});
    assert.deepEqual(Object.keys(result),['encodingStage']);
    assert.equal(JSON.stringify(result).includes('PRIVATE KEY'),false);
    assert.equal(JSON.stringify(result).includes(values.GRIDLY_APPLE_NODE_INTERNAL_TOKEN),false);
    return result.encodingStage;
  };
  assert.equal(await probe(pem),'not_a_pem_parse_failure');
  assert.equal(await probe(pem.replaceAll('\n','\\n')),'escaped_lf_repairs_key');
  assert.equal(await probe(JSON.stringify(pem)),'json_unquote_repairs_key');
  const body=pem.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
  assert.equal(await probe('-----BEGIN PRIVATE KEY-----'+body+'-----END PRIVATE KEY-----'),'pem_rewrap_repairs_key');
  assert.equal(await probe('-----BEGIN PRIVATE KEY-----\n????\n-----END PRIVATE KEY-----'),'pem_body_encoding_invalid');
  assert.equal(await probe('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----'),'pem_der_unparseable');
  assert.equal(await probe('prefix BEGIN PRIVATE KEY suffix'),'pem_wrapper_invalid');
  assert.deepEqual(await makeHandler({readSecret:()=>undefined})({probe:'lp24466s_pem_encoding'}),
    {encodingStage:'configuration_unusable'});
  assert.equal((await makeHandler({readSecret:()=>undefined})({...event(),probe:'lp24466s_pem_encoding'})).statusCode,503);
});

test('local private-key check reports only a fixed source-file stage',()=>{
  const {privateKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const path=join(tmpdir(),`lp24466s-synthetic-${process.pid}.p8`);
  try {
    writeFileSync(path,privateKey.export({type:'pkcs8',format:'pem'}));
    const output=execFileSync(process.execPath,['check-private-key-local.mjs',path],{cwd:new URL('.',import.meta.url),encoding:'utf8'}).trim();
    assert.equal(output,'sourceKeyStage: ready');
  } finally {try {unlinkSync(path);} catch { /* Synthetic fixture may not have been written. */ }}
});

test('strict Apple verifier checks original, current and renewal with selected Sandbox environment',async()=>{
  const calls=[];
  const library={
    SignedDataVerifier:class{
      constructor(roots,online,env,bundle,appId){calls.push({online,env,bundle,appId});}
      async verifyAndDecodeTransaction(value){calls.push(value);return value===signed?base:{...base};}
      async verifyAndDecodeRenewalInfo(){calls.push('renewal');return renewal;}
    },
    AppStoreServerAPIClient:class{
      constructor(key,keyId,issuer,bundle,env){calls.push({keyId,issuer,bundle,env});}
      createBearerToken(){return 'header.payload.signature';}
      async getAllSubscriptionStatuses(reference){calls.push(reference);return {data:[{lastTransactions:[{originalTransactionId:reference,signedTransactionInfo:'current.jws.sig',signedRenewalInfo:'renewal.jws.sig',status:1}]}]};}
    }
  };
  const config={roots:[Buffer.alloc(256)],privateKey:'synthetic',keyId:values.GRIDLY_APPLE_KEY_ID,issuer:values.GRIDLY_APPLE_ISSUER_ID,appId:123456789};
  const result=await verifyStore(signed,'sandbox/test',config,library);
  assert.equal(calls[0].online,true);
  assert.equal(calls[0].env,'Sandbox');
  assert.equal(calls[0].appId,undefined);
  assert.equal(result.environment,'sandbox/test');
  assert.equal(result.originalReference,'public-test-id');
  assert.equal(result.transaction.expiresDate,base.expiresDate);
  assert.ok(calls.includes('renewal'));
  const badLibrary={...library,SignedDataVerifier:class extends library.SignedDataVerifier{
    async verifyAndDecodeRenewalInfo(){return {...renewal,environment:'Production'};}
  }};
  await assert.rejects(verifyStore(signed,'sandbox/test',config,badLibrary),/invalid_evidence/);
});

test('Production verifier binds app Apple ID and denies provider outage or bundle mismatch',async()=>{
  const args=[];
  const config={roots:[Buffer.alloc(256)],privateKey:'synthetic',keyId:values.GRIDLY_APPLE_KEY_ID,issuer:values.GRIDLY_APPLE_ISSUER_ID,appId:123456789};
  const original={...base,environment:'Production'};
  const library={SignedDataVerifier:class{
    constructor(...items){args.push(items);}
    async verifyAndDecodeTransaction(){return original;}
    async verifyAndDecodeRenewalInfo(){return {...renewal,environment:'Production'};}
  },AppStoreServerAPIClient:class{createBearerToken(){return 'header.payload.signature';}async getAllSubscriptionStatuses(){throw Error('provider_unavailable');}}};
  await assert.rejects(verifyStore(signed,'production',config,library),/provider_unavailable/);
  assert.equal(args[0][1],true);
  assert.equal(args[0][2],'Production');
  assert.equal(args[0][3],'com.gridlygo.gridly');
  assert.equal(args[0][4],123456789);
  original.bundleId='other.bundle';
  await assert.rejects(verifyStore(signed,'production',config,library),/invalid_evidence/);
});

test('Lambda success response contains bounded facts and canonical HMAC only',async()=>{
  const digest=createHash('sha256').update('sandbox/test\n'+signed).digest('hex');
  const body={environment:'sandbox/test',requestDigest:digest};
  const handler=makeHandler({readSecret:name=>values[name],verify:async()=>body});
  const response=await handler(event());
  assert.equal(response.statusCode,200);
  const parsed=JSON.parse(response.body);
  assert.deepEqual(parsed.body,body);
  assert.equal(parsed.mac,createHmac('sha256',Buffer.alloc(32,7)).update('gridly-apple-node-v1\n'+JSON.stringify({environment:'sandbox/test',requestDigest:digest})).digest('hex'));
  assert.equal(JSON.stringify(response).includes(signed),false);
  assert.equal(JSON.stringify(response).includes(values.GRIDLY_APPLE_NODE_INTERNAL_TOKEN),false);
  const denied=await handler(event({environment:'production',signedTransaction:signed}));
  assert.equal(denied.statusCode,502);
});
