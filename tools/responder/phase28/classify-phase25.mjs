// Read Git objects into a disposable test directory; never check out or alter history.
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../../..');
const git=(...args)=>execFileSync('git',args,{cwd:root,windowsHide:true});
const testFile='tests/responder-phase25-production-shaped-neutral-migration-design.test.mjs';
const reportFile='reports/responder/responder-phase25-production-shaped-neutral-migration-design.json';
const actorFile='tools/responder/phase25/owner-decisions.md';
const revisions=['9917ceca','4f89805ed836ab6e73dc383d99a2f24d55d83f5f'];
const results=[];
for(const ref of revisions){
 const commit=git('rev-parse',ref).toString().trim();
 const directory=mkdtempSync(join(tmpdir(),'gridly-phase25-certification-'));
 const historicalManifest=JSON.parse(git('show',`${commit}:${reportFile}`));
 const files=[...new Set([...git('ls-tree','-r','--name-only',commit,'tools/responder/phase25',testFile,reportFile).toString().trim().split(/\r?\n/),...Object.keys(historicalManifest.design_artifact_hashes)])];
 for(const file of files){const target=join(directory,file);mkdirSync(dirname(target),{recursive:true});writeFileSync(target,git('show',`${commit}:${file}`))}
 const test=spawnSync(process.execPath,['--test','--test-reporter=tap',join(directory,testFile)],{encoding:'utf8',windowsHide:true});
 const manifest=JSON.parse(readFileSync(join(directory,reportFile)));
 const output=test.stdout+test.stderr;
 results.push({commit,exitCode:test.status,tests:Number(output.match(/# tests (\d+)/)?.[1]),passed:Number(output.match(/# pass (\d+)/)?.[1]),failed:Number(output.match(/# fail (\d+)/)?.[1]),expected:manifest.design_artifact_hashes[actorFile],actual:createHash('sha256').update(readFileSync(join(directory,actorFile))).digest('hex'),output,disposableDirectory:directory});
}
const current=spawnSync(process.execPath,['--test','--test-reporter=tap',testFile],{cwd:root,encoding:'utf8',windowsHide:true});
const report={classification:'KNOWN_PREEXISTING_NON_PHASE28_FAILURE',failingTest:'manifest counts and artifact hashes match the design package',path:actorFile,firstKnownReproducibleBaseline:results.find(r=>r.failed)?.commit,sourceCommit:results[0],startingHead:results[1],current:{exitCode:current.status,output:current.stdout+current.stderr},historicalFilesModified:false};
if(results[1].failed!==1||current.status!==1||results.some(r=>r.output.includes('ENOENT'))||!results[1].output.includes('ERR_ASSERTION')||results[1].expected===results[1].actual)throw Error('Classification requires investigation; baseline differs');
writeFileSync(join(root,'reports/responder/phase28-evidence/phase25-historical-classification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({classification:report.classification,sourcePassed:results[0].passed,sourceFailed:results[0].failed,startingPassed:results[1].passed,startingFailed:results[1].failed}));
