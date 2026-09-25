import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {root,out,artifacts,write} from './inventory.mjs';
const require=createRequire(import.meta.url),session=await require('./session.cjs')({fixtureWeather:true,fixtureReports:true});
const evidence={sourceHash:crypto.createHash('sha256').update(fs.readFileSync(`${root}/js/app.js`)).digest('hex'),viewports:[]};
try {
 const {page,evidence:network}=await session.newPage();evidence.network=network;
 await page.addScriptTag({path:`${root}/tools/lp24449a/runtime-probe.js`});
 await page.evaluate(()=>lp24449a.settle());
 const saved=await page.evaluate(()=>localStorage.getItem('gridlySavedPlacesV1'));
 await page.evaluate(()=>document.getElementById('mobileDestinationCommandBtn').click());
 await page.locator('[data-saved-place-role="home"]').waitFor({state:'visible'});
 await page.locator('[data-saved-place-role="work"]').waitFor({state:'visible'});
 for(const width of [320,360,390,440]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const state=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,rows:[...document.querySelectorAll('#gridlySearchResults [data-saved-place-role]')].map(n=>({role:n.dataset.savedPlaceRole,text:n.innerText,rect:n.getBoundingClientRect().toJSON()}))}));
  for(const role of ['home','work']){const row=state.rows.find(r=>r.role===role);assert.ok(row,`${role} is rendered`);assert.ok(row.rect.height>=44,`${role} tap height`);assert.ok(row.rect.left>=0&&row.rect.right<=width,`${role} stays inside viewport`);assert.match(row.text,new RegExp(role,'i'));}
  const ordered=state.rows.slice().sort((a,b)=>a.rect.top-b.rect.top);for(let i=1;i<ordered.length;i++)assert.ok(ordered[i].rect.top>=ordered[i-1].rect.bottom-1,'Saved-place rows do not overlap');
  assert.ok(state.documentWidth<=width,'No document horizontal overflow');
  evidence.viewports.push(state);await page.screenshot({path:`${artifacts}/saved-places-${width}.png`});
 }
 assert.equal(await page.evaluate(()=>localStorage.getItem('gridlySavedPlacesV1')),saved);
 assert.equal(network.errors.length,0);evidence.passed=true;console.log('Saved Home/Work layout and storage pass at 320/360/390/440px.');
}catch(error){evidence.failure=String(error.stack);console.error(error);process.exitCode=1;}finally{write(`${out}/freeze-saved-places.json`,evidence);await session.close();}
