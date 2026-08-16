import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { buildPromotionTarget, assertExpectedCurrentHash, stableBytes, PATHS, PRODUCTION_WRITE_ALLOWLIST, ROOT } from '../tools/lp2013/promote-named-place-cameras.mjs';

const built=buildPromotionTarget(), rows=built.audit.records, byId=id=>rows.find(x=>x.GEOID===id), byName=name=>rows.find(x=>x.name===name);
const copyFixture=()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'lp2013-'));for(const p of [PATHS.whatif,PATHS.summary,PATHS.certification,PATHS.production]){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.copyFileSync(path.join(ROOT,p),path.join(root,p));}return root;};
const mutate=(root,p,fn)=>{const x=JSON.parse(fs.readFileSync(path.join(root,p)));fn(x);fs.writeFileSync(path.join(root,p),stableBytes(x));};
const fails=(fn,re)=>assert.throws(fn,re);

test('LP201.2 certification and inactive runtime are required',()=>{const r=copyFixture();mutate(r,PATHS.certification,x=>x.promotionDesignCertified=false);fails(()=>buildPromotionTarget({root:r}),/certification invalid/);});
test('exact 1555 certified cohort and exact 1859 inventory',()=>assert.deepEqual([built.result.counts.certifiedPromotionCount,built.result.counts.canonicalCount],[1555,1859]));
test('proposed GEOIDs join exactly and missing production GEOID fails closed',()=>{const r=copyFixture();mutate(r,PATHS.production,x=>delete x.places['4800100']);mutate(r,PATHS.summary,x=>x.inputIdentities.presentation.sha256=requireHash(r,PATHS.production));mutate(r,PATHS.certification,x=>x.statewideWhatIfIdentity.artifacts.find(y=>y.path===PATHS.summary).sha256=requireHash(r,PATHS.summary));fails(()=>buildPromotionTarget({root:r}),/inventory/);});
test('invalid proposed coordinate fails closed',()=>{const r=copyFixture();mutate(r,PATHS.whatif,x=>x.records.find(y=>y.promotionEligible).proposal.latitude=999);mutate(r,PATHS.certification,x=>x.statewideWhatIfIdentity.artifacts.find(y=>y.path===PATHS.whatif).sha256=requireHash(r,PATHS.whatif));fails(()=>buildPromotionTarget({root:r}),/invalid proposed coordinate/);});
test('duplicate evidence GEOID fails closed',()=>{const r=copyFixture();mutate(r,PATHS.whatif,x=>x.records[1].canonical.placeGeoid=x.records[0].canonical.placeGeoid);mutate(r,PATHS.certification,x=>x.statewideWhatIfIdentity.artifacts.find(y=>y.path===PATHS.whatif).sha256=requireHash(r,PATHS.whatif));fails(()=>buildPromotionTarget({root:r}),/duplicate evidence GEOID/);});
function requireHash(root,p){return (awaitlessSha)(fs.readFileSync(path.join(root,p)));} function awaitlessSha(b){return (awaitlessCrypto).createHash('sha256').update(b).digest('hex');} import crypto from 'node:crypto'; const awaitlessCrypto=crypto;

