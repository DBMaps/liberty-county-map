import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from '@playwright/test';

test('deferred paid runtime finishes app.js evaluation before DOM-ready initializers run',async()=>{
  const root=process.cwd();
  const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
  const server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+sep))throw Error();
      res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
      res.end(await readFile(file));
    }catch{res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:')?route.continue():route.abort());
    await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',async route=>route.fulfill({contentType:'text/javascript',body:await readFile(resolve(root,'node_modules/leaflet/dist/leaflet.js'))}));
    await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',async route=>route.fulfill({contentType:'text/css',body:await readFile(resolve(root,'node_modules/leaflet/dist/leaflet.css'))}));
    await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',async route=>route.fulfill({contentType:'text/javascript',body:await readFile(resolve(root,'node_modules/@supabase/supabase-js/dist/umd/supabase.js'))}));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    const result=await page.evaluate(async()=>{
      const {loadPaidRuntime}=await import('/js/gridly-paid-startup.mjs');
      await loadPaidRuntime({document,window,allowed:()=>true,timeoutMs:5000});
      await new Promise(resolve=>setTimeout(resolve,2000));
      return {
        prepaintLocked:document.documentElement.classList.contains('gridly-prepaint-lock'),
        presentationOwned:document.body.classList.contains('gridly-v2-presentation-owner-active'),
        portraitHidden:document.getElementById('gridlyPortraitV2')?.hidden
      };
    });
    assert.deepEqual(result,{prepaintLocked:false,presentationOwned:true,portraitHidden:false});
    assert.deepEqual(errors,[]);
  }finally{
    await browser?.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
