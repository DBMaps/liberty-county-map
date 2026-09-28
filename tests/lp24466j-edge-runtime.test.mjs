import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {generateKeyPairSync,randomBytes,X509Certificate} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {APPLE_APP_ATTEST_ROOT_PEM} from '../supabase/functions/_shared/entitlement/apple-app-attest.mjs';

const deno=process.env.GRIDLY_LP24466J_DENO;
const denoDir=process.env.GRIDLY_LP24466J_DENO_DIR;
const endpoint='http://127.0.0.1:8000/';
const entries=[
  ['challenge','supabase/functions/gridly-subscription-challenge/index.ts'],
  ['apple','supabase/functions/gridly-verify-apple-subscription/index.ts'],
  ['google','supabase/functions/gridly-verify-google-subscription/index.ts'],
  ['ops','supabase/functions/gridly-subscription-ops/index.ts'],
];

const isolatedEnvironment=(overrides={})=>{
  const env={};
  for(const name of ['SystemRoot','WINDIR','TEMP','TMP','PATH','PATHEXT'])
    if(process.env[name])env[name]=process.env[name];
  env.DENO_DIR=denoDir;
  return {...env,...overrides};
};

async function awaitServer(child){
  for(let attempt=0;attempt<100;attempt++){
    if(child.exitCode!==null)throw Error('Deno exited before startup');
    try {const response=await fetch(endpoint);await response.body?.cancel();return;}
    catch {await delay(100);}
  }
  throw Error('Deno did not start');
}

async function withServer(entry,environment,check){
  const output={text:''};
  const child=spawn(deno,[
    'run','--cached-only','--no-config','--no-lock','--node-modules-dir=none',
    '--allow-env','--allow-net=0.0.0.0:8000,127.0.0.1:8000',entry,
  ],{cwd:process.cwd(),env:isolatedEnvironment(environment),windowsHide:true,stdio:['ignore','pipe','pipe']});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{
    output.text=(output.text+chunk).slice(-32768);
  });
  try {
    await awaitServer(child);await check();
    for(const name of ['SUPABASE_SERVICE_ROLE_KEY','GRIDLY_CHALLENGE_GATEWAY_TOKEN',
      'GRIDLY_SUBSCRIPTION_OPS_TOKEN','GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64',
      'GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64','GRIDLY_GOOGLE_ACK_AES_CURRENT_KEY_B64'])
      if(environment[name])assert.ok(!output.text.includes(environment[name]),`Deno logged ${name}`);
    assert.ok(!output.text.includes('-----BEGIN PRIVATE KEY-----'),'Deno logged a private key');
    assert.ok(!output.text.includes('synthetic.payload.signature'),'Deno logged raw store evidence');
  }
  finally {child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(5000)]);}
}

function syntheticConfiguration(){
  const ec=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).privateKey;
  const rsa=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey;
  return {
    SUPABASE_URL:'https://localcertfixture.supabase.co/',
    SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-role-for-local-runtime-only',
    GRIDLY_CHALLENGE_GATEWAY_TOKEN:randomBytes(32).toString('hex'),
    GRIDLY_SUBSCRIPTION_OPS_TOKEN:randomBytes(32).toString('hex'),
    GRIDLY_STORE_ENVIRONMENT:'production',
    GRIDLY_STORE_BUNDLE_ID:'com.gridlygo.gridly',
    GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64:ec.export({format:'der',type:'pkcs8'}).toString('base64'),
    GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64:randomBytes(32).toString('base64'),
    GRIDLY_APPLE_ISSUER_ID:'00000000-0000-4000-8000-000000000001',
    GRIDLY_APPLE_KEY_ID:'ABCDEFGHIJ',
    GRIDLY_APPLE_PRIVATE_KEY_P8:ec.export({format:'pem',type:'pkcs8'}),
    GRIDLY_APPLE_APP_ID:'123456789',
    // Public trust data is used only to initialize a local constructor; no Apple provider call follows.
    GRIDLY_APPLE_STORE_ROOTS_B64:JSON.stringify([new X509Certificate(APPLE_APP_ATTEST_ROOT_PEM).raw.toString('base64')]),
    GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',project_id:'gridly-play-billing',
      client_email:'synthetic@gridly-play-billing.iam.gserviceaccount.com',
      private_key:rsa.export({format:'pem',type:'pkcs8'}),token_uri:'https://oauth2.googleapis.com/token'}),
    GRIDLY_GOOGLE_ACK_AES_CURRENT_KEY_B64:randomBytes(32).toString('base64'),
    GRIDLY_GOOGLE_ACK_AES_CURRENT_VERSION:'local1',
  };
}

