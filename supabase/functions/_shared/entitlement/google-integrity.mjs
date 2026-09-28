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
export function createGoogleIntegrityVerifier({accessToken,fetchImpl=fetch,now=Date.now}={}) {
  return Object.freeze({verify:async ({authorization,requestHash,environment})=>{
    try {
      if(typeof accessToken !== 'function' || environment !== 'production' || authorization?.type !== 'google_standard' ||
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
        account?.appLicensingVerdict!=='LICENSED' ||
        !Array.isArray(device?.deviceRecognitionVerdict) || !device.deviceRecognitionVerdict.includes('MEETS_DEVICE_INTEGRITY')) return null;
      return Object.freeze({verified:true,platform:'google',kind:'google_standard'});
    } catch {return null;}
  }});
}
