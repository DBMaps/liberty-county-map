import {test} from 'node:test';
import assert from 'node:assert/strict';

test('opt-in iPhone probe reports only safe nonpurchase statuses and replays the same bound request',async()=>{
  const calls=[];
  const originalWindow=globalThis.window,originalLocation=globalThis.location,originalLog=console.log;
  let report;
  const result=new Promise(resolve=>{report=resolve;});
  try {
    globalThis.location={href:new URL('../index.html',import.meta.url).href};
    globalThis.window={Capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'ios',
      isPluginAvailable:name=>['CapacitorHttp','GridlyAppAttest'].includes(name),
      nativePromise:async(plugin,method,options)=>{
        calls.push({plugin,method,options});
        if(plugin==='GridlyAppAttest')return {type:'apple_initial',keyId:'synthetic-private-key-id',object:'synthetic-private-attestation'};
        if(options.url.endsWith('/subscription-challenge'))return {status:200,data:{challenge:'a'.repeat(43),
          expiresAt:new Date(Date.now()+90000).toISOString(),protocolVersion:'gridly-subscription-verification-v1'}};
        return {status:calls.filter(call=>call.options?.url?.includes('gridly-verify-apple-subscription')).length===1?502:401,
          data:{error:'verification_unavailable'}};
      }}};
    console.log=(label,value)=>{if(label==='LP24466P_PROBE')report(value);};
    await import(`../tools/lp24466p/apple-nonpurchase-probe.js?case=${Date.now()}`);
    const logged=await Promise.race([result,new Promise((_,reject)=>setTimeout(()=>reject(Error('probe_timeout')),3000))]);
    assert.deepEqual(JSON.parse(logged),{stage:'complete',challenge:'shape_and_expiry_valid',nativeType:'apple_initial',
      firstStatus:502,replayStatus:401,paidProofReturned:false});
    assert.equal(calls.length,4);
    assert.equal(calls[0].plugin,'CapacitorHttp');
    assert.equal(calls[1].plugin,'GridlyAppAttest');
    assert.equal(calls[2].options.data,calls[3].options.data);
    assert.doesNotMatch(logged,/synthetic-private|"a{43}"|invalid\.invalid\.invalid/);
  } finally {
    globalThis.window=originalWindow;globalThis.location=originalLocation;console.log=originalLog;
  }
});
