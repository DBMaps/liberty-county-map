// Opt-in host-side interception contract; never imported by the consumer bundle.
// A native adapter must intercept the WHOLE owned fixture before networking starts.
import {createHash,timingSafeEqual} from 'node:crypto';
const ENDPOINT='https://static-map-tiles-api.arcgis.com';
const PATH=/^\/arcgis\/rest\/services\/static-basemap-tiles-service\/v1\/arcgis\/imagery\/labels\/static\/tile\/(?:0|[1-9]\d*)\/(?:0|[1-9]\d*)\/(?:0|[1-9]\d*)$/;
const CAPABILITY='gridly.native-label-interceptor.v1';
const safeOrigin=value=>{
  try{const u=new URL(value);if(u.username||u.password)return 'UNOBSERVABLE';
    const origin=u.protocol+'//'+u.host;
    return ['https://localhost','capacitor://localhost','http://localhost:5500','http://127.0.0.1:5500'].includes(origin)?origin:'OTHER_ORIGIN';
  }catch{return 'UNOBSERVABLE';}
};
const digest=value=>createHash('sha256').update(value).digest();
const equivalent=(a,b)=>timingSafeEqual(digest(a),digest(b));
const safeStatus=value=>Number.isInteger(value)&&value>=100&&value<=599?value:null;
const pngSignature=Buffer.from([137,80,78,71,13,10,26,10]);
export function pngTileValid(bytes) {
  if(!Buffer.isBuffer(bytes)||bytes.length<45||bytes.length>2*1024*1024||!bytes.subarray(0,8).equals(pngSignature))return false;
  let offset=8,ihdr=false,idat=false,iend=false;
  while(offset+12<=bytes.length){
    const length=bytes.readUInt32BE(offset),end=offset+12+length;if(end>bytes.length)return false;
    const type=bytes.toString('ascii',offset+4,offset+8);
    let crc=0xffffffff;for(const n of bytes.subarray(offset+4,offset+8+length)){crc^=n;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
    if(((crc^0xffffffff)>>>0)!==bytes.readUInt32BE(offset+8+length))return false;
    if(!ihdr){if(type!=='IHDR'||length!==13||bytes.readUInt32BE(offset+8)!==512||bytes.readUInt32BE(offset+12)!==512)return false;ihdr=true;}
    else if(type==='IHDR')return false;
    if(type==='IDAT')idat=true;
    if(type==='IEND'){if(length!==0||end!==bytes.length)return false;iend=true;}
    offset=end;
  }
  // Structural/CRC validation only; native image decoding/rendering is separate.
  return ihdr&&idat&&iend&&offset===bytes.length;
}

export function createLabelDiagnostic({mode,platform,runId,candidateToken,interceptor,ledger,observeContext}={}) {
  const fail=code=>{throw Error(code);};
  if(mode!=='OWNER_ISOLATED_NATIVE_LABEL_DIAGNOSTIC'||!['android','ios'].includes(platform)||!/^synthetic-[a-z0-9-]{1,60}$|^owner-[a-f0-9]{32}$/.test(runId||'')||typeof candidateToken!=='string'||!candidateToken||typeof observeContext!=='function')fail('DIAGNOSTIC_EXPLICIT_ACTIVATION_REQUIRED');
  if(interceptor?.capability!==CAPABILITY||interceptor.beforeFirstNetwork!==true||interceptor.wholeContext!==true||interceptor.retriesDisabled!==true||interceptor.redirectsDisabled!==true||interceptor.reconnectPreservesLedger!==true||typeof interceptor.install!=='function')fail('DIAGNOSTIC_NATIVE_INTERCEPTION_UNAVAILABLE');
  if(ledger?.capability!=='gridly.durable-atomic-label-budget.v1'||typeof ledger.reserve!=='function'||typeof ledger.stop!=='function'||typeof ledger.read!=='function')fail('DIAGNOSTIC_DURABLE_BUDGET_REQUIRED');
  const scope=platform+':'+runId;
  let armed=false,stopped=false,inflight=false,installed=false;
  const evidence=[];
  const deny=()=>Object.freeze({action:'ABORT',status:'BLOCKED'});
  const stop=async code=>{stopped=true;armed=false;try{await ledger.stop(scope);}catch{};return Object.freeze({status:code});};
  async function beforeDispatch(request) {
    if(!installed||!armed||stopped||inflight)return deny();
    let url;
    try {url=new URL(request.url);}catch{return deny();}
    // Only the candidate, documented endpoint, GET, and token query are accepted.
    if(url.origin!==ENDPOINT||url.username||url.password||url.hash||!PATH.test(url.pathname)||request.method!=='GET'||
      [...url.searchParams.keys()].join(',')!=='token')return deny();
    if(!equivalent(url.searchParams.get('token')||'',candidateToken)){await stop('CREDENTIAL_MISMATCH');return deny();}
    inflight=true;
    try {
      const reservation=await ledger.reserve(scope,2);
      if(!reservation||reservation.allowed!==true||!Number.isInteger(reservation.ordinal)||reservation.ordinal<1||reservation.ordinal>2){await stop('BUDGET_EXHAUSTED');return deny();}
      let context;
      try{context=await observeContext();}catch{await stop('CONTEXT_UNAVAILABLE');inflight=false;return deny();}
      const actualOrigin=safeOrigin(context?.origin);
      if(actualOrigin!==(platform==='android'?'https://localhost':'capacitor://localhost')){await stop('CONTEXT_UNAVAILABLE');inflight=false;return deny();}
      const headers=request.headers;
      const referer=typeof headers?.get==='function'?headers.get('referer'):null;
      const origin=typeof headers?.get==='function'?headers.get('origin'):null;
      evidence.push(Object.freeze({request:reservation.ordinal,platform,origin:actualOrigin,
        referer:referer===null?'UNOBSERVABLE':safeOrigin(referer),requestOrigin:origin===null?'UNOBSERVABLE':safeOrigin(origin),
        httpStatus:null,contentType:null,tileValidity:'PENDING',rendering:'UNVERIFIED'}));
      return Object.freeze({action:'CONTINUE_UNMODIFIED',ordinal:reservation.ordinal,maxRetries:0,maxRedirects:0});
    }catch{await stop('BUDGET_UNAVAILABLE');return deny();}
    finally{if(!evidence.length||evidence.at(-1)?.tileValidity!=='PENDING')inflight=false;}
  }
  async function afterResponse({ordinal,status,contentType,bytes,rendered}={}) {
    const index=evidence.findIndex(x=>x.request===ordinal&&x.tileValidity==='PENDING');
    if(index<0){await stop('UNEXPECTED_RESPONSE');inflight=false;return Object.freeze({status:'STOPPED'});}
    const type=typeof contentType==='string'?contentType.split(';')[0].trim().toLowerCase():'';
    const valid=status===200&&type==='image/png'&&pngTileValid(bytes);
    evidence[index]=Object.freeze({...evidence[index],httpStatus:safeStatus(status),contentType:type==='image/png'?'image/png':'UNEXPECTED',tileValidity:valid?'PNG_STRUCTURE_AND_CRC_PASS':'FAIL',rendering:rendered===true?'PASS':'UNVERIFIED'});
    inflight=false;
    if(!valid)return stop('STOPPED_ON_ERROR');
    if(ordinal===2)return stop('BUDGET_EXHAUSTED');
    return Object.freeze({status:'PASS'});
  }
  return Object.freeze({
    async install(){if(installed||stopped)fail('DIAGNOSTIC_ALREADY_INSTALLED');
      try{await interceptor.install({beforeDispatch,afterResponse,onError:()=>stop('STOPPED_ON_TRANSPORT_ERROR'),denyAllOtherRequests:true});installed=true;}
      catch{stopped=true;fail('DIAGNOSTIC_INTERCEPTION_INSTALL_FAILED');}
      return Object.freeze({status:'INSTALLED_UNARMED'});},
    async arm(){if(!installed||stopped||armed)fail('DIAGNOSTIC_ARM_REJECTED');let state;try{state=await ledger.read(scope);}catch{fail('DIAGNOSTIC_BUDGET_UNAVAILABLE');}
      if(!state||state.stopped||!Number.isInteger(state.count)||state.count<0||state.count>=2)fail('DIAGNOSTIC_ARM_REJECTED');armed=true;return Object.freeze({status:'ARMED'});},
    stop:()=>stop('STOPPED_BY_OWNER'),
    evidence:()=>Object.freeze(evidence.map(x=>Object.freeze({...x}))),
    state:()=>Object.freeze({installed,armed,stopped,requestsObserved:evidence.length,nativeAdapterCertified:false})
  });
}
