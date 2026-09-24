import fs from 'node:fs';import crypto from 'node:crypto';import {read,write,out} from './inventory.mjs';
const repair=read('reports/lp24449b1/repair.json'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');let restored=fs.readFileSync('js/app.js','utf8');
const currentHash=hash(restored),edits=[];
for(const edit of repair.edits){const matches=restored.split(edit.next).length-1;if(matches!==1)throw Error(`Repair fragment count ${matches}`);restored=restored.replace(edit.next,edit.old);edits.push({oldAnchor:edit.old.split('\n')[0],matches});}
const report={currentHash,expectedFinalHash:repair.finalSha256,inMemoryReverseHash:hash(restored),expectedStartingHash:repair.startingSha256,edits,passed:currentHash===repair.finalSha256&&hash(restored)===repair.startingSha256,policy:'Reverse the four recorded B1 substitutions in memory only, then compare the exact original dirty49B SHA-256. No workspace file is restored or rewritten.'};
write(`${out}/bounded-diff-proof.json`,report);console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
