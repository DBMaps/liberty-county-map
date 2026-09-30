import { Buffer } from 'node:buffer';
import { createHash, createHmac, createPrivateKey, sign as nodeSign, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { AppStoreServerAPIClient, Environment, SignedDataVerifier } from '@apple/app-store-server-library';

const BUNDLE = 'com.gridlygo.gridly';
const PRODUCT = 'com.gridlygo.gridly.monthly';
const STATUS_PROBE_REFERENCE = '00000000000000000000';
const ROOTS = Object.freeze([
  ['apple-inc-root.der', 'b0b1730ecbc7ff4505142c49f1295e6eda6bcaed7e2c68c5be91b5a11001f024'],
  ['apple-root-g2.der', 'c2b9b042dd57830e7d117dac55ac8ae19407d38e41d88f3215bc3a890444a050'],
  ['apple-root-g3.der', '63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179']
]);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const canonical = value => {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
};
const reply = (statusCode, error) => ({statusCode, headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({error})});
const validReference = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
const providerEnvironment = env => env === 'production' ? Environment.PRODUCTION : Environment.SANDBOX;
const expectedEnvironment = env => env === 'production' ? 'Production' : 'Sandbox';

function roots() {
  return ROOTS.map(([name, hash]) => {
    const bytes = readFileSync(new URL('./' + name, import.meta.url));
    if (sha256(bytes) !== hash) throw Error('configuration_unavailable');
    return bytes;
  });
}

function privateKeyFromEnvironment(value) {
  if (!value.startsWith('b64:')) return value;
  const encoded=value.slice(4);
  if (encoded.length===0 || encoded.length>8192 || encoded.length%4!==0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw Error('configuration_unavailable');
  const bytes=Buffer.from(encoded,'base64');
  if (bytes.length===0 || bytes.toString('base64')!==encoded) throw Error('configuration_unavailable');
  const pem=bytes.toString('utf8');
  if (!Buffer.from(pem,'utf8').equals(bytes)) throw Error('configuration_unavailable');
  return pem;
}

function configuration(read = name => process.env[name], {parsePrivateKey=true} = {}) {
  const required = name => {const value = read(name); if (typeof value !== 'string' || !value) throw Error('configuration_unavailable'); return value;};
  const token = required('GRIDLY_APPLE_NODE_INTERNAL_TOKEN');
  const hmacText = required('GRIDLY_APPLE_NODE_RESPONSE_HMAC_KEY');
  const hmacKey = Buffer.from(hmacText, 'base64');
  const issuer = required('GRIDLY_APPLE_ISSUER_ID');
  const keyId = required('GRIDLY_APPLE_KEY_ID');
  const privateKey = privateKeyFromEnvironment(required('GRIDLY_APPLE_PRIVATE_KEY_P8'));
  const appIdText = required('GRIDLY_APPLE_APP_ID');
  const appId = Number(appIdText);
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(token) || !/^[A-Za-z0-9+/]{43,}={0,2}$/.test(hmacText) || hmacKey.length !== 32 ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(issuer) ||
      !/^[A-Z0-9]{10}$/.test(keyId) || !privateKey.includes('BEGIN PRIVATE KEY') ||
      !/^[1-9][0-9]{0,15}$/.test(appIdText) || !Number.isSafeInteger(appId)) throw Error('configuration_unavailable');
  if(parsePrivateKey){
    let parsedPrivateKey;
    try {parsedPrivateKey=createPrivateKey(privateKey);}
    catch {throw Error('configuration_unavailable');}
    if(parsedPrivateKey.asymmetricKeyType!=='ec' || parsedPrivateKey.asymmetricKeyDetails?.namedCurve!=='prime256v1')
      throw Error('configuration_unavailable');
  }
  return {token, hmacKey, issuer, keyId, privateKey, appId, roots:roots()};
}

function signedVerifier(config, env) {
  const selected = providerEnvironment(env);
  return new SignedDataVerifier(config.roots, true, selected, BUNDLE,
    selected === Environment.PRODUCTION ? config.appId : undefined);
}

function normalizedFacts(original, current, renewal, status, env, signedTransaction) {
  const expected = expectedEnvironment(env);
  const reference = original.originalTransactionId;
  if (original.bundleId !== BUNDLE || original.productId !== PRODUCT || original.type !== 'Auto-Renewable Subscription' ||
      original.environment !== expected || !validReference(reference) ||
      current.bundleId !== BUNDLE || current.productId !== PRODUCT || current.type !== 'Auto-Renewable Subscription' ||
      current.environment !== expected || current.originalTransactionId !== reference ||
      renewal.environment !== expected || renewal.productId !== PRODUCT || renewal.originalTransactionId !== reference ||
      ![0,1].includes(renewal.autoRenewStatus) || ![1,2,3,4,5].includes(status) ||
      !Number.isSafeInteger(current.expiresDate) || current.expiresDate <= 0 ||
      (current.revocationDate != null && (!Number.isSafeInteger(current.revocationDate) || current.revocationDate <= 0))) throw Error('invalid_evidence');
  return {
    version:1,
    environment:env,
    requestDigest:sha256(env + '\n' + signedTransaction),
    issuedAt:Date.now(),
    originalReference:reference,
    transaction:{bundleId:current.bundleId,productId:current.productId,type:current.type,
      environment:current.environment,originalTransactionId:current.originalTransactionId,
      expiresDate:current.expiresDate,revocationDate:current.revocationDate ?? null},
    renewal:{originalTransactionId:renewal.originalTransactionId,productId:renewal.productId,
      environment:renewal.environment,autoRenewStatus:renewal.autoRenewStatus},
    status
  };
}

function privateKeyStage(config) {
  let key;
  try { key = createPrivateKey(config.privateKey); }
  catch {
    return config.privateKey.includes('\\n') && !config.privateKey.includes('\n') ?
      'pem_literal_newlines' : 'pem_parse_failed';
  }
  if (key.asymmetricKeyType !== 'ec') return 'key_type_not_ec';
  if (key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') return 'curve_not_p256';
  try {
    if (!nodeSign('sha256',Buffer.from('lp24466s-key-stage-v1'),key).length) return 'node_sign_failed';
  } catch { return 'node_sign_failed'; }
  let client;
  try { client=new AppStoreServerAPIClient(config.privateKey,config.keyId,config.issuer,BUNDLE,Environment.SANDBOX); }
  catch { return 'api_client_init_failed'; }
  try {
    const jwt=client.createBearerToken();
    return typeof jwt==='string' && jwt.split('.').length===3 ? 'ready' : 'jwt_sign_failed';
  } catch { return 'jwt_sign_failed'; }
}

function privateKeyEncodingStage(config) {
  const source=config.privateKey;
  const originalStage=privateKeyStage(config);
  if(originalStage!=='pem_parse_failed' && originalStage!=='pem_literal_newlines')
    return 'not_a_pem_parse_failure';
  let jsonDecoded;
  try { if(source.startsWith('"')&&source.endsWith('"')) jsonDecoded=JSON.parse(source); }
  catch { /* A malformed quoted value is classified below. */ }
  const candidates=[
    ['trim_repairs_key',source.trim()],
    ['json_unquote_repairs_key',typeof jsonDecoded==='string' ? jsonDecoded : source],
    ['escaped_crlf_repairs_key',source.replaceAll('\\r\\n','\n')],
    ['escaped_lf_repairs_key',source.replaceAll('\\n','\n')]
  ];
  const begin='-----BEGIN PRIVATE KEY-----';
  const end='-----END PRIVATE KEY-----';
  const first=source.indexOf(begin), last=source.indexOf(end);
  if(first>=0 && last>first){
    const body=source.slice(first+begin.length,last).replace(/\s/g,'');
    if(/^[A-Za-z0-9+/]+={0,2}$/.test(body) && body.length>0 && body.length<=8192)
      candidates.push(['pem_rewrap_repairs_key',begin+'\n'+(body.match(/.{1,64}/g)??[]).join('\n')+'\n'+end+'\n']);
  }
  for(const [stage,value] of candidates){
    if(value!==source && privateKeyStage({...config,privateKey:value})==='ready') return stage;
  }
  if(first<0 || last<=first || source.indexOf(begin,first+begin.length)>=0 || source.indexOf(end,last+end.length)>=0)
    return 'pem_wrapper_invalid';
  const compact=source.slice(first+begin.length,last).replace(/\s/g,'');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(compact) || compact.length===0 || compact.length>8192 || compact.length%4!==0)
    return 'pem_body_encoding_invalid';
  const der=Buffer.from(compact,'base64');
  if(der.toString('base64')!==compact) return 'pem_body_encoding_invalid';
  let key;
  try {key=createPrivateKey({key:der,format:'der',type:'pkcs8'});}
  catch {return 'pem_der_unparseable';}
  if(key.asymmetricKeyType!=='ec' || key.asymmetricKeyDetails?.namedCurve!=='prime256v1')
    return 'pem_der_wrong_type_or_curve';
  try {if(!nodeSign('sha256',Buffer.from('lp24466s-pem-encoding-v1'),key).length) return 'pem_der_sign_failed';}
  catch {return 'pem_der_sign_failed';}
  return 'pem_wrapper_unclassified';
}

export async function verifyStore(signedTransaction, env, config, library = {SignedDataVerifier,AppStoreServerAPIClient}, checkpoint = () => {}) {
  const selected = providerEnvironment(env);
  checkpoint('verifier_init');
  const verifier = library.SignedDataVerifier === SignedDataVerifier ? signedVerifier(config,env) :
    new library.SignedDataVerifier(config.roots,true,selected,BUNDLE,selected === Environment.PRODUCTION ? config.appId : undefined);
  checkpoint('original_jws');
  const original = await verifier.verifyAndDecodeTransaction(signedTransaction);
  checkpoint('original_claims');
  if (original.bundleId !== BUNDLE || original.productId !== PRODUCT || original.type !== 'Auto-Renewable Subscription' ||
      original.environment !== expectedEnvironment(env) || !validReference(original.originalTransactionId)) throw Error('invalid_evidence');
  const client = new library.AppStoreServerAPIClient(config.privateKey,config.keyId,config.issuer,BUNDLE,selected);
  checkpoint('status_signing');
  const signedApiToken=client.createBearerToken();
  if(typeof signedApiToken!=='string'||signedApiToken.split('.').length!==3)throw Error('configuration_unavailable');
  checkpoint('status_api');
  const status = await client.getAllSubscriptionStatuses(original.originalTransactionId);
  checkpoint('status_shape');
  if (!Array.isArray(status?.data) || status.data.length > 8) throw Error('invalid_evidence');
  const rows = status.data.flatMap(group => {
    if (!Array.isArray(group.lastTransactions) || group.lastTransactions.length > 16) throw Error('invalid_evidence');
    return group.lastTransactions;
  }).filter(row => row.originalTransactionId === original.originalTransactionId);
  if (rows.length !== 1 || typeof rows[0].signedTransactionInfo !== 'string' ||
      typeof rows[0].signedRenewalInfo !== 'string') throw Error('invalid_evidence');
  checkpoint('current_jws');
  const current = await verifier.verifyAndDecodeTransaction(rows[0].signedTransactionInfo);
  checkpoint('renewal_jws');
  const renewal = await verifier.verifyAndDecodeRenewalInfo(rows[0].signedRenewalInfo);
  checkpoint('normalized_facts');
  return normalizedFacts(original,current,renewal,rows[0].status,env,signedTransaction);
}

export function makeHandler({readSecret,verify=verifyStore,statusClient=AppStoreServerAPIClient} = {}) {
  return async event => {
    if(exactKeys(event,['probe'])&&event.probe==='lp24466s_status_path'){
      // IAM-only, read-only Sandbox call with a fixed invalid reference; never return provider data.
      let config;
      try {config=configuration(readSecret);} catch {return {statusPath:'configuration_unusable'};}
      let client;
      try {
        client=new statusClient(config.privateKey,config.keyId,config.issuer,BUNDLE,Environment.SANDBOX);
        const jwt=client.createBearerToken();
        if(typeof jwt!=='string'||jwt.split('.').length!==3) return {statusPath:'signing_unusable'};
      } catch {return {statusPath:'signing_unusable'};}
      try {
        await client.getAllSubscriptionStatuses(STATUS_PROBE_REFERENCE);
        return {statusPath:'unexpected_success'};
      } catch(error) {
        if(error?.httpStatusCode===400 && error?.apiError===4000006) return {statusPath:'apple_invalid_transaction_id'};
        if(error?.httpStatusCode===401) return {statusPath:'apple_unauthorized'};
        if(error?.httpStatusCode===404 && [4040005,4040006,4040010].includes(error?.apiError))
          return {statusPath:'apple_transaction_not_found'};
        if(error?.httpStatusCode===400) return {statusPath:'apple_other_bad_request'};
        if(error?.httpStatusCode===404) return {statusPath:'apple_other_not_found'};
        if(error?.httpStatusCode===429) return {statusPath:'apple_rate_limited'};
        if(Number.isInteger(error?.httpStatusCode) && error.httpStatusCode>=500 && error.httpStatusCode<=599)
          return {statusPath:'apple_server_unavailable'};
        if(['FetchError','TypeError'].includes(error?.name)) return {statusPath:'transport_unavailable'};
        return {statusPath:'unclassified_failure'};
      }
    }
    if(exactKeys(event,['probe'])&&event.probe==='lp24466s_pem_encoding'){
      // IAM-only direct invocation: fixed classification, never emit key bytes or parser errors.
      try {return {encodingStage:privateKeyEncodingStage(configuration(readSecret,{parsePrivateKey:false}))};}
      catch {return {encodingStage:'configuration_unusable'};}
    }
    if(exactKeys(event,['probe'])&&event.probe==='lp24466s_key_stage'){
      // IAM-only direct invocation: fixed stage codes; no key, JWT or error text leaves memory.
      try { return {stage:privateKeyStage(configuration(readSecret,{parsePrivateKey:false}))}; }
      catch { return {stage:'configuration_unusable'}; }
    }
    if(exactKeys(event,['probe'])&&event.probe==='lp24466s_api_signing'){
      // Temporary IAM-only direct-invocation check: no token, JWT or key leaves memory.
      let config;
      try {config=configuration(readSecret);} catch {return {configurationUsable:false,signingUsable:false};}
      try {
        const client=new AppStoreServerAPIClient(config.privateKey,config.keyId,config.issuer,BUNDLE,Environment.SANDBOX);
        const jwt=client.createBearerToken();
        return {configurationUsable:true,signingUsable:typeof jwt==='string'&&jwt.split('.').length===3};
      } catch {return {configurationUsable:true,signingUsable:false};}
    }
    if (event?.requestContext?.http?.method !== 'POST' || event.rawPath !== '/' || event.rawQueryString) return reply(405,'invalid_request');
    let config;
    try { config = configuration(readSecret); }
    catch { return reply(503,'verification_unavailable'); }
    const supplied = event.headers?.['x-gridly-apple-node-token'];
    const left = createHash('sha256').update(typeof supplied === 'string' ? supplied : '').digest();
    const right = createHash('sha256').update(config.token).digest();
    if (!timingSafeEqual(left,right)) return reply(401,'unauthorized');
    if (event.headers?.['content-type'] !== 'application/json' || typeof event.body !== 'string' || event.body.length > 24576 ||
        (event.isBase64Encoded && (event.body.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(event.body)))) return reply(400,'invalid_request');
    let stage='request_body';
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body,'base64').toString('utf8') : event.body;
      if (Buffer.byteLength(raw) > 24576) return reply(400,'invalid_request');
      const parsed = JSON.parse(raw);
      if (!exactKeys(parsed,['environment','signedTransaction']) ||
          !['production','sandbox/test'].includes(parsed.environment) ||
          typeof parsed.signedTransaction !== 'string' || parsed.signedTransaction.length > 16384 ||
          !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(parsed.signedTransaction)) return reply(400,'invalid_request');
      stage='verifier_call';
      const body = await verify(parsed.signedTransaction,parsed.environment,config,undefined,code=>{stage=code;});
      stage='response_sign';
      if (typeof body !== 'object' || !body || body.environment !== parsed.environment ||
          body.requestDigest !== sha256(parsed.environment + '\n' + parsed.signedTransaction)) throw Error('invalid_evidence');
      const mac = createHmac('sha256',config.hmacKey).update('gridly-apple-node-v1\n' + canonical(body)).digest('hex');
      return {statusCode:200,headers:{'content-type':'application/json','cache-control':'no-store'},
        body:JSON.stringify({body,mac})};
    } catch (error) {
      // LP244.66S temporary bounded diagnostic; response body stays generic.
      const denied=reply(502,'verification_unavailable');
      denied.headers['x-gridly-lp24466s-stage']=stage;
      if(Number.isInteger(error?.status)&&error.status>=0&&error.status<=7)
        denied.headers['x-gridly-lp24466s-apple-status']=String(error.status);
      if(Number.isInteger(error?.httpStatusCode)&&error.httpStatusCode>=400&&error.httpStatusCode<=599)
        denied.headers['x-gridly-lp24466s-http-status']=String(error.httpStatusCode);
      if(Number.isInteger(error?.apiError)&&error.apiError>=4000000&&error.apiError<=5999999)
        denied.headers['x-gridly-lp24466s-api-code']=String(error.apiError);
      if(['FetchError','TypeError','Error','APIException','VerificationException'].includes(error?.name))
        denied.headers['x-gridly-lp24466s-kind']=error.name;
      if(['ENOTFOUND','EAI_AGAIN','ECONNRESET','ECONNREFUSED','ETIMEDOUT','ERR_OSSL_UNSUPPORTED','ERR_OSSL_EVP_UNSUPPORTED','ERR_INVALID_ARG_TYPE'].includes(error?.code))
        denied.headers['x-gridly-lp24466s-network-code']=error.code;
      return denied;
    }
  };
}

export const handler = makeHandler();
