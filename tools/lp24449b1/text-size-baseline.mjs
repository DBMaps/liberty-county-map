import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {root,out,artifacts,write} from './inventory.mjs';
const require=createRequire(import.meta.url),runs=[];
for(const baseline of [true,false]){
 const session=await require('./session.cjs')({baseline,fixtureWeather:true,fixtureReports:true});
 try{
  const {page}=await session.newPage();await page.setViewportSize({width:320,height:844});
  await page.evaluate(()=>document.getElementById('gridlySettingsDockButton').click());
  const summary=page.locator('#gridlyPortraitV2Sheet summary').filter({hasText:'Appearance'});
  if(!await summary.evaluate(n=>n.parentElement.open))await summary.evaluate(n=>n.click());
  await page.locator('[data-gridly-settings-text-size-option="large"]').evaluate(n=>n.click());
  await page.locator('.settings-display-choice').first().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>[...document.querySelectorAll('.settings-display-choice [role=radio]')].every(n=>n.getBoundingClientRect().height>=44));
  await page.locator('[data-gridly-settings-text-size-option="large"]').scrollIntoViewIfNeeded();
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const controls=await page.locator('[data-gridly-settings-text-size-option]').evaluateAll(nodes=>nodes.map(n=>{const range=document.createRange();range.selectNodeContents(n);const r=n.getBoundingClientRect(),t=range.getBoundingClientRect(),s=getComputedStyle(n);return {label:n.textContent.trim(),width:r.width,height:r.height,textWidth:t.width,font:s.font,overflow:s.overflow,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth};}));
  const screenshot=`${artifacts}/text-size-${baseline?'baseline':'repaired'}-320-large.png`;await page.screenshot({path:screenshot});
  runs.push({baseline,sourceHash:crypto.createHash('sha256').update(fs.readFileSync(`${root}/${baseline?'.artifacts/lp24449b1/baseline-app.js':'js/app.js'}`)).digest('hex'),controls,screenshot});
 }finally{await session.close();}
}
const result={scope:'Compare observed 320 px large-text control clipping with exact starting source; no presentation repair.',runs,sameControlMetrics:JSON.stringify(runs[0].controls)===JSON.stringify(runs[1].controls)};
write(`${out}/text-size-baseline.json`,result);console.log(JSON.stringify(result));
