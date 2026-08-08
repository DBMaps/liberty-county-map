import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { ROOT, SOURCE, PACKAGE, LIMIT_BYTES, build, deterministicGzip, packageAsset } from '../../tools/lp1833/repair-pages-artifact.mjs';
import { canonicalBlob } from '../../tools/lp18321/git-asset-identity.mjs';

test('Montgomery package regenerates byte-identically and preserves its source',()=>{const generated=packageAsset(ROOT);assert.deepEqual(deterministicGzip(canonicalBlob(ROOT,SOURCE)),generated);assert.ok(generated.length<LIMIT_BYTES);});
test('artifact is runtime-evidence-driven and Pages compatible',()=>{const made=build();assert.equal(made.compatibility.oversizedFileCount,0);assert.ok(Object.values(made.compatibility.proofs).every(Boolean));assert.notEqual(made.compatibility.artifactIdentity,made.transition.priorLp1831ArtifactIdentity);});
test('Montgomery loader is integrity checked, explicit gzip, and fail closed',()=>{const app=fs.readFileSync(`${ROOT}/js/app.js`,'utf8');assert.match(app,/gridlyDecodeMontgomeryRoadwayPackage/);for(const proof of ['DecompressionStream("gzip")','crypto.subtle.digest','compressed_size_mismatch','digest_mismatch','uncompressed_size_mismatch','TextDecoder("utf-8", { fatal: true })','roadway_dataset_not_feature_collection'])assert.ok(app.includes(proof),proof);assert.doesNotMatch(app,/roadSegmentsPath: "assets\/county-implementation\/montgomery\/runtime-assets\/montgomery-roads-raw\.geojson"/);});
test('service worker has no oversized asset or compressed roadway precache reference',()=>{const sw=fs.readFileSync(`${ROOT}/service-worker.js`,'utf8');assert.doesNotMatch(sw,/fra-crossings-tx|harris-48201|montgomery-roads-(?:raw|lp1833)/);});
test('artifact inventory cannot admit arbitrary untracked files',()=>{const arbitrary=`${ROOT}/assets/lp1833-arbitrary-untracked.txt`;fs.writeFileSync(arbitrary,'must not stage');try{assert.equal(build().compatibility.fileCount,493);assert.equal(build().compatibility.proofs.montgomeryCompressedPresent,true);}finally{fs.rmSync(arbitrary,{force:true});}});
