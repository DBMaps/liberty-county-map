import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {webcrypto as crypto,randomBytes} from 'node:crypto';
import {chromium} from '@playwright/test';
import {paidStartupFixtureModule} from './helpers/paid-startup-fixture.mjs';
import {pathToFileURL} from 'node:url';
const backendRoot=resolve(process.env.GRIDLY_REVIEW_BACKEND_ROOT||'.');
const {createGoogleReviewHandler,createGoogleReviewNativeAuthorizer}=await import(pathToFileURL(resolve(backendRoot,'supabase/functions/_shared/google-review.mjs')));
const {createGoogleReviewIntegrityVerifier}=await import(pathToFileURL(resolve(backendRoot,'supabase/functions/_shared/entitlement/google-integrity.mjs')));
const id='grr_'+'a'.repeat(32),code=id+'_'+'a'.repeat(43),revision='b'.repeat(32);

test('real Android reviewer form → signed authority → full Report UI → nonpublishing Submit; cold-open requires re-entry',{timeout:65000},async()=>{
  const exactPackage=!!process.env.GRIDLY_REVIEW_EXACT_ROOT;
  const root=resolve(process.env.GRIDLY_REVIEW_EXACT_ROOT||process.env.GRIDLY_REVIEW_TEST_ROOT||'.'),keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey),challenges=new Set(),events=[];
  const certificate=Buffer.from('3763446a68e18349e0a3474e21d28a142746f30e4c22957baa930da23650913b','hex').toString('base64url');
  const googleVerifier=createGoogleReviewIntegrityVerifier({accessToken:async()=>'offline',fetchImpl:async(url,options)=>{
    assert.match(url,/playintegrity.googleapis.com/);const hash=JSON.parse(options.body).integrity_token.slice(8);
    return Response.json({tokenPayloadExternal:{requestDetails:{requestPackageName:'com.gridlygo.gridly',requestHash:hash,timestampMillis:String(Date.now())},
      appIntegrity:{packageName:'com.gridlygo.gridly',appRecognitionVerdict:'PLAY_RECOGNIZED',versionCode:'14',certificateSha256Digest:[certificate]},
      deviceIntegrity:{deviceRecognitionVerdict:['MEETS_DEVICE_INTEGRITY']},accountDetails:{appLicensingVerdict:'UNLICENSED'}}});}});
  const handler=createGoogleReviewHandler({...keys,authorizeNative:createGoogleReviewNativeAuthorizer({googleVerifier,store:{consume:async({hash})=>challenges.delete(hash)}}),
    credentialAuthority:async({action,credentialId,digest,revision:rev})=>{
      if(credentialId!==id||action==='login'&&digest!==Buffer.from(await crypto.subtle.digest('SHA-256',Buffer.from(code))).toString('hex')||action!=='login'&&rev!==revision)return null;
      if(action==='verified')events.push('verified');if(action==='report')events.push('report');
      return {credentialId:id,credentialRevision:revision};
    },reportingStatus:async()=>({reporting_enabled:true,protocol_version:2})});
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;
    try {
      if(path==='/fixture/challenge') {
        const challenge=randomBytes(32).toString('base64url');challenges.add(Buffer.from(await crypto.subtle.digest('SHA-256',Buffer.from(challenge))).toString('base64url'));
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify({challenge,expiresAt:new Date(Date.now()+120000).toISOString(),protocolVersion:'gridly-subscription-verification-v1'}));return;
      }
      if(path==='/fixture/review') {
        let body='';for await(const part of req)body+=part;const response=await handler(new Request('https://fixture.test/review',{method:'POST',body}));
        res.writeHead(response.status,{'Content-Type':'application/json'});res.end(await response.text());return;
      }
      if(!exactPackage&&path==='/js/gridly-paid-config.mjs'){res.setHeader('Content-Type','text/javascript');res.end(paidStartupFixtureModule());return;}
      if(path==='/js/gridly-entitlement-public-key.mjs'){res.setHeader('Content-Type','text/javascript');res.end(`export const importProductionEntitlementKey=()=>crypto.subtle.importKey('jwk',${JSON.stringify(jwk)},{name:'ECDSA',namedCurve:'P-256'},false,['verify']);`);return;}
      const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+sep))throw Error();let bytes=await readFile(file);
      if(path==='/')bytes=bytes.toString().replace('</body>','<script type="application/gridly-protected">window.__protectedStarted=true;</script></body>');
      res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    const networkWrites=[];
    await page.route('**/*',async route=>{
      const url=route.request().url();
      if(url.startsWith('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'))return route.fulfill({path:resolve('node_modules/leaflet/dist/leaflet.js'),contentType:'text/javascript'});
      if(url.startsWith('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'))return route.fulfill({path:resolve('node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'});
      if(url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'))return route.fulfill({path:resolve('node_modules/@supabase/supabase-js/dist/umd/supabase.js'),contentType:'text/javascript'});
      if(url.includes('/rest/v1/rpc/get_community_reporting_status'))return route.fulfill({contentType:'application/json',body:'{"protocol_version":2,"reporting_enabled":true}'});
      if(url.includes('/functions/v1/gridly-google-review-access')){
        const body=route.request().postDataJSON();networkWrites.push(body);
        const response=await handler(new Request('https://fixture.test/review',{method:'POST',body:JSON.stringify(body)}));
        return route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
      }
      if(url.includes('/rest/v1/reports')&&route.request().method()==='GET')return route.fulfill({contentType:'application/json',body:'[]'});
      if(new URL(url).origin===origin)return route.continue();
      if(route.request().method()!=='GET')networkWrites.push({unexpected:url});return route.abort();
    });
    await page.addInitScript(()=>{
      localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');localStorage.setItem('gridlyEntitled','true');
      window.__paidStartupOptions={};window.__nativeRequests=[];
      window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'android',isPluginAvailable:name=>['GridlyPlayBilling','GridlyPlayIntegrity','CapacitorHttp'].includes(name),
        Plugins:{GridlyPlayBilling:{addListener:async()=>({remove:async()=>{}}),startObserving:async()=>({}),getProducts:async()=>({result:'available',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),queryCurrentPurchases:async()=>({result:'no_evidence'}),restorePurchases:async()=>({result:'no_evidence'}),purchase:async()=>{throw Error('Purchase is forbidden in reviewer certification');}},GridlyPlayIntegrity:{prepare:async()=>({prepared:true}),authorize:async({digest})=>({type:'google_standard',token:'fixture.'+digest})}},
        nativePromise:async(plugin,method,options)=>{
          if(plugin!=='CapacitorHttp'||method!=='request')throw Error();window.__nativeRequests.push(options.url);
          const path=options.url==='https://gridlygo.com/subscription-challenge'?'/fixture/challenge':options.url==='https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-google-review-access'?'/fixture/review':null;
          if(!path)throw Error();const response=await fetch(path,{method:'POST',body:options.data});return {status:response.status,data:await response.text()};
        }};
    });
    await page.goto(origin+'/?paid=true');await page.locator('#gridlyPaidEntryActions:not([hidden])').waitFor();
    assert.equal(await page.evaluate(()=>!!window.__protectedStarted),false);
    await page.getByText('App Review Access',{exact:true}).click();
    await page.getByLabel('Reviewer access code').fill(id+'_'+'b'.repeat(43));await page.getByRole('button',{name:'Open review access'}).click();
    await page.getByText('Review access could not be verified. Check the code and try again.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>!!window.__protectedStarted),false);
    await page.getByLabel('Reviewer access code').fill(code);await page.getByRole('button',{name:'Open review access'}).click();
    await page.waitForFunction(()=>window.__protectedStarted&&!document.documentElement.classList.contains('gridly-paid-locked'));
    assert.deepEqual(events,['verified']);assert.equal(await page.evaluate(()=>window.gridlyPaidReporting.isReviewActive()),true);
    assert.equal(await page.locator('#gridlyGoogleReviewCode').inputValue(),'');
    assert.equal(await page.evaluate(code=>Object.values(localStorage).some(value=>value.includes(code)),code),false);
    assert.equal(await page.evaluate(()=>window.__nativeRequests.some(url=>url.includes('verify-google-subscription'))),false);
    await page.waitForFunction(()=>typeof map!=='undefined'&&map);
    await page.locator('[data-v2-sheet="report"]').first().tap();
    await page.locator('[data-v2-action="report-select-hazard"][data-hazard-type="flooding"]').tap();
    await page.locator('[data-v2-action="report-tap-map"]').tap();
    await page.waitForFunction(()=>reportingState.placementModeActive);
    assert.equal(await page.evaluate(()=>localStorage.getItem('gridlyPendingCommunityOperationV1')),null);
    const chosen=await page.evaluate(()=>{
      snapHazardToRoad=async(lat,lng)=>({lat:lat+.001,lng:lng+.001,invalid:false,selectedRoadName:'Fixture road'});
      window.gridlyUgcCompliance={ensureAccepted:async()=>true};
      const top=document.querySelector('#gridlyPortraitV2 .gridly-v2-segments').getBoundingClientRect().bottom;
      const bottom=document.querySelector('#gridlyPortraitV2 .gridly-v2-bottom-region').getBoundingClientRect().top;
      return {x:Math.round(innerWidth/2),y:Math.round((top+bottom)/2)};
    });
    await page.touchscreen.tap(chosen.x,chosen.y);await page.locator('[data-v2-report-review]').waitFor({state:'visible'});
    assert.equal(networkWrites.length,0,'review/location selection does not submit');
    const storageBefore=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
    await page.locator('[data-v2-action="report-confirm-governed-draft"]').click();
    try {await page.waitForFunction(()=>document.getElementById('gridlyV2ParticipationAcknowledgement')?.textContent.includes('Review mode — report validated but not published.'),{},{timeout:8000});}
    catch(error){console.log(JSON.stringify({errors,requests:networkWrites.map(({proof,...body})=>body),feedback:await page.evaluate(()=>({text:document.getElementById('gridlyV2ParticipationAcknowledgement')?.textContent,state:reportingState}))}));throw error;}
    await page.waitForFunction(()=>!reportingState.submissionInProgress);
    assert.equal(networkWrites.length,1);assert.equal(networkWrites[0].operation,'submit_community_observation');assert.equal(networkWrites[0].protocol_version,2);
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage))),storageBefore,'review Submit persists no pending operation/history/report payload');
    assert.equal(await page.evaluate(()=>activeHazards.length+activeReports.length),0,'review Submit creates no local incident');
    assert.equal(await page.locator('#gridlyRetryPendingReport').count(),0);
    assert.equal(await page.evaluate(()=>window.gridlyGovernedRoadHazardReportDraft),null);
    await page.screenshot({path:resolve('.artifacts/android-review14/review-submit-validated.png')});
    await page.reload();await page.locator('#gridlyPaidEntryActions:not([hidden])').waitFor();assert.equal(await page.evaluate(()=>!!window.__protectedStarted),false);
    await page.close();
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
