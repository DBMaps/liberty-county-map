import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeEdgeTransport} from '../js/gridly-native-edge-transport.mjs';

test('native transport uses fixed gateway/verifier routes and public routing key only',async()=>{
  const calls=[],transport=createNativeEdgeTransport({capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},
    fetchImpl:async(url,options)=>{calls.push({url,options});return Response.json(url.includes('subscription-challenge')
      ?{challenge:'a'.repeat(43),expiresAt:'2026-09-28T00:02:00Z',protocolVersion:'gridly-subscription-verification-v1'}
      :{proof:'synthetic'});}});
  assert.equal((await transport.requestChallenge({platform:'google'})).data.challenge,'a'.repeat(43));
  assert.equal((await transport.invoke('gridly-verify-google-subscription',{body:{platform:'google'}})).data.proof,'synthetic');
  assert.equal(calls[0].url,'https://gridlygo.com/subscription-challenge');
  assert.equal(calls[1].url,'https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-verify-google-subscription');
  assert.match(calls[1].options.headers.apikey,/^sb_publishable_/);
  assert.equal(calls[0].options.headers.apikey,undefined);
  assert.equal(calls[0].options.redirect,'manual');
  assert.throws(()=>transport.requestChallenge({platform:'apple'}),/verification_unavailable/);
  assert.throws(()=>transport.invoke('gridly-verify-apple-subscription',{body:{platform:'google'}}),/verification_unavailable/);
  assert.equal(createNativeEdgeTransport({capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'android'}}),null);
  assert.equal(createNativeEdgeTransport({capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'web'}}),null);
});
