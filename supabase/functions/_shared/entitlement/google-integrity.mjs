const PACKAGE = 'com.gridlygo.gridly';
export const GOOGLE_PLAY_CLOUD_PROJECT_ID = 'gridly-play-billing';
export const GOOGLE_PLAY_CLOUD_PROJECT_NUMBER = '219024907806';
const ENDPOINT = `https://playintegrity.googleapis.com/v1/${PACKAGE}:decodeIntegrityToken`;

async function boundedJson(response) {
  const reader=response.body?.getReader();if(!reader)throw Error();
  const chunks=[];let size=0;
  try {for(let i=0;i<256;i++){const {done,value}=await reader.read();if(done){const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return JSON.parse(new TextDecoder().decode(bytes));}
    size+=value.length;if(size>16384)throw Error();chunks.push(value);}throw Error();}
  finally {void reader.cancel().catch(()=>{});}
}

// Decode occurs only on the server. A Play verdict is never subscriber ownership.
/** @param {{accessToken?: unknown, fetchImpl?: typeof fetch, now?: () => number, acceptedEnvironment?: string, acceptedVersionCodes?: readonly string[]}} options */
export function createGoogleIntegrityVerifier({accessToken,fetchImpl=fetch,now=Date.now,acceptedEnvironment='production',acceptedVersionCodes}={}) {
  return integrityVerifier({accessToken,fetchImpl,now,acceptedEnvironment,acceptedVersionCodes,review:false});
}

// Dedicated review authority does not depend on a reviewer Google account.
// Normal subscription admission continues to require LICENSED. Review requires
// the exact Play-signed production app/build plus its bound fresh challenge.
/** @param {{accessToken?: unknown, fetchImpl?: typeof fetch, now?: () => number}} options */
export function createGoogleReviewIntegrityVerifier({accessToken,fetchImpl=fetch,now=Date.now}={}) {
  return integrityVerifier({accessToken,fetchImpl,now,acceptedEnvironment:'production',acceptedVersionCodes:['12'],review:true});
}
function integrityVerifier({accessToken,fetchImpl,now,acceptedEnvironment,acceptedVersionCodes,review}) {
  const versions=acceptedVersionCodes===undefined?null:
    Array.isArray(acceptedVersionCodes)&&acceptedVersionCodes.length>0&&acceptedVersionCodes.length<=8&&
    acceptedVersionCodes.every(value=>typeof value==='string'&&/^[1-9][0-9]{0,8}$/.test(value))?
      Object.freeze([...acceptedVersionCodes]):false;
  return Object.freeze({verify:async ({authorization,requestHash,environment})=>{
    try {
      if(typeof accessToken !== 'function' || versions===false ||
        !['production','sandbox/test'].includes(acceptedEnvironment) ||
        environment !== acceptedEnvironment || authorization?.type !== 'google_standard' ||
        typeof authorization.token !== 'string' || authorization.token.length<1 || authorization.token.length>16384 ||
        !/^[A-Za-z0-9_-]{43}$/.test(requestHash)) return null;
      const response=await fetchImpl(ENDPOINT,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),
        headers:{Authorization:`Bearer ${await accessToken()}`,'Content-Type':'application/json'},
        body:JSON.stringify({integrity_token:authorization.token})});
      if(!response.ok)return null;
      const payload=(await boundedJson(response))?.tokenPayloadExternal;
      const details=payload?.requestDetails,app=payload?.appIntegrity,device=payload?.deviceIntegrity,account=payload?.accountDetails;
      const at=Number(details?.timestampMillis),current=now();
      if(details?.requestPackageName!==PACKAGE || details?.requestHash!==requestHash ||
        !Number.isSafeInteger(at) || at>current+5000 || at<current-120000 ||
        app?.packageName!==PACKAGE || app?.appRecognitionVerdict!=='PLAY_RECOGNIZED' ||
        (versions!==null&&!versions.includes(app.versionCode)) ||
        (!review&&account?.appLicensingVerdict!=='LICENSED') ||
        (review&&(!Array.isArray(app.certificateSha256Digest)||!app.certificateSha256Digest.includes(
          btoa(String.fromCharCode(...'3763446a68e18349e0a3474e21d28a142746f30e4c22957baa930da23650913b'.match(/../g).map(value=>parseInt(value,16)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')))) ||
        !Array.isArray(device?.deviceRecognitionVerdict) || !device.deviceRecognitionVerdict.includes('MEETS_DEVICE_INTEGRITY')) return null;
      return Object.freeze({verified:true,platform:'google',kind:'google_standard'});
    } catch {return null;}
  }});
}
