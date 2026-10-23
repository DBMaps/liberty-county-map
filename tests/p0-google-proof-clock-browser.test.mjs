import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile} from 'node:fs/promises';
import {join,resolve,extname} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from '@playwright/test';
import {writeProofClockWeb,prepareProofClockAndroid} from '../tools/entitlement/prepare-proof-clock-android.mjs';
test('Chromium runs exact Build14 UNKNOWN and repaired proof-clock acceptance/security cases',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'gridly-proof-clock-'));
 await writeProofClockWeb(directory);
 const server=createServer(async(req,res)=>{
  try{const path=new URL(req.url,'http://localhost').pathname,file=resolve(directory,'.'+path);
   if(!file.startsWith(directory+'/')&&!file.startsWith(directory+'\\'))throw Error();
   res.setHeader('Content-Type',extname(file)==='.html'?'text/html':'text/javascript');res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await page.goto(origin+'/cert/index.html');await page.locator('#run').click();
  await page.waitForFunction(()=>!!window.__p0ClockCertification);
  const result=await page.evaluate(()=>window.__p0ClockCertification);
  assert.equal(result.checks.length,24);assert.equal(result.allPassed,true,JSON.stringify(result));
  assert.equal(result.liveProviderTested,false);assert.equal(result.productionSignerIdentityVerified,false);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
test('owner Android CERT has separate identity, no production plugins/secrets, release guard and exact corrected source',async()=>{
 const output=resolve('.artifacts/p0-google-access/android-proof-clock-cert-'+process.pid);
 const result=await prepareProofClockAndroid(output);
 assert.equal(result.applicationId,'com.gridlygo.proofclockcert');assert.equal(result.productionBackendConfigured,false);
 const gradle=await readFile(join(output,'android/app/build.gradle'),'utf8');
 assert.match(gradle,/cannot build Release/);assert.doesNotMatch(gradle,/GRIDLY_RELEASE|billingclient|play:integrity/);
 const activity=await readFile(join(output,'android/app/src/main/java/com/gridlygo/proofclockcert/MainActivity.kt'),'utf8');
 assert.match(activity,/check\(BuildConfig.DEBUG\)/);assert.doesNotMatch(activity,/GridlyPlayBilling|GridlyPlayIntegrity/);
 const source=await readFile('js/gridly-entitlement.mjs');
 assert.deepEqual(await readFile(join(output,'android/app/src/main/assets/public/js/gridly-entitlement.mjs')),source);
});
