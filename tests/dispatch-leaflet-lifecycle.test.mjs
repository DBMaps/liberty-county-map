import test, {before,after} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {previewServer} from '../tools/dispatch-ui/serve.mjs';
let browser,server,base;
before(async()=>{
 server=previewServer({demo:true});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,channel:process.env.DISPATCH_BROWSER_CHANNEL||'msedge'});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function visit(fn){
 const context=await browser.newContext(),errors=[];
 // Observe native cancellations before Leaflet captures its browser API references.
 await context.addInitScript(()=>{
  window.__canceledFrames=[];
  const cancel=window.cancelAnimationFrame.bind(window);
  window.cancelAnimationFrame=function(frame){window.__canceledFrames.push(frame);return cancel(frame);};
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push({message:error.message,stack:error.stack}));
 try{
  await page.goto(base+'/?demo=1');
  await page.getByRole('combobox',{name:'View',exact:true}).selectOption('split');
  await page.locator('[data-marker]').first().waitFor();
  await fn(page,errors);
  assert.deepEqual(errors,[],'No renderer exception may escape the Dispatch runtime');
 }finally{await context.close();}
}
// Native frame barriers, bounded by a failure deadline; no timing sleep or frame suppression.
const scenario=async(mode)=>{
 const frameBarrier=()=>new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>reject(new Error('Native frame barrier timed out')),3000);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(deadline);resolve();}));
 });
 const host=()=>{const div=document.createElement('div');div.style.cssText='width:400px;height:300px';document.body.append(div);return div;};
 let div=host(),map=L.map(div,{preferCanvas:true,zoomAnimation:false,fadeAnimation:false}).setView([30,-95],13);
 const line=L.polyline([[30,-95],[30.001,-95.001]]).addTo(map),renderer=map.getRenderer(line);
 const counts={clear:0,afterTeardown:0};let removed=false;
 const clear=renderer._clear;renderer._clear=function(...args){counts.clear++;if(removed)counts.afterTeardown++;return clear.apply(this,args);};
 const pending=renderer._redrawRequest;
 let result;
 try{
  if(mode==='teardown'){
   map.fire('moveend');
   const canceled=window.__canceledFrames.includes(pending);
   const requestAfterSync=renderer._redrawRequest;
   map.remove();removed=true;div.remove();
   await frameBarrier();
   result={pending,canceled,requestAfterSync,contextRemoved:!renderer._ctx,...counts};
  }else if(mode==='normal'){
   await frameBarrier();const first=counts.clear;
   line.setLatLngs([[30,-95],[30.002,-95.002]]);await frameBarrier();
   result={first,second:counts.clear,contextLive:!!renderer._ctx};
  }else if(mode==='postponed'){
   renderer._postponeUpdatePaths=true;renderer._updatePaths();
   const retained=renderer._redrawRequest===pending&&!window.__canceledFrames.includes(pending);
   renderer._postponeUpdatePaths=false;await frameBarrier();
   result={retained,clear:counts.clear,contextLive:!!renderer._ctx};
  }else if(mode==='reuse'){
   map.fire('moveend');map.remove();removed=true;div.remove();await frameBarrier();
   const stale=counts.afterTeardown;removed=false;div=host();
   map=L.map(div,{preferCanvas:true,zoomAnimation:false,fadeAnimation:false}).setView([30,-95],13);
   line.options.renderer=renderer;line.addTo(map);const first=counts.clear;await frameBarrier();
   line.setLatLngs([[30,-95],[30.003,-95.003]]);await frameBarrier();
   result={stale,reinitialized:!!renderer._ctx,redrawn:counts.clear>first,request:renderer._redrawRequest,first,clear:counts.clear};
  }
 }finally{if(!removed)map.remove();div.remove();}
 return result;
};
test('queued redraw is canceled before synchronous update and cannot clear after teardown',()=>visit(async(page,errors)=>{
 const result=await page.evaluate(scenario,'teardown');
 assert.deepEqual(errors,[],'Queued frame must not clear a destroyed canvas');
 assert.ok(Number.isInteger(result.pending)&&result.pending>0);
 assert.equal(result.canceled,true,'The original queued frame must be canceled');
 assert.equal(result.requestAfterSync,null);assert.equal(result.contextRemoved,true);
 assert.equal(result.afterTeardown,0);assert.ok(result.clear>0,'Synchronous redraw remains functional');
}));
test('normal canvas scheduling still renders initial and changed geometry',()=>visit(async page=>{
 const result=await page.evaluate(scenario,'normal');assert.ok(result.first>0);assert.ok(result.second>result.first);assert.equal(result.contextLive,true);
}));
test('postponed path updates retain their legitimate queued frame',()=>visit(async page=>{
 const result=await page.evaluate(scenario,'postponed');assert.equal(result.retained,true);assert.ok(result.clear>0);assert.equal(result.contextLive,true);
}));
test('canvas renderer can be removed and reused on a newly initialized map',()=>visit(async page=>{
 const result=await page.evaluate(scenario,'reuse');assert.equal(result.stale,0);assert.equal(result.reinitialized,true);assert.equal(result.redrawn,true,JSON.stringify(result));
}));
