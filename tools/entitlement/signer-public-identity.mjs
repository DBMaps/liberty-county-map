import {createPrivateKey,createPublicKey,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {PRODUCTION_ENTITLEMENT_SPKI_SHA256} from '../../js/gridly-entitlement-public-key.mjs';

// Offline, fixed-source identity check. No network, files, key replacement or
// private-key export. A matching local public pin alone is not production proof.
export function signerPublicIdentity({readSecret=name=>process.env[name],configuredSecretDigest=null}={}) {
 let der;
 try {
  if(configuredSecretDigest!==null&&!/^[a-f0-9]{64}$/.test(configuredSecretDigest))
   return {ok:false,errorCategory:'invalid_configuration_digest'};
  const value=readSecret('GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64');
  if(typeof value!=='string'||!value)return {ok:false,errorCategory:'signer_source_unavailable'};
  if(value.length>16384||! /^[A-Za-z0-9+/]+={0,2}$/.test(value))
   return {ok:false,errorCategory:'invalid_signer_source'};
  if(configuredSecretDigest!==null&&createHash('sha256').update(value,'utf8').digest('hex')!==configuredSecretDigest)
   return {ok:false,errorCategory:'configuration_digest_mismatch'};
  der=Buffer.from(value,'base64');
  if(der.toString('base64')!==value)return {ok:false,errorCategory:'invalid_signer_source'};
  const privateKey=createPrivateKey({key:der,format:'der',type:'pkcs8'});
  if(privateKey.asymmetricKeyType!=='ec'||privateKey.asymmetricKeyDetails?.namedCurve!=='prime256v1')
   return {ok:false,errorCategory:'invalid_signer_algorithm'};
  const spki=createPublicKey(privateKey).export({format:'der',type:'spki'});
  const publicSpkiSha256=createHash('sha256').update(spki).digest('hex');
  return {ok:true,publicSpkiSha256,build14PinMatches:publicSpkiSha256===PRODUCTION_ENTITLEMENT_SPKI_SHA256,
   suppliedConfigurationDigestMatches:configuredSecretDigest===null?null:true};
 }catch{return {ok:false,errorCategory:'invalid_signer_source'};}
 finally{der?.fill(0);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const args=process.argv.slice(2);
 const valid=args.length===0||(args.length===2&&args[0]==='--configured-secret-digest');
 const result=valid?signerPublicIdentity({configuredSecretDigest:args[1]??null}):{ok:false,errorCategory:'invalid_arguments'};
 process.stdout.write(JSON.stringify(result)+'\n');
 if(!result.ok)process.exitCode=1;
}
