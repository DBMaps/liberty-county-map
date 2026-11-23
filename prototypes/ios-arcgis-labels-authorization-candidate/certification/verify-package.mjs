// Portable hosted gate. Reads only packaged sources; never uses local C: paths or credentials.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {sourcePaths} from './manifest.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
const entries=readFileSync(resolve(root,'certification/source.sha256'),'utf8').trim().split(/\r?\n/);
assert.deepEqual(entries.map(row=>row.slice(66)),sourcePaths(),'unlisted or missing package source');
for(const row of entries){const [,hash,path]=/^([a-f0-9]{64})  (.+)$/.exec(row);assert.equal(sha(readFileSync(resolve(root,path))),hash,path);}
const refs=JSON.parse(readFileSync(resolve(root,'evidence/source-copies.json')));
for(const row of refs.files)assert.equal(sha(readFileSync(resolve(root,row.copy))),row.sha256,row.copy);
const pkg=readFileSync(resolve(root,'Package.swift'),'utf8');
assert.match(pkg,/\.iOS\("16\.4"\)/);assert.match(pkg,/exact: "8\.3\.4"/);assert.match(pkg,/swiftLanguageVersions: \[\.v5\]/);
assert.match(pkg,/\.product\(name: "Cordova", package: "capacitor-swift-pm"\)/);
const sdk=readFileSync(resolve(root,'certification/capacitor-8.3.4-Package.swift'),'utf8');
assert.match(sdk,/ab16c1187895c9d15692fca2ad8e483adb89cd76803a4069a220ba934a3bb190/);
assert.match(sdk,/700b28ca65630f512d03ecc13c855e870424ce2aa3030479c10ca6cbc1002d12/);
assert.equal(readdirSync(resolve(root,'native/Tests')).filter(p=>p.endsWith('.swift')).length,3);
for(const f of ['GridlyStoreKitPlugin.swift','GridlyAppAttestPlugin.swift']){
 const before=readFileSync(resolve(root,'reference/build18/ios/App/App',f),'utf8'),after=readFileSync(resolve(root,'native',f),'utf8');
 const methods=s=>[...s.matchAll(/CAPPluginMethod\(name: "([^"]+)"/g)].map(m=>m[1]);assert.deepEqual(methods(after),methods(before));
}
console.log(`${entries.length} certification source hashes and unchanged bridge contracts verified.`);