test('actual Deno Edge entrypoints start and deny without deployment configuration',
  {skip:!deno||!denoDir?'set GRIDLY_LP24466J_DENO and GRIDLY_LP24466J_DENO_DIR for runtime certification':false,
    timeout:90000},async()=>{
    await assert.rejects(fetch(endpoint),'port 8000 must be unused before certification');
    for(const [name,entry] of entries){
      await withServer(entry,{},async()=>{
        const cases=[
          {method:'GET'},
          {method:'POST',headers:{'Content-Type':'application/json'},body:'not-json'},
          {method:'POST',headers:{'Content-Type':'application/json'},body:'{}'},
        ];
        for(const request of cases){
          const response=await fetch(endpoint,request);
          assert.equal(response.headers.get('cache-control'),'no-store',`${name} cache policy`);
          const body=await response.json();
          assert.deepEqual(Object.keys(body),['error'],`${name} returned authority`);
          assert.ok([400,401,405,503].includes(response.status),`${name} status ${response.status}`);
          assert.notEqual(response.status,200,`${name} minted authority without configuration`);
        }
      });
    }
  });

test('configured Deno handlers enforce independent HTTP tokens and native authorization before provider calls',
  {skip:!deno||!denoDir?'portable Deno runtime unavailable':false,timeout:90000},async()=>{
    await assert.rejects(fetch(endpoint),'port 8000 must be unused before certification');
    const config=syntheticConfiguration();
    const post=body=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const challenge=post({platform:'apple'});
    await withServer(entries[0][1],config,async()=>{
      assert.equal((await fetch(endpoint,{method:'GET'})).status,405);
      assert.equal((await fetch(endpoint,post({platform:'web'}))).status,400);
      assert.equal((await fetch(endpoint,challenge)).status,429);
      assert.equal((await fetch(endpoint,{...challenge,headers:{...challenge.headers,
        'X-Gridly-Challenge-Gateway-Token':'0'.repeat(64)}})).status,429);
    });
    for(const [name,entry] of entries.slice(1,3)){
      await withServer(entry,config,async()=>{
        assert.equal((await fetch(endpoint,{method:'GET'})).status,405);
        assert.equal((await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'not-json'})).status,400,
          `${name} composition must initialize beyond missing-config fallback`);
        const request={platform:name,environment:'production',nonce:'a'.repeat(48),
          productId:name==='apple'?'com.gridlygo.gridly.monthly':'gridly_monthly',
          ...(name==='google'?{basePlanId:'monthly'}:{}),
          evidence:name==='apple'?{signedTransactions:['synthetic.payload.signature']}:{purchaseTokens:['synthetic-token']}};
        assert.equal((await fetch(endpoint,post(request))).status,401,`${name} must require native authorization`);
      });
    }
    await withServer(entries[3][1],config,async()=>{
      assert.equal((await fetch(endpoint,{method:'POST'})).status,401);
      assert.equal((await fetch(endpoint,{method:'POST',headers:{'X-Gridly-Subscription-Ops-Token':'0'.repeat(64)}})).status,401);
      assert.equal((await fetch(endpoint,{method:'GET',headers:{'X-Gridly-Subscription-Ops-Token':config.GRIDLY_SUBSCRIPTION_OPS_TOKEN}})).status,400);
      assert.equal((await fetch(endpoint,{...post({unexpected:true}),headers:{'Content-Type':'application/json',
        'X-Gridly-Subscription-Ops-Token':config.GRIDLY_SUBSCRIPTION_OPS_TOKEN}})).status,400);
    });
  });

test('malformed deployment URL keeps every Deno entrypoint closed',
  {skip:!deno||!denoDir?'portable Deno runtime unavailable':false,timeout:90000},async()=>{
    await assert.rejects(fetch(endpoint),'port 8000 must be unused before certification');
    const config={...syntheticConfiguration(),SUPABASE_URL:'http://invalid.local/'};
    for(const [name,entry] of entries){
      await withServer(entry,config,async()=>{
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
        assert.equal(response.status,503,`${name} malformed configuration must deny`);
        assert.equal(response.headers.get('cache-control'),'no-store');
        assert.deepEqual(Object.keys(await response.json()),['error']);
      });
    }
  });
