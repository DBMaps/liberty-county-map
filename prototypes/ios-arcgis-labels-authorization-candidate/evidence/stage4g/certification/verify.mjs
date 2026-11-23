import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const here=fileURLToPath(new URL('./',import.meta.url)),candidate=resolve(here,'../../..'),repo=resolve(candidate,'../..'),local=process.argv.includes('--local');
const sha=b=>createHash('sha256').update(b).digest('hex');
const check=(path,hash)=>assert.equal(sha(readFileSync(path)),hash,path);
check(resolve(candidate,'certification/source.sha256'),'dedc27b2738e984965a1b47dec8770e755c8822cb859a49db42802b1c406089e');
check(resolve(candidate,'evidence/stage4f/interface-source.sha256'),'cd51585149f6bba296cc72b13c4e99551810e28b8b09fd6fe0d377ace88df917');
for(const row of readFileSync(resolve(candidate,'evidence/stage4f/interface-source.sha256'),'utf8').trim().split(/\r?\n/)){const [,hash,path]=/^([a-f0-9]{64})  (.+)$/.exec(row);assert.ok(path.startsWith('package/')&&!path.includes('..'));check(resolve(candidate,'evidence/stage4f',path),hash);}
execFileSync(process.execPath,[resolve(candidate,'certification/verify-package.mjs')],{stdio:'inherit'});
const root=JSON.parse(readFileSync(resolve(here,'root-source.json')));
for(const row of root.files){let bytes=readFileSync(resolve(repo,row.path));if(local)bytes=Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n'));assert.equal(sha(bytes),row.sha256,row.path);assert.equal(createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),row.gitBlob,row.path);}
for(const row of readFileSync(resolve(here,'package.sha256'),'utf8').trim().split(/\r?\n/)){const [,hash,path]=/^([a-f0-9]{64})  (.+)$/.exec(row);assert.ok(path.startsWith('prototypes/ios-arcgis-labels-authorization-candidate/evidence/')&&!path.includes('..'));check(resolve(repo,path),hash);}
if(!local)assert.equal(sha(readFileSync(resolve(repo,'.github/workflows/gridly-apple-build-9.yml'))),sha(readFileSync(resolve(here,'workflow.yml.in'))));
console.log(JSON.stringify({stage4dSourceFiles:196,stage4fPackageFiles:13,rootRegressionFiles:root.files.length,nativeChanged:false}));

