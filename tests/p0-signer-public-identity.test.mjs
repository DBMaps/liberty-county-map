import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {signerPublicIdentity} from '../tools/entitlement/signer-public-identity.mjs';
// All private material here is newly generated offline test data.
const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const synthetic=pair.privateKey.export({format:'der',type:'pkcs8'}).toString('base64');
const readSecret=name=>{assert.equal(name,'GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64');return synthetic;};
const digest=createHash('sha256').update(synthetic).digest('hex');
test('derive only public SPKI identity from a synthetic authorized source',()=>{
 const result=signerPublicIdentity({readSecret});
 assert.equal(result.publicSpkiSha256,createHash('sha256').update(pair.publicKey.export({format:'der',type:'spki'})).digest('hex'));
 assert.equal(result.build14PinMatches,false);assert.equal(result.suppliedConfigurationDigestMatches,null);
 assert.doesNotMatch(JSON.stringify(result),new RegExp(synthetic));
});
test('only a matching supplied configuration digest can corroborate source identity',()=>{
 assert.equal(signerPublicIdentity({readSecret,configuredSecretDigest:digest}).suppliedConfigurationDigestMatches,true);
 assert.deepEqual(signerPublicIdentity({readSecret,configuredSecretDigest:'0'.repeat(64)}),{ok:false,errorCategory:'configuration_digest_mismatch'});
});
test('missing, malformed, thrown and wrong-curve secrets return fixed safe categories',()=>{
 for(const value of [undefined,'private-error-must-not-print','====',synthetic+'\n']){
  const result=signerPublicIdentity({readSecret:()=>value});assert.equal(result.ok,false);
  assert.ok(!JSON.stringify(result).includes('private-error-must-not-print'));
 }
 assert.equal(signerPublicIdentity({readSecret:()=>{throw Error(synthetic);}}).errorCategory,'invalid_signer_source');
 const wrong=generateKeyPairSync('ec',{namedCurve:'secp384r1'}).privateKey.export({format:'der',type:'pkcs8'}).toString('base64');
 assert.equal(signerPublicIdentity({readSecret:()=>wrong}).errorCategory,'invalid_signer_algorithm');
});
test('public digest input validates before secret access',()=>{
 assert.deepEqual(signerPublicIdentity({configuredSecretDigest:'bad',readSecret:()=>{throw Error('must not read');}}),
 {ok:false,errorCategory:'invalid_configuration_digest'});
});
test('diagnostic has no network, filesystem read, private export or secret-valued CLI argument',()=>{
 const source=readFileSync(new URL('../tools/entitlement/signer-public-identity.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\(|node:fs|privateKey\.export|console\.|process\.stderr/);
 assert.match(source,/createPublicKey\(privateKey\)\.export\(\{format:'der',type:'spki'\}\)/);
});
