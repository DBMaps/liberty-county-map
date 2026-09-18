import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
const css=readFileSync('public-site/assets/site.css','utf8');
const html=readFileSync('public-site/index.html','utf8');
const mobile=css.slice(css.indexOf('@media (max-width: 736px)'),css.indexOf('@media (max-width: 34rem)'));
test('LP244.42B iOS autosizing is explicit and zoom remains accessible',()=>{
 assert.match(css,/html\s*\{[^}]*-webkit-text-size-adjust:\s*100%;\s*text-size-adjust:\s*100%/);
 assert.match(html,/<meta name="viewport" content="width=device-width, initial-scale=1">/);
 assert.doesNotMatch(html+css,/user-scalable\s*=\s*no|maximum-scale\s*=|text-size-adjust:\s*none|overflow-x:\s*hidden|transform:\s*scale/);
});
test('LP244.42B mobile image and wordmark caps are independent of root text size',()=>{
 for(const rule of [/\.device-frame\s*\{\s*width: 240px/,/\.product-evidence > img\s*\{[^}]*max-width: 280px/,/\.journey-evidence img\s*\{[^}]*max-width: 280px/,/\.footer-brand img\s*\{[^}]*max-width: min\(100%, 120px\)/,/\.texas-figure\s*\{[^}]*max-width: 232px/])assert.match(mobile,rule);
 assert.match(mobile,/min-height: 44px/);
});
test('LP244.42B preserves approved desktop rules and all content',()=>{
 const old=execFileSync('git',['show','93dc3753:public-site/assets/site.css'],{encoding:'utf8'}).replaceAll('\r\n','\n');
 const strip=s=>s.replace(/\/\* LP244\.42B:[\s\S]*?\*\/\s*/,'').replace(/@media \(max-width: (?:46rem|736px)\)[\s\S]*?(?=@media \(max-width: 34rem\))/,'').replace('-webkit-text-size-adjust: 100%; text-size-adjust: 100%; ','').replaceAll('\r\n','\n');
 assert.equal(strip(css),strip(old));
 assert.equal(html.replaceAll('\r\n','\n'),execFileSync('git',['show','93dc3753:public-site/index.html'],{encoding:'utf8'}).replaceAll('\r\n','\n'));
 for(const text of ['See community-reported conditions and help keep local information current.','For adults 18 and over.','Coming soon to the Apple App Store and Google Play.','Your trip.<br>Your decision.'])assert.ok(html.includes(text));
});
