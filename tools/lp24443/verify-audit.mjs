// Audit artifact validation only; no application, provider or database execution.
import fs from 'node:fs';
import cp from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const baseline='647c85a30d042a90276c3915ba92538df78ddf1c';
const docs=['TRAVEL-AWARENESS-NOTIFICATIONS-HAZARD-AUDIT','NOTIFICATION-ARCHITECTURE','TRAVEL-CONTEXT-MODEL','HAZARD-ADVISORY-TAXONOMY','WINTER-HAZARD-READINESS','IMPLEMENTATION-SEQUENCE'].map(x=>`docs/launch/LP24443-${x}.md`);
const inventory=JSON.parse(fs.readFileSync('reports/lp24443-current-capability-inventory.json','utf8'));
const gaps=JSON.parse(fs.readFileSync('reports/lp24443-launch-gap-matrix.json','utf8'));
assert.equal(gaps.features.length,12);
const allowed=new Set(['READY TO IMPLEMENT','PARTIAL FOUNDATION','NET NEW','BLOCKED BY NATIVE CONFIG','BLOCKED BY BACKEND','BLOCKED BY PRODUCT DECISION']);
for(const f of gaps.features)for(const status of [f.primary,...f.additional])assert.ok(allowed.has(status),status);
let references=0;
for(const file of docs){
  const text=fs.readFileSync(file,'utf8');assert.ok(text.length>4000,file);
  for(const match of text.matchAll(/\]\(([^)]+)\)/g)){
    const link=match[1];if(/^https?:/.test(link))continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(file),link)),`${file}: broken ${link}`);
  }
}
for(const f of gaps.features)for(const reference of f.evidence){
  const match=reference.match(/^(.*):(\d+)$/);assert.ok(match,reference);
  assert.ok(fs.readFileSync(match[1],'utf8').split(/\r?\n/).length>=Number(match[2]),reference);references++;
}
const main=fs.readFileSync(docs[0],'utf8');
for(let i=1;i<=45;i++)assert.ok(new RegExp(`\\| ${i} `).test(main),`missing request part ${i}`);
const changed=cp.execFileSync('git',['diff','--name-only',baseline],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
assert.ok(changed.every(p=>/^docs\/launch\/LP24443-|^reports\/lp24443-|^tools\/lp24443\//i.test(p)),`non-audit changed paths: ${changed}`);
const tests=fs.readFileSync('reports/lp24443-existing-tests.txt','utf8');
assert.match(tests,/tests 92/);assert.match(tests,/pass 91/);assert.match(tests,/fail 1/);assert.match(tests,/deterministic drift/);
const runtimeDelivery=inventory.results.delivery.filter(x=>/^(js\/|android\/|ios\/|supabase\/)|^service-worker/.test(x.file));
assert.equal(runtimeDelivery.length,0);
const testFiles=['lp2419-home-area-selection-simplification.test.mjs','lp240x1-governed-home-identity-repair.test.mjs','lp2444-2-native-search-geolocation-runtime.test.mjs','lp2448-route-publication-ownership.test.mjs','lp1782-statewide-route-intelligence-geometry-bridge.test.mjs','lp1783-route-aware-incident-hydration.test.mjs','lp1784-live-proximity-route-intelligence.test.mjs','lp1785-live-route-progress-propagation.test.mjs','lp1786-cleared-route-convergence.test.mjs','lp237-community-hazard-identity-lifecycle.test.cjs','lp165/statewide-notification-certification.test.mjs','lp2413-weather-startup-authority.test.cjs'].map(x=>`tests/${x}`);
const result={audit:'LP244.43',baseline,artifactValidation:'PASS',documents:docs,requestPartsCovered:45,featureCount:12,evidenceReferencesValidated:references,inventory:{tracked:inventory.trackedFiles,scanned:inventory.scannedTextFiles,excluded:inventory.skipped.length},testCommand:['node','--test',...testFiles].join(' '),existingTestResult:{total:92,pass:91,fail:1,exitCode:1,failure:'LP165 historical protected-artifact hash drift'},runtimeChanges:false,nativeBuildPerformed:false,productionAccessPerformed:false,gitPushPerformed:false,mergePerformed:false,scope:'Repository/static and extracted-function tests; no physical delivery certification'};
fs.writeFileSync('reports/lp24443-audit-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