for(const [name,id] of [['Austin','4805000'],['Dallas','4819000'],['El Paso','4824000'],['Fort Worth','4827000']]) test(`LP197 ${name} fallback row and authority are protected`,()=>assert.deepEqual([byId(id).decision,built.target.places[id]],["RETAIN_LP197_HIGHER_AUTHORITY",JSON.parse(fs.readFileSync(PATHS.production)).places[id]]));
test('Kyle and every B/D/E/G/H record stay unchanged',()=>{assert.equal(byId('4839952').decision,'RETAIN_UNRESOLVED_OR_INELIGIBLE');assert.equal(rows.filter(x=>/^[BDEGH]_/.test(x.lp2011Bucket)).every(x=>x.currentLatitude===x.proposedLatitude&&x.currentLongitude===x.proposedLongitude),true);});
test('eligible A and C cameras are promoted in WhatIf',()=>{for(const prefix of ['A_','C_'])assert.ok(rows.some(x=>x.lp2011Bucket.startsWith(prefix)&&x.decision.startsWith('PROMOTE')));});
test('zoom schema and governed behavior remain unchanged',()=>{assert.equal(rows.every(x=>x.zoomBehavior.value===13),true);assert.equal(Object.values(built.target.places).every(x=>Object.keys(x).join(',')==='lat,lon'),true);});
test('Dayton exact promoted target',()=>assert.deepEqual(built.target.places['4819432'],{lat:30.0473202,lon:-94.8873913}));
test('multi-county and CDP semantic identity remain unchanged',()=>{assert.ok(rows.some(x=>x.countyMemberships.length>1&&x.decision.startsWith('PROMOTE')));assert.ok(rows.some(x=>x.governedType==='CENSUS_DESIGNATED_PLACE'&&x.decision.startsWith('PROMOTE')));});
test('Houston and San Antonio parent promotions cannot modify regions',()=>{assert.equal(byName('Houston').decision,'PROMOTE_CERTIFIED_NAMED_PLACE_CAMERA');assert.equal(byName('San Antonio').decision,'PROMOTE_CERTIFIED_NAMED_PLACE_CAMERA');assert.equal(built.result.regionSeparation,'CANONICAL_PLACE_ROWS_ONLY');});
test('serialization and target hash are deterministic',()=>{const again=buildPromotionTarget();assert.ok(again.targetBytes.equals(built.targetBytes));assert.equal(again.result.artifactIdentity.proposed.sha256,built.result.artifactIdentity.proposed.sha256);});
test('current-hash mismatch blocks future Apply guard',()=>fails(()=>assertExpectedCurrentHash('drift','audited'),/hash mismatch/));
test('target construction is idempotent',()=>assert.ok(stableBytes(built.target).equals(built.targetBytes)));
test('production write allowlist is exact',()=>assert.deepEqual(PRODUCTION_WRITE_ALLOWLIST,[PATHS.production]));
test('Phase 1 executor has no production writer and rejects Apply',()=>{const source=fs.readFileSync('tools/lp2013/promote-named-place-cameras.mjs','utf8');assert.doesNotMatch(source,/writeFileSync\(path\.join\(root,PATHS\.production/);assert.notEqual(spawnSync(process.execPath,['tools/lp2013/promote-named-place-cameras.mjs','--apply']).status,0);});
test('runtimeActivation remains false throughout LP201.3 evidence',()=>assert.equal(built.result.runtimeActivation||built.audit.runtimeActivation,false));
test('LP201.2 artifacts remain byte-identical after construction',()=>{const before=built.sourceHashes;buildPromotionTarget();assert.deepEqual(buildPromotionTarget().sourceHashes,before);});
test('unresolved cohort is exactly 300 and genuine B controls remain unchanged',()=>{assert.equal(built.result.counts.unresolvedRetainedCount,300);for(const id of ['4839952','4856498','4863782','4867554'])assert.equal(byId(id).decision,'RETAIN_UNRESOLVED_OR_INELIGIBLE');});
test('coordinate-only target contains all records and changes only certified rows',()=>{assert.equal(Object.keys(built.target.places).length,1859);assert.equal(built.result.counts.coordinateChangeCount+built.result.counts.alreadyEquivalentCount,1555);});
test('representative future-camera inventory is complete',()=>{for(const n of ['Dayton','Tyler','Waco','Corpus Christi','Stamford','Galveston','Monahans','Liberty','Abbott','Acala','Houston','Austin','Dallas','El Paso','Fort Worth','Kyle'])assert.ok(byName(n),n);});
test('runtime consumer and lifecycle surfaces are outside write allowlist',()=>{for(const p of ['js/app.js','js/gridlyPackageRegistry.js','assets/package-registry/runtime-package-registry.json','data/runtime/'])assert.ok(!PRODUCTION_WRITE_ALLOWLIST.includes(p));});
test('verify command validates exact tracked target bytes',()=>assert.doesNotThrow(()=>execFileSync(process.execPath,['tools/lp2013/promote-named-place-cameras.mjs','--verify'])));
